// src/purchase-order/dto/create-purchase-order-from-requirements.dto.ts
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { PurchaseOrderStatus } from '../../generated/prisma/client';
import { PurchaseOrderRequirementItemInputDto } from './purchase-order-requirement-item-input.dto';

export class CreatePurchaseOrderFromRequirementsDto {
  @IsOptional() @IsString() purchaseOrderNo?: string;
  @IsOptional() @IsString() supplierId?: string;
  @IsOptional() @IsString() supplierName?: string;
  @IsOptional() @IsBoolean() groupBySupplier?: boolean;
  @IsOptional() @IsEnum(PurchaseOrderStatus) status?: PurchaseOrderStatus;
  @IsOptional() @IsString() currencyCode?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) exchangeRate?: number;
  @IsOptional() @IsDateString() expectedDeliveryDate?: string;
  @IsOptional() @IsString() ownerUserId?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) freightAmount?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) otherAmount?: number;
  @IsOptional() @IsString() remark?: string;
  @IsOptional() @IsObject() extra?: Record<string, unknown>;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderRequirementItemInputDto)
  items: PurchaseOrderRequirementItemInputDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachmentFileIds?: string[];
}
