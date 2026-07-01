import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { InquiryPriority, InquiryStatus } from '../../generated/prisma/client';
import { InquiryItemInputDto } from './inquiry-item-input.dto';

export class CreateInquiryDto {
  @IsOptional()
  @IsString()
  inquiryNo?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  customerContactId?: string;

  @IsOptional()
  @IsString()
  customerContactName?: string;

  @IsString()
  subject: string;

  @IsOptional()
  @IsString()
  sourceCode?: string;

  @IsOptional()
  @IsEnum(InquiryPriority)
  priority?: InquiryPriority;

  @IsOptional()
  @IsEnum(InquiryStatus)
  status?: InquiryStatus;

  @IsOptional()
  @IsString()
  currencyCode?: string;

  @IsOptional()
  @IsString()
  tradeTerm?: string;

  @IsOptional()
  @IsString()
  paymentTerm?: string;

  @IsOptional()
  @IsDateString()
  expectedDeliveryDate?: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @IsOptional()
  @IsString()
  ownerUserId?: string;

  @IsOptional()
  @IsString()
  remark?: string;

  @IsOptional()
  @IsObject()
  extra?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InquiryItemInputDto)
  items?: InquiryItemInputDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachmentFileIds?: string[];
}
