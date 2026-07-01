// src/quotation/dto/replace-quotation-items.dto.ts
import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import { QuotationItemInputDto } from './quotation-item-input.dto';

export class ReplaceQuotationItemsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuotationItemInputDto)
  items: QuotationItemInputDto[];
}
