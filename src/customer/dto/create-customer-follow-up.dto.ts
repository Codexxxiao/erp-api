import { IsDateString, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateCustomerFollowUpDto {
  @IsString()
  typeCode: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsDateString()
  followedAt?: string;

  @IsOptional()
  @IsDateString()
  nextFollowAt?: string;

  @IsOptional()
  @IsObject()
  extra?: Record<string, unknown>;
}
