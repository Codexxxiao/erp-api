import { PartialType } from '@nestjs/swagger';
import { CreateFormFieldDto } from './create-form-field.dto';

export class UpdateFormFieldDto extends PartialType(CreateFormFieldDto) {}
