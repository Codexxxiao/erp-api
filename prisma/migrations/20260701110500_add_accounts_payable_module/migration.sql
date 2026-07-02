-- CreateEnum
CREATE TYPE "AccountsPayableSourceType" AS ENUM ('MANUAL', 'PURCHASE_ORDER', 'INBOUND_RECEIPT');

-- CreateEnum
CREATE TYPE "AccountsPayableStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'PARTIALLY_PAID', 'PAID', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AccountsPayablePaymentStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AccountsPayablePaymentMethod" AS ENUM ('BANK_TRANSFER', 'CASH', 'CHECK', 'ALIPAY', 'WECHAT', 'OTHER');

-- CreateTable
CREATE TABLE "AccountsPayable" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "payableNo" TEXT NOT NULL,
    "sourceType" "AccountsPayableSourceType" NOT NULL DEFAULT 'MANUAL',
    "sourceId" TEXT,
    "sourceNo" TEXT,
    "purchaseOrderId" TEXT,
    "inboundReceiptId" TEXT,
    "supplierId" TEXT,
    "supplierName" TEXT,
    "subject" TEXT NOT NULL,
    "status" "AccountsPayableStatus" NOT NULL DEFAULT 'DRAFT',
    "currencyCode" TEXT NOT NULL,
    "exchangeRate" DECIMAL(18,6),
    "totalAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "paidAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "outstandingAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "dueDate" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "remark" TEXT,
    "extra" JSONB,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountsPayable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountsPayableItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "payableId" TEXT NOT NULL,
    "sourceItemId" TEXT,
    "productId" TEXT,
    "productCode" TEXT,
    "productNameCn" TEXT,
    "productNameEn" TEXT,
    "categoryCode" TEXT,
    "unitCode" TEXT,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "currencyCode" TEXT,
    "remark" TEXT,
    "extra" JSONB,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountsPayableItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountsPayablePayment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "paymentNo" TEXT NOT NULL,
    "supplierId" TEXT,
    "supplierName" TEXT,
    "status" "AccountsPayablePaymentStatus" NOT NULL DEFAULT 'DRAFT',
    "paymentDate" TIMESTAMP(3),
    "method" "AccountsPayablePaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
    "bankAccountNo" TEXT,
    "transactionNo" TEXT,
    "currencyCode" TEXT NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "allocatedAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "unappliedAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "confirmedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "remark" TEXT,
    "extra" JSONB,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountsPayablePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountsPayablePaymentAllocation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "payableId" TEXT NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountsPayablePaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountsPayable_tenantId_idx" ON "AccountsPayable"("tenantId");

-- CreateIndex
CREATE INDEX "AccountsPayable_sourceType_sourceId_idx" ON "AccountsPayable"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "AccountsPayable_purchaseOrderId_idx" ON "AccountsPayable"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "AccountsPayable_inboundReceiptId_idx" ON "AccountsPayable"("inboundReceiptId");

-- CreateIndex
CREATE INDEX "AccountsPayable_supplierId_idx" ON "AccountsPayable"("supplierId");

-- CreateIndex
CREATE INDEX "AccountsPayable_status_idx" ON "AccountsPayable"("status");

-- CreateIndex
CREATE INDEX "AccountsPayable_createdAt_idx" ON "AccountsPayable"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AccountsPayable_tenantId_payableNo_key" ON "AccountsPayable"("tenantId", "payableNo");

-- CreateIndex
CREATE INDEX "AccountsPayableItem_tenantId_idx" ON "AccountsPayableItem"("tenantId");

-- CreateIndex
CREATE INDEX "AccountsPayableItem_payableId_idx" ON "AccountsPayableItem"("payableId");

-- CreateIndex
CREATE INDEX "AccountsPayableItem_sourceItemId_idx" ON "AccountsPayableItem"("sourceItemId");

-- CreateIndex
CREATE INDEX "AccountsPayableItem_productId_idx" ON "AccountsPayableItem"("productId");

-- CreateIndex
CREATE INDEX "AccountsPayableItem_productCode_idx" ON "AccountsPayableItem"("productCode");

-- CreateIndex
CREATE INDEX "AccountsPayablePayment_tenantId_idx" ON "AccountsPayablePayment"("tenantId");

-- CreateIndex
CREATE INDEX "AccountsPayablePayment_supplierId_idx" ON "AccountsPayablePayment"("supplierId");

-- CreateIndex
CREATE INDEX "AccountsPayablePayment_status_idx" ON "AccountsPayablePayment"("status");

-- CreateIndex
CREATE INDEX "AccountsPayablePayment_paymentDate_idx" ON "AccountsPayablePayment"("paymentDate");

-- CreateIndex
CREATE INDEX "AccountsPayablePayment_createdAt_idx" ON "AccountsPayablePayment"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AccountsPayablePayment_tenantId_paymentNo_key" ON "AccountsPayablePayment"("tenantId", "paymentNo");

-- CreateIndex
CREATE INDEX "AccountsPayablePaymentAllocation_tenantId_idx" ON "AccountsPayablePaymentAllocation"("tenantId");

-- CreateIndex
CREATE INDEX "AccountsPayablePaymentAllocation_paymentId_idx" ON "AccountsPayablePaymentAllocation"("paymentId");

-- CreateIndex
CREATE INDEX "AccountsPayablePaymentAllocation_payableId_idx" ON "AccountsPayablePaymentAllocation"("payableId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountsPayablePaymentAllocation_paymentId_payableId_key" ON "AccountsPayablePaymentAllocation"("paymentId", "payableId");

-- AddForeignKey
ALTER TABLE "AccountsPayableItem" ADD CONSTRAINT "AccountsPayableItem_payableId_fkey" FOREIGN KEY ("payableId") REFERENCES "AccountsPayable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountsPayablePaymentAllocation" ADD CONSTRAINT "AccountsPayablePaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "AccountsPayablePayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountsPayablePaymentAllocation" ADD CONSTRAINT "AccountsPayablePaymentAllocation_payableId_fkey" FOREIGN KEY ("payableId") REFERENCES "AccountsPayable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
