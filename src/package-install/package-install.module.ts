import { Module } from '@nestjs/common';
import { PackageInstallController } from './package-install.controller';
import { PackageInstallService } from './package-install.service';

@Module({
  controllers: [PackageInstallController],
  providers: [PackageInstallService],
  exports: [PackageInstallService],
})
export class PackageInstallModule {}
