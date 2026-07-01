// src/purchase-order/dto/update-purchase-order-item-received-quantity.dto.ts
import { Type } from 'class-transformer';
import { IsNumber, Min } from 'class-validator';

export class UpdatePurchaseOrderItemReceivedQuantityDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  receivedQuantity: number;
}
