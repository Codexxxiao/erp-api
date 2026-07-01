// src/inventory/dto/create-inventory-adjustment.dto.ts
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
import { InventoryAdjustmentType } from '../../generated/prisma/client';
import { InventoryAdjustmentItemInputDto } from './inventory-adjustment-item-input.dto';

export class CreateInventoryAdjustmentDto {
  @IsOptional() @IsString() adjustmentNo?: string;
  @IsEnum(InventoryAdjustmentType) type: InventoryAdjustmentType;
  @IsOptional() @IsString() warehouseCode?: string;
  @IsOptional() @IsString() reasonCode?: string;
  @IsOptional() @IsDateString() adjustedAt?: string;
  @IsOptional() @IsString() remark?: string;
  @IsOptional() @IsObject() extra?: Record<string, unknown>;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InventoryAdjustmentItemInputDto)
  items: InventoryAdjustmentItemInputDto[];
}
