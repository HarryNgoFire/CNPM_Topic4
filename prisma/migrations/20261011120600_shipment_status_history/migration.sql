-- Audit trail of status changes (FR-09, BR-AUDIT-01). fromStatus is NULL for the initial RECEIVED row.

-- CreateTable
CREATE TABLE "ShipmentStatusHistory" (
    "id" UUID NOT NULL,
    "shipmentId" UUID NOT NULL,
    "fromStatus" "ShipmentStatus",
    "toStatus" "ShipmentStatus" NOT NULL,
    "changedBy" UUID NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShipmentStatusHistory_shipmentId_occurredAt_idx" ON "ShipmentStatusHistory"("shipmentId", "occurredAt");

-- AddForeignKey
ALTER TABLE "ShipmentStatusHistory" ADD CONSTRAINT "ShipmentStatusHistory_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentStatusHistory" ADD CONSTRAINT "ShipmentStatusHistory_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- History rows are evidence for disputes: insert only.
CREATE FUNCTION protect_status_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Status history is append only'; END $$;
CREATE TRIGGER history_append_only BEFORE UPDATE OR DELETE ON "ShipmentStatusHistory" FOR EACH ROW EXECUTE FUNCTION protect_status_history();
