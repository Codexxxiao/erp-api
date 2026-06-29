-- CreateEnum
CREATE TYPE "FormRecordStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'CANCELED');

-- CreateTable
CREATE TABLE "FormRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "formCode" TEXT NOT NULL,
    "recordNo" TEXT NOT NULL,
    "status" "FormRecordStatus" NOT NULL DEFAULT 'DRAFT',
    "mainData" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormRecordDetail" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "tableCode" TEXT NOT NULL,
    "rowIndex" INTEGER NOT NULL DEFAULT 0,
    "rowData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormRecordDetail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FormRecord_tenantId_idx" ON "FormRecord"("tenantId");

-- CreateIndex
CREATE INDEX "FormRecord_formId_idx" ON "FormRecord"("formId");

-- CreateIndex
CREATE INDEX "FormRecord_formCode_idx" ON "FormRecord"("formCode");

-- CreateIndex
CREATE INDEX "FormRecord_status_idx" ON "FormRecord"("status");

-- CreateIndex
CREATE UNIQUE INDEX "FormRecord_tenantId_recordNo_key" ON "FormRecord"("tenantId", "recordNo");

-- CreateIndex
CREATE INDEX "FormRecordDetail_recordId_idx" ON "FormRecordDetail"("recordId");

-- CreateIndex
CREATE INDEX "FormRecordDetail_tableId_idx" ON "FormRecordDetail"("tableId");

-- CreateIndex
CREATE INDEX "FormRecordDetail_tableCode_idx" ON "FormRecordDetail"("tableCode");

-- AddForeignKey
ALTER TABLE "FormRecord" ADD CONSTRAINT "FormRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormRecord" ADD CONSTRAINT "FormRecord_formId_fkey" FOREIGN KEY ("formId") REFERENCES "FormDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormRecordDetail" ADD CONSTRAINT "FormRecordDetail_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "FormRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormRecordDetail" ADD CONSTRAINT "FormRecordDetail_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "FormTable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
