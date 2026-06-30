import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt/jwt.guard';
import { PlatformAdminGuard } from '../auth/guards/platform-admin.guard';
import { PreviewPackageUpgradeDto } from './dto/preview-package-upgrade.dto';
import { PackageUpgradeService } from './package-upgrade.service';

@UseGuards(JwtAuthGuard, PlatformAdminGuard)
@Controller('admin/package-upgrades')
export class PackageUpgradeController {
  constructor(private readonly service: PackageUpgradeService) {}

  @Get('tenants/:tenantId/packages')
  findTenantPackages(@Param('tenantId') tenantId: string) {
    return this.service.findTenantPackages(tenantId);
  }

  @Get('tenants/:tenantId/packages/:packageId/available')
  findAvailableVersions(
    @Param('tenantId') tenantId: string,
    @Param('packageId') packageId: string,
  ) {
    return this.service.findAvailableVersions(tenantId, packageId);
  }

  @Post('preview')
  preview(@Body() dto: PreviewPackageUpgradeDto) {
    return this.service.preview(dto);
  }
}
