import { IsOptional, IsString, MinLength } from 'class-validator';

export class BootstrapPlatformAdminDto {
  @IsString()
  username: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsString()
  nickname?: string;
}
