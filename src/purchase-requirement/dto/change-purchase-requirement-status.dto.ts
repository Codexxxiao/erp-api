// src/purchase-requirement/dto/change-purchase-requirement-status.dto.ts
import { IsEnum } from 'class-validator';
import { PurchaseRequirementStatus } from '../../generated/prisma/client';

export class ChangePurchaseRequirementStatusDto {
  @IsEnum(PurchaseRequirementStatus)
  status: PurchaseRequirementStatus;
}
