// src/inventory/dto/query-inventory-transaction.dto.ts
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
  InventoryDirection,
  InventoryTransactionType,
} from '../../generated/prisma/client';

export class QueryInventoryTransactionDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pageSize = 20;
  @IsOptional()
  @IsEnum(InventoryTransactionType)
  type?: InventoryTransactionType;
  @IsOptional() @IsEnum(InventoryDirection) direction?: InventoryDirection;
  @IsOptional() @IsString() sourceType?: string;
  @IsOptional() @IsString() sourceId?: string;
  @IsOptional() @IsString() productId?: string;
  @IsOptional() @IsString() productCode?: string;
  @IsOptional() @IsString() warehouseCode?: string;
  @IsOptional() @IsDateString() occurredFrom?: string;
  @IsOptional() @IsDateString() occurredTo?: string;
}
