import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  MessageRecipientStatus,
  MessageType,
} from '../../generated/prisma/client';

export class QueryMessageDto {
  @IsOptional()
  @IsEnum(MessageRecipientStatus)
  status?: MessageRecipientStatus;

  @IsOptional()
  @IsEnum(MessageType)
  type?: MessageType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;
}
