-- AlterTable
ALTER TABLE "FormPhysicalTable" ADD COLUMN     "formVersionId" TEXT;

-- CreateIndex
CREATE INDEX "FormPhysicalTable_formVersionId_idx" ON "FormPhysicalTable"("formVersionId");

-- AddForeignKey
ALTER TABLE "FormRecord" ADD CONSTRAINT "FormRecord_formVersionId_fkey" FOREIGN KEY ("formVersionId") REFERENCES "FormVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormPhysicalTable" ADD CONSTRAINT "FormPhysicalTable_formVersionId_fkey" FOREIGN KEY ("formVersionId") REFERENCES "FormVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
