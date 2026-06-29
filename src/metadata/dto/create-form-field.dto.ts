import { FormFieldType } from '../../generated/prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateFormFieldDto {
  @IsString()
  @MaxLength(64)
  code: string;

  @IsString()
  @MaxLength(100)
  name: string;

  @IsEnum(FormFieldType)
  type: FormFieldType;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsBoolean()
  unique?: boolean;

  @IsOptional()
  @IsBoolean()
  readonly?: boolean;

  @IsOptional()
  @IsBoolean()
  hidden?: boolean;

  @IsOptional()
  defaultValue?: unknown;

  @IsOptional()
  @IsString()
  dictionaryCode?: string;

  @IsOptional()
  @IsString()
  dataSourceCode?: string;

  @IsOptional()
  dataSourceMapping?: unknown;

  @IsOptional()
  formula?: unknown;

  @IsOptional()
  validationRules?: unknown;

  @IsOptional()
  visibleWhen?: unknown;

  @IsOptional()
  config?: unknown;

  @IsOptional()
  @IsInt()
  sort?: number;
}
