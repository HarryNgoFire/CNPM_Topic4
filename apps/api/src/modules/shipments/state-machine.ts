import { ShipmentStatus } from "@prisma/client";

/**
 * BR-STATE-01: the two-stage delivery flow (A = pickup, B = dropoff).
 * Forward only, with two early exits: CANCELLED from any unfinished state and
 * DELIVERY_FAILED once the parcel is on its way to B. IN_TRANSIT is kept only
 * so shipments created before migration 20261110020000 can still finish.
 * Documented in docs/m3/STATE_MACHINE.md.
 */
export const VALID_TRANSITIONS: ReadonlySet<string> = new Set([
  "RECEIVED>EN_ROUTE_PICKUP",
  "EN_ROUTE_PICKUP>ARRIVED_PICKUP",
  "ARRIVED_PICKUP>OUT_FOR_DELIVERY",
  "OUT_FOR_DELIVERY>ARRIVED_DROPOFF",
  "ARRIVED_DROPOFF>DELIVERED",
  "IN_TRANSIT>OUT_FOR_DELIVERY",
  "OUT_FOR_DELIVERY>DELIVERY_FAILED",
  "ARRIVED_DROPOFF>DELIVERY_FAILED",
  "IN_TRANSIT>DELIVERY_FAILED",
  "RECEIVED>CANCELLED",
  "EN_ROUTE_PICKUP>CANCELLED",
  "ARRIVED_PICKUP>CANCELLED",
  "IN_TRANSIT>CANCELLED",
  "OUT_FOR_DELIVERY>CANCELLED",
  "ARRIVED_DROPOFF>CANCELLED",
]);

/** BR-STATE-02: the single rule every status change goes through. */
export function canTransition(
  current: ShipmentStatus,
  next: ShipmentStatus,
): boolean {
  return VALID_TRANSITIONS.has(`${current}>${next}`);
}
