// src/inbound-receipt/dto/replace-inbound-receipt-items.dto.ts
import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import { InboundReceiptItemInputDto } from './inbound-receipt-item-input.dto';

export class ReplaceInboundReceiptItemsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InboundReceiptItemInputDto)
  items: InboundReceiptItemInputDto[];
}
