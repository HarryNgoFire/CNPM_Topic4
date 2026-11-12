-- AlterEnum
ALTER TYPE "ShipmentStatus" ADD VALUE 'EN_ROUTE_PICKUP';
ALTER TYPE "ShipmentStatus" ADD VALUE 'ARRIVED_PICKUP';
ALTER TYPE "ShipmentStatus" ADD VALUE 'ARRIVED_DROPOFF';
ALTER TYPE "ShipmentStatus" ADD VALUE 'CANCELLED';
ALTER TYPE "ShipmentStatus" ADD VALUE 'DELIVERY_FAILED';

-- Backward compatibility rule:
-- Legacy 'IN_TRANSIT' is preserved in the enum so existing shipments and audit history rows
-- remain fully readable and operable. Do not remove 'IN_TRANSIT' or update legacy rows.

-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN IF NOT EXISTS "reason" TEXT;

-- AlterTable
ALTER TABLE "ShipmentStatusHistory" ADD COLUMN IF NOT EXISTS "reason" TEXT;
