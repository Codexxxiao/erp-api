// src/purchase-requirement/dto/replace-purchase-requirement-items.dto.ts
import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import { PurchaseRequirementItemInputDto } from './purchase-requirement-item-input.dto';

export class ReplacePurchaseRequirementItemsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseRequirementItemInputDto)
  items: PurchaseRequirementItemInputDto[];
}
