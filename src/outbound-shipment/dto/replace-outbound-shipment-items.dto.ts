// src/outbound-shipment/dto/replace-outbound-shipment-items.dto.ts
import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import { OutboundShipmentItemInputDto } from './outbound-shipment-item-input.dto';

export class ReplaceOutboundShipmentItemsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OutboundShipmentItemInputDto)
  items: OutboundShipmentItemInputDto[];
}
