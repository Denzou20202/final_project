import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { safeStoredImageContentType } from './article-image-mime-types.js';
import { S3Service } from './s3.service.js';

export interface UploadedImageFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

// Only word chars, dots, and dashes — this is a public, unauthenticated
// route, so the key must never be trusted as a raw S3 path segment without
// a sanity check first, even though normal route matching can't produce a
// "/" here in practice.
const SAFE_KEY = /^[\w.-]+$/;

@Injectable()
export class ArticleImagesService {
  constructor(private readonly s3Service: S3Service) {}

  async upload(file: UploadedImageFile): Promise<{ url: string }> {
    // extname() returns everything after the last dot, not a clean
    // extension — a real-world filename like "screenshot.jpeg (1)" (a
    // browser's own "duplicate download" naming) or "photo.png " (trailing
    // whitespace from a copy/paste) yields ".jpeg (1)"/".png ", which
    // contains characters SAFE_KEY (used by getImage() below on every
    // read) rejects. Without this check the upload silently "succeeds" but
    // the image 404s forever the moment anyone actually tries to load it.
    // Falling back to .png doesn't affect what's actually served — the
    // real Content-Type comes from S3 object metadata (file.mimetype
    // below), never from the key's extension.
    const rawExt = extname(file.originalname);
    const ext = rawExt && SAFE_KEY.test(rawExt) ? rawExt : '.png';
    const key = `${randomUUID()}${ext}`;
    // Never persist file.mimetype verbatim — see article-image-mime-types.ts.
    // This route is unauthenticated and unauthenticated-served on the public
    // FAQ, so a lying declared Content-Type here is the highest-impact
    // instance of this bug class in the app: it would reach every anonymous
    // visitor, not just staff who happen to open one ticket's attachment.
    await this.s3Service.upload(key, file.buffer, safeStoredImageContentType(file.mimetype));
    // Relative, not absolute — operator-app (authoring) and client-portal
    // (public viewing) are served from the same origin via nginx, so a
    // relative src resolves correctly from either.
    return { url: `/api/public/images/${key}` };
  }

  async getImage(key: string): Promise<{ body: Buffer; contentType: string }> {
    if (!SAFE_KEY.test(key)) {
      throw new NotFoundException('Image not found');
    }
    return this.s3Service.download(key);
  }
}
