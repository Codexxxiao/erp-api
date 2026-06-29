-- CreateEnum
CREATE TYPE "PhysicalSchemaStatus" AS ENUM ('DRAFT', 'SYNCED', 'FAILED');

-- CreateTable
CREATE TABLE "FormPhysicalTable" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "formVersion" INTEGER NOT NULL,
    "tableCode" TEXT NOT NULL,
    "tableName" TEXT NOT NULL,
    "status" "PhysicalSchemaStatus" NOT NULL DEFAULT 'DRAFT',
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormPhysicalTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormPhysicalColumn" (
    "id" TEXT NOT NULL,
    "physicalTableId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "fieldCode" TEXT NOT NULL,
    "columnName" TEXT NOT NULL,
    "labelColumnName" TEXT,
    "extraColumnName" TEXT,
    "sqlType" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isNullable" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormPhysicalColumn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FormPhysicalTable_tenantId_idx" ON "FormPhysicalTable"("tenantId");

-- CreateIndex
CREATE INDEX "FormPhysicalTable_formId_idx" ON "FormPhysicalTable"("formId");

-- CreateIndex
CREATE UNIQUE INDEX "FormPhysicalTable_tableId_key" ON "FormPhysicalTable"("tableId");

-- CreateIndex
CREATE UNIQUE INDEX "FormPhysicalTable_tenantId_tableName_key" ON "FormPhysicalTable"("tenantId", "tableName");

-- CreateIndex
CREATE INDEX "FormPhysicalColumn_fieldId_idx" ON "FormPhysicalColumn"("fieldId");

-- CreateIndex
CREATE UNIQUE INDEX "FormPhysicalColumn_physicalTableId_fieldId_key" ON "FormPhysicalColumn"("physicalTableId", "fieldId");

-- CreateIndex
CREATE UNIQUE INDEX "FormPhysicalColumn_physicalTableId_columnName_key" ON "FormPhysicalColumn"("physicalTableId", "columnName");

-- AddForeignKey
ALTER TABLE "FormPhysicalColumn" ADD CONSTRAINT "FormPhysicalColumn_physicalTableId_fkey" FOREIGN KEY ("physicalTableId") REFERENCES "FormPhysicalTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
