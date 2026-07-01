// src/accounts-receivable/dto/ar-payment-allocation-input.dto.ts
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class ArPaymentAllocationInputDto {
  @IsString()
  receivableId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  amount: number;

  @IsOptional()
  @IsString()
  remark?: string;
}
