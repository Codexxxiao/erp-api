// src/inventory/dto/query-inventory-adjustment.dto.ts
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import {
  InventoryAdjustmentStatus,
  InventoryAdjustmentType,
} from '../../generated/prisma/client';

export class QueryInventoryAdjustmentDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pageSize = 20;
  @IsOptional() @IsString() keyword?: string;
  @IsOptional() @IsEnum(InventoryAdjustmentType) type?: InventoryAdjustmentType;
  @IsOptional()
  @IsEnum(InventoryAdjustmentStatus)
  status?: InventoryAdjustmentStatus;
  @IsOptional() @IsString() warehouseCode?: string;
}
