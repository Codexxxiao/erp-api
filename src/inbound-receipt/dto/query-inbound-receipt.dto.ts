// src/inbound-receipt/dto/query-inbound-receipt.dto.ts
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { InboundReceiptStatus } from '../../generated/prisma/client';

export class QueryInboundReceiptDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pageSize = 20;
  @IsOptional() @IsString() keyword?: string;
  @IsOptional() @IsEnum(InboundReceiptStatus) status?: InboundReceiptStatus;
  @IsOptional() @IsString() purchaseOrderId?: string;
  @IsOptional() @IsString() supplierId?: string;
  @IsOptional() @IsString() warehouseCode?: string;
  @IsOptional() @IsDateString() createdFrom?: string;
  @IsOptional() @IsDateString() createdTo?: string;
}
