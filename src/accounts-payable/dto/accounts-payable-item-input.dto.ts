// src/accounts-payable/dto/accounts-payable-item-input.dto.ts
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class AccountsPayableItemInputDto {
  @IsOptional() @IsString() sourceItemId?: string;
  @IsOptional() @IsString() productId?: string;
  @IsOptional() @IsString() productCode?: string;
  @IsOptional() @IsString() productNameCn?: string;
  @IsOptional() @IsString() productNameEn?: string;
  @IsOptional() @IsString() categoryCode?: string;
  @IsOptional() @IsString() unitCode?: string;
  @Type(() => Number) @IsNumber() @Min(0.0001) quantity: number;
  @Type(() => Number) @IsNumber() @Min(0) unitPrice: number;
  @IsOptional() @IsString() currencyCode?: string;
  @IsOptional() @IsString() remark?: string;
  @IsOptional() @IsObject() extra?: Record<string, unknown>;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sort?: number;
}
