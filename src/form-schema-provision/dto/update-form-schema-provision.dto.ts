import { PartialType } from '@nestjs/swagger';
import { CreateFormSchemaProvisionDto } from './create-form-schema-provision.dto';

export class UpdateFormSchemaProvisionDto extends PartialType(CreateFormSchemaProvisionDto) {}
