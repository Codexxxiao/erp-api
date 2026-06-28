import { IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class CreateTenantDto {
  @IsString()
  name: string;

  @IsString()
  @Matches(/^[a-z0-9][a-z0-9-]{1,31}$/)
  code: string;

  @IsString()
  adminUsername: string;

  @IsString()
  @MinLength(6)
  adminPassword: string;

  @IsOptional()
  @IsString()
  adminNickname?: string;
}
