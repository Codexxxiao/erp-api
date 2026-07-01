-- CreateEnum
CREATE TYPE "SupplierStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLACKLISTED');

-- CreateEnum
CREATE TYPE "SupplierType" AS ENUM ('MANUFACTURER', 'TRADING_COMPANY', 'LOGISTICS', 'SERVICE', 'OTHER');

-- AlterTable
ALTER TABLE "ProductSupplierQuote" ADD COLUMN     "supplierId" TEXT;

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "type" "SupplierType" NOT NULL DEFAULT 'TRADING_COMPANY',
    "status" "SupplierStatus" NOT NULL DEFAULT 'ACTIVE',
    "countryRegion" TEXT,
    "province" TEXT,
    "city" TEXT,
    "address" TEXT,
    "website" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "source" TEXT,
    "level" TEXT,
    "settlementCurrency" TEXT,
    "paymentTerm" TEXT,
    "tradeTerm" TEXT,
    "tags" JSONB,
    "remark" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierContact" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "mobile" TEXT,
    "whatsapp" TEXT,
    "wechat" TEXT,
    "skype" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierFollowUp" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "type" TEXT,
    "content" TEXT NOT NULL,
    "nextFollowAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierFollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Supplier_tenantId_idx" ON "Supplier"("tenantId");

-- CreateIndex
CREATE INDEX "Supplier_tenantId_status_idx" ON "Supplier"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Supplier_tenantId_name_idx" ON "Supplier"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_tenantId_code_key" ON "Supplier"("tenantId", "code");

-- CreateIndex
CREATE INDEX "SupplierContact_tenantId_supplierId_idx" ON "SupplierContact"("tenantId", "supplierId");

-- CreateIndex
CREATE INDEX "SupplierContact_tenantId_isPrimary_idx" ON "SupplierContact"("tenantId", "isPrimary");

-- CreateIndex
CREATE INDEX "SupplierFollowUp_tenantId_supplierId_idx" ON "SupplierFollowUp"("tenantId", "supplierId");

-- CreateIndex
CREATE INDEX "SupplierFollowUp_tenantId_createdAt_idx" ON "SupplierFollowUp"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "ProductSupplierQuote_tenantId_supplierId_idx" ON "ProductSupplierQuote"("tenantId", "supplierId");

-- AddForeignKey
ALTER TABLE "ProductSupplierQuote" ADD CONSTRAINT "ProductSupplierQuote_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierContact" ADD CONSTRAINT "SupplierContact_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierFollowUp" ADD CONSTRAINT "SupplierFollowUp_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
