-- Versioned pricing parameters: one row is one complete, consistent set of rates.

-- CreateTable
CREATE TABLE "PricingRule" (
    "id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "baseFee" DECIMAL(12,2) NOT NULL,
    "ratePerKm" DECIMAL(12,2) NOT NULL,
    "freeWeightThreshold" DECIMAL(6,2) NOT NULL,
    "ratePerExtraKg" DECIMAL(12,2) NOT NULL,
    "standardMultiplier" DECIMAL(6,2) NOT NULL,
    "expressMultiplier" DECIMAL(6,2) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PricingRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PricingRule_version_key" ON "PricingRule"("version");

ALTER TABLE "PricingRule" ADD CONSTRAINT "valid_prices" CHECK ("baseFee">=0 AND "ratePerKm">=0 AND "freeWeightThreshold">=0 AND "ratePerExtraKg">=0 AND "standardMultiplier">0 AND "expressMultiplier">0);
