import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { ProductStatus } from '../../generated/prisma/client';
import { CreateProductSupplierQuoteDto } from './create-product-supplier-quote.dto';

export class CreateProductDto {
  @IsString()
  code: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsString()
  nameCn: string;

  @IsOptional()
  @IsString()
  nameEn?: string;

  @IsOptional()
  @IsString()
  categoryCode?: string;

  @IsOptional()
  @IsString()
  unitCode?: string;

  @IsOptional()
  @IsString()
  currencyCode?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  costPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  salePrice?: number;

  @IsOptional()
  @IsString()
  defaultSupplierCustomerId?: string;

  @IsOptional()
  @IsString()
  mainImageFileId?: string;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  remark?: string;

  @IsOptional()
  @IsObject()
  extra?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageFileIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachmentFileIds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductSupplierQuoteDto)
  supplierQuotes?: CreateProductSupplierQuoteDto[];
}
