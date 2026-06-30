import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt/jwt.guard';
import { PlatformAdminGuard } from '../auth/guards/platform-admin.guard';
import { PreviewPackageUpgradeDto } from './dto/preview-package-upgrade.dto';
import { PackageUpgradeService } from './package-upgrade.service';
import { CurrentUserDecorator } from '../common/decorators/current-user.decorator';
import type { CurrentUser } from '../common/types/current-user';
import { ExecutePackageUpgradeDto } from './dto/execute-package-upgrade.dto';
import { QueryPackageUpgradeDto } from './dto/query-package-upgrade.dto';

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

  @Post('execute')
  execute(
    @CurrentUserDecorator() user: CurrentUser,
    @Body() dto: ExecutePackageUpgradeDto,
  ) {
    return this.service.execute(user, dto);
  }

  @Get('records')
  findMany(@Query() query: QueryPackageUpgradeDto) {
    return this.service.findMany(query);
  }

  @Get('records/:id/logs')
  findLogs(@Param('id') id: string) {
    return this.service.findLogs(id);
  }

  @Get('records/:id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }
}
