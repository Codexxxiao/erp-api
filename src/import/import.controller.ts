import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt/jwt.guard';
import { TenantMemberGuard } from '../common/guards/tenant-member.guard';
import { MustChangePasswordGuard } from '../common/guards/must-change-password.guard';
import { CurrentUserDecorator } from '../common/decorators/current-user.decorator';
import type { CurrentUser } from '../common/types/current-user';
import { CreateImportTaskDto } from './dto/create-import-task.dto';
import { ExecuteImportTaskDto } from './dto/execute-import-task.dto';
import { PreviewImportTaskDto } from './dto/preview-import-task.dto';
import { QueryImportTaskDto } from './dto/query-import-task.dto';
import { ValidateImportTaskDto } from './dto/validate-import-task.dto';
import { ImportService } from './import.service';

@UseGuards(JwtAuthGuard, TenantMemberGuard, MustChangePasswordGuard)
@Controller('tenant/import-tasks')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post()
  create(
    @CurrentUserDecorator() user: CurrentUser,
    @Body() dto: CreateImportTaskDto,
  ) {
    return this.importService.createTask(user, dto);
  }

  @Get()
  findMany(
    @CurrentUserDecorator() user: CurrentUser,
    @Query() query: QueryImportTaskDto,
  ) {
    return this.importService.findMany(user, query);
  }

  @Get(':id')
  findOne(@CurrentUserDecorator() user: CurrentUser, @Param('id') id: string) {
    return this.importService.findOne(user, id);
  }

  @Get(':id/rows')
  findRows(@CurrentUserDecorator() user: CurrentUser, @Param('id') id: string) {
    return this.importService.findRows(user, id);
  }

  @Post(':id/preview')
  preview(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: PreviewImportTaskDto,
  ) {
    return this.importService.preview(user, id, dto);
  }

  @Post(':id/validate')
  validate(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: ValidateImportTaskDto,
  ) {
    return this.importService.validate(user, id, dto);
  }

  @Post(':id/execute')
  execute(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: ExecuteImportTaskDto,
  ) {
    return this.importService.execute(user, id, dto);
  }
}
