import { PartialType } from '@nestjs/swagger';
import { CreateFormTableDto } from './create-form-table.dto';

export class UpdateFormTableDto extends PartialType(CreateFormTableDto) {}
