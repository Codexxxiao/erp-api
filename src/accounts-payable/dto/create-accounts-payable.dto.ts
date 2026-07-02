// src/accounts-payable/dto/create-accounts-payable.dto.ts
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
  AccountsPayableSourceType,
  AccountsPayableStatus,
} from '../../generated/prisma/client';
import { AccountsPayableItemInputDto } from './accounts-payable-item-input.dto';

export class CreateAccountsPayableDto {
  @IsOptional() @IsString() payableNo?: string;
  @IsOptional()
  @IsEnum(AccountsPayableSourceType)
  sourceType?: AccountsPayableSourceType;
  @IsOptional() @IsString() sourceId?: string;
  @IsOptional() @IsString() sourceNo?: string;
  @IsOptional() @IsString() purchaseOrderId?: string;
  @IsOptional() @IsString() inboundReceiptId?: string;
  @IsOptional() @IsString() supplierId?: string;
  @IsOptional() @IsString() supplierName?: string;
  @IsString() subject: string;
  @IsOptional() @IsEnum(AccountsPayableStatus) status?: AccountsPayableStatus;
  @IsString() currencyCode: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) exchangeRate?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) totalAmount?: number;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsString() remark?: string;
  @IsOptional() @IsObject() extra?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AccountsPayableItemInputDto)
  items?: AccountsPayableItemInputDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachmentFileIds?: string[];
}
