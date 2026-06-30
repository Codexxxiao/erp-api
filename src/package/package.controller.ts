import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt/jwt.guard';
import { PlatformAdminGuard } from '../auth/guards/platform-admin.guard';
import { CurrentUserDecorator } from '../common/decorators/current-user.decorator';
import type { CurrentUser } from '../common/types/current-user';
import { CreatePackageDto } from './dto/create-package.dto';
import { CreatePackageVersionDto } from './dto/create-package-version.dto';
import { QueryPackageDto } from './dto/query-package.dto';
import { UpdatePackageDto } from './dto/update-package.dto';
import { PackageService } from './package.service';

@UseGuards(JwtAuthGuard, PlatformAdminGuard)
@Controller('admin/packages')
export class PackageController {
  constructor(private readonly packageService: PackageService) {}

  @Post()
  create(
    @CurrentUserDecorator() user: CurrentUser,
    @Body() dto: CreatePackageDto,
  ) {
    return this.packageService.createPackage(user, dto);
  }

  @Get()
  findMany(@Query() query: QueryPackageDto) {
    return this.packageService.findPackages(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.packageService.findPackage(id);
  }

  @Patch(':id')
  update(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: UpdatePackageDto,
  ) {
    return this.packageService.updatePackage(user, id, dto);
  }

  @Post(':id/versions')
  createVersion(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: CreatePackageVersionDto,
  ) {
    return this.packageService.createVersion(user, id, dto);
  }

  @Get(':id/versions')
  findVersions(@Param('id') id: string) {
    return this.packageService.findVersions(id);
  }
}
