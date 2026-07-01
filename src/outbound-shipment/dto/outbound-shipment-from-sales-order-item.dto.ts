// src/outbound-shipment/dto/outbound-shipment-from-sales-order-item.dto.ts
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class OutboundShipmentFromSalesOrderItemDto {
  @IsString()
  salesOrderItemId: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  shippedQuantity?: number;
  @IsOptional() @IsString() warehouseCode?: string;
  @IsOptional() @IsString() locationCode?: string;
  @IsOptional() @IsString() batchNo?: string;
  @IsOptional() @IsString() remark?: string;
}
