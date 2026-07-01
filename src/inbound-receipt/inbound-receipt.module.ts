// src/inbound-receipt/inbound-receipt.module.ts
import { Module } from '@nestjs/common';
import { FileModule } from '../file/file.module';
import { InboundReceiptController } from './inbound-receipt.controller';
import { InboundReceiptService } from './inbound-receipt.service';

@Module({
  imports: [FileModule],
  controllers: [InboundReceiptController],
  providers: [InboundReceiptService],
  exports: [InboundReceiptService],
})
export class InboundReceiptModule {}
