-- AlterTable
ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "locationAccuracyM" DOUBLE PRECISION;
ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "locationCapturedAt" TIMESTAMP(3);

COMMENT ON COLUMN "Driver"."locationAccuracyM" IS 'GPS horizontal accuracy in meters (null for legacy rows)';
COMMENT ON COLUMN "Driver"."locationCapturedAt" IS 'Client device capture timestamp (null for legacy rows)';
