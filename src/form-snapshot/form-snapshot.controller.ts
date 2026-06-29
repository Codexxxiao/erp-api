import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt/jwt.guard';
import { TenantAdminGuard } from '../common/guards/tenant-admin.guard';
import { TenantMemberGuard } from '../common/guards/tenant-member.guard';
import { MustChangePasswordGuard } from '../common/guards/must-change-password.guard';
import { CurrentUserDecorator } from '../common/decorators/current-user.decorator';
import type { CurrentUser } from '../common/types/current-user';
import { FormSnapshotService } from './form-snapshot.service';

@UseGuards(JwtAuthGuard, TenantMemberGuard, MustChangePasswordGuard)
@Controller('tenant/forms')
export class FormSnapshotController {
  constructor(private readonly formSnapshotService: FormSnapshotService) {}

  @UseGuards(TenantAdminGuard)
  @Post(':id/versions/publish')
  publish(@CurrentUserDecorator() user: CurrentUser, @Param('id') id: string) {
    return this.formSnapshotService.publish(user, id);
  }

  @Get(':id/versions')
  findVersions(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.formSnapshotService.findVersions(user, id);
  }

  @Get(':id/versions/latest')
  findLatest(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.formSnapshotService.findLatest(user, id);
  }

  @Get(':id/versions/:version')
  findOne(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Param('version', ParseIntPipe) version: number,
  ) {
    return this.formSnapshotService.findOne(user, id, version);
  }
}
