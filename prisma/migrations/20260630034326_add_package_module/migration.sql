-- CreateEnum
CREATE TYPE "PackageStatus" AS ENUM ('DRAFT', 'ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "PackageVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PackageAssetType" AS ENUM ('PERMISSION', 'MENU', 'DICTIONARY', 'DATA_SOURCE', 'FORM', 'FORM_VERSION', 'LIST_VIEW', 'DOCUMENT_FLOW', 'WORKFLOW', 'MESSAGE_TEMPLATE');

-- CreateTable
CREATE TABLE "Package" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "tags" JSONB,
    "status" "PackageStatus" NOT NULL DEFAULT 'DRAFT',
    "config" JSONB,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Package_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageVersion" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "versionNo" INTEGER NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "changelog" TEXT,
    "status" "PackageVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "config" JSONB,
    "publishedById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackageVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageAsset" (
    "id" TEXT NOT NULL,
    "packageVersionId" TEXT NOT NULL,
    "type" "PackageAssetType" NOT NULL,
    "assetId" TEXT NOT NULL,
    "sourceTenantId" TEXT,
    "assetCode" TEXT,
    "assetName" TEXT,
    "assetSnapshot" JSONB,
    "dependencies" JSONB,
    "config" JSONB,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackageAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Package_code_key" ON "Package"("code");

-- CreateIndex
CREATE INDEX "Package_status_idx" ON "Package"("status");

-- CreateIndex
CREATE INDEX "Package_category_idx" ON "Package"("category");

-- CreateIndex
CREATE INDEX "Package_createdAt_idx" ON "Package"("createdAt");

-- CreateIndex
CREATE INDEX "PackageVersion_packageId_idx" ON "PackageVersion"("packageId");

-- CreateIndex
CREATE INDEX "PackageVersion_status_idx" ON "PackageVersion"("status");

-- CreateIndex
CREATE INDEX "PackageVersion_publishedAt_idx" ON "PackageVersion"("publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PackageVersion_packageId_versionNo_key" ON "PackageVersion"("packageId", "versionNo");

-- CreateIndex
CREATE INDEX "PackageAsset_packageVersionId_idx" ON "PackageAsset"("packageVersionId");

-- CreateIndex
CREATE INDEX "PackageAsset_type_idx" ON "PackageAsset"("type");

-- CreateIndex
CREATE INDEX "PackageAsset_assetId_idx" ON "PackageAsset"("assetId");

-- CreateIndex
CREATE INDEX "PackageAsset_sourceTenantId_idx" ON "PackageAsset"("sourceTenantId");

-- CreateIndex
CREATE UNIQUE INDEX "PackageAsset_packageVersionId_type_assetId_key" ON "PackageAsset"("packageVersionId", "type", "assetId");

-- AddForeignKey
ALTER TABLE "PackageVersion" ADD CONSTRAINT "PackageVersion_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageAsset" ADD CONSTRAINT "PackageAsset_packageVersionId_fkey" FOREIGN KEY ("packageVersionId") REFERENCES "PackageVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
