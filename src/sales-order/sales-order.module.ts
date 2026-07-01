// src/sales-order/sales-order.module.ts
import { Module } from '@nestjs/common';
import { FileModule } from '../file/file.module';
import { SalesOrderController } from './sales-order.controller';
import { SalesOrderService } from './sales-order.service';

@Module({
  imports: [FileModule],
  controllers: [SalesOrderController],
  providers: [SalesOrderService],
  exports: [SalesOrderService],
})
export class SalesOrderModule {}
