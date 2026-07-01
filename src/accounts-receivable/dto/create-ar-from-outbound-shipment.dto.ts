// src/accounts-receivable/dto/create-ar-from-outbound-shipment.dto.ts
import { IsDateString, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateArFromOutboundShipmentDto {
  @IsOptional() @IsString() receivableNo?: string;
  @IsOptional() @IsString() subject?: string;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsString() remark?: string;
  @IsOptional() @IsObject() extra?: Record<string, unknown>;
}
