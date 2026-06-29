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
import { DictionaryService } from './dictionary.service';
import { CreateDictionaryDto } from './dto/create-dictionary.dto';
import { UpdateDictionaryDto } from './dto/update-dictionary.dto';
import { CreateDictionaryItemDto } from './dto/create-dictionary-item.dto';
import { UpdateDictionaryItemDto } from './dto/update-dictionary-item.dto';

@Controller('tenant/dictionaries')
export class TenantDictionaryController {
  constructor(private readonly dictionaries: DictionaryService) {}

  @Get()
  @UseGuards(JwtAuthGuard, TenantAdminGuard, MustChangePasswordGuard)
  findTenantDictionaries(@CurrentUserDecorator() user: CurrentUser) {
    return this.dictionaries.findTenantDictionaries(user);
  }

  @Get('available')
  @UseGuards(JwtAuthGuard, TenantMemberGuard, MustChangePasswordGuard)
  findAvailable(@CurrentUserDecorator() user: CurrentUser) {
    return this.dictionaries.findAvailableDictionaries(user);
  }

  @Get('code/:code/items')
  @UseGuards(JwtAuthGuard, TenantMemberGuard, MustChangePasswordGuard)
  findItemsByCode(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('code') code: string,
  ) {
    return this.dictionaries.findTenantItemsByCode(user, code);
  }

  @Post()
  @UseGuards(JwtAuthGuard, TenantAdminGuard, MustChangePasswordGuard)
  create(
    @CurrentUserDecorator() user: CurrentUser,
    @Body() dto: CreateDictionaryDto,
  ) {
    return this.dictionaries.createTenantDictionary(user, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, TenantAdminGuard, MustChangePasswordGuard)
  update(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: UpdateDictionaryDto,
  ) {
    return this.dictionaries.updateTenantDictionary(user, id, dto);
  }

  @Post(':id/items')
  @UseGuards(JwtAuthGuard, TenantAdminGuard, MustChangePasswordGuard)
  createItem(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: CreateDictionaryItemDto,
  ) {
    return this.dictionaries.createTenantItem(user, id, dto);
  }

  @Patch('items/:itemId')
  @UseGuards(JwtAuthGuard, TenantAdminGuard, MustChangePasswordGuard)
  updateItem(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateDictionaryItemDto,
  ) {
    return this.dictionaries.updateTenantItem(user, itemId, dto);
  }
}
