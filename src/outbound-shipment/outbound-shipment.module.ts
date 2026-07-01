// src/outbound-shipment/outbound-shipment.module.ts
import { Module } from '@nestjs/common';
import { FileModule } from '../file/file.module';
import { InventoryModule } from '../inventory/inventory.module';
import { OutboundShipmentController } from './outbound-shipment.controller';
import { OutboundShipmentService } from './outbound-shipment.service';

@Module({
  imports: [FileModule, InventoryModule],
  controllers: [OutboundShipmentController],
  providers: [OutboundShipmentService],
  exports: [OutboundShipmentService],
})
export class OutboundShipmentModule {}
