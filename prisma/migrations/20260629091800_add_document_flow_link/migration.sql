-- CreateEnum
CREATE TYPE "DocumentFlowRepeatPolicy" AS ENUM ('BLOCK', 'ALLOW');

-- CreateEnum
CREATE TYPE "DocumentFlowLinkStatus" AS ENUM ('RESERVED', 'SUCCESS', 'FAILED', 'CANCELED');

-- AlterTable
ALTER TABLE "DocumentFlow" ADD COLUMN     "repeatPolicy" "DocumentFlowRepeatPolicy" NOT NULL DEFAULT 'BLOCK';

-- AlterTable
ALTER TABLE "DocumentFlowExecution" ADD COLUMN     "linkId" TEXT;

-- CreateTable
CREATE TABLE "DocumentFlowLink" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "sourceFormId" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "sourceRecordNo" TEXT,
    "targetFormId" TEXT NOT NULL,
    "targetRecordId" TEXT,
    "targetRecordNo" TEXT,
    "status" "DocumentFlowLinkStatus" NOT NULL DEFAULT 'RESERVED',
    "dedupKey" TEXT,
    "errorMessage" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentFlowLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentFlowLink_tenantId_idx" ON "DocumentFlowLink"("tenantId");

-- CreateIndex
CREATE INDEX "DocumentFlowLink_flowId_idx" ON "DocumentFlowLink"("flowId");

-- CreateIndex
CREATE INDEX "DocumentFlowLink_sourceRecordId_idx" ON "DocumentFlowLink"("sourceRecordId");

-- CreateIndex
CREATE INDEX "DocumentFlowLink_targetRecordId_idx" ON "DocumentFlowLink"("targetRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentFlowLink_tenantId_flowId_dedupKey_key" ON "DocumentFlowLink"("tenantId", "flowId", "dedupKey");

-- CreateIndex
CREATE INDEX "DocumentFlowExecution_linkId_idx" ON "DocumentFlowExecution"("linkId");

-- AddForeignKey
ALTER TABLE "DocumentFlowLink" ADD CONSTRAINT "DocumentFlowLink_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "DocumentFlow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentFlowExecution" ADD CONSTRAINT "DocumentFlowExecution_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "DocumentFlowLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;
