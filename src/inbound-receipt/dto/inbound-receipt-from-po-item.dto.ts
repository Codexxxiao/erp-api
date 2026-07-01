// src/inbound-receipt/dto/inbound-receipt-from-po-item.dto.ts
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class InboundReceiptFromPoItemDto {
  @IsString()
  purchaseOrderItemId: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  receivedQuantity?: number;
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
  @IsOptional() @IsString() batchNo?: string;
  @IsOptional() @IsString() warehouseCode?: string;
  @IsOptional() @IsString() locationCode?: string;
  @IsOptional() @IsString() remark?: string;
}
