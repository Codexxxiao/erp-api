-- CreateEnum
CREATE TYPE "ImportTaskStatus" AS ENUM ('CREATED', 'PREVIEWED', 'VALIDATED', 'IMPORTING', 'SUCCESS', 'PARTIAL_SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "ImportTaskRowStatus" AS ENUM ('PENDING', 'VALID', 'INVALID', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "ImportTask" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "formId" TEXT,
    "formCode" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "sheetName" TEXT,
    "headerRow" INTEGER NOT NULL DEFAULT 1,
    "dataStartRow" INTEGER NOT NULL DEFAULT 2,
    "status" "ImportTaskStatus" NOT NULL DEFAULT 'CREATED',
    "mapping" JSONB,
    "preview" JSONB,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "successRows" INTEGER NOT NULL DEFAULT 0,
    "failedRows" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdById" TEXT NOT NULL,
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportTaskRow" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "status" "ImportTaskRowStatus" NOT NULL DEFAULT 'PENDING',
    "rawData" JSONB NOT NULL,
    "mappedData" JSONB,
    "errors" JSONB,
    "recordId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportTaskRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportTask_tenantId_idx" ON "ImportTask"("tenantId");

-- CreateIndex
CREATE INDEX "ImportTask_formCode_idx" ON "ImportTask"("formCode");

-- CreateIndex
CREATE INDEX "ImportTask_fileId_idx" ON "ImportTask"("fileId");

-- CreateIndex
CREATE INDEX "ImportTask_status_idx" ON "ImportTask"("status");

-- CreateIndex
CREATE INDEX "ImportTask_createdAt_idx" ON "ImportTask"("createdAt");

-- CreateIndex
CREATE INDEX "ImportTaskRow_taskId_idx" ON "ImportTaskRow"("taskId");

-- CreateIndex
CREATE INDEX "ImportTaskRow_status_idx" ON "ImportTaskRow"("status");

-- CreateIndex
CREATE INDEX "ImportTaskRow_recordId_idx" ON "ImportTaskRow"("recordId");

-- CreateIndex
CREATE UNIQUE INDEX "ImportTaskRow_taskId_rowNumber_key" ON "ImportTaskRow"("taskId", "rowNumber");

-- AddForeignKey
ALTER TABLE "ImportTaskRow" ADD CONSTRAINT "ImportTaskRow_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ImportTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
