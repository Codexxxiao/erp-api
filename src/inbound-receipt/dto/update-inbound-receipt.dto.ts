// src/inbound-receipt/dto/update-inbound-receipt.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateInboundReceiptDto } from './create-inbound-receipt.dto';

export class UpdateInboundReceiptDto extends PartialType(
  CreateInboundReceiptDto,
) {}
