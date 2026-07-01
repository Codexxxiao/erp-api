// src/inventory/dto/inventory-adjustment-item-input.dto.ts
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class InventoryAdjustmentItemInputDto {
  @IsOptional() @IsString() productId?: string;
  @IsOptional() @IsString() productCode?: string;
  @IsOptional() @IsString() productNameCn?: string;
  @IsOptional() @IsString() productNameEn?: string;
  @IsOptional() @IsString() categoryCode?: string;
  @IsOptional() @IsString() unitCode?: string;
  @IsOptional() @IsString() warehouseCode?: string;
  @IsOptional() @IsString() locationCode?: string;
  @IsOptional() @IsString() batchNo?: string;
  @Type(() => Number) @IsNumber() @Min(0.0001) quantity: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) unitCost?: number;
  @IsOptional() @IsString() currencyCode?: string;
  @IsOptional() @IsString() remark?: string;
  @IsOptional() @IsObject() extra?: Record<string, unknown>;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sort?: number;
}
