import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt/jwt.guard';
import { PlatformAdminGuard } from '../auth/guards/platform-admin.guard';
import { CurrentUserDecorator } from '../common/decorators/current-user.decorator';
import type { CurrentUser } from '../common/types/current-user';
import { AddPackageAssetDto } from './dto/add-package-asset.dto';
import { PackageService } from './package.service';

@UseGuards(JwtAuthGuard, PlatformAdminGuard)
@Controller('admin/package-versions')
export class PackageVersionController {
  constructor(private readonly packageService: PackageService) {}

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.packageService.findVersion(id);
  }

  @Post(':id/publish')
  publish(@CurrentUserDecorator() user: CurrentUser, @Param('id') id: string) {
    return this.packageService.publishVersion(user, id);
  }

  @Get(':id/assets')
  findAssets(@Param('id') id: string) {
    return this.packageService.findAssets(id);
  }

  @Post(':id/assets')
  addAsset(@Param('id') id: string, @Body() dto: AddPackageAssetDto) {
    return this.packageService.addAsset(id, dto);
  }
}
