import { ShipmentStatus } from "@prisma/client";
/** BR-STATE-01: delivery only moves forward, one step at a time. DELIVERED is terminal. */
export const SHIPMENT_STATUS_ORDER: readonly ShipmentStatus[] = [
  "RECEIVED",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];
/** BR-STATE-02: the single rule every status change goes through. */
export function canTransition(current: ShipmentStatus, next: ShipmentStatus) {
  const from = SHIPMENT_STATUS_ORDER.indexOf(current);
  return from >= 0 && SHIPMENT_STATUS_ORDER.indexOf(next) === from + 1;
}
