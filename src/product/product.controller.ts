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
import { CreateProductDto } from './dto/create-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateProductSupplierQuoteDto } from './dto/create-product-supplier-quote.dto';
import { UpdateProductSupplierQuoteDto } from './dto/update-product-supplier-quote.dto';
import { ProductService } from './product.service';

@UseGuards(JwtAuthGuard, TenantMemberGuard, MustChangePasswordGuard)
@Controller('tenant/products')
export class ProductController {
  constructor(private readonly service: ProductService) {}

  @Post()
  create(
    @CurrentUserDecorator() user: CurrentUser,
    @Body() dto: CreateProductDto,
  ) {
    return this.service.create(user, dto);
  }

  @Get()
  findMany(
    @CurrentUserDecorator() user: CurrentUser,
    @Query() query: QueryProductDto,
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
    @Body() dto: UpdateProductDto,
  ) {
    return this.service.update(user, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUserDecorator() user: CurrentUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }

  @Post(':id/supplier-quotes')
  createSupplierQuote(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: CreateProductSupplierQuoteDto,
  ) {
    return this.service.createSupplierQuote(user, id, dto);
  }

  @Patch(':id/supplier-quotes/:quoteId')
  updateSupplierQuote(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Param('quoteId') quoteId: string,
    @Body() dto: UpdateProductSupplierQuoteDto,
  ) {
    return this.service.updateSupplierQuote(user, id, quoteId, dto);
  }

  @Delete(':id/supplier-quotes/:quoteId')
  removeSupplierQuote(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Param('quoteId') quoteId: string,
  ) {
    return this.service.removeSupplierQuote(user, id, quoteId);
  }

  @Post(':id/supplier-quotes/:quoteId/set-default')
  setDefaultSupplierQuote(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Param('quoteId') quoteId: string,
  ) {
    return this.service.setDefaultSupplierQuote(user, id, quoteId);
  }
}
