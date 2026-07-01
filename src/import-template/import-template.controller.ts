import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt/jwt.guard';
import { TenantMemberGuard } from '../common/guards/tenant-member.guard';
import { MustChangePasswordGuard } from '../common/guards/must-change-password.guard';
import { CurrentUserDecorator } from '../common/decorators/current-user.decorator';
import type { CurrentUser } from '../common/types/current-user';
import { CreateImportTemplateDto } from './dto/create-import-template.dto';
import { QueryImportTemplateDto } from './dto/query-import-template.dto';
import { UpdateImportTemplateDto } from './dto/update-import-template.dto';
import { ImportTemplateService } from './import-template.service';

@UseGuards(JwtAuthGuard, TenantMemberGuard, MustChangePasswordGuard)
@Controller('tenant/import-templates')
export class ImportTemplateController {
  constructor(private readonly service: ImportTemplateService) {}

  @Post()
  create(
    @CurrentUserDecorator() user: CurrentUser,
    @Body() dto: CreateImportTemplateDto,
  ) {
    return this.service.create(user, dto);
  }

  @Get()
  findMany(
    @CurrentUserDecorator() user: CurrentUser,
    @Query() query: QueryImportTemplateDto,
  ) {
    return this.service.findMany(user, query);
  }

  @Get(':id')
  findOne(@CurrentUserDecorator() user: CurrentUser, @Param('id') id: string) {
    return this.service.findOne(user, id);
  }

  @Patch(':id')
  update(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: UpdateImportTemplateDto,
  ) {
    return this.service.update(user, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUserDecorator() user: CurrentUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }

  @Post(':id/set-default')
  setDefault(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.service.setDefault(user, id);
  }
}
