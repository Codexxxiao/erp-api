import { FormTableType } from '../../generated/prisma/client';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateFormTableDto {
  @IsString()
  @MaxLength(64)
  code: string;

  @IsString()
  @MaxLength(100)
  name: string;

  @IsEnum(FormTableType)
  type: FormTableType;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  layout?: unknown;

  @IsOptional()
  config?: unknown;

  @IsOptional()
  @IsInt()
  sort?: number;
}
