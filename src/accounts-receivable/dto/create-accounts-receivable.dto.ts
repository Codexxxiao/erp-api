// src/accounts-receivable/dto/create-accounts-receivable.dto.ts
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  AccountsReceivableSourceType,
  AccountsReceivableStatus,
} from '../../generated/prisma/client';
import { AccountsReceivableItemInputDto } from './accounts-receivable-item-input.dto';

export class CreateAccountsReceivableDto {
  @IsOptional() @IsString() receivableNo?: string;
  @IsOptional()
  @IsEnum(AccountsReceivableSourceType)
  sourceType?: AccountsReceivableSourceType;
  @IsOptional() @IsString() sourceId?: string;
  @IsOptional() @IsString() sourceNo?: string;
  @IsOptional() @IsString() salesOrderId?: string;
  @IsOptional() @IsString() outboundShipmentId?: string;
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsString() customerName?: string;
  @IsString() subject: string;
  @IsOptional()
  @IsEnum(AccountsReceivableStatus)
  status?: AccountsReceivableStatus;
  @IsString() currencyCode: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) exchangeRate?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) totalAmount?: number;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsString() remark?: string;
  @IsOptional() @IsObject() extra?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AccountsReceivableItemInputDto)
  items?: AccountsReceivableItemInputDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachmentFileIds?: string[];
}
