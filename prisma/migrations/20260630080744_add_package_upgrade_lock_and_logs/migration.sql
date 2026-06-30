-- CreateEnum
CREATE TYPE "PackageUpgradeLogLevel" AS ENUM ('INFO', 'WARNING', 'ERROR');

-- AlterEnum
ALTER TYPE "PackageTenantVersionStatus" ADD VALUE 'UPGRADING';

-- CreateTable
CREATE TABLE "PackageUpgradeLog" (
    "id" TEXT NOT NULL,
    "upgradeId" TEXT NOT NULL,
    "level" "PackageUpgradeLogLevel" NOT NULL DEFAULT 'INFO',
    "message" TEXT NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackageUpgradeLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PackageUpgradeLog_upgradeId_idx" ON "PackageUpgradeLog"("upgradeId");

-- CreateIndex
CREATE INDEX "PackageUpgradeLog_level_idx" ON "PackageUpgradeLog"("level");

-- CreateIndex
CREATE INDEX "PackageUpgradeLog_createdAt_idx" ON "PackageUpgradeLog"("createdAt");

-- AddForeignKey
ALTER TABLE "PackageUpgradeLog" ADD CONSTRAINT "PackageUpgradeLog_upgradeId_fkey" FOREIGN KEY ("upgradeId") REFERENCES "PackageUpgrade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
