-- CreateEnum
CREATE TYPE "OutboundShipmentStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'SHIPPED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OutboundShipmentItemStatus" AS ENUM ('NORMAL', 'CANCELLED');

-- AlterEnum
ALTER TYPE "InventoryTransactionType" ADD VALUE 'OUTBOUND_SHIPMENT';

-- CreateTable
CREATE TABLE "OutboundShipment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "shipmentNo" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "salesOrderNo" TEXT,
    "customerId" TEXT,
    "customerName" TEXT,
    "status" "OutboundShipmentStatus" NOT NULL DEFAULT 'DRAFT',
    "shipmentDate" TIMESTAMP(3),
    "warehouseCode" TEXT,
    "transportMode" TEXT,
    "carrierName" TEXT,
    "trackingNo" TEXT,
    "bookingNo" TEXT,
    "containerNo" TEXT,
    "blNo" TEXT,
    "etd" TIMESTAMP(3),
    "eta" TIMESTAMP(3),
    "destinationPort" TEXT,
    "shippingAddress" TEXT,
    "consigneeName" TEXT,
    "ownerUserId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "totalShippedQuantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "remark" TEXT,
    "extra" JSONB,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutboundShipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboundShipmentItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "salesOrderItemId" TEXT NOT NULL,
    "productId" TEXT,
    "productCode" TEXT,
    "productNameCn" TEXT,
    "productNameEn" TEXT,
    "categoryCode" TEXT,
    "unitCode" TEXT,
    "warehouseCode" TEXT NOT NULL,
    "locationCode" TEXT NOT NULL DEFAULT '',
    "batchNo" TEXT NOT NULL DEFAULT '',
    "shippedQuantity" DECIMAL(18,4) NOT NULL,
    "unitPrice" DECIMAL(18,4),
    "amount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "currencyCode" TEXT,
    "status" "OutboundShipmentItemStatus" NOT NULL DEFAULT 'NORMAL',
    "remark" TEXT,
    "extra" JSONB,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutboundShipmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OutboundShipment_tenantId_idx" ON "OutboundShipment"("tenantId");

-- CreateIndex
CREATE INDEX "OutboundShipment_salesOrderId_idx" ON "OutboundShipment"("salesOrderId");

-- CreateIndex
CREATE INDEX "OutboundShipment_customerId_idx" ON "OutboundShipment"("customerId");

-- CreateIndex
CREATE INDEX "OutboundShipment_status_idx" ON "OutboundShipment"("status");

-- CreateIndex
CREATE INDEX "OutboundShipment_warehouseCode_idx" ON "OutboundShipment"("warehouseCode");

-- CreateIndex
CREATE INDEX "OutboundShipment_shipmentDate_idx" ON "OutboundShipment"("shipmentDate");

-- CreateIndex
CREATE INDEX "OutboundShipment_createdAt_idx" ON "OutboundShipment"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OutboundShipment_tenantId_shipmentNo_key" ON "OutboundShipment"("tenantId", "shipmentNo");

-- CreateIndex
CREATE INDEX "OutboundShipmentItem_tenantId_idx" ON "OutboundShipmentItem"("tenantId");

-- CreateIndex
CREATE INDEX "OutboundShipmentItem_shipmentId_idx" ON "OutboundShipmentItem"("shipmentId");

-- CreateIndex
CREATE INDEX "OutboundShipmentItem_salesOrderItemId_idx" ON "OutboundShipmentItem"("salesOrderItemId");

-- CreateIndex
CREATE INDEX "OutboundShipmentItem_productId_idx" ON "OutboundShipmentItem"("productId");

-- CreateIndex
CREATE INDEX "OutboundShipmentItem_productCode_idx" ON "OutboundShipmentItem"("productCode");

-- CreateIndex
CREATE INDEX "OutboundShipmentItem_warehouseCode_idx" ON "OutboundShipmentItem"("warehouseCode");

-- CreateIndex
CREATE INDEX "OutboundShipmentItem_status_idx" ON "OutboundShipmentItem"("status");

-- AddForeignKey
ALTER TABLE "OutboundShipmentItem" ADD CONSTRAINT "OutboundShipmentItem_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "OutboundShipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
