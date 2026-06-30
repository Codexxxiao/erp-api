import { Module } from '@nestjs/common';
import { PackageUpgradeController } from './package-upgrade.controller';
import { PackageUpgradeService } from './package-upgrade.service';

@Module({
  controllers: [PackageUpgradeController],
  providers: [PackageUpgradeService],
  exports: [PackageUpgradeService],
})
export class PackageUpgradeModule {}
