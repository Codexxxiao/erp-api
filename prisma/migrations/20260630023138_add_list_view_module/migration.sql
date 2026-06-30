-- CreateEnum
CREATE TYPE "ListViewStatus" AS ENUM ('DRAFT', 'ENABLED', 'DISABLED');

-- CreateEnum
CREATE TYPE "ListViewColumnSource" AS ENUM ('SYSTEM', 'FIELD');

-- CreateEnum
CREATE TYPE "ListViewFilterOperator" AS ENUM ('EQ', 'NE', 'CONTAINS', 'STARTS_WITH', 'ENDS_WITH', 'GT', 'GTE', 'LT', 'LTE', 'BETWEEN', 'IN', 'IS_NULL', 'IS_NOT_NULL');

-- CreateEnum
CREATE TYPE "ListViewSortDirection" AS ENUM ('ASC', 'DESC');

-- CreateTable
CREATE TABLE "ListView" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "formVersionId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ListViewStatus" NOT NULL DEFAULT 'DRAFT',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListViewColumn" (
    "id" TEXT NOT NULL,
    "viewId" TEXT NOT NULL,
    "source" "ListViewColumnSource" NOT NULL DEFAULT 'FIELD',
    "systemKey" TEXT,
    "fieldId" TEXT,
    "fieldCode" TEXT,
    "title" TEXT NOT NULL,
    "width" INTEGER,
    "fixed" TEXT,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "sortable" BOOLEAN NOT NULL DEFAULT true,
    "sortDirection" "ListViewSortDirection",
    "config" JSONB,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListViewColumn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListViewFilter" (
    "id" TEXT NOT NULL,
    "viewId" TEXT NOT NULL,
    "source" "ListViewColumnSource" NOT NULL DEFAULT 'FIELD',
    "systemKey" TEXT,
    "fieldId" TEXT,
    "fieldCode" TEXT,
    "label" TEXT NOT NULL,
    "operator" "ListViewFilterOperator" NOT NULL,
    "defaultValue" JSONB,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListViewFilter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ListView_tenantId_idx" ON "ListView"("tenantId");

-- CreateIndex
CREATE INDEX "ListView_formId_idx" ON "ListView"("formId");

-- CreateIndex
CREATE INDEX "ListView_formVersionId_idx" ON "ListView"("formVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "ListView_tenantId_code_key" ON "ListView"("tenantId", "code");

-- CreateIndex
CREATE INDEX "ListViewColumn_viewId_idx" ON "ListViewColumn"("viewId");

-- CreateIndex
CREATE INDEX "ListViewColumn_fieldId_idx" ON "ListViewColumn"("fieldId");

-- CreateIndex
CREATE INDEX "ListViewColumn_fieldCode_idx" ON "ListViewColumn"("fieldCode");

-- CreateIndex
CREATE INDEX "ListViewColumn_systemKey_idx" ON "ListViewColumn"("systemKey");

-- CreateIndex
CREATE INDEX "ListViewFilter_viewId_idx" ON "ListViewFilter"("viewId");

-- CreateIndex
CREATE INDEX "ListViewFilter_fieldId_idx" ON "ListViewFilter"("fieldId");

-- CreateIndex
CREATE INDEX "ListViewFilter_fieldCode_idx" ON "ListViewFilter"("fieldCode");

-- CreateIndex
CREATE INDEX "ListViewFilter_systemKey_idx" ON "ListViewFilter"("systemKey");

-- AddForeignKey
ALTER TABLE "ListView" ADD CONSTRAINT "ListView_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListViewColumn" ADD CONSTRAINT "ListViewColumn_viewId_fkey" FOREIGN KEY ("viewId") REFERENCES "ListView"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListViewFilter" ADD CONSTRAINT "ListViewFilter_viewId_fkey" FOREIGN KEY ("viewId") REFERENCES "ListView"("id") ON DELETE CASCADE ON UPDATE CASCADE;
