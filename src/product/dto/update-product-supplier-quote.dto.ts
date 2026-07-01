import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ProductSupplierQuoteStatus } from '../../generated/prisma/client';

export class UpdateProductSupplierQuoteDto {
  @IsOptional()
  @IsString()
  supplierCustomerId?: string;

  @IsOptional()
  @IsString()
  supplierName?: string;

  @IsOptional()
  @IsString()
  currencyCode?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  purchasePrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  moq?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  leadTimeDays?: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsEnum(ProductSupplierQuoteStatus)
  status?: ProductSupplierQuoteStatus;

  @IsOptional()
  @IsString()
  remark?: string;

  @IsOptional()
  @IsObject()
  extra?: Record<string, unknown>;
}
