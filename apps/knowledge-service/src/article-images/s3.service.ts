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

// Same MinIO instance/bucket ticket-service's S3Service uses (see
// apps/ticket-service/src/attachments/s3.service.ts) — services can't
// import each other's app-local code in this NX layout, so this is a
// deliberate duplicate, not a fork. KB image keys are flat (no "/"), while
// ticket attachment keys always start with "<ticketId>/", so the two
// namespaces share the bucket without ever colliding.
@Injectable()
export class S3Service implements OnModuleInit {
  private readonly logger = new Logger(S3Service.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: ConfigService) {
    this.bucket = config.get<string>('S3_BUCKET', 'veloxdesk-attachments');
    // See ticket-service's identical S3Service for the full rationale:
    // S3_APP_ACCESS_KEY/S3_APP_SECRET_KEY is a scoped MinIO user, not the
    // root credentials (S3_ACCESS_KEY/S3_SECRET_KEY, used only to bootstrap
    // the minio container itself). No fallback to the root vars on purpose.
    const accessKeyId = config.get<string>('S3_APP_ACCESS_KEY', '');
    const secretAccessKey = config.get<string>('S3_APP_SECRET_KEY', '');
    if (!accessKeyId || !secretAccessKey) {
      this.logger.error('S3_APP_ACCESS_KEY/S3_APP_SECRET_KEY are not set — all S3 operations will fail with AccessDenied');
    }
    this.client = new S3Client({
      endpoint: config.get<string>('S3_ENDPOINT', 'http://localhost:9000'),
      region: config.get<string>('S3_REGION', 'us-east-1'),
      forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

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
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }));
  }

  // No presigned URL here on purpose: an embedded image in a published
  // article has to keep loading indefinitely for anonymous FAQ visitors,
  // not expire after a few minutes like ticket-service's download links do.
  // Fetching the bytes server-side and streaming them back through our own
  // public route keeps MinIO itself off the public internet entirely.
  async download(key: string): Promise<{ body: Buffer; contentType: string }> {
    try {
      const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      if (!result.Body) {
        throw new NotFoundException('Image not found');
      }
      const body = Buffer.from(await result.Body.transformToByteArray());
      return { body, contentType: result.ContentType ?? 'application/octet-stream' };
    } catch {
      throw new NotFoundException('Image not found');
    }
  }

  // Best-effort cleanup (called from ArticlesService.remove) — same
  // reasoning as ticket-service's identical S3Service.deleteObject: by the
  // time this runs, the referencing DB row is already gone, so a failure
  // here leaves an orphaned object, not a dangling reference. Log and
  // swallow rather than propagate — the article delete should never fail
  // over an image cleanup miss.
  async deleteObject(key: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (err) {
      this.logger.warn(`Failed to delete S3 object "${key}": ${(err as Error).message}`);
    }
  }
}
