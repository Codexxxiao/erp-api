// src/accounts-receivable/dto/create-ar-from-sales-order.dto.ts
import { IsDateString, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateArFromSalesOrderDto {
  @IsOptional() @IsString() receivableNo?: string;
  @IsOptional() @IsString() subject?: string;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsString() remark?: string;
  @IsOptional() @IsObject() extra?: Record<string, unknown>;
}
