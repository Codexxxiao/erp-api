// src/sales-order/dto/create-sales-order-from-contract.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateSalesOrderDto } from './create-sales-order.dto';

export class CreateSalesOrderFromContractDto extends PartialType(
  CreateSalesOrderDto,
) {}
