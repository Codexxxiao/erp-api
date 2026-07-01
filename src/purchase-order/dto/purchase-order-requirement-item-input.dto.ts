// src/purchase-order/dto/purchase-order-requirement-item-input.dto.ts
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class PurchaseOrderRequirementItemInputDto {
  @IsString()
  requirementItemId: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  purchaseQuantity?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) unitPrice?: number;
  @IsOptional() @IsDateString() expectedDeliveryDate?: string;
  @IsOptional() @IsString() remark?: string;
}
