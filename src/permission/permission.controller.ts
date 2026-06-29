import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt/jwt.guard';
import { PlatformAdminGuard } from '../auth/guards/platform-admin.guard';
import { PermissionService } from './permission.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';

@Controller('admin/permissions')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class PermissionController {
  constructor(private readonly permissions: PermissionService) {}

  @Post()
  create(@Body() dto: CreatePermissionDto) {
    return this.permissions.createPermission(dto);
  }

  @Get()
  findMany() {
    return this.permissions.findPermissions();
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePermissionDto) {
    return this.permissions.updatePermission(id, dto);
  }
}
