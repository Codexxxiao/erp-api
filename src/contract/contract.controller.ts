// src/contract/contract.controller.ts
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
import { ContractService } from './contract.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { QueryContractDto } from './dto/query-contract.dto';
import { ChangeContractStatusDto } from './dto/change-contract-status.dto';
import { CreateContractFromQuotationDto } from './dto/create-contract-from-quotation.dto';

@UseGuards(JwtAuthGuard, TenantMemberGuard, MustChangePasswordGuard)
@Controller('tenant/contracts')
export class ContractController {
  constructor(private readonly service: ContractService) {}

  @Post() create(
    @CurrentUserDecorator() user: CurrentUser,
    @Body() dto: CreateContractDto,
  ) {
    return this.service.create(user, dto);
  }
  @Post('from-quotation/:quotationId') createFromQuotation(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('quotationId') quotationId: string,
    @Body() dto: CreateContractFromQuotationDto,
  ) {
    return this.service.createFromQuotation(user, quotationId, dto);
  }
  @Get() findMany(
    @CurrentUserDecorator() user: CurrentUser,
    @Query() query: QueryContractDto,
  ) {
    return this.service.findMany(user, query);
  }
  @Get(':id') findOne(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.service.findOne(user, id);
  }
  @Patch(':id') update(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: UpdateContractDto,
  ) {
    return this.service.update(user, id, dto);
  }
  @Post(':id/status') changeStatus(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: ChangeContractStatusDto,
  ) {
    return this.service.changeStatus(user, id, dto);
  }
  @Delete(':id') remove(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.service.remove(user, id);
  }
}
