import { JwtAuthGuard, Roles, RolesGuard } from '@veloxdesk/common';
import { UserRole } from '@veloxdesk/types';
import {
  Controller,
  FileTypeValidator,
  MaxFileSizeValidator,
  ParseFilePipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { ALLOWED_IMAGE_MIME_TYPES } from './article-image-mime-types.js';
import { ArticleImagesService } from './article-images.service.js';

const MAX_IMAGE_SIZE_BYTES = 15 * 1024 * 1024;

@ApiTags('article-images')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OPERATOR, UserRole.ADMIN)
@Controller('articles/images')
export class ArticleImagesController {
  constructor(private readonly articleImagesService: ArticleImagesService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_IMAGE_SIZE_BYTES }),
          new FileTypeValidator({ fileType: ALLOWED_IMAGE_MIME_TYPES, fallbackToMimetype: true }),
        ],
      }),
    )
    file: Express.Multer.File,
  ): Promise<{ url: string }> {
    return this.articleImagesService.upload(file);
  }
}
