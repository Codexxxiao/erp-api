// src/supplier/dto/supplier-file-relation.dto.ts
import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class SupplierFileRelationDto {
  @IsUUID()
  fileId: string;

  @IsOptional()
  @IsString()
  fieldCode?: string;

  @IsOptional()
  @IsString()
  relationName?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sort?: number;

  @IsOptional()
  @IsObject()
  extra?: Record<string, unknown>;
}
