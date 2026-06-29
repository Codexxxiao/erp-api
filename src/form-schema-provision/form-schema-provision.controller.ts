import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt/jwt.guard';
import { TenantAdminGuard } from '../common/guards/tenant-admin.guard';
import { MustChangePasswordGuard } from '../common/guards/must-change-password.guard';
import { CurrentUserDecorator } from '../common/decorators/current-user.decorator';
import type { CurrentUser } from '../common/types/current-user';
import { FormSchemaProvisionService } from './form-schema-provision.service';
import { Query } from '@nestjs/common';

@UseGuards(JwtAuthGuard, TenantAdminGuard, MustChangePasswordGuard)
@Controller('tenant/forms')
export class FormSchemaProvisionController {
  constructor(
    private readonly formSchemaProvisionService: FormSchemaProvisionService,
  ) {}

  @Patch(':id/publish-schema')
  publishSchema(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Query('version') version?: string,
  ) {
    return this.formSchemaProvisionService.publishTenantForm(
      user,
      id,
      version ? Number(version) : undefined,
    );
  }

  @Get(':id/physical-schema')
  getPhysicalSchema(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.formSchemaProvisionService.getPhysicalSchema(user, id);
  }
}
