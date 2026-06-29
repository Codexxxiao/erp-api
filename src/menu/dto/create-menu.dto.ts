import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { MenuType } from '../../generated/prisma/client';

export class CreateMenuDto {
  @IsOptional()
  @IsString()
  parentId?: string | null;

  @IsOptional()
  @IsEnum(MenuType)
  type?: MenuType;

  @IsString()
  title: string;

  @IsString()
  @Matches(/^[a-z][a-z0-9.-]*$/)
  name: string;

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
  permissionCode?: string;

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
