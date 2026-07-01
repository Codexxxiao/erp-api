// src/inbound-receipt/dto/inbound-receipt-item-input.dto.ts
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class InboundReceiptItemInputDto {
  @IsString()
  purchaseOrderItemId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  receivedQuantity: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  qualifiedQuantity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  rejectedQuantity?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) unitPrice?: number;
  @IsOptional() @IsString() batchNo?: string;
  @IsOptional() @IsString() warehouseCode?: string;
  @IsOptional() @IsString() locationCode?: string;
  @IsOptional() @IsString() remark?: string;
  @IsOptional() @IsObject() extra?: Record<string, unknown>;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sort?: number;
}
