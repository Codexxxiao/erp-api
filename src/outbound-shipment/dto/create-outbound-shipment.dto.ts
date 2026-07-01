// src/outbound-shipment/dto/create-outbound-shipment.dto.ts
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
import { OutboundShipmentStatus } from '../../generated/prisma/client';
import { OutboundShipmentItemInputDto } from './outbound-shipment-item-input.dto';

export class CreateOutboundShipmentDto {
  @IsOptional() @IsString() shipmentNo?: string;
  @IsString() salesOrderId: string;
  @IsOptional() @IsEnum(OutboundShipmentStatus) status?: OutboundShipmentStatus;
  @IsOptional() @IsDateString() shipmentDate?: string;
  @IsOptional() @IsString() warehouseCode?: string;
  @IsOptional() @IsString() transportMode?: string;
  @IsOptional() @IsString() carrierName?: string;
  @IsOptional() @IsString() trackingNo?: string;
  @IsOptional() @IsString() bookingNo?: string;
  @IsOptional() @IsString() containerNo?: string;
  @IsOptional() @IsString() blNo?: string;
  @IsOptional() @IsDateString() etd?: string;
  @IsOptional() @IsDateString() eta?: string;
  @IsOptional() @IsString() destinationPort?: string;
  @IsOptional() @IsString() shippingAddress?: string;
  @IsOptional() @IsString() consigneeName?: string;
  @IsOptional() @IsString() ownerUserId?: string;
  @IsOptional() @IsString() remark?: string;
  @IsOptional() @IsObject() extra?: Record<string, unknown>;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OutboundShipmentItemInputDto)
  items: OutboundShipmentItemInputDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachmentFileIds?: string[];
}
