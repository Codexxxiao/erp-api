-- CreateEnum
CREATE TYPE "PackageInstallStatus" AS ENUM ('INSTALLING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "PackageInstallConflictPolicy" AS ENUM ('FAIL', 'SKIP', 'OVERWRITE');

-- CreateEnum
CREATE TYPE "PackageInstallAssetStatus" AS ENUM ('SUCCESS', 'SKIPPED', 'FAILED');

-- CreateEnum
CREATE TYPE "PackageInstallAssetAction" AS ENUM ('CREATED', 'UPDATED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "PackageInstallLogLevel" AS ENUM ('INFO', 'WARNING', 'ERROR');

-- CreateTable
CREATE TABLE "PackageInstall" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "packageVersionId" TEXT NOT NULL,
    "status" "PackageInstallStatus" NOT NULL DEFAULT 'INSTALLING',
    "conflictPolicy" "PackageInstallConflictPolicy" NOT NULL DEFAULT 'FAIL',
    "installedById" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "error" TEXT,
    "summary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackageInstall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageInstallAsset" (
    "id" TEXT NOT NULL,
    "installId" TEXT NOT NULL,
    "packageAssetId" TEXT,
    "type" "PackageAssetType" NOT NULL,
    "sourceAssetId" TEXT NOT NULL,
    "targetAssetId" TEXT,
    "assetCode" TEXT,
    "status" "PackageInstallAssetStatus" NOT NULL,
    "action" "PackageInstallAssetAction",
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackageInstallAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageInstallLog" (
    "id" TEXT NOT NULL,
    "installId" TEXT NOT NULL,
    "level" "PackageInstallLogLevel" NOT NULL DEFAULT 'INFO',
    "message" TEXT NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackageInstallLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PackageInstall_tenantId_idx" ON "PackageInstall"("tenantId");

-- CreateIndex
CREATE INDEX "PackageInstall_packageVersionId_idx" ON "PackageInstall"("packageVersionId");

-- CreateIndex
CREATE INDEX "PackageInstall_status_idx" ON "PackageInstall"("status");

-- CreateIndex
CREATE INDEX "PackageInstall_createdAt_idx" ON "PackageInstall"("createdAt");

-- CreateIndex
CREATE INDEX "PackageInstallAsset_installId_idx" ON "PackageInstallAsset"("installId");

-- CreateIndex
CREATE INDEX "PackageInstallAsset_packageAssetId_idx" ON "PackageInstallAsset"("packageAssetId");

-- CreateIndex
CREATE INDEX "PackageInstallAsset_type_idx" ON "PackageInstallAsset"("type");

-- CreateIndex
CREATE INDEX "PackageInstallAsset_sourceAssetId_idx" ON "PackageInstallAsset"("sourceAssetId");

-- CreateIndex
CREATE INDEX "PackageInstallAsset_targetAssetId_idx" ON "PackageInstallAsset"("targetAssetId");

-- CreateIndex
CREATE INDEX "PackageInstallLog_installId_idx" ON "PackageInstallLog"("installId");

-- CreateIndex
CREATE INDEX "PackageInstallLog_level_idx" ON "PackageInstallLog"("level");

-- CreateIndex
CREATE INDEX "PackageInstallLog_createdAt_idx" ON "PackageInstallLog"("createdAt");

-- AddForeignKey
ALTER TABLE "PackageInstallAsset" ADD CONSTRAINT "PackageInstallAsset_installId_fkey" FOREIGN KEY ("installId") REFERENCES "PackageInstall"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageInstallLog" ADD CONSTRAINT "PackageInstallLog_installId_fkey" FOREIGN KEY ("installId") REFERENCES "PackageInstall"("id") ON DELETE CASCADE ON UPDATE CASCADE;
