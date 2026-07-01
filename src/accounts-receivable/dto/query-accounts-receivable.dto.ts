// src/accounts-receivable/dto/query-accounts-receivable.dto.ts
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
  AccountsReceivableSourceType,
  AccountsReceivableStatus,
} from '../../generated/prisma/client';

export class QueryAccountsReceivableDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pageSize = 20;
  @IsOptional() @IsString() keyword?: string;
  @IsOptional()
  @IsEnum(AccountsReceivableStatus)
  status?: AccountsReceivableStatus;
  @IsOptional()
  @IsEnum(AccountsReceivableSourceType)
  sourceType?: AccountsReceivableSourceType;
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsString() salesOrderId?: string;
  @IsOptional() @IsString() outboundShipmentId?: string;
  @IsOptional() @IsString() currencyCode?: string;
  @IsOptional() @IsDateString() createdFrom?: string;
  @IsOptional() @IsDateString() createdTo?: string;
}
