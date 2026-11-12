import { canTransition } from "../../src/modules/shipments/shipments.service";
import { ShipmentStatus } from "@prisma/client";

const ALL_STATES: ShipmentStatus[] = [
  "RECEIVED",
  "EN_ROUTE_PICKUP",
  "ARRIVED_PICKUP",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "ARRIVED_DROPOFF",
  "DELIVERED",
  "CANCELLED",
  "DELIVERY_FAILED",
];

const VALID = new Set([
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

type Row = [ShipmentStatus, ShipmentStatus, boolean];
const cases: Row[] = ALL_STATES.flatMap((a) =>
  ALL_STATES.map((b): Row => [a, b, VALID.has(`${a}>${b}`)]),
);

describe("QA: shipment state machine 9x9 matrix", () => {
  test.each(cases)("%s -> %s allowed = %s", (from, to, expected) => {
    expect(canTransition(from, to)).toBe(expected);
  });

  it("rejects unknown statuses", () => {
    expect(canTransition("RECEIVED", "UNKNOWN" as ShipmentStatus)).toBe(false);
    expect(canTransition("UNKNOWN" as ShipmentStatus, "RECEIVED")).toBe(false);
  });

  it("terminal states have no outbound transitions to other states", () => {
    const terminalStates: ShipmentStatus[] = ["DELIVERED", "CANCELLED", "DELIVERY_FAILED"];
    for (const term of terminalStates) {
      for (const to of ALL_STATES) {
        expect(canTransition(term, to)).toBe(false);
      }
    }
  });

  it("rejects skips in normal progress chain", () => {
    expect(canTransition("RECEIVED", "ARRIVED_PICKUP")).toBe(false);
    expect(canTransition("RECEIVED", "OUT_FOR_DELIVERY")).toBe(false);
    expect(canTransition("RECEIVED", "DELIVERED")).toBe(false);
    expect(canTransition("EN_ROUTE_PICKUP", "OUT_FOR_DELIVERY")).toBe(false);
    expect(canTransition("ARRIVED_PICKUP", "ARRIVED_DROPOFF")).toBe(false);
    expect(canTransition("OUT_FOR_DELIVERY", "DELIVERED")).toBe(false);
  });

  it("allows legacy IN_TRANSIT -> OUT_FOR_DELIVERY", () => {
    expect(canTransition("IN_TRANSIT", "OUT_FOR_DELIVERY")).toBe(true);
  });
});
