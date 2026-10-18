import { canTransition } from "../../src/modules/shipments/shipments.service";
import { ShipmentStatus } from "@prisma/client";

// Real FSM (docs/architecture): RECEIVED -> IN_TRANSIT -> OUT_FOR_DELIVERY -> DELIVERED
const STATES: ShipmentStatus[] = [
  "RECEIVED",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];
// Valid edges are hard-coded on purpose: the test must not copy the implementation.
const VALID = new Set([
  "RECEIVED>IN_TRANSIT",
  "IN_TRANSIT>OUT_FOR_DELIVERY",
  "OUT_FOR_DELIVERY>DELIVERED",
]);
type Row = [ShipmentStatus, ShipmentStatus, boolean];
const cases: Row[] = STATES.flatMap((a) =>
  STATES.map((b): Row => [a, b, VALID.has(`${a}>${b}`)]),
);

describe("QA: shipment state machine 4x4 matrix", () => {
  test.each(cases)("%s -> %s allowed = %s", (from, to, expected) => {
    expect(canTransition(from, to)).toBe(expected);
  });

  it("rejects statuses that do not exist in the enum", () => {
    expect(canTransition("RECEIVED", "FAILED" as ShipmentStatus)).toBe(false);
    expect(canTransition("CREATED" as ShipmentStatus, "RECEIVED")).toBe(false);
  });

  it("DELIVERED is terminal", () => {
    for (const to of STATES) {
      expect(canTransition("DELIVERED", to)).toBe(false);
    }
  });
});
