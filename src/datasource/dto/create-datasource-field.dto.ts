import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { DataSourceFieldType } from '../../generated/prisma/client';

export class CreateDataSourceFieldDto {
  @IsString()
  @Matches(/^[a-z][a-z0-9_]*$/)
  key: string;

  @IsString()
  label: string;

  @IsString()
  path: string;

  @IsOptional()
  @IsEnum(DataSourceFieldType)
  type?: DataSourceFieldType;

  @IsOptional()
  @IsBoolean()
  isValue?: boolean;

  @IsOptional()
  @IsBoolean()
  isLabel?: boolean;

  @IsOptional()
  @IsBoolean()
  isExtra?: boolean;

  @IsOptional()
  @IsInt()
  sort?: number;
}
