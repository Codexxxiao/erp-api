import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { MenuType } from '../../generated/prisma/client';

export class UpdateMenuDto {
  @IsOptional()
  @IsString()
  parentId?: string | null;

  @IsOptional()
  @IsEnum(MenuType)
  type?: MenuType;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  path?: string;

  @IsOptional()
  @IsString()
  component?: string;

  @IsOptional()
  @IsString()
  redirect?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsInt()
  sort?: number;

  @IsOptional()
  @IsString()
  permissionCode?: string | null;

  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsObject()
  meta?: Record<string, unknown>;
}
