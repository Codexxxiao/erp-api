import { Module } from '@nestjs/common';
import { FormSchemaProvisionController } from './form-schema-provision.controller';
import { FormSchemaProvisionService } from './form-schema-provision.service';

@Module({
  controllers: [FormSchemaProvisionController],
  providers: [FormSchemaProvisionService],
  exports: [FormSchemaProvisionService],
})
export class FormSchemaProvisionModule {}
