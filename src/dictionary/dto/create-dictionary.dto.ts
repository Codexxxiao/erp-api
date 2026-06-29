import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class CreateDictionaryDto {
  @IsString()
  @Matches(/^[a-z][a-z0-9.-]*$/)
  code: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  sort?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
