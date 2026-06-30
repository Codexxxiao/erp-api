-- CreateEnum
CREATE TYPE "PackageTenantVersionStatus" AS ENUM ('INSTALLED', 'UPGRADE_AVAILABLE', 'DISABLED');

-- CreateTable
CREATE TABLE "PackageTenantVersion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "packageCode" TEXT NOT NULL,
    "packageName" TEXT NOT NULL,
    "currentVersionId" TEXT NOT NULL,
    "currentVersionNo" INTEGER NOT NULL,
    "lastInstallId" TEXT,
    "status" "PackageTenantVersionStatus" NOT NULL DEFAULT 'INSTALLED',
    "installedById" TEXT,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackageTenantVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PackageTenantVersion_tenantId_idx" ON "PackageTenantVersion"("tenantId");

-- CreateIndex
CREATE INDEX "PackageTenantVersion_packageId_idx" ON "PackageTenantVersion"("packageId");

-- CreateIndex
CREATE INDEX "PackageTenantVersion_currentVersionId_idx" ON "PackageTenantVersion"("currentVersionId");

-- CreateIndex
CREATE INDEX "PackageTenantVersion_lastInstallId_idx" ON "PackageTenantVersion"("lastInstallId");

-- CreateIndex
CREATE INDEX "PackageTenantVersion_status_idx" ON "PackageTenantVersion"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PackageTenantVersion_tenantId_packageId_key" ON "PackageTenantVersion"("tenantId", "packageId");
