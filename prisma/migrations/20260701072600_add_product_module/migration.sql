-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DISCONTINUED');

-- CreateEnum
CREATE TYPE "ProductSupplierQuoteStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "sku" TEXT,
    "nameCn" TEXT NOT NULL,
    "nameEn" TEXT,
    "categoryCode" TEXT,
    "unitCode" TEXT,
    "currencyCode" TEXT,
    "costPrice" DECIMAL(18,4),
    "salePrice" DECIMAL(18,4),
    "defaultSupplierCustomerId" TEXT,
    "mainImageFileId" TEXT,
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "description" TEXT,
    "remark" TEXT,
    "extra" JSONB,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductSupplierQuote" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "supplierCustomerId" TEXT,
    "supplierName" TEXT,
    "currencyCode" TEXT NOT NULL,
    "purchasePrice" DECIMAL(18,4) NOT NULL,
    "moq" DECIMAL(18,4),
    "leadTimeDays" INTEGER,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "status" "ProductSupplierQuoteStatus" NOT NULL DEFAULT 'ACTIVE',
    "remark" TEXT,
    "extra" JSONB,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductSupplierQuote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Product_tenantId_idx" ON "Product"("tenantId");

-- CreateIndex
CREATE INDEX "Product_categoryCode_idx" ON "Product"("categoryCode");

-- CreateIndex
CREATE INDEX "Product_unitCode_idx" ON "Product"("unitCode");

-- CreateIndex
CREATE INDEX "Product_currencyCode_idx" ON "Product"("currencyCode");

-- CreateIndex
CREATE INDEX "Product_status_idx" ON "Product"("status");

-- CreateIndex
CREATE INDEX "Product_defaultSupplierCustomerId_idx" ON "Product"("defaultSupplierCustomerId");

-- CreateIndex
CREATE INDEX "Product_createdAt_idx" ON "Product"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Product_tenantId_code_key" ON "Product"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Product_tenantId_sku_key" ON "Product"("tenantId", "sku");

-- CreateIndex
CREATE INDEX "ProductSupplierQuote_tenantId_idx" ON "ProductSupplierQuote"("tenantId");

-- CreateIndex
CREATE INDEX "ProductSupplierQuote_productId_idx" ON "ProductSupplierQuote"("productId");

-- CreateIndex
CREATE INDEX "ProductSupplierQuote_supplierCustomerId_idx" ON "ProductSupplierQuote"("supplierCustomerId");

-- CreateIndex
CREATE INDEX "ProductSupplierQuote_currencyCode_idx" ON "ProductSupplierQuote"("currencyCode");

-- CreateIndex
CREATE INDEX "ProductSupplierQuote_isDefault_idx" ON "ProductSupplierQuote"("isDefault");

-- CreateIndex
CREATE INDEX "ProductSupplierQuote_status_idx" ON "ProductSupplierQuote"("status");

-- AddForeignKey
ALTER TABLE "ProductSupplierQuote" ADD CONSTRAINT "ProductSupplierQuote_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
