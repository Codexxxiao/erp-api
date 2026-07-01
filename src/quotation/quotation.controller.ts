import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt/jwt.guard';
import { TenantMemberGuard } from '../common/guards/tenant-member.guard';
import { MustChangePasswordGuard } from '../common/guards/must-change-password.guard';
import { CurrentUserDecorator } from '../common/decorators/current-user.decorator';
import type { CurrentUser } from '../common/types/current-user';
import { QuotationService } from './quotation.service';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';
import { QueryQuotationDto } from './dto/query-quotation.dto';
import { ChangeQuotationStatusDto } from './dto/change-quotation-status.dto';
import { ReplaceQuotationItemsDto } from './dto/replace-quotation-items.dto';
import { CreateQuotationFromInquiryDto } from './dto/create-quotation-from-inquiry.dto';

@UseGuards(JwtAuthGuard, TenantMemberGuard, MustChangePasswordGuard)
@Controller('tenant/quotations')
export class QuotationController {
  constructor(private readonly service: QuotationService) {}

  @Post()
  create(
    @CurrentUserDecorator() user: CurrentUser,
    @Body() dto: CreateQuotationDto,
  ) {
    return this.service.create(user, dto);
  }

  @Post('from-inquiry/:inquiryId')
  createFromInquiry(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('inquiryId') inquiryId: string,
    @Body() dto: CreateQuotationFromInquiryDto,
  ) {
    return this.service.createFromInquiry(user, inquiryId, dto);
  }

  @Get()
  findMany(
    @CurrentUserDecorator() user: CurrentUser,
    @Query() query: QueryQuotationDto,
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
    @Body() dto: UpdateQuotationDto,
  ) {
    return this.service.update(user, id, dto);
  }

  @Put(':id/items')
  replaceItems(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: ReplaceQuotationItemsDto,
  ) {
    return this.service.replaceItems(user, id, dto);
  }

  @Post(':id/status')
  changeStatus(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: ChangeQuotationStatusDto,
  ) {
    return this.service.changeStatus(user, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUserDecorator() user: CurrentUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}
