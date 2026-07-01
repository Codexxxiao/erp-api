// src/contract/dto/create-contract.dto.ts
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
import { SalesContractStatus } from '../../generated/prisma/client';
import { ContractItemInputDto } from './contract-item-input.dto';

export class CreateContractDto {
  @IsOptional() @IsString() contractNo?: string;
  @IsOptional() @IsString() quotationId?: string;
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsString() customerName?: string;
  @IsOptional() @IsString() customerContactId?: string;
  @IsOptional() @IsString() customerContactName?: string;
  @IsString() subject: string;
  @IsOptional() @IsEnum(SalesContractStatus) status?: SalesContractStatus;
  @IsString() currencyCode: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) exchangeRate?: number;
  @IsOptional() @IsString() tradeTerm?: string;
  @IsOptional() @IsString() paymentTerm?: string;
  @IsOptional() @IsDateString() signDate?: string;
  @IsOptional() @IsDateString() effectiveDate?: string;
  @IsOptional() @IsDateString() expectedDeliveryDate?: string;
  @IsOptional() @IsString() ownerUserId?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) freightAmount?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) otherAmount?: number;
  @IsOptional() @IsString() remark?: string;
  @IsOptional() @IsObject() extra?: Record<string, unknown>;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContractItemInputDto)
  items?: ContractItemInputDto[];
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachmentFileIds?: string[];
}
