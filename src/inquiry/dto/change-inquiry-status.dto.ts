import { IsEnum, IsOptional, IsString } from 'class-validator';
import { InquiryStatus } from '../../generated/prisma/client';

export class ChangeInquiryStatusDto {
  @IsEnum(InquiryStatus)
  status: InquiryStatus;

  @IsOptional()
  @IsString()
  reason?: string;
}
