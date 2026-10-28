import { OpenAPIObject } from "@nestjs/swagger";
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const text = { type: "string" };
const uuid = { type: "string", format: "uuid" };
const date = { type: "string", format: "date-time" };
const money = { type: "number", minimum: 0 };
const status = {
  type: "string",
  enum: ["RECEIVED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"],
};
const object = (
  properties: Record<string, any>,
  required: string[] = Object.keys(properties),
) => ({ type: "object", properties, required });
const array = (name: string) => ({ type: "array", items: ref(name) });
export function addResponseContracts(doc: OpenAPIObject) {
  const schemas: Record<string, any> = {
    ErrorResponse: object({
      statusCode: { type: "integer" },
      requestId: uuid,
      error: { oneOf: [text, { type: "object" }] },
    }),
    FeeQuoteResponse: object({
      currency: { type: "string", const: "VND" },
      ruleId: uuid,
      ruleVersion: { type: "integer" },
      distanceKm: money,
      distanceSource: {
        type: "string",
        enum: [
          "OSRM_DRIVING",
          "GOOGLE_ROUTES_TWO_WHEELER",
          "GOOGLE_ROUTES_DRIVE",
          "POSTGIS_GEODESIC_FALLBACK",
        ],
      },
      baseFee: money,
      distanceFee: money,
      weightSurcharge: money,
      serviceMultiplier: money,
      fee: money,
    }),
    ShipmentResponse: object({
      id: uuid,
      trackingCode: text,
      senderId: uuid,
      pickupAddressId: uuid,
      dropoffAddressId: uuid,
      status,
      serviceType: { type: "string", enum: ["STANDARD", "EXPRESS"] },
      fee: money,
      feeBreakdown: ref("FeeQuoteResponse"),
      createdAt: date,
      updatedAt: date,
    }),
    TimelineEntry: object({ toStatus: status, occurredAt: date }),
    TrackingResponse: object({
      trackingCode: text,
      status,
      createdAt: date,
      pickup: object({ city: text }),
      dropoff: object({ city: text }),
      history: array("TimelineEntry"),
    }),
    AssignmentResponse: object({
      id: uuid,
      shipmentId: uuid,
      driverId: uuid,
      status: {
        type: "string",
        enum: ["PENDING", "ACCEPTED", "REJECTED", "EXPIRED", "COMPLETED"],
      },
      assignedAt: date,
      expiresAt: date,
      respondedAt: { type: ["string", "null"], format: "date-time" },
    }),
    QueuedResponse: object({
      shipmentId: uuid,
      assignment: { type: "null" },
      reason: { type: "string", enum: ["NO_AVAILABLE_DRIVER", "MAX_ATTEMPTS"] },
      requiresDispatcher: { type: "boolean" },
    }),
    RespondResponse: object({
      assignment: ref("AssignmentResponse"),
      idempotent: { type: "boolean" },
      expired: { type: "boolean" },
    }),
    DriverResponse: object({
      id: uuid,
      userId: uuid,
      vehicleType: text,
      status: { type: "string", enum: ["OFFLINE", "AVAILABLE", "BUSY"] },
      lastLocationAt: { type: ["string", "null"], format: "date-time" },
    }),
    SubscriptionResponse: object({
      id: uuid,
      url: { type: "string", format: "uri" },
      active: { type: "boolean" },
      createdAt: date,
    }),
    WebhookDeliveryResponse: object({
      id: uuid,
      subscriptionId: uuid,
      status: { type: "string", enum: ["PENDING", "DELIVERED", "FAILED"] },
      attempts: { type: "integer" },
      nextAttemptAt: date,
      lastError: { type: ["string", "null"] },
      deliveredAt: { type: ["string", "null"], format: "date-time" },
    }),
    WebhookPayload: object({
      eventId: uuid,
      eventType: { type: "string", const: "shipment.status_changed" },
      occurredAt: date,
      data: object({
        shipmentId: uuid,
        trackingCode: text,
        fromStatus: { type: ["string", "null"], enum: [...status.enum, null] },
        toStatus: status,
      }),
    }),
    WebhookEventResponse: object({
      id: uuid,
      shipmentId: uuid,
      eventType: text,
      payload: ref("WebhookPayload"),
      createdAt: date,
      deliveries: array("WebhookDeliveryResponse"),
    }),
    PricingRuleResponse: object({
      id: uuid,
      version: { type: "integer" },
      baseFee: money,
      ratePerKm: money,
      freeWeightThreshold: money,
      ratePerExtraKg: money,
      standardMultiplier: money,
      expressMultiplier: money,
      effectiveFrom: date,
      active: { type: "boolean" },
    }),
    AuthResponse: object({
      accessToken: text,
      refreshToken: text,
      expiresIn: { type: "integer", const: 900 },
    }),
    UserResponse: object({
      id: uuid,
      email: { type: "string", format: "email" },
      name: text,
      role: {
        type: "string",
        enum: ["SENDER", "DRIVER", "DISPATCHER", "ADMIN"],
      },
    }),
  };
  schemas.AddressResponse = object({
    id: uuid,
    line: text,
    ward: text,
    district: text,
    city: text,
  });
  schemas.ParcelResponse = object({
    id: uuid,
    shipmentId: uuid,
    weightKg: money,
    lengthCm: money,
    widthCm: money,
    heightCm: money,
  });
  schemas.HistoryResponse = object({
    id: uuid,
    shipmentId: uuid,
    fromStatus: { type: ["string", "null"], enum: [...status.enum, null] },
    toStatus: status,
    changedBy: uuid,
    occurredAt: date,
  });
  schemas.NavigationUrls = object({
    pickup: { type: "string", format: "uri" },
    dropoff: { type: "string", format: "uri" },
  });
  schemas.ShipmentDetailResponse = {
    allOf: [
      ref("ShipmentResponse"),
      object({
        parcel: ref("ParcelResponse"),
        pickup: ref("AddressResponse"),
        dropoff: ref("AddressResponse"),
        history: array("HistoryResponse"),
        navigationUrls: {
          oneOf: [ref("NavigationUrls"), { type: "null" }],
        },
      }),
    ],
  };
  schemas.DriverTaskResponse = {
    allOf: [
      ref("AssignmentResponse"),
      object({
        shipment: {
          allOf: [
            ref("ShipmentResponse"),
            object({
              parcel: ref("ParcelResponse"),
              pickup: ref("AddressResponse"),
              dropoff: ref("AddressResponse"),
            }),
          ],
        },
        navigationUrls: {
          oneOf: [ref("NavigationUrls"), { type: "null" }],
        },
      }),
    ],
  };
  schemas.DispatchQueueResponse = {
    allOf: [
      ref("ShipmentResponse"),
      object({ assignments: array("AssignmentResponse") }),
    ],
  };
  doc.components ??= {};
  doc.components.schemas = { ...doc.components.schemas, ...schemas };
  const contracts: Record<string, any> = {
    "POST /api/v1/pricing/quote": ref("FeeQuoteResponse"),
    "POST /api/v1/shipments": ref("ShipmentResponse"),
    "GET /api/v1/shipments": array("ShipmentResponse"),
    "GET /api/v1/shipments/{id}": ref("ShipmentDetailResponse"),
    "POST /api/v1/shipments/{id}/transition": ref("ShipmentResponse"),
    "GET /api/v1/tracking/{trackingCode}": ref("TrackingResponse"),
    "POST /api/v1/shipments/{id}/assign-driver": {
      oneOf: [ref("AssignmentResponse"), ref("QueuedResponse")],
    },
    "POST /api/v1/assignments/{id}/respond": ref("RespondResponse"),
    "GET /api/v1/dispatch/queue": array("DispatchQueueResponse"),
    "GET /api/v1/drivers/me/tasks": array("DriverTaskResponse"),
    "PATCH /api/v1/drivers/me/location": object({
      lat: { type: "number", minimum: -90, maximum: 90 },
      lng: { type: "number", minimum: -180, maximum: 180 },
    }),
    "PATCH /api/v1/drivers/me/status": ref("DriverResponse"),
    "POST /api/v1/webhooks/subscriptions": ref("SubscriptionResponse"),
    "GET /api/v1/webhooks/events": array("WebhookEventResponse"),
    "GET /api/v1/admin/pricing-rules": array("PricingRuleResponse"),
    "PUT /api/v1/admin/pricing-rules/{id}": ref("PricingRuleResponse"),
    "POST /api/v1/auth/register": ref("UserResponse"),
    "POST /api/v1/auth/login": ref("AuthResponse"),
    "POST /api/v1/auth/refresh": ref("AuthResponse"),
    "POST /api/v1/auth/logout": object({ ok: { type: "boolean" } }),
    "GET /api/v1/health": object({ status: { type: "string", const: "ok" } }),
  };
  for (const [path, item] of Object.entries(doc.paths))
    for (const [verb, op] of Object.entries(item ?? {})) {
      if (!op || typeof op !== "object" || !("responses" in op)) continue;
      const operation = op as any;
      const schema = contracts[`${verb.toUpperCase()} ${path}`];
      for (const code of Object.keys(operation.responses)) {
        operation.responses[code].content = {
          "application/json": {
            schema: Number(code) >= 400 ? ref("ErrorResponse") : schema,
          },
        };
      }
    }
  return doc;
}
