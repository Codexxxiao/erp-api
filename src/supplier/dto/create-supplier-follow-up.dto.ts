// src/supplier/dto/create-supplier-follow-up.dto.ts
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateSupplierFollowUpDto {
  @IsOptional()
  @IsString()
  type?: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsDateString()
  nextFollowAt?: string;
}
