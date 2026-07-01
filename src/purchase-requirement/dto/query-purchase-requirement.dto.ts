// src/purchase-requirement/dto/query-purchase-requirement.dto.ts
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
  PurchaseRequirementPriority,
  PurchaseRequirementSourceType,
  PurchaseRequirementStatus,
} from '../../generated/prisma/client';

export class QueryPurchaseRequirementDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pageSize = 20;
  @IsOptional() @IsString() keyword?: string;
  @IsOptional()
  @IsEnum(PurchaseRequirementStatus)
  status?: PurchaseRequirementStatus;
  @IsOptional()
  @IsEnum(PurchaseRequirementPriority)
  priority?: PurchaseRequirementPriority;
  @IsOptional()
  @IsEnum(PurchaseRequirementSourceType)
  sourceType?: PurchaseRequirementSourceType;
  @IsOptional() @IsString() sourceSalesOrderId?: string;
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsString() ownerUserId?: string;
  @IsOptional() @IsDateString() createdFrom?: string;
  @IsOptional() @IsDateString() createdTo?: string;
}
