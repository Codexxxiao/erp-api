// src/purchase-requirement/dto/update-requirement-item-ordered-quantity.dto.ts
import { Type } from 'class-transformer';
import { IsNumber, Min } from 'class-validator';

export class UpdateRequirementItemOrderedQuantityDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  orderedQuantity: number;
}
