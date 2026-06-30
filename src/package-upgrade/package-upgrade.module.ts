import { Module } from '@nestjs/common';
import { PackageInstallModule } from '../package-install/package-install.module';
import { PackageUpgradeController } from './package-upgrade.controller';
import { PackageUpgradeService } from './package-upgrade.service';

@Module({
  imports: [PackageInstallModule],
  controllers: [PackageUpgradeController],
  providers: [PackageUpgradeService],
  exports: [PackageUpgradeService],
})
export class PackageUpgradeModule {}
