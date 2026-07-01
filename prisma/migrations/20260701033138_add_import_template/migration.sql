-- AlterTable
ALTER TABLE "ImportTask" ADD COLUMN     "templateId" TEXT;

-- CreateTable
CREATE TABLE "ImportTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "formId" TEXT,
    "formCode" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "mapping" JSONB NOT NULL,
    "config" JSONB,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportTemplate_tenantId_idx" ON "ImportTemplate"("tenantId");

-- CreateIndex
CREATE INDEX "ImportTemplate_formCode_idx" ON "ImportTemplate"("formCode");

-- CreateIndex
CREATE INDEX "ImportTemplate_formId_idx" ON "ImportTemplate"("formId");

-- CreateIndex
CREATE INDEX "ImportTemplate_isDefault_idx" ON "ImportTemplate"("isDefault");

-- CreateIndex
CREATE INDEX "ImportTemplate_isActive_idx" ON "ImportTemplate"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ImportTemplate_tenantId_code_key" ON "ImportTemplate"("tenantId", "code");

-- CreateIndex
CREATE INDEX "ImportTask_templateId_idx" ON "ImportTask"("templateId");
