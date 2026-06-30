import {
  Body,
  Controller,
  Param,
  Post,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt/jwt.guard';
import { CurrentUserDecorator } from '../common/decorators/current-user.decorator';
import { MustChangePasswordGuard } from '../common/guards/must-change-password.guard';
import { TenantMemberGuard } from '../common/guards/tenant-member.guard';
import type { CurrentUser } from '../common/types/current-user';
import { ExportListViewDto } from './dto/export-list-view.dto';
import { ExportService } from './export.service';

@UseGuards(JwtAuthGuard, TenantMemberGuard, MustChangePasswordGuard)
@Controller('tenant/exports')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Post('list-views/:id/excel')
  async exportListViewExcel(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: ExportListViewDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = await this.exportService.exportListViewExcel(user, id, dto);

    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Length', file.buffer.length);
    res.setHeader(
      'Content-Disposition',
      this.contentDisposition(file.fileName),
    );

    return new StreamableFile(file.buffer);
  }

  private contentDisposition(fileName: string) {
    const fallback = fileName.replace(/[^\x20-\x7e]/g, '_');
    const encoded = encodeURIComponent(fileName);

    return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
  }
}
