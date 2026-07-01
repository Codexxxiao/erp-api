// src/contract/dto/contract-item-input.dto.ts
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

export class ContractItemInputDto {
  @IsOptional() @IsString() sourceQuotationItemId?: string;
  @IsOptional() @IsString() productId?: string;
  @IsOptional() @IsString() productCode?: string;
  @IsOptional() @IsString() productNameCn?: string;
  @IsOptional() @IsString() productNameEn?: string;
  @IsOptional() @IsString() categoryCode?: string;
  @IsOptional() @IsString() unitCode?: string;
  @IsOptional() @IsString() description?: string;
  @Type(() => Number) @IsNumber() @Min(0.0001) quantity: number;
  @Type(() => Number) @IsNumber() @Min(0) unitPrice: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) discountRate?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) discountAmount?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) taxRate?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) taxAmount?: number;
  @IsOptional() @IsString() currencyCode?: string;
  @IsOptional() @IsDateString() expectedDeliveryDate?: string;
  @IsOptional() @IsString() remark?: string;
  @IsOptional() @IsObject() extra?: Record<string, unknown>;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sort?: number;
}
