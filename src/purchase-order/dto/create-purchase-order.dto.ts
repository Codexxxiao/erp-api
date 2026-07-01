// src/purchase-order/dto/create-purchase-order.dto.ts
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
import {
  PurchaseOrderSourceType,
  PurchaseOrderStatus,
} from '../../generated/prisma/client';
import { PurchaseOrderItemInputDto } from './purchase-order-item-input.dto';

export class CreatePurchaseOrderDto {
  @IsOptional() @IsString() purchaseOrderNo?: string;
  @IsOptional()
  @IsEnum(PurchaseOrderSourceType)
  sourceType?: PurchaseOrderSourceType;
  @IsOptional() @IsString() supplierId?: string;
  @IsOptional() @IsString() supplierName?: string;
  @IsOptional() @IsEnum(PurchaseOrderStatus) status?: PurchaseOrderStatus;
  @IsString() currencyCode: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) exchangeRate?: number;
  @IsOptional() @IsDateString() expectedDeliveryDate?: string;
  @IsOptional() @IsString() ownerUserId?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) freightAmount?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) otherAmount?: number;
  @IsOptional() @IsString() remark?: string;
  @IsOptional() @IsObject() extra?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemInputDto)
  items?: PurchaseOrderItemInputDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachmentFileIds?: string[];
}
