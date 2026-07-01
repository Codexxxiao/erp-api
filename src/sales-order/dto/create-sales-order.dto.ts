// src/sales-order/dto/create-sales-order.dto.ts
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { SalesOrderStatus } from '../../generated/prisma/client';
import { SalesOrderItemInputDto } from './sales-order-item-input.dto';

export class CreateSalesOrderDto {
  @IsOptional() @IsString() orderNo?: string;
  @IsOptional() @IsString() contractId?: string;
  @IsOptional() @IsString() quotationId?: string;
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsString() customerName?: string;
  @IsOptional() @IsString() customerContactId?: string;
  @IsOptional() @IsString() customerContactName?: string;
  @IsString() subject: string;
  @IsOptional() @IsEnum(SalesOrderStatus) status?: SalesOrderStatus;
  @IsString() currencyCode: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) exchangeRate?: number;
  @IsOptional() @IsString() tradeTerm?: string;
  @IsOptional() @IsString() paymentTerm?: string;
  @IsOptional() @IsDateString() expectedDeliveryDate?: string;
  @IsOptional() @IsString() ownerUserId?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) freightAmount?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) otherAmount?: number;
  @IsOptional() @IsString() remark?: string;
  @IsOptional() @IsObject() extra?: Record<string, unknown>;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SalesOrderItemInputDto)
  items?: SalesOrderItemInputDto[];
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachmentFileIds?: string[];
}
