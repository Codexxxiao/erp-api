// src/purchase-requirement/dto/update-purchase-requirement.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreatePurchaseRequirementDto } from './create-purchase-requirement.dto';

export class UpdatePurchaseRequirementDto extends PartialType(
  CreatePurchaseRequirementDto,
) {}
