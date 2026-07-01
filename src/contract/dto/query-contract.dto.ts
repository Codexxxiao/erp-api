// src/contract/dto/query-contract.dto.ts
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { SalesContractStatus } from '../../generated/prisma/client';

export class QueryContractDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pageSize = 20;
  @IsOptional() @IsString() keyword?: string;
  @IsOptional() @IsEnum(SalesContractStatus) status?: SalesContractStatus;
  @IsOptional() @IsString() quotationId?: string;
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsString() ownerUserId?: string;
  @IsOptional() @IsString() currencyCode?: string;
  @IsOptional() @IsDateString() createdFrom?: string;
  @IsOptional() @IsDateString() createdTo?: string;
}
