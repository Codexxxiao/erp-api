import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';
import { DataSourceFieldType } from '../../generated/prisma/client';

export class UpdateDataSourceFieldDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  path?: string;

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
