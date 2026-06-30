import { Module } from '@nestjs/common';
import { FormSchemaProvisionModule } from '../form-schema-provision/form-schema-provision.module';
import { PackageInstallController } from './package-install.controller';
import { PackageInstallService } from './package-install.service';

@Module({
  imports: [FormSchemaProvisionModule],
  controllers: [PackageInstallController],
  providers: [PackageInstallService],
  exports: [PackageInstallService],
})
export class PackageInstallModule {}
