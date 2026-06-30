import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { MessageLevel, MessageType } from '../../generated/prisma/client';

export class CreateMessageTemplateDto {
  @IsString()
  @MaxLength(64)
  code: string;

  @IsString()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsEnum(MessageType)
  type?: MessageType;

  @IsOptional()
  @IsEnum(MessageLevel)
  level?: MessageLevel;

  @IsString()
  @MaxLength(200)
  titleTemplate: string;

  @IsString()
  @MaxLength(5000)
  contentTemplate: string;

  @IsOptional()
  config?: unknown;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
