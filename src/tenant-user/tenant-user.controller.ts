import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt/jwt.guard';
import { TenantAdminGuard } from '../common/guards/tenant-admin.guard';
import { MustChangePasswordGuard } from '../common/guards/must-change-password.guard';
import { CurrentUserDecorator } from '../common/decorators/current-user.decorator';
import type { CurrentUser } from '../common/types/current-user';
import { TenantUserService } from './tenant-user.service';
import { CreateTenantUserDto } from './dto/create-tenant-user.dto';
import { InviteTenantUserDto } from './dto/invite-tenant-user.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { UpdateTenantUserDto } from './dto/update-tenant-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

interface RequestWithUser extends Request {
  user?: CurrentUser;
}

@Controller('tenant/users')
export class TenantUserController {
  constructor(private readonly service: TenantUserService) {}

  @Get()
  @UseGuards(JwtAuthGuard, TenantAdminGuard, MustChangePasswordGuard)
  findMany(@CurrentUserDecorator() user: CurrentUser) {
    return this.service.findMany(user);
  }

  @Post()
  @UseGuards(JwtAuthGuard, TenantAdminGuard, MustChangePasswordGuard)
  create(
    @CurrentUserDecorator() user: CurrentUser,
    @Body() dto: CreateTenantUserDto,
    @Req() req: RequestWithUser,
  ) {
    return this.service.create(user, dto, req.ip);
  }

  @Post('invite')
  @UseGuards(JwtAuthGuard, TenantAdminGuard, MustChangePasswordGuard)
  invite(
    @CurrentUserDecorator() user: CurrentUser,
    @Body() dto: InviteTenantUserDto,
    @Req() req: RequestWithUser,
  ) {
    return this.service.invite(user, dto, req.ip);
  }

  @Post('accept-invite')
  acceptInvite(@Body() dto: AcceptInviteDto, @Req() req: Request) {
    return this.service.acceptInvite(dto, req.ip);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, TenantAdminGuard, MustChangePasswordGuard)
  update(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: UpdateTenantUserDto,
    @Req() req: RequestWithUser,
  ) {
    return this.service.update(user, id, dto, req.ip);
  }

  @Patch(':id/reset-password')
  @UseGuards(JwtAuthGuard, TenantAdminGuard, MustChangePasswordGuard)
  resetPassword(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
    @Req() req: RequestWithUser,
  ) {
    return this.service.resetPassword(user, id, dto.newPassword, req.ip);
  }
}
