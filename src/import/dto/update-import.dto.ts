import { PartialType } from '@nestjs/swagger';
import { CreateImportDto } from './create-import.dto';

export class UpdateImportDto extends PartialType(CreateImportDto) {}
