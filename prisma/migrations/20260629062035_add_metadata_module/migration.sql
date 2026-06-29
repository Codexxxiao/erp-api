-- CreateEnum
CREATE TYPE "FormStatus" AS ENUM ('DRAFT', 'ENABLED', 'DISABLED');

-- CreateEnum
CREATE TYPE "FormTableType" AS ENUM ('MAIN', 'SUB');

-- CreateEnum
CREATE TYPE "FormFieldType" AS ENUM ('TEXT', 'TEXTAREA', 'NUMBER', 'DECIMAL', 'MONEY', 'DATE', 'DATETIME', 'BOOLEAN', 'DICTIONARY', 'DATASOURCE', 'USER', 'ATTACHMENT', 'IMAGE');

-- CreateTable
CREATE TABLE "FormDefinition" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "scopeKey" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "FormStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "layout" JSONB,
    "config" JSONB,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormTable" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "parentId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FormTableType" NOT NULL,
    "layout" JSONB,
    "config" JSONB,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormField" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FormFieldType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "unique" BOOLEAN NOT NULL DEFAULT false,
    "readonly" BOOLEAN NOT NULL DEFAULT false,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "defaultValue" JSONB,
    "dictionaryCode" TEXT,
    "dataSourceCode" TEXT,
    "dataSourceMapping" JSONB,
    "formula" JSONB,
    "validationRules" JSONB,
    "visibleWhen" JSONB,
    "config" JSONB,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormField_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FormDefinition_tenantId_idx" ON "FormDefinition"("tenantId");

-- CreateIndex
CREATE INDEX "FormDefinition_scopeKey_idx" ON "FormDefinition"("scopeKey");

-- CreateIndex
CREATE INDEX "FormDefinition_code_idx" ON "FormDefinition"("code");

-- CreateIndex
CREATE UNIQUE INDEX "FormDefinition_scopeKey_code_key" ON "FormDefinition"("scopeKey", "code");

-- CreateIndex
CREATE INDEX "FormTable_formId_idx" ON "FormTable"("formId");

-- CreateIndex
CREATE INDEX "FormTable_parentId_idx" ON "FormTable"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "FormTable_formId_code_key" ON "FormTable"("formId", "code");

-- CreateIndex
CREATE INDEX "FormField_tableId_idx" ON "FormField"("tableId");

-- CreateIndex
CREATE INDEX "FormField_code_idx" ON "FormField"("code");

-- CreateIndex
CREATE UNIQUE INDEX "FormField_tableId_code_key" ON "FormField"("tableId", "code");

-- AddForeignKey
ALTER TABLE "FormDefinition" ADD CONSTRAINT "FormDefinition_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormTable" ADD CONSTRAINT "FormTable_formId_fkey" FOREIGN KEY ("formId") REFERENCES "FormDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormTable" ADD CONSTRAINT "FormTable_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "FormTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormField" ADD CONSTRAINT "FormField_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "FormTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
