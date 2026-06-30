-- CreateEnum
CREATE TYPE "PackageUpgradeStatus" AS ENUM ('UPGRADING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "PackageUpgradeConflictPolicy" AS ENUM ('FAIL', 'OVERWRITE');

-- CreateTable
CREATE TABLE "PackageUpgrade" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "fromVersionId" TEXT NOT NULL,
    "fromVersionNo" INTEGER NOT NULL,
    "toVersionId" TEXT NOT NULL,
    "toVersionNo" INTEGER NOT NULL,
    "status" "PackageUpgradeStatus" NOT NULL DEFAULT 'UPGRADING',
    "conflictPolicy" "PackageUpgradeConflictPolicy" NOT NULL DEFAULT 'FAIL',
    "installId" TEXT,
    "preview" JSONB,
    "summary" JSONB,
    "error" TEXT,
    "upgradedById" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackageUpgrade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PackageUpgrade_tenantId_idx" ON "PackageUpgrade"("tenantId");

-- CreateIndex
CREATE INDEX "PackageUpgrade_packageId_idx" ON "PackageUpgrade"("packageId");

-- CreateIndex
CREATE INDEX "PackageUpgrade_fromVersionId_idx" ON "PackageUpgrade"("fromVersionId");

-- CreateIndex
CREATE INDEX "PackageUpgrade_toVersionId_idx" ON "PackageUpgrade"("toVersionId");

-- CreateIndex
CREATE INDEX "PackageUpgrade_installId_idx" ON "PackageUpgrade"("installId");

-- CreateIndex
CREATE INDEX "PackageUpgrade_status_idx" ON "PackageUpgrade"("status");

-- CreateIndex
CREATE INDEX "PackageUpgrade_createdAt_idx" ON "PackageUpgrade"("createdAt");
