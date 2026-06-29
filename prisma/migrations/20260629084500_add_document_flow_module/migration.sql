-- CreateEnum
CREATE TYPE "DocumentFlowDirection" AS ENUM ('PUSH_DOWN', 'IMPORT');

-- CreateEnum
CREATE TYPE "DocumentFlowStatus" AS ENUM ('DRAFT', 'ENABLED', 'DISABLED');

-- CreateEnum
CREATE TYPE "DocumentFlowMappingType" AS ENUM ('FIELD', 'CONSTANT');

-- CreateEnum
CREATE TYPE "DocumentFlowExecutionStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "DocumentFlow" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "direction" "DocumentFlowDirection" NOT NULL,
    "sourceFormId" TEXT NOT NULL,
    "targetFormId" TEXT NOT NULL,
    "status" "DocumentFlowStatus" NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentFlow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentFlowMapping" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "sourceTableCode" TEXT,
    "sourceFieldCode" TEXT,
    "targetTableCode" TEXT,
    "targetFieldCode" TEXT NOT NULL,
    "mappingType" "DocumentFlowMappingType" NOT NULL DEFAULT 'FIELD',
    "constantValue" JSONB,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentFlowMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentFlowExecution" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "sourceFormId" TEXT NOT NULL,
    "targetFormId" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "targetRecordId" TEXT,
    "status" "DocumentFlowExecutionStatus" NOT NULL,
    "payload" JSONB,
    "errorMessage" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentFlowExecution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentFlow_tenantId_idx" ON "DocumentFlow"("tenantId");

-- CreateIndex
CREATE INDEX "DocumentFlow_sourceFormId_idx" ON "DocumentFlow"("sourceFormId");

-- CreateIndex
CREATE INDEX "DocumentFlow_targetFormId_idx" ON "DocumentFlow"("targetFormId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentFlow_tenantId_code_key" ON "DocumentFlow"("tenantId", "code");

-- CreateIndex
CREATE INDEX "DocumentFlowMapping_flowId_idx" ON "DocumentFlowMapping"("flowId");

-- CreateIndex
CREATE INDEX "DocumentFlowMapping_sourceTableCode_idx" ON "DocumentFlowMapping"("sourceTableCode");

-- CreateIndex
CREATE INDEX "DocumentFlowMapping_targetTableCode_idx" ON "DocumentFlowMapping"("targetTableCode");

-- CreateIndex
CREATE INDEX "DocumentFlowExecution_tenantId_idx" ON "DocumentFlowExecution"("tenantId");

-- CreateIndex
CREATE INDEX "DocumentFlowExecution_flowId_idx" ON "DocumentFlowExecution"("flowId");

-- CreateIndex
CREATE INDEX "DocumentFlowExecution_sourceRecordId_idx" ON "DocumentFlowExecution"("sourceRecordId");

-- CreateIndex
CREATE INDEX "DocumentFlowExecution_targetRecordId_idx" ON "DocumentFlowExecution"("targetRecordId");

-- AddForeignKey
ALTER TABLE "DocumentFlowMapping" ADD CONSTRAINT "DocumentFlowMapping_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "DocumentFlow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentFlowExecution" ADD CONSTRAINT "DocumentFlowExecution_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "DocumentFlow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
