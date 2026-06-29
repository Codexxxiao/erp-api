import { IsOptional, IsString, Matches } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @Matches(/^[a-z][a-z0-9-]{1,31}$/)
  code: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}
