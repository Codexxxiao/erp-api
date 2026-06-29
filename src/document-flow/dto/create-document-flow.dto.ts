import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  DocumentFlowDirection,
  DocumentFlowMappingType,
  DocumentFlowRepeatPolicy,
} from '../../generated/prisma/client';

export class CreateDocumentFlowMappingDto {
  @IsOptional()
  @IsString()
  sourceTableCode?: string;

  @IsOptional()
  @IsString()
  sourceFieldCode?: string;

  @IsOptional()
  @IsString()
  targetTableCode?: string;

  @IsString()
  targetFieldCode: string;

  @IsEnum(DocumentFlowMappingType)
  mappingType: DocumentFlowMappingType;

  @IsOptional()
  constantValue?: unknown;

  @IsOptional()
  @IsInt()
  sort?: number;
}

export class CreateDocumentFlowDto {
  @IsString()
  @MaxLength(64)
  code: string;

  @IsString()
  @MaxLength(100)
  name: string;

  @IsEnum(DocumentFlowDirection)
  direction: DocumentFlowDirection;

  @IsString()
  sourceFormId: string;

  @IsString()
  targetFormId: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  config?: unknown;

  @IsOptional()
  @IsEnum(DocumentFlowRepeatPolicy)
  repeatPolicy?: DocumentFlowRepeatPolicy;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateDocumentFlowMappingDto)
  mappings?: CreateDocumentFlowMappingDto[];
}
