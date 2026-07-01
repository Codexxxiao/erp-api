// src/inventory/dto/update-inventory-adjustment.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateInventoryAdjustmentDto } from './create-inventory-adjustment.dto';

export class UpdateInventoryAdjustmentDto extends PartialType(
  CreateInventoryAdjustmentDto,
) {}
