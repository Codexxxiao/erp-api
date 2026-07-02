// src/accounts-payable/dto/query-ap-payment.dto.ts
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { AccountsPayablePaymentStatus } from '../../generated/prisma/client';

export class QueryApPaymentDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pageSize = 20;
  @IsOptional() @IsString() keyword?: string;
  @IsOptional() @IsEnum(AccountsPayablePaymentStatus) status?: AccountsPayablePaymentStatus;
  @IsOptional() @IsString() supplierId?: string;
  @IsOptional() @IsString() currencyCode?: string;
  @IsOptional() @IsDateString() createdFrom?: string;
  @IsOptional() @IsDateString() createdTo?: string;
}