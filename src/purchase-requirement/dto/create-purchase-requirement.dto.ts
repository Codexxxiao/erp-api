// src/purchase-requirement/dto/create-purchase-requirement.dto.ts
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import {
  PurchaseRequirementPriority,
  PurchaseRequirementSourceType,
  PurchaseRequirementStatus,
} from '../../generated/prisma/client';
import { PurchaseRequirementItemInputDto } from './purchase-requirement-item-input.dto';

export class CreatePurchaseRequirementDto {
  @IsOptional() @IsString() requirementNo?: string;
  @IsOptional()
  @IsEnum(PurchaseRequirementSourceType)
  sourceType?: PurchaseRequirementSourceType;
  @IsOptional() @IsString() sourceSalesOrderId?: string;
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsString() customerName?: string;
  @IsString() subject: string;
  @IsOptional()
  @IsEnum(PurchaseRequirementStatus)
  status?: PurchaseRequirementStatus;
  @IsOptional()
  @IsEnum(PurchaseRequirementPriority)
  priority?: PurchaseRequirementPriority;
  @IsOptional() @IsDateString() requiredDate?: string;
  @IsOptional() @IsString() ownerUserId?: string;
  @IsOptional() @IsString() remark?: string;
  @IsOptional() @IsObject() extra?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseRequirementItemInputDto)
  items?: PurchaseRequirementItemInputDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachmentFileIds?: string[];
}
