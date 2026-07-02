// src/accounts-payable/dto/query-accounts-payable.dto.ts
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import {
  AccountsPayableSourceType,
  AccountsPayableStatus,
} from '../../generated/prisma/client';

export class QueryAccountsPayableDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pageSize = 20;
  @IsOptional() @IsString() keyword?: string;
  @IsOptional() @IsEnum(AccountsPayableStatus) status?: AccountsPayableStatus;
  @IsOptional()
  @IsEnum(AccountsPayableSourceType)
  sourceType?: AccountsPayableSourceType;
  @IsOptional() @IsString() supplierId?: string;
  @IsOptional() @IsString() purchaseOrderId?: string;
  @IsOptional() @IsString() inboundReceiptId?: string;
  @IsOptional() @IsString() currencyCode?: string;
  @IsOptional() @IsDateString() createdFrom?: string;
  @IsOptional() @IsDateString() createdTo?: string;
}
