// src/tenant-user/tenant-user.module.ts
import { Module } from '@nestjs/common';
import { TenantUserController } from './tenant-user.controller';
import { TenantUserService } from './tenant-user.service';

@Module({
  controllers: [TenantUserController],
  providers: [TenantUserService],
})
export class TenantUserModule {}
