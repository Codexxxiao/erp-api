import { Module } from '@nestjs/common';
import { PermissionController } from './permission.controller';
import { TenantRoleController } from './tenant-role.controller';
import { PermissionService } from './permission.service';

@Module({
  controllers: [PermissionController, TenantRoleController],
  providers: [PermissionService],
  exports: [PermissionService],
})
export class PermissionModule {}
