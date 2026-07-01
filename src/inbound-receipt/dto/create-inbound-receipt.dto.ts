// src/inbound-receipt/dto/create-inbound-receipt.dto.ts
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
import { InboundReceiptItemInputDto } from './inbound-receipt-item-input.dto';

export class CreateInboundReceiptDto {
  @IsOptional() @IsString() receiptNo?: string;
  @IsString() purchaseOrderId: string;
  @IsOptional() @IsString() supplierId?: string;
  @IsOptional() @IsString() supplierName?: string;
  @IsOptional() @IsEnum(InboundReceiptStatus) status?: InboundReceiptStatus;
  @IsOptional() @IsDateString() receiptDate?: string;
  @IsOptional() @IsString() warehouseCode?: string;
  @IsOptional() @IsString() ownerUserId?: string;
  @IsOptional() @IsString() remark?: string;
  @IsOptional() @IsObject() extra?: Record<string, unknown>;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InboundReceiptItemInputDto)
  items: InboundReceiptItemInputDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachmentFileIds?: string[];
}
