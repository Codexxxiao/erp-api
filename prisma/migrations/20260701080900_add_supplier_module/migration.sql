-- CreateEnum
CREATE TYPE "InquiryStatus" AS ENUM ('DRAFT', 'OPEN', 'QUOTED', 'WON', 'LOST', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InquiryPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateTable
CREATE TABLE "Inquiry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "inquiryNo" TEXT NOT NULL,
    "customerId" TEXT,
    "customerName" TEXT,
    "customerContactId" TEXT,
    "customerContactName" TEXT,
    "subject" TEXT NOT NULL,
    "sourceCode" TEXT,
    "priority" "InquiryPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "InquiryStatus" NOT NULL DEFAULT 'OPEN',
    "currencyCode" TEXT,
    "tradeTerm" TEXT,
    "paymentTerm" TEXT,
    "expectedDeliveryDate" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "ownerUserId" TEXT,
    "quotedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "lostReason" TEXT,
    "remark" TEXT,
    "extra" JSONB,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InquiryItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "inquiryId" TEXT NOT NULL,
    "productId" TEXT,
    "productCode" TEXT,
    "productNameCn" TEXT,
    "productNameEn" TEXT,
    "categoryCode" TEXT,
    "unitCode" TEXT,
    "quantity" DECIMAL(18,4) NOT NULL,
    "targetPrice" DECIMAL(18,4),
    "currencyCode" TEXT,
    "expectedDeliveryDate" TIMESTAMP(3),
    "remark" TEXT,
    "extra" JSONB,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InquiryItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Inquiry_tenantId_idx" ON "Inquiry"("tenantId");

-- CreateIndex
CREATE INDEX "Inquiry_customerId_idx" ON "Inquiry"("customerId");

-- CreateIndex
CREATE INDEX "Inquiry_status_idx" ON "Inquiry"("status");

-- CreateIndex
CREATE INDEX "Inquiry_priority_idx" ON "Inquiry"("priority");

-- CreateIndex
CREATE INDEX "Inquiry_sourceCode_idx" ON "Inquiry"("sourceCode");

-- CreateIndex
CREATE INDEX "Inquiry_ownerUserId_idx" ON "Inquiry"("ownerUserId");

-- CreateIndex
CREATE INDEX "Inquiry_createdAt_idx" ON "Inquiry"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Inquiry_tenantId_inquiryNo_key" ON "Inquiry"("tenantId", "inquiryNo");

-- CreateIndex
CREATE INDEX "InquiryItem_tenantId_idx" ON "InquiryItem"("tenantId");

-- CreateIndex
CREATE INDEX "InquiryItem_inquiryId_idx" ON "InquiryItem"("inquiryId");

-- CreateIndex
CREATE INDEX "InquiryItem_productId_idx" ON "InquiryItem"("productId");

-- CreateIndex
CREATE INDEX "InquiryItem_productCode_idx" ON "InquiryItem"("productCode");

-- AddForeignKey
ALTER TABLE "InquiryItem" ADD CONSTRAINT "InquiryItem_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "Inquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
