// src/outbound-shipment/dto/outbound-shipment-item-input.dto.ts
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class OutboundShipmentItemInputDto {
  @IsString()
  salesOrderItemId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  shippedQuantity: number;

  @IsOptional() @IsString() warehouseCode?: string;
  @IsOptional() @IsString() locationCode?: string;
  @IsOptional() @IsString() batchNo?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) unitPrice?: number;
  @IsOptional() @IsString() remark?: string;
  @IsOptional() @IsObject() extra?: Record<string, unknown>;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sort?: number;
}
