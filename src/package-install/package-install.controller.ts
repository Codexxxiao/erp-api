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
import { CurrentUserDecorator } from '../common/decorators/current-user.decorator';
import type { CurrentUser } from '../common/types/current-user';
import { CreatePackageInstallDto } from './dto/create-package-install.dto';
import { QueryPackageInstallDto } from './dto/query-package-install.dto';
import { PackageInstallService } from './package-install.service';

@UseGuards(JwtAuthGuard, PlatformAdminGuard)
@Controller('admin/package-installs')
export class PackageInstallController {
  constructor(private readonly service: PackageInstallService) {}

  @Post('preview')
  preview(@Body() dto: CreatePackageInstallDto) {
    return this.service.preview(dto);
  }

  @Post()
  install(
    @CurrentUserDecorator() user: CurrentUser,
    @Body() dto: CreatePackageInstallDto,
  ) {
    return this.service.install(user, dto);
  }

  @Get()
  findMany(@Query() query: QueryPackageInstallDto) {
    return this.service.findMany(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }
}
