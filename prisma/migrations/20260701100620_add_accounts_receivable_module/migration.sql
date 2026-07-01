-- CreateEnum
CREATE TYPE "AccountsReceivableSourceType" AS ENUM ('MANUAL', 'SALES_ORDER', 'OUTBOUND_SHIPMENT');

-- CreateEnum
CREATE TYPE "AccountsReceivableStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AccountsReceivablePaymentStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AccountsReceivablePaymentMethod" AS ENUM ('BANK_TRANSFER', 'CASH', 'CHECK', 'ALIPAY', 'WECHAT', 'OTHER');

-- CreateTable
CREATE TABLE "AccountsReceivable" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "receivableNo" TEXT NOT NULL,
    "sourceType" "AccountsReceivableSourceType" NOT NULL DEFAULT 'MANUAL',
    "sourceId" TEXT,
    "sourceNo" TEXT,
    "salesOrderId" TEXT,
    "outboundShipmentId" TEXT,
    "customerId" TEXT,
    "customerName" TEXT,
    "subject" TEXT NOT NULL,
    "status" "AccountsReceivableStatus" NOT NULL DEFAULT 'DRAFT',
    "currencyCode" TEXT NOT NULL,
    "exchangeRate" DECIMAL(18,6),
    "totalAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "receivedAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
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

    CONSTRAINT "AccountsReceivable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountsReceivableItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "receivableId" TEXT NOT NULL,
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

    CONSTRAINT "AccountsReceivableItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountsReceivablePayment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "paymentNo" TEXT NOT NULL,
    "customerId" TEXT,
    "customerName" TEXT,
    "status" "AccountsReceivablePaymentStatus" NOT NULL DEFAULT 'DRAFT',
    "paymentDate" TIMESTAMP(3),
    "method" "AccountsReceivablePaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
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

    CONSTRAINT "AccountsReceivablePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountsReceivablePaymentAllocation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "receivableId" TEXT NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountsReceivablePaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountsReceivable_tenantId_idx" ON "AccountsReceivable"("tenantId");

-- CreateIndex
CREATE INDEX "AccountsReceivable_sourceType_sourceId_idx" ON "AccountsReceivable"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "AccountsReceivable_salesOrderId_idx" ON "AccountsReceivable"("salesOrderId");

-- CreateIndex
CREATE INDEX "AccountsReceivable_outboundShipmentId_idx" ON "AccountsReceivable"("outboundShipmentId");

-- CreateIndex
CREATE INDEX "AccountsReceivable_customerId_idx" ON "AccountsReceivable"("customerId");

-- CreateIndex
CREATE INDEX "AccountsReceivable_status_idx" ON "AccountsReceivable"("status");

-- CreateIndex
CREATE INDEX "AccountsReceivable_createdAt_idx" ON "AccountsReceivable"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AccountsReceivable_tenantId_receivableNo_key" ON "AccountsReceivable"("tenantId", "receivableNo");

-- CreateIndex
CREATE INDEX "AccountsReceivableItem_tenantId_idx" ON "AccountsReceivableItem"("tenantId");

-- CreateIndex
CREATE INDEX "AccountsReceivableItem_receivableId_idx" ON "AccountsReceivableItem"("receivableId");

-- CreateIndex
CREATE INDEX "AccountsReceivableItem_sourceItemId_idx" ON "AccountsReceivableItem"("sourceItemId");

-- CreateIndex
CREATE INDEX "AccountsReceivableItem_productId_idx" ON "AccountsReceivableItem"("productId");

-- CreateIndex
CREATE INDEX "AccountsReceivableItem_productCode_idx" ON "AccountsReceivableItem"("productCode");

-- CreateIndex
CREATE INDEX "AccountsReceivablePayment_tenantId_idx" ON "AccountsReceivablePayment"("tenantId");

-- CreateIndex
CREATE INDEX "AccountsReceivablePayment_customerId_idx" ON "AccountsReceivablePayment"("customerId");

-- CreateIndex
CREATE INDEX "AccountsReceivablePayment_status_idx" ON "AccountsReceivablePayment"("status");

-- CreateIndex
CREATE INDEX "AccountsReceivablePayment_paymentDate_idx" ON "AccountsReceivablePayment"("paymentDate");

-- CreateIndex
CREATE INDEX "AccountsReceivablePayment_createdAt_idx" ON "AccountsReceivablePayment"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AccountsReceivablePayment_tenantId_paymentNo_key" ON "AccountsReceivablePayment"("tenantId", "paymentNo");

-- CreateIndex
CREATE INDEX "AccountsReceivablePaymentAllocation_tenantId_idx" ON "AccountsReceivablePaymentAllocation"("tenantId");

-- CreateIndex
CREATE INDEX "AccountsReceivablePaymentAllocation_paymentId_idx" ON "AccountsReceivablePaymentAllocation"("paymentId");

-- CreateIndex
CREATE INDEX "AccountsReceivablePaymentAllocation_receivableId_idx" ON "AccountsReceivablePaymentAllocation"("receivableId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountsReceivablePaymentAllocation_paymentId_receivableId_key" ON "AccountsReceivablePaymentAllocation"("paymentId", "receivableId");

-- AddForeignKey
ALTER TABLE "AccountsReceivableItem" ADD CONSTRAINT "AccountsReceivableItem_receivableId_fkey" FOREIGN KEY ("receivableId") REFERENCES "AccountsReceivable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountsReceivablePaymentAllocation" ADD CONSTRAINT "AccountsReceivablePaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "AccountsReceivablePayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountsReceivablePaymentAllocation" ADD CONSTRAINT "AccountsReceivablePaymentAllocation_receivableId_fkey" FOREIGN KEY ("receivableId") REFERENCES "AccountsReceivable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
