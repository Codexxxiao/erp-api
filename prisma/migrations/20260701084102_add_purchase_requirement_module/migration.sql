-- CreateEnum
CREATE TYPE "PurchaseRequirementSourceType" AS ENUM ('MANUAL', 'SALES_ORDER');

-- CreateEnum
CREATE TYPE "PurchaseRequirementStatus" AS ENUM ('DRAFT', 'OPEN', 'PARTIALLY_ORDERED', 'ORDERED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PurchaseRequirementItemStatus" AS ENUM ('OPEN', 'PARTIALLY_ORDERED', 'ORDERED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PurchaseRequirementPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateTable
CREATE TABLE "PurchaseRequirement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requirementNo" TEXT NOT NULL,
    "sourceType" "PurchaseRequirementSourceType" NOT NULL DEFAULT 'MANUAL',
    "sourceSalesOrderId" TEXT,
    "customerId" TEXT,
    "customerName" TEXT,
    "subject" TEXT NOT NULL,
    "status" "PurchaseRequirementStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "PurchaseRequirementPriority" NOT NULL DEFAULT 'NORMAL',
    "requiredDate" TIMESTAMP(3),
    "ownerUserId" TEXT,
    "closedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "remark" TEXT,
    "extra" JSONB,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequirementItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "sourceSalesOrderItemId" TEXT,
    "productId" TEXT,
    "productCode" TEXT,
    "productNameCn" TEXT,
    "productNameEn" TEXT,
    "categoryCode" TEXT,
    "unitCode" TEXT,
    "requiredQuantity" DECIMAL(18,4) NOT NULL,
    "orderedQuantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "suggestedSupplierId" TEXT,
    "suggestedSupplierName" TEXT,
    "targetPurchasePrice" DECIMAL(18,4),
    "currencyCode" TEXT,
    "requiredDate" TIMESTAMP(3),
    "status" "PurchaseRequirementItemStatus" NOT NULL DEFAULT 'OPEN',
    "remark" TEXT,
    "extra" JSONB,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseRequirementItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PurchaseRequirement_tenantId_idx" ON "PurchaseRequirement"("tenantId");

-- CreateIndex
CREATE INDEX "PurchaseRequirement_sourceSalesOrderId_idx" ON "PurchaseRequirement"("sourceSalesOrderId");

-- CreateIndex
CREATE INDEX "PurchaseRequirement_customerId_idx" ON "PurchaseRequirement"("customerId");

-- CreateIndex
CREATE INDEX "PurchaseRequirement_status_idx" ON "PurchaseRequirement"("status");

-- CreateIndex
CREATE INDEX "PurchaseRequirement_priority_idx" ON "PurchaseRequirement"("priority");

-- CreateIndex
CREATE INDEX "PurchaseRequirement_ownerUserId_idx" ON "PurchaseRequirement"("ownerUserId");

-- CreateIndex
CREATE INDEX "PurchaseRequirement_createdAt_idx" ON "PurchaseRequirement"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseRequirement_tenantId_requirementNo_key" ON "PurchaseRequirement"("tenantId", "requirementNo");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseRequirement_tenantId_sourceSalesOrderId_key" ON "PurchaseRequirement"("tenantId", "sourceSalesOrderId");

-- CreateIndex
CREATE INDEX "PurchaseRequirementItem_tenantId_idx" ON "PurchaseRequirementItem"("tenantId");

-- CreateIndex
CREATE INDEX "PurchaseRequirementItem_requirementId_idx" ON "PurchaseRequirementItem"("requirementId");

-- CreateIndex
CREATE INDEX "PurchaseRequirementItem_sourceSalesOrderItemId_idx" ON "PurchaseRequirementItem"("sourceSalesOrderItemId");

-- CreateIndex
CREATE INDEX "PurchaseRequirementItem_productId_idx" ON "PurchaseRequirementItem"("productId");

-- CreateIndex
CREATE INDEX "PurchaseRequirementItem_productCode_idx" ON "PurchaseRequirementItem"("productCode");

-- CreateIndex
CREATE INDEX "PurchaseRequirementItem_suggestedSupplierId_idx" ON "PurchaseRequirementItem"("suggestedSupplierId");

-- CreateIndex
CREATE INDEX "PurchaseRequirementItem_status_idx" ON "PurchaseRequirementItem"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseRequirementItem_tenantId_sourceSalesOrderItemId_key" ON "PurchaseRequirementItem"("tenantId", "sourceSalesOrderItemId");

-- AddForeignKey
ALTER TABLE "PurchaseRequirementItem" ADD CONSTRAINT "PurchaseRequirementItem_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "PurchaseRequirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
