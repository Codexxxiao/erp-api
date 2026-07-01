-- CreateEnum
CREATE TYPE "InboundReceiptStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InboundReceiptItemStatus" AS ENUM ('NORMAL', 'CANCELLED');

-- CreateTable
CREATE TABLE "InboundReceipt" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "receiptNo" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "purchaseOrderNo" TEXT,
    "supplierId" TEXT,
    "supplierName" TEXT,
    "status" "InboundReceiptStatus" NOT NULL DEFAULT 'DRAFT',
    "receiptDate" TIMESTAMP(3),
    "warehouseCode" TEXT,
    "ownerUserId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "totalReceivedQuantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "totalQualifiedQuantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "totalRejectedQuantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "remark" TEXT,
    "extra" JSONB,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboundReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboundReceiptItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "purchaseOrderItemId" TEXT NOT NULL,
    "productId" TEXT,
    "productCode" TEXT,
    "productNameCn" TEXT,
    "productNameEn" TEXT,
    "categoryCode" TEXT,
    "unitCode" TEXT,
    "receivedQuantity" DECIMAL(18,4) NOT NULL,
    "qualifiedQuantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "rejectedQuantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(18,4),
    "amount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "currencyCode" TEXT,
    "batchNo" TEXT,
    "warehouseCode" TEXT,
    "locationCode" TEXT,
    "status" "InboundReceiptItemStatus" NOT NULL DEFAULT 'NORMAL',
    "remark" TEXT,
    "extra" JSONB,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboundReceiptItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InboundReceipt_tenantId_idx" ON "InboundReceipt"("tenantId");

-- CreateIndex
CREATE INDEX "InboundReceipt_purchaseOrderId_idx" ON "InboundReceipt"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "InboundReceipt_supplierId_idx" ON "InboundReceipt"("supplierId");

-- CreateIndex
CREATE INDEX "InboundReceipt_status_idx" ON "InboundReceipt"("status");

-- CreateIndex
CREATE INDEX "InboundReceipt_receiptDate_idx" ON "InboundReceipt"("receiptDate");

-- CreateIndex
CREATE INDEX "InboundReceipt_createdAt_idx" ON "InboundReceipt"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "InboundReceipt_tenantId_receiptNo_key" ON "InboundReceipt"("tenantId", "receiptNo");

-- CreateIndex
CREATE INDEX "InboundReceiptItem_tenantId_idx" ON "InboundReceiptItem"("tenantId");

-- CreateIndex
CREATE INDEX "InboundReceiptItem_receiptId_idx" ON "InboundReceiptItem"("receiptId");

-- CreateIndex
CREATE INDEX "InboundReceiptItem_purchaseOrderItemId_idx" ON "InboundReceiptItem"("purchaseOrderItemId");

-- CreateIndex
CREATE INDEX "InboundReceiptItem_productId_idx" ON "InboundReceiptItem"("productId");

-- CreateIndex
CREATE INDEX "InboundReceiptItem_productCode_idx" ON "InboundReceiptItem"("productCode");

-- CreateIndex
CREATE INDEX "InboundReceiptItem_status_idx" ON "InboundReceiptItem"("status");

-- AddForeignKey
ALTER TABLE "InboundReceiptItem" ADD CONSTRAINT "InboundReceiptItem_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "InboundReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
