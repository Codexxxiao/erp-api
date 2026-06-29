import { PartialType } from '@nestjs/swagger';
import { CreateRuntimeFormDto } from './create-runtime-form.dto';

export class UpdateRuntimeFormDto extends PartialType(CreateRuntimeFormDto) {}
