import {
  Body,
  Controller,
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
import { RuntimeFormService } from './runtime-form.service';
import { CreateFormRecordDto } from './dto/create-form-record.dto';
import { UpdateFormRecordDto } from './dto/update-form-record.dto';
import { QueryFormRecordDto } from './dto/query-form-record.dto';

@UseGuards(JwtAuthGuard, TenantMemberGuard, MustChangePasswordGuard)
@Controller('tenant/form-records')
export class RuntimeFormController {
  constructor(private readonly runtimeFormService: RuntimeFormService) {}

  @Post()
  create(
    @CurrentUserDecorator() user: CurrentUser,
    @Body() dto: CreateFormRecordDto,
  ) {
    return this.runtimeFormService.create(user, dto);
  }

  @Get()
  findAll(
    @CurrentUserDecorator() user: CurrentUser,
    @Query() query: QueryFormRecordDto,
  ) {
    return this.runtimeFormService.findAll(user, query);
  }

  @Get(':id')
  findOne(@CurrentUserDecorator() user: CurrentUser, @Param('id') id: string) {
    return this.runtimeFormService.findOne(user, id);
  }

  @Patch(':id')
  update(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: UpdateFormRecordDto,
  ) {
    return this.runtimeFormService.update(user, id, dto);
  }

  @Patch(':id/submit')
  submit(@CurrentUserDecorator() user: CurrentUser, @Param('id') id: string) {
    return this.runtimeFormService.submit(user, id);
  }

  @Patch(':id/cancel')
  cancel(@CurrentUserDecorator() user: CurrentUser, @Param('id') id: string) {
    return this.runtimeFormService.cancel(user, id);
  }
}
