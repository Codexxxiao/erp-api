import { APP_INTERCEPTOR } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { TenantModule } from './tenant/tenant.module';
import { AuditModule } from './audit/audit.module';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { TenantUserModule } from './tenant-user/tenant-user.module';
import { PermissionModule } from './permission/permission.module';
import { MenuModule } from './menu/menu.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    TenantModule,
    AuditModule,
    TenantUserModule,
    PermissionModule,
    MenuModule,
  ],
  providers: [{ provide: APP_INTERCEPTOR, useClass: AuditInterceptor }],
})
export class AppModule {}
