// src/purchase-order/dto/query-purchase-order.dto.ts
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import {
  PurchaseOrderSourceType,
  PurchaseOrderStatus,
} from '../../generated/prisma/client';

export class QueryPurchaseOrderDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pageSize = 20;
  @IsOptional() @IsString() keyword?: string;
  @IsOptional() @IsEnum(PurchaseOrderStatus) status?: PurchaseOrderStatus;
  @IsOptional()
  @IsEnum(PurchaseOrderSourceType)
  sourceType?: PurchaseOrderSourceType;
  @IsOptional() @IsString() supplierId?: string;
  @IsOptional() @IsString() ownerUserId?: string;
  @IsOptional() @IsString() currencyCode?: string;
  @IsOptional() @IsDateString() createdFrom?: string;
  @IsOptional() @IsDateString() createdTo?: string;
}
