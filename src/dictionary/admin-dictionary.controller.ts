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
import { DictionaryService } from './dictionary.service';
import { CreateDictionaryDto } from './dto/create-dictionary.dto';
import { UpdateDictionaryDto } from './dto/update-dictionary.dto';
import { CreateDictionaryItemDto } from './dto/create-dictionary-item.dto';
import { UpdateDictionaryItemDto } from './dto/update-dictionary-item.dto';

@Controller('admin/dictionaries')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class AdminDictionaryController {
  constructor(private readonly dictionaries: DictionaryService) {}

  @Post()
  create(@Body() dto: CreateDictionaryDto) {
    return this.dictionaries.createSystemDictionary(dto);
  }

  @Get()
  findMany() {
    return this.dictionaries.findSystemDictionaries();
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDictionaryDto) {
    return this.dictionaries.updateSystemDictionary(id, dto);
  }

  @Post(':id/items')
  createItem(@Param('id') id: string, @Body() dto: CreateDictionaryItemDto) {
    return this.dictionaries.createSystemItem(id, dto);
  }

  @Patch('items/:itemId')
  updateItem(
    @Param('itemId') itemId: string,
    @Body() dto: UpdateDictionaryItemDto,
  ) {
    return this.dictionaries.updateSystemItem(itemId, dto);
  }
}
