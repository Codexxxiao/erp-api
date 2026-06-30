import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt/jwt.guard';
import { CurrentUserDecorator } from '../common/decorators/current-user.decorator';
import type { CurrentUser } from '../common/types/current-user';
import { CreateFileRelationDto } from './dto/create-file-relation.dto';
import { QueryFileDto } from './dto/query-file.dto';
import { QueryFileRelationDto } from './dto/query-file-relation.dto';
import { UploadFileDto } from './dto/upload-file.dto';
import { FileService } from './file.service';

const uploadMaxSize = Number(process.env.FILE_MAX_SIZE ?? 20 * 1024 * 1024);

@UseGuards(JwtAuthGuard)
@Controller('tenant/files')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: uploadMaxSize },
    }),
  )
  upload(
    @CurrentUserDecorator() user: CurrentUser,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadFileDto,
  ) {
    return this.fileService.upload(user, file, dto);
  }

  @Get()
  findMany(
    @CurrentUserDecorator() user: CurrentUser,
    @Query() query: QueryFileDto,
  ) {
    return this.fileService.findMany(user, query);
  }

  @Get('relations')
  findRelations(
    @CurrentUserDecorator() user: CurrentUser,
    @Query() query: QueryFileRelationDto,
  ) {
    return this.fileService.findRelations(user, query);
  }

  @Get(':id/download')
  async download(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { file, stream } = await this.fileService.prepareDownload(user, id);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Length', String(file.size));
    res.setHeader(
      'Content-Disposition',
      this.contentDisposition(file.originalName),
    );
    return new StreamableFile(stream);
  }

  @Get(':id')
  findOne(@CurrentUserDecorator() user: CurrentUser, @Param('id') id: string) {
    return this.fileService.findOne(user, id);
  }

  @Delete(':id')
  remove(@CurrentUserDecorator() user: CurrentUser, @Param('id') id: string) {
    return this.fileService.remove(user, id);
  }

  @Post(':id/relations')
  createRelation(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: CreateFileRelationDto,
  ) {
    return this.fileService.createRelation(user, id, dto);
  }

  @Delete(':id/relations/:relationId')
  removeRelation(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Param('relationId') relationId: string,
  ) {
    return this.fileService.removeRelation(user, id, relationId);
  }

  private contentDisposition(filename: string) {
    const fallback = filename
      .replace(/[^\x20-\x7e]/g, '_')
      .replace(/["\\]/g, '_');
    return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
  }
}
