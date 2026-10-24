-- Shipment aggregate: the four delivery states, the fee snapshot taken at booking, and its parcel.

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('RECEIVED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('STANDARD', 'EXPRESS');

-- CreateTable
CREATE TABLE "Shipment" (
    "id" UUID NOT NULL,
    "trackingCode" VARCHAR(16) NOT NULL,
    "senderId" UUID NOT NULL,
    "pickupAddressId" UUID NOT NULL,
    "dropoffAddressId" UUID NOT NULL,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'RECEIVED',
    "serviceType" "ServiceType" NOT NULL,
    "fee" DECIMAL(12,2) NOT NULL,
    "feeBreakdown" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parcel" (
    "id" UUID NOT NULL,
    "shipmentId" UUID NOT NULL,
    "weightKg" DECIMAL(6,2) NOT NULL,
    "lengthCm" DECIMAL(6,2) NOT NULL,
    "widthCm" DECIMAL(6,2) NOT NULL,
    "heightCm" DECIMAL(6,2) NOT NULL,

    CONSTRAINT "Parcel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_trackingCode_key" ON "Shipment"("trackingCode");

-- CreateIndex
CREATE INDEX "Shipment_senderId_createdAt_idx" ON "Shipment"("senderId", "createdAt");

-- CreateIndex
CREATE INDEX "Shipment_status_idx" ON "Shipment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Parcel_shipmentId_key" ON "Parcel"("shipmentId");

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_pickupAddressId_fkey" FOREIGN KEY ("pickupAddressId") REFERENCES "Address"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_dropoffAddressId_fkey" FOREIGN KEY ("dropoffAddressId") REFERENCES "Address"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Parcel" ADD CONSTRAINT "positive_parcel" CHECK ("weightKg">0 AND "lengthCm">0 AND "widthCm">0 AND "heightCm">0);
ALTER TABLE "Shipment" ADD CONSTRAINT "nonnegative_fee" CHECK (fee>=0);
