// src/inventory/dto/query-inventory-balance.dto.ts
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class QueryInventoryBalanceDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pageSize = 20;
  @IsOptional() @IsString() keyword?: string;
  @IsOptional() @IsString() productId?: string;
  @IsOptional() @IsString() productCode?: string;
  @IsOptional() @IsString() warehouseCode?: string;
  @IsOptional() @IsString() locationCode?: string;
  @IsOptional() @IsString() batchNo?: string;
}
