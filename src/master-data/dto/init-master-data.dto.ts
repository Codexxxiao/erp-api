import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

export class InitMasterDataDto {
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  overwrite?: boolean;
}
