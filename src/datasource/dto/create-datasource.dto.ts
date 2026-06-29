import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { DataSourceType } from '../../generated/prisma/client';

export class CreateDataSourceDto {
  @IsString()
  @Matches(/^[a-z][a-z0-9.-]*$/)
  code: string;

  @IsString()
  name: string;

  @IsEnum(DataSourceType)
  type: DataSourceType;

  @IsObject()
  config: Record<string, unknown>;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  sort?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
