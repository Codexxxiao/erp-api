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
import { TenantAdminGuard } from '../common/guards/tenant-admin.guard';
import { TenantMemberGuard } from '../common/guards/tenant-member.guard';
import { MustChangePasswordGuard } from '../common/guards/must-change-password.guard';
import { CurrentUserDecorator } from '../common/decorators/current-user.decorator';
import type { CurrentUser } from '../common/types/current-user';
import { MenuService, type MenuTreeNode } from './menu.service';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';

@Controller('tenant/menus')
export class MenuController {
  constructor(private readonly menus: MenuService) {}

  @Get('tree')
  @UseGuards(JwtAuthGuard, TenantMemberGuard, MustChangePasswordGuard)
  tree(@CurrentUserDecorator() user: CurrentUser): Promise<MenuTreeNode[]> {
    return this.menus.getCurrentUserMenuTree(user);
  }

  @Post()
  @UseGuards(JwtAuthGuard, TenantAdminGuard, MustChangePasswordGuard)
  create(
    @CurrentUserDecorator() user: CurrentUser,
    @Body() dto: CreateMenuDto,
  ) {
    return this.menus.create(user, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, TenantAdminGuard, MustChangePasswordGuard)
  findMany(@CurrentUserDecorator() user: CurrentUser) {
    return this.menus.findMany(user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, TenantAdminGuard, MustChangePasswordGuard)
  update(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: UpdateMenuDto,
  ) {
    return this.menus.update(user, id, dto);
  }
}
