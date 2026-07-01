// src/quotation/dto/change-quotation-status.dto.ts
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { QuotationStatus } from '../../generated/prisma/client';

export class ChangeQuotationStatusDto {
  @IsEnum(QuotationStatus)
  status: QuotationStatus;

  @IsOptional()
  @IsString()
  reason?: string;
}
