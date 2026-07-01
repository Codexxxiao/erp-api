import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt/jwt.guard';
import { TenantMemberGuard } from '../common/guards/tenant-member.guard';
import { MustChangePasswordGuard } from '../common/guards/must-change-password.guard';
import { CurrentUserDecorator } from '../common/decorators/current-user.decorator';
import type { CurrentUser } from '../common/types/current-user';
import { InitMasterDataDto } from './dto/init-master-data.dto';
import { MasterDataService } from './master-data.service';

@UseGuards(JwtAuthGuard, TenantMemberGuard, MustChangePasswordGuard)
@Controller('tenant/master-data')
export class MasterDataController {
  constructor(private readonly service: MasterDataService) {}

  @Get('presets')
  presets() {
    return this.service.presets();
  }

  @Post('init')
  init(
    @CurrentUserDecorator() user: CurrentUser,
    @Body() dto: InitMasterDataDto,
  ) {
    return this.service.initTenant(user, dto);
  }
}
