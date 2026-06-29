-- CreateTable
CREATE TABLE "Dictionary" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "scopeKey" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dictionary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DictionaryItem" (
    "id" TEXT NOT NULL,
    "dictionaryId" TEXT NOT NULL,
    "parentId" TEXT,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "extra" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DictionaryItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Dictionary_tenantId_idx" ON "Dictionary"("tenantId");

-- CreateIndex
CREATE INDEX "Dictionary_scopeKey_idx" ON "Dictionary"("scopeKey");

-- CreateIndex
CREATE UNIQUE INDEX "Dictionary_scopeKey_code_key" ON "Dictionary"("scopeKey", "code");

-- CreateIndex
CREATE INDEX "DictionaryItem_dictionaryId_idx" ON "DictionaryItem"("dictionaryId");

-- CreateIndex
CREATE INDEX "DictionaryItem_parentId_idx" ON "DictionaryItem"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "DictionaryItem_dictionaryId_value_key" ON "DictionaryItem"("dictionaryId", "value");

-- AddForeignKey
ALTER TABLE "Dictionary" ADD CONSTRAINT "Dictionary_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DictionaryItem" ADD CONSTRAINT "DictionaryItem_dictionaryId_fkey" FOREIGN KEY ("dictionaryId") REFERENCES "Dictionary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DictionaryItem" ADD CONSTRAINT "DictionaryItem_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "DictionaryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
