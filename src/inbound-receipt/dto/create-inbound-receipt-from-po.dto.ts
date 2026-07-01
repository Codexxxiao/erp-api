// src/inbound-receipt/dto/create-inbound-receipt-from-po.dto.ts
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
import { InboundReceiptStatus } from '../../generated/prisma/client';
import { InboundReceiptFromPoItemDto } from './inbound-receipt-from-po-item.dto';

export class CreateInboundReceiptFromPoDto {
  @IsOptional() @IsString() receiptNo?: string;
  @IsOptional() @IsEnum(InboundReceiptStatus) status?: InboundReceiptStatus;
  @IsOptional() @IsDateString() receiptDate?: string;
  @IsOptional() @IsString() warehouseCode?: string;
  @IsOptional() @IsString() ownerUserId?: string;
  @IsOptional() @IsString() remark?: string;
  @IsOptional() @IsObject() extra?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InboundReceiptFromPoItemDto)
  items?: InboundReceiptFromPoItemDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachmentFileIds?: string[];
}
