-- CreateEnum
CREATE TYPE "FileObjectStatus" AS ENUM ('ACTIVE', 'DELETED');

-- CreateTable
CREATE TABLE "FileObject" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "extension" TEXT,
    "size" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "status" "FileObjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "uploadedById" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FileObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileRelation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "ownerType" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "fieldCode" TEXT NOT NULL DEFAULT '',
    "relationName" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "extra" JSONB,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileRelation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FileObject_storageKey_key" ON "FileObject"("storageKey");

-- CreateIndex
CREATE INDEX "FileObject_tenantId_idx" ON "FileObject"("tenantId");

-- CreateIndex
CREATE INDEX "FileObject_checksum_idx" ON "FileObject"("checksum");

-- CreateIndex
CREATE INDEX "FileObject_status_idx" ON "FileObject"("status");

-- CreateIndex
CREATE INDEX "FileObject_createdAt_idx" ON "FileObject"("createdAt");

-- CreateIndex
CREATE INDEX "FileRelation_tenantId_ownerType_ownerId_idx" ON "FileRelation"("tenantId", "ownerType", "ownerId");

-- CreateIndex
CREATE INDEX "FileRelation_fileId_idx" ON "FileRelation"("fileId");

-- CreateIndex
CREATE INDEX "FileRelation_fieldCode_idx" ON "FileRelation"("fieldCode");

-- CreateIndex
CREATE UNIQUE INDEX "FileRelation_tenantId_fileId_ownerType_ownerId_fieldCode_key" ON "FileRelation"("tenantId", "fileId", "ownerType", "ownerId", "fieldCode");

-- AddForeignKey
ALTER TABLE "FileRelation" ADD CONSTRAINT "FileRelation_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
