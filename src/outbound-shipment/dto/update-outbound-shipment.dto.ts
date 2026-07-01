// src/outbound-shipment/dto/update-outbound-shipment.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateOutboundShipmentDto } from './create-outbound-shipment.dto';

export class UpdateOutboundShipmentDto extends PartialType(
  CreateOutboundShipmentDto,
) {}
