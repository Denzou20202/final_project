import { Module } from '@nestjs/common';
import { ArticleImagesController } from './article-images.controller.js';
import { ArticleImagesService } from './article-images.service.js';
import { PublicImagesController } from './public-images.controller.js';
import { S3Service } from './s3.service.js';

@Module({
  controllers: [ArticleImagesController, PublicImagesController],
  providers: [ArticleImagesService, S3Service],
})
export class ArticleImagesModule {}
