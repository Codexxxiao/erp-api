// src/inventory/dto/create-warehouse.dto.ts
import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import { WarehouseStatus } from '../../generated/prisma/client';

export class CreateWarehouseDto {
  @IsString() code: string;
  @IsString() name: string;
  @IsOptional() @IsEnum(WarehouseStatus) status?: WarehouseStatus;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() contactName?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() remark?: string;
  @IsOptional() @IsObject() extra?: Record<string, unknown>;
}
