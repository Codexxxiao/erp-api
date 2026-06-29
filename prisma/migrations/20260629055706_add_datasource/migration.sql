-- CreateEnum
CREATE TYPE "DataSourceType" AS ENUM ('STATIC', 'DICTIONARY', 'INTERNAL', 'HTTP');

-- CreateEnum
CREATE TYPE "DataSourceFieldType" AS ENUM ('STRING', 'NUMBER', 'BOOLEAN', 'DATE', 'DATETIME', 'JSON');

-- CreateTable
CREATE TABLE "DataSource" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "scopeKey" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DataSourceType" NOT NULL,
    "description" TEXT,
    "config" JSONB NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataSourceField" (
    "id" TEXT NOT NULL,
    "dataSourceId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "type" "DataSourceFieldType" NOT NULL DEFAULT 'STRING',
    "isValue" BOOLEAN NOT NULL DEFAULT false,
    "isLabel" BOOLEAN NOT NULL DEFAULT false,
    "isExtra" BOOLEAN NOT NULL DEFAULT true,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataSourceField_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DataSource_tenantId_idx" ON "DataSource"("tenantId");

-- CreateIndex
CREATE INDEX "DataSource_scopeKey_idx" ON "DataSource"("scopeKey");

-- CreateIndex
CREATE INDEX "DataSource_code_idx" ON "DataSource"("code");

-- CreateIndex
CREATE UNIQUE INDEX "DataSource_scopeKey_code_key" ON "DataSource"("scopeKey", "code");

-- CreateIndex
CREATE INDEX "DataSourceField_dataSourceId_idx" ON "DataSourceField"("dataSourceId");

-- CreateIndex
CREATE UNIQUE INDEX "DataSourceField_dataSourceId_key_key" ON "DataSourceField"("dataSourceId", "key");

-- AddForeignKey
ALTER TABLE "DataSource" ADD CONSTRAINT "DataSource_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataSourceField" ADD CONSTRAINT "DataSourceField_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "DataSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
