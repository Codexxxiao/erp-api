import { Module } from '@nestjs/common';
import { FormSnapshotModule } from '../form-snapshot/form-snapshot.module';
import { FormSchemaProvisionController } from './form-schema-provision.controller';
import { FormSchemaProvisionService } from './form-schema-provision.service';

@Module({
  imports: [FormSnapshotModule],
  controllers: [FormSchemaProvisionController],
  providers: [FormSchemaProvisionService],
  exports: [FormSchemaProvisionService],
})
export class FormSchemaProvisionModule {}
