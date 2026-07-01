// src/contract/dto/change-contract-status.dto.ts
import { IsEnum } from 'class-validator';
import { SalesContractStatus } from '../../generated/prisma/client';

export class ChangeContractStatusDto {
  @IsEnum(SalesContractStatus)
  status: SalesContractStatus;
}
