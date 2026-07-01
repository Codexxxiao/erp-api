// src/sales-order/dto/change-sales-order-status.dto.ts
import { IsEnum } from 'class-validator';
import { SalesOrderStatus } from '../../generated/prisma/client';

export class ChangeSalesOrderStatusDto {
  @IsEnum(SalesOrderStatus)
  status: SalesOrderStatus;
}
