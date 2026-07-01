// src/purchase-order/dto/change-purchase-order-status.dto.ts
import { IsEnum } from 'class-validator';
import { PurchaseOrderStatus } from '../../generated/prisma/client';

export class ChangePurchaseOrderStatusDto {
  @IsEnum(PurchaseOrderStatus)
  status: PurchaseOrderStatus;
}
