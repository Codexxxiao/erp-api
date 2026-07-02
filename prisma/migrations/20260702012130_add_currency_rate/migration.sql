-- CreateEnum
CREATE TYPE "CurrencyRateSource" AS ENUM ('MANUAL', 'IMPORT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "CurrencyRateStatus" AS ENUM ('ENABLED', 'DISABLED');

-- CreateTable
CREATE TABLE "currency_rates" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fromCurrencyCode" VARCHAR(16) NOT NULL,
    "toCurrencyCode" VARCHAR(16) NOT NULL,
    "rate" DECIMAL(20,12) NOT NULL,
    "rateDate" DATE NOT NULL,
    "source" "CurrencyRateSource" NOT NULL DEFAULT 'MANUAL',
    "status" "CurrencyRateStatus" NOT NULL DEFAULT 'ENABLED',
    "remark" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "currency_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "currency_rates_tenantId_fromCurrencyCode_toCurrencyCode_rat_idx" ON "currency_rates"("tenantId", "fromCurrencyCode", "toCurrencyCode", "rateDate");

-- CreateIndex
CREATE INDEX "currency_rates_tenantId_toCurrencyCode_rateDate_idx" ON "currency_rates"("tenantId", "toCurrencyCode", "rateDate");

-- CreateIndex
CREATE INDEX "currency_rates_tenantId_rateDate_idx" ON "currency_rates"("tenantId", "rateDate");

-- CreateIndex
CREATE UNIQUE INDEX "currency_rates_tenantId_fromCurrencyCode_toCurrencyCode_rat_key" ON "currency_rates"("tenantId", "fromCurrencyCode", "toCurrencyCode", "rateDate");
