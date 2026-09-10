import { CurrentUser, JwtAuthGuard } from '@veloxdesk/common';
import type { JwtPayload } from '@veloxdesk/common';
import {
  BadRequestException,
  Body,
  Controller,
  FileTypeValidator,
  Get,
  Header,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  ParseUUIDPipe,
  Post,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { ALLOWED_MIME_TYPES, ATTACHMENT_MAX_SIZE_BYTES } from './attachment-mime-types.js';
import { AttachmentsService } from './attachments.service.js';
import { UploadAttachmentDto } from './dto/upload-attachment.dto.js';

const MAX_FILE_SIZE_BYTES = ATTACHMENT_MAX_SIZE_BYTES;

// NestJS's built-in validators are solid (FileTypeValidator's magic-number
// sniffing in particular isn't worth reimplementing) but their generated
// messages are raw, English, developer-facing text — never meant to reach
// an end user (see ChatPanel's getErrorMessage, which used to show these
// verbatim). Both validators' messages have a distinct, stable prefix
// ("current file size is" / "current file type is"), which is all that's
// needed to tell them apart and attach a stable `code` the frontend maps to
// a translated string via i18n — the raw text still travels in `message`
// too, for anyone hitting the API directly / reading server logs.
export function attachmentValidationExceptionFactory(error: string): never {
  const code = error.includes('current file size') ? 'ATTACHMENT_TOO_LARGE' : 'ATTACHMENT_UNSUPPORTED_TYPE';
  throw new BadRequestException({ message: error, code });
}

// RFC 6266/5987: filename* carries the real (possibly non-ASCII) name for
// browsers that understand it; the quoted `filename=` fallback is ASCII-only
// and never contains a raw '"' or control character, so neither field can
// be used to inject anything into the header. Needed here (unlike the
// fixed-name CSV/XML exports elsewhere in the app) because this is the one
// download endpoint that reflects a real, attacker-influenceable, possibly
// Cyrillic filename.
function attachmentContentDisposition(fileName: string): string {
  const asciiFallback = fileName.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, "'") || 'file';
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

@ApiTags('attachments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  // defParamCharset: multer/busboy decode Content-Disposition's filename=
  // param as Latin-1 by default (a real multer option, not a typo — see its
  // own doc comment) even though every modern browser actually sends raw
  // UTF-8 bytes there with no charset marker. Left at the default, any
  // non-ASCII filename (Cyrillic, etc.) gets stored corrupted byte-for-byte
  // ("mojibake") from the moment it's uploaded — this is the fix, not a
  // display-side one; the frontend just renders whatever fileName the API
  // returns.
  @Post('tickets/:ticketId/attachments')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { defParamCharset: 'utf8' }))
  upload(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @UploadedFile(
      new ParseFilePipe({
        exceptionFactory: attachmentValidationExceptionFactory,
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_FILE_SIZE_BYTES }),
          // Magic-number sniffing first (stronger for images/pdf/zip/docx);
          // plain text/CSV have no detectable signature, so fall back to the
          // client-supplied mimetype for those rather than rejecting them.
          new FileTypeValidator({ fileType: ALLOWED_MIME_TYPES, fallbackToMimetype: true }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Body() body: UploadAttachmentDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.attachmentsService.upload(ticketId, file, actor, body.commentId);
  }

  @Get('tickets/:ticketId/attachments')
  list(@Param('ticketId', ParseUUIDPipe) ticketId: string, @CurrentUser() actor: JwtPayload) {
    return this.attachmentsService.list(ticketId, actor);
  }

  // Returns the actual bytes, not a redirect to a presigned URL — MinIO
  // (S3_ENDPOINT="minio:9000") is only ever reachable from inside the
  // Docker network, never from a real browser, so a presigned URL just
  // 404s as ERR_NAME_NOT_RESOLVED no matter how it's signed. The frontend
  // fetches this with its Authorization header (a plain <a href>/<img src>
  // can't carry one) and turns the response into a blob URL — whether that
  // ends up forcing a save-as or displaying inline is decided there, not
  // by anything this endpoint sets.
  @Get('attachments/:id/download')
  @Header('X-Content-Type-Options', 'nosniff')
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: JwtPayload,
  ): Promise<StreamableFile> {
    const { body, contentType, fileName } = await this.attachmentsService.getFile(id, actor);
    // disposition forces a save-as regardless of contentType — belt-and-
    // suspenders alongside AttachmentsService's own content-type allowlist
    // check: even if some future caller of this endpoint ever rendered the
    // response inline instead of via a blob (the two current frontends
    // don't), an HTML/SVG payload could never execute in this origin's
    // context.
    return new StreamableFile(body, { type: contentType, disposition: attachmentContentDisposition(fileName) });
  }
}
