// src/accounts-receivable/dto/create-ar-payment.dto.ts
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
  AccountsReceivablePaymentMethod,
  AccountsReceivablePaymentStatus,
} from '../../generated/prisma/client';
import { ArPaymentAllocationInputDto } from './ar-payment-allocation-input.dto';

export class CreateArPaymentDto {
  @IsOptional() @IsString() paymentNo?: string;
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsString() customerName?: string;
  @IsOptional()
  @IsEnum(AccountsReceivablePaymentStatus)
  status?: AccountsReceivablePaymentStatus;
  @IsOptional() @IsDateString() paymentDate?: string;
  @IsOptional()
  @IsEnum(AccountsReceivablePaymentMethod)
  method?: AccountsReceivablePaymentMethod;
  @IsOptional() @IsString() bankAccountNo?: string;
  @IsOptional() @IsString() transactionNo?: string;
  @IsString() currencyCode: string;
  @Type(() => Number) @IsNumber() @Min(0.0001) amount: number;
  @IsOptional() @IsString() remark?: string;
  @IsOptional() @IsObject() extra?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ArPaymentAllocationInputDto)
  allocations?: ArPaymentAllocationInputDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachmentFileIds?: string[];
}
