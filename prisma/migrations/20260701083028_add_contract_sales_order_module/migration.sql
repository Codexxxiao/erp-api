-- CreateEnum
CREATE TYPE "SalesContractStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "SalesOrderStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "SalesContract" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contractNo" TEXT NOT NULL,
    "quotationId" TEXT,
    "customerId" TEXT,
    "customerName" TEXT,
    "customerContactId" TEXT,
    "customerContactName" TEXT,
    "subject" TEXT NOT NULL,
    "status" "SalesContractStatus" NOT NULL DEFAULT 'DRAFT',
    "currencyCode" TEXT NOT NULL,
    "exchangeRate" DECIMAL(18,6),
    "tradeTerm" TEXT,
    "paymentTerm" TEXT,
    "signDate" TIMESTAMP(3),
    "effectiveDate" TIMESTAMP(3),
    "expectedDeliveryDate" TIMESTAMP(3),
    "ownerUserId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "subtotalAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "freightAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "otherAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "remark" TEXT,
    "extra" JSONB,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesContractItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "sourceQuotationItemId" TEXT,
    "productId" TEXT,
    "productCode" TEXT,
    "productNameCn" TEXT,
    "productNameEn" TEXT,
    "categoryCode" TEXT,
    "unitCode" TEXT,
    "description" TEXT,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "grossAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "discountRate" DECIMAL(8,4),
    "discountAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "taxRate" DECIMAL(8,4),
    "taxAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "amount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "currencyCode" TEXT,
    "expectedDeliveryDate" TIMESTAMP(3),
    "remark" TEXT,
    "extra" JSONB,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesContractItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOrder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderNo" TEXT NOT NULL,
    "contractId" TEXT,
    "quotationId" TEXT,
    "customerId" TEXT,
    "customerName" TEXT,
    "customerContactId" TEXT,
    "customerContactName" TEXT,
    "subject" TEXT NOT NULL,
    "status" "SalesOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "currencyCode" TEXT NOT NULL,
    "exchangeRate" DECIMAL(18,6),
    "tradeTerm" TEXT,
    "paymentTerm" TEXT,
    "expectedDeliveryDate" TIMESTAMP(3),
    "ownerUserId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "processingAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "subtotalAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "freightAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "otherAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "remark" TEXT,
    "extra" JSONB,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOrderItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "sourceContractItemId" TEXT,
    "sourceQuotationItemId" TEXT,
    "productId" TEXT,
    "productCode" TEXT,
    "productNameCn" TEXT,
    "productNameEn" TEXT,
    "categoryCode" TEXT,
    "unitCode" TEXT,
    "orderedQuantity" DECIMAL(18,4) NOT NULL,
    "shippedQuantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "grossAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "amount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "currencyCode" TEXT,
    "expectedDeliveryDate" TIMESTAMP(3),
    "remark" TEXT,
    "extra" JSONB,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalesContract_tenantId_idx" ON "SalesContract"("tenantId");

-- CreateIndex
CREATE INDEX "SalesContract_quotationId_idx" ON "SalesContract"("quotationId");

-- CreateIndex
CREATE INDEX "SalesContract_customerId_idx" ON "SalesContract"("customerId");

-- CreateIndex
CREATE INDEX "SalesContract_status_idx" ON "SalesContract"("status");

-- CreateIndex
CREATE INDEX "SalesContract_ownerUserId_idx" ON "SalesContract"("ownerUserId");

-- CreateIndex
CREATE INDEX "SalesContract_createdAt_idx" ON "SalesContract"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SalesContract_tenantId_contractNo_key" ON "SalesContract"("tenantId", "contractNo");

-- CreateIndex
CREATE INDEX "SalesContractItem_tenantId_idx" ON "SalesContractItem"("tenantId");

-- CreateIndex
CREATE INDEX "SalesContractItem_contractId_idx" ON "SalesContractItem"("contractId");

-- CreateIndex
CREATE INDEX "SalesContractItem_sourceQuotationItemId_idx" ON "SalesContractItem"("sourceQuotationItemId");

-- CreateIndex
CREATE INDEX "SalesContractItem_productId_idx" ON "SalesContractItem"("productId");

-- CreateIndex
CREATE INDEX "SalesOrder_tenantId_idx" ON "SalesOrder"("tenantId");

-- CreateIndex
CREATE INDEX "SalesOrder_contractId_idx" ON "SalesOrder"("contractId");

-- CreateIndex
CREATE INDEX "SalesOrder_quotationId_idx" ON "SalesOrder"("quotationId");

-- CreateIndex
CREATE INDEX "SalesOrder_customerId_idx" ON "SalesOrder"("customerId");

-- CreateIndex
CREATE INDEX "SalesOrder_status_idx" ON "SalesOrder"("status");

-- CreateIndex
CREATE INDEX "SalesOrder_ownerUserId_idx" ON "SalesOrder"("ownerUserId");

-- CreateIndex
CREATE INDEX "SalesOrder_createdAt_idx" ON "SalesOrder"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SalesOrder_tenantId_orderNo_key" ON "SalesOrder"("tenantId", "orderNo");

-- CreateIndex
CREATE INDEX "SalesOrderItem_tenantId_idx" ON "SalesOrderItem"("tenantId");

-- CreateIndex
CREATE INDEX "SalesOrderItem_orderId_idx" ON "SalesOrderItem"("orderId");

-- CreateIndex
CREATE INDEX "SalesOrderItem_sourceContractItemId_idx" ON "SalesOrderItem"("sourceContractItemId");

-- CreateIndex
CREATE INDEX "SalesOrderItem_sourceQuotationItemId_idx" ON "SalesOrderItem"("sourceQuotationItemId");

-- CreateIndex
CREATE INDEX "SalesOrderItem_productId_idx" ON "SalesOrderItem"("productId");

-- AddForeignKey
ALTER TABLE "SalesContractItem" ADD CONSTRAINT "SalesContractItem_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "SalesContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "SalesContract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderItem" ADD CONSTRAINT "SalesOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
