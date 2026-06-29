-- CreateEnum
CREATE TYPE "FormVersionStatus" AS ENUM ('PUBLISHED', 'DEPRECATED');

-- AlterTable
ALTER TABLE "FormRecord" ADD COLUMN     "formVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "formVersionId" TEXT;

-- CreateTable
CREATE TABLE "FormVersion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "formCode" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "FormVersionStatus" NOT NULL DEFAULT 'PUBLISHED',
    "snapshot" JSONB NOT NULL,
    "publishedById" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FormVersion_tenantId_idx" ON "FormVersion"("tenantId");

-- CreateIndex
CREATE INDEX "FormVersion_formId_idx" ON "FormVersion"("formId");

-- CreateIndex
CREATE INDEX "FormVersion_formCode_idx" ON "FormVersion"("formCode");

-- CreateIndex
CREATE UNIQUE INDEX "FormVersion_formId_version_key" ON "FormVersion"("formId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "FormVersion_tenantId_formCode_version_key" ON "FormVersion"("tenantId", "formCode", "version");

-- CreateIndex
CREATE INDEX "FormRecord_formVersionId_idx" ON "FormRecord"("formVersionId");

-- AddForeignKey
ALTER TABLE "FormVersion" ADD CONSTRAINT "FormVersion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormVersion" ADD CONSTRAINT "FormVersion_formId_fkey" FOREIGN KEY ("formId") REFERENCES "FormDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
