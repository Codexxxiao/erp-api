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
import { MessageModule } from './message/message.module';
import { ListViewModule } from './list-view/list-view.module';
import { ExportModule } from './export/export.module';
import { PackageModule } from './package/package.module';
import { PackageInstallModule } from './package-install/package-install.module';
import { PackageUpgradeModule } from './package-upgrade/package-upgrade.module';
import { FileModule } from './file/file.module';
import { ImportModule } from './import/import.module';
import { ImportTemplateModule } from './import-template/import-template.module';
import { MasterDataModule } from './master-data/master-data.module';
import { CustomerModule } from './customer/customer.module';
import { ProductModule } from './product/product.module';
import { SupplierModule } from './supplier/supplier.module';
import { InquiryModule } from './inquiry/inquiry.module';
import { QuotationModule } from './quotation/quotation.module';
import { ContractModule } from './contract/contract.module';
import { SalesOrderModule } from './sales-order/sales-order.module';
import { PurchaseRequirementModule } from './purchase-requirement/purchase-requirement.module';
import { PurchaseOrderModule } from './purchase-order/purchase-order.module';
import { InboundReceiptModule } from './inbound-receipt/inbound-receipt.module';
import { InventoryModule } from './inventory/inventory.module';
import { OutboundShipmentModule } from './outbound-shipment/outbound-shipment.module';
import { AccountsReceivableModule } from './accounts-receivable/accounts-receivable.module';
import { AccountsPayableModule } from './accounts-payable/accounts-payable.module';
import { FinanceSummaryModule } from './finance-summary/finance-summary.module';
import { CurrencyRateModule } from './currency-rate/currency-rate.module';

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
    MessageModule,
    ListViewModule,
    ExportModule,
    PackageModule,
    PackageInstallModule,
    PackageUpgradeModule,
    FileModule,
    ImportModule,
    ImportTemplateModule,
    MasterDataModule,
    CustomerModule,
    ProductModule,
    SupplierModule,
    InquiryModule,
    QuotationModule,
    ContractModule,
    SalesOrderModule,
    PurchaseRequirementModule,
    PurchaseOrderModule,
    InboundReceiptModule,
    InventoryModule,
    OutboundShipmentModule,
    AccountsReceivableModule,
    AccountsPayableModule,
    FinanceSummaryModule,
    CurrencyRateModule,
  ],
  providers: [{ provide: APP_INTERCEPTOR, useClass: AuditInterceptor }],
})
export class AppModule {}
