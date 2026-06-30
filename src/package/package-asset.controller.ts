import {
  Body,
  Controller,
  Delete,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt/jwt.guard';
import { PlatformAdminGuard } from '../auth/guards/platform-admin.guard';
import { UpdatePackageAssetDto } from './dto/update-package-asset.dto';
import { PackageService } from './package.service';

@UseGuards(JwtAuthGuard, PlatformAdminGuard)
@Controller('admin/package-assets')
export class PackageAssetController {
  constructor(private readonly packageService: PackageService) {}

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePackageAssetDto) {
    return this.packageService.updateAsset(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.packageService.removeAsset(id);
  }
}
