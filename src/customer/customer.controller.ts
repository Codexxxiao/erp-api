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
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { QueryCustomerDto } from './dto/query-customer.dto';
import { CustomerContactInputDto } from './dto/customer-contact-input.dto';
import { CreateCustomerFollowUpDto } from './dto/create-customer-follow-up.dto';
import { CustomerService } from './customer.service';

@UseGuards(JwtAuthGuard, TenantMemberGuard, MustChangePasswordGuard)
@Controller('tenant/customers')
export class CustomerController {
  constructor(private readonly service: CustomerService) {}

  @Post()
  create(
    @CurrentUserDecorator() user: CurrentUser,
    @Body() dto: CreateCustomerDto,
  ) {
    return this.service.create(user, dto);
  }

  @Get()
  findMany(
    @CurrentUserDecorator() user: CurrentUser,
    @Query() query: QueryCustomerDto,
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
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.service.update(user, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUserDecorator() user: CurrentUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }

  @Post(':id/contacts')
  createContact(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: CustomerContactInputDto,
  ) {
    return this.service.createContact(user, id, dto);
  }

  @Patch(':id/contacts/:contactId')
  updateContact(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Param('contactId') contactId: string,
    @Body() dto: CustomerContactInputDto,
  ) {
    return this.service.updateContact(user, id, contactId, dto);
  }

  @Delete(':id/contacts/:contactId')
  removeContact(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Param('contactId') contactId: string,
  ) {
    return this.service.removeContact(user, id, contactId);
  }

  @Post(':id/follow-ups')
  createFollowUp(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: CreateCustomerFollowUpDto,
  ) {
    return this.service.createFollowUp(user, id, dto);
  }

  @Get(':id/follow-ups')
  findFollowUps(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.service.findFollowUps(user, id);
  }
}
