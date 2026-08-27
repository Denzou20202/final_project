import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class S3Service implements OnModuleInit {
  private readonly logger = new Logger(S3Service.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: ConfigService) {
    this.bucket = config.get<string>('S3_BUCKET', 'veloxdesk-attachments');
    // S3_APP_ACCESS_KEY/S3_APP_SECRET_KEY — a scoped MinIO user (see
    // infra/minio-provision-app-user.sh), NOT S3_ACCESS_KEY/S3_SECRET_KEY,
    // which are the MinIO ROOT credentials (used only to bootstrap the
    // minio container itself — see docker-compose.prod.yml's minio:
    // service). This app used to authenticate as root, meaning a
    // compromise of this service inherited full admin control over the
    // whole MinIO instance instead of just this one bucket. Deliberately no
    // fallback to the root vars here — a silent fallback would defeat the
    // point and hide a misconfiguration behind a working-by-accident state.
    const accessKeyId = config.get<string>('S3_APP_ACCESS_KEY', '');
    const secretAccessKey = config.get<string>('S3_APP_SECRET_KEY', '');
    if (!accessKeyId || !secretAccessKey) {
      this.logger.error('S3_APP_ACCESS_KEY/S3_APP_SECRET_KEY are not set — all S3 operations will fail with AccessDenied');
    }
    this.client = new S3Client({
      endpoint: config.get<string>('S3_ENDPOINT', 'http://localhost:9000'),
      region: config.get<string>('S3_REGION', 'us-east-1'),
      // MinIO serves buckets as path segments, not subdomains.
      forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  // MinIO doesn't auto-provision buckets the way managed S3 setups often do
  // in prod — create it on boot if missing so local/dev doesn't need a
  // separate provisioning step.
  async onModuleInit(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      try {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.logger.log(`Created S3 bucket "${this.bucket}"`);
      } catch (err) {
        this.logger.error(`Failed to create S3 bucket "${this.bucket}"`, err as Error);
      }
    }
  }

  async upload(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }

  // No presigned URL: S3_ENDPOINT is the Docker-internal "minio:9000" —
  // resolvable by this container, never by an actual user's browser (a
  // presigned URL just embeds that same unreachable host, so it 404s as
  // ERR_NAME_NOT_RESOLVED no matter how the signature/headers are set).
  // Fetching the bytes server-side and streaming them back through our own
  // already-public API route is the only way this reaches a real browser —
  // same reasoning as knowledge-service's article-images S3Service.
  async download(key: string): Promise<{ body: Buffer; contentType: string }> {
    try {
      const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      if (!result.Body) {
        throw new NotFoundException('File not found');
      }
      const body = Buffer.from(await result.Body.transformToByteArray());
      return { body, contentType: result.ContentType ?? 'application/octet-stream' };
    } catch {
      throw new NotFoundException('File not found');
    }
  }

  // Best-effort cleanup (called from ticket hard-delete): the DB row is
  // already gone via cascade by the time this runs, so a failure here would
  // leave an orphaned object, not a dangling reference — log and swallow
  // rather than propagate, callers should never fail the delete over this.
  async deleteObject(key: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (err) {
      this.logger.warn(`Failed to delete S3 object "${key}": ${(err as Error).message}`);
    }
  }
}
