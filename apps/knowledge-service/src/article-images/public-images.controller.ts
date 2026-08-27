import { Controller, Get, Header, Param, StreamableFile } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ArticleImagesService } from './article-images.service.js';

// No auth — embedded inline in published FAQ articles, which anonymous
// visitors need to keep loading indefinitely. Cache-Control is safe to set
// aggressively: keys are content-addressed by a fresh uuid per upload, never
// reused, so nothing ever needs to invalidate a cached copy.
@ApiTags('public-images')
@Controller('public/images')
export class PublicImagesController {
  constructor(private readonly articleImagesService: ArticleImagesService) {}

  @Get(':key')
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  @Header('X-Content-Type-Options', 'nosniff')
  async getImage(@Param('key') key: string): Promise<StreamableFile> {
    const { body, contentType } = await this.articleImagesService.getImage(key);
    return new StreamableFile(body, { type: contentType });
  }
}
