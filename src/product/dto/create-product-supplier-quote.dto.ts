// src/product/dto/create-product-supplier-quote.dto.ts
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
} from 'class-validator';
import { ProductSupplierQuoteStatus } from '../../generated/prisma/client';

export class CreateProductSupplierQuoteDto {
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ValidateIf((dto) => !dto.supplierId)
  @IsString()
  supplierName?: string;

  @IsString()
  currency: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  moq?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  leadTimeDays?: number;

  @IsOptional()
  @IsString()
  remark?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsEnum(ProductSupplierQuoteStatus)
  status?: ProductSupplierQuoteStatus;
}
