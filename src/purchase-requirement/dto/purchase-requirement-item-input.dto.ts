// src/purchase-requirement/dto/purchase-requirement-item-input.dto.ts
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class PurchaseRequirementItemInputDto {
  @IsOptional() @IsString() sourceSalesOrderItemId?: string;
  @IsOptional() @IsString() productId?: string;
  @IsOptional() @IsString() productCode?: string;
  @IsOptional() @IsString() productNameCn?: string;
  @IsOptional() @IsString() productNameEn?: string;
  @IsOptional() @IsString() categoryCode?: string;
  @IsOptional() @IsString() unitCode?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  requiredQuantity: number;

  @IsOptional()
  @IsString()
  suggestedSupplierId?: string;

  @IsOptional()
  @IsString()
  suggestedSupplierName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  targetPurchasePrice?: number;

  @IsOptional() @IsString() currencyCode?: string;
  @IsOptional() @IsDateString() requiredDate?: string;
  @IsOptional() @IsString() remark?: string;
  @IsOptional() @IsObject() extra?: Record<string, unknown>;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sort?: number;
}
