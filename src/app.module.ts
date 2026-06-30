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
import { DictionaryModule } from './dictionary/dictionary.module';
import { DatasourceModule } from './datasource/datasource.module';
import { MetadataModule } from './metadata/metadata.module';
import { RuntimeFormModule } from './runtime-form/runtime-form.module';
import { FormSchemaProvisionModule } from './form-schema-provision/form-schema-provision.module';
import { DocumentFlowModule } from './document-flow/document-flow.module';
import { FormSnapshotModule } from './form-snapshot/form-snapshot.module';
import { WorkflowModule } from './workflow/workflow.module';

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
    DictionaryModule,
    DatasourceModule,
    MetadataModule,
    RuntimeFormModule,
    FormSchemaProvisionModule,
    DocumentFlowModule,
    FormSnapshotModule,
    WorkflowModule,
  ],
  providers: [{ provide: APP_INTERCEPTOR, useClass: AuditInterceptor }],
})
export class AppModule {}
