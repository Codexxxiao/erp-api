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
import { TenantAdminGuard } from '../common/guards/tenant-admin.guard';
import { TenantMemberGuard } from '../common/guards/tenant-member.guard';
import { MustChangePasswordGuard } from '../common/guards/must-change-password.guard';
import { CurrentUserDecorator } from '../common/decorators/current-user.decorator';
import type { CurrentUser } from '../common/types/current-user';
import { MessageService } from './message.service';
import { SendMessageDto } from './dto/send-message.dto';
import { QueryMessageDto } from './dto/query-message.dto';
import { CreateMessageTemplateDto } from './dto/create-message-template.dto';
import { UpdateMessageTemplateDto } from './dto/update-message-template.dto';
import { SendTemplateMessageDto } from './dto/send-template-message.dto';

@UseGuards(JwtAuthGuard, TenantMemberGuard, MustChangePasswordGuard)
@Controller('tenant/messages')
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @UseGuards(TenantAdminGuard)
  @Post()
  send(@CurrentUserDecorator() user: CurrentUser, @Body() dto: SendMessageDto) {
    return this.messageService.send(user, dto);
  }

  @Get()
  findMine(
    @CurrentUserDecorator() user: CurrentUser,
    @Query() query: QueryMessageDto,
  ) {
    return this.messageService.findMine(user, query);
  }

  @Get('unread-count')
  unreadCount(@CurrentUserDecorator() user: CurrentUser) {
    return this.messageService.unreadCount(user);
  }

  @Patch('read-all')
  markAllRead(@CurrentUserDecorator() user: CurrentUser) {
    return this.messageService.markAllRead(user);
  }

  @UseGuards(TenantAdminGuard)
  @Post('templates')
  createTemplate(
    @CurrentUserDecorator() user: CurrentUser,
    @Body() dto: CreateMessageTemplateDto,
  ) {
    return this.messageService.createTemplate(user, dto);
  }

  @UseGuards(TenantAdminGuard)
  @Get('templates')
  findTemplates(@CurrentUserDecorator() user: CurrentUser) {
    return this.messageService.findTemplates(user);
  }

  @UseGuards(TenantAdminGuard)
  @Patch('templates/:id')
  updateTemplate(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: UpdateMessageTemplateDto,
  ) {
    return this.messageService.updateTemplate(user, id, dto);
  }

  @UseGuards(TenantAdminGuard)
  @Post('templates/send')
  sendByTemplate(
    @CurrentUserDecorator() user: CurrentUser,
    @Body() dto: SendTemplateMessageDto,
  ) {
    return this.messageService.sendByTemplate(user, dto);
  }

  @Get(':id')
  findOne(@CurrentUserDecorator() user: CurrentUser, @Param('id') id: string) {
    return this.messageService.findOne(user, id);
  }

  @Patch(':id/read')
  markRead(@CurrentUserDecorator() user: CurrentUser, @Param('id') id: string) {
    return this.messageService.markRead(user, id);
  }

  @Patch(':id/archive')
  archive(@CurrentUserDecorator() user: CurrentUser, @Param('id') id: string) {
    return this.messageService.archive(user, id);
  }
}
