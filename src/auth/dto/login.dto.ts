import { IsOptional, IsString } from 'class-validator';

export class LoginDto {
  @IsOptional()
  @IsString()
  tenantCode?: string;

  @IsString()
  username: string;

  @IsString()
  password: string;
}
