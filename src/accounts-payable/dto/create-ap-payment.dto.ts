// src/accounts-payable/dto/create-ap-payment.dto.ts
import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsEnum, IsNumber, IsObject, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { AccountsPayablePaymentMethod, AccountsPayablePaymentStatus } from '../../generated/prisma/client';
import { ApPaymentAllocationInputDto } from './ap-payment-allocation-input.dto';

export class CreateApPaymentDto {
  @IsOptional() @IsString() paymentNo?: string;
  @IsOptional() @IsString() supplierId?: string;
  @IsOptional() @IsString() supplierName?: string;
  @IsOptional() @IsEnum(AccountsPayablePaymentStatus) status?: AccountsPayablePaymentStatus;
  @IsOptional() @IsDateString() paymentDate?: string;
  @IsOptional() @IsEnum(AccountsPayablePaymentMethod) method?: AccountsPayablePaymentMethod;
  @IsOptional() @IsString() bankAccountNo?: string;
  @IsOptional() @IsString() transactionNo?: string;
  @IsString() currencyCode: string;
  @Type(() => Number) @IsNumber() @Min(0.0001) amount: number;
  @IsOptional() @IsString() remark?: string;
  @IsOptional() @IsObject() extra?: Record<string, unknown>;

  @IsOptional() @IsArray() @ValidateNested({ each: true })
  @Type(() => ApPaymentAllocationInputDto)
  allocations?: ApPaymentAllocationInputDto[];

  @IsOptional() @IsArray() @IsString({ each: true }) attachmentFileIds?: string[];
}