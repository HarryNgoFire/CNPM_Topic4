-- Dispatch invitations (BR-DISPATCH-01/02/03).

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'COMPLETED');

-- CreateTable
CREATE TABLE "DriverAssignment" (
    "id" UUID NOT NULL,
    "shipmentId" UUID NOT NULL,
    "driverId" UUID NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'PENDING',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "DriverAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DriverAssignment_status_expiresAt_idx" ON "DriverAssignment"("status", "expiresAt");

-- AddForeignKey
ALTER TABLE "DriverAssignment" ADD CONSTRAINT "DriverAssignment_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverAssignment" ADD CONSTRAINT "DriverAssignment_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- An invitation reserves both the shipment and driver until resolved.
CREATE UNIQUE INDEX "one_active_assignment_per_shipment" ON "DriverAssignment" ("shipmentId") WHERE status IN ('PENDING','ACCEPTED');
CREATE UNIQUE INDEX "one_active_assignment_per_driver" ON "DriverAssignment" ("driverId") WHERE status IN ('PENDING','ACCEPTED');
