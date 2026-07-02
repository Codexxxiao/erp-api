// src/accounts-payable/dto/create-ap-from-inbound-receipt.dto.ts
import { IsDateString, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateApFromInboundReceiptDto {
  @IsOptional() @IsString() payableNo?: string;
  @IsOptional() @IsString() subject?: string;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsString() remark?: string;
  @IsOptional() @IsObject() extra?: Record<string, unknown>;
}
