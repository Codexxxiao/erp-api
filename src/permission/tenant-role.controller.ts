import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Put,
  UseGuards,
  Post,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt/jwt.guard';
import { TenantAdminGuard } from '../common/guards/tenant-admin.guard';
import { TenantMemberGuard } from '../common/guards/tenant-member.guard';
import { MustChangePasswordGuard } from '../common/guards/must-change-password.guard';
import { CurrentUserDecorator } from '../common/decorators/current-user.decorator';
import type { CurrentUser } from '../common/types/current-user';
import { PermissionService } from './permission.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { SetRolePermissionsDto } from './dto/set-role-permissions.dto';
import { SetUserRolesDto } from './dto/set-user-roles.dto';

@Controller('tenant')
export class TenantRoleController {
  constructor(private readonly permissions: PermissionService) {}

  @Get('permissions/me')
  @UseGuards(JwtAuthGuard, TenantMemberGuard, MustChangePasswordGuard)
  myPermissions(@CurrentUserDecorator() user: CurrentUser) {
    return this.permissions.getCurrentPermissionCodes(user);
  }

  @Post('roles')
  @UseGuards(JwtAuthGuard, TenantAdminGuard, MustChangePasswordGuard)
  createRole(
    @CurrentUserDecorator() user: CurrentUser,
    @Body() dto: CreateRoleDto,
  ) {
    return this.permissions.createRole(user, dto);
  }

  @Get('roles')
  @UseGuards(JwtAuthGuard, TenantAdminGuard, MustChangePasswordGuard)
  findRoles(@CurrentUserDecorator() user: CurrentUser) {
    return this.permissions.findRoles(user);
  }

  @Get('roles/:id')
  @UseGuards(JwtAuthGuard, TenantAdminGuard, MustChangePasswordGuard)
  findRole(@CurrentUserDecorator() user: CurrentUser, @Param('id') id: string) {
    return this.permissions.findRole(user, id);
  }

  @Patch('roles/:id')
  @UseGuards(JwtAuthGuard, TenantAdminGuard, MustChangePasswordGuard)
  updateRole(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.permissions.updateRole(user, id, dto);
  }

  @Put('roles/:id/permissions')
  @UseGuards(JwtAuthGuard, TenantAdminGuard, MustChangePasswordGuard)
  setRolePermissions(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: SetRolePermissionsDto,
  ) {
    return this.permissions.setRolePermissions(user, id, dto.permissionCodes);
  }

  @Put('users/:id/roles')
  @UseGuards(JwtAuthGuard, TenantAdminGuard, MustChangePasswordGuard)
  setUserRoles(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: SetUserRolesDto,
  ) {
    return this.permissions.setUserRoles(user, id, dto.roleIds);
  }
}
