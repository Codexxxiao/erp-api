import { Module } from '@nestjs/common';
import { PackageAssetController } from './package-asset.controller';
import { PackageController } from './package.controller';
import { PackageVersionController } from './package-version.controller';
import { PackageService } from './package.service';

@Module({
  controllers: [
    PackageController,
    PackageVersionController,
    PackageAssetController,
  ],
  providers: [PackageService],
  exports: [PackageService],
})
export class PackageModule {}
