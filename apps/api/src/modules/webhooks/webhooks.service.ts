import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { Prisma, ShipmentStatus } from "@prisma/client";
import { createHmac, randomUUID } from "node:crypto";
import { PrismaService } from "../../database/prisma.service";
import { SubscriptionDto, PageDto } from "../../common/dto";
export const RETRY_DELAYS_MS = [10000, 60000, 300000, 900000, 1800000];
export function signPayload(body: string, secret: string) {
  return "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
}
export function validateDestination(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BadRequestException("Invalid webhook URL");
  }
  const allowed = (process.env.WEBHOOK_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (
    url.username ||
    url.password ||
    url.hash ||
    !allowed.includes(url.origin) ||
    !(
      url.protocol === "https:" ||
      (url.protocol === "http:" && process.env.WEBHOOK_ALLOW_HTTP === "true")
    )
  )
    throw new BadRequestException("Webhook destination is not allowed");
  return url.toString();
}
@Injectable()
export class WebhooksService {
  private running = false;
  private readonly logger = new Logger(WebhooksService.name);
  constructor(private readonly db: PrismaService) {}
  async record(
    tx: Prisma.TransactionClient,
    shipment: { id: string; trackingCode: string },
    fromStatus: ShipmentStatus | null,
    toStatus: ShipmentStatus,
  ) {
    const eventId = randomUUID();
    const payload = {
      eventId,
      eventType: "shipment.status_changed",
      occurredAt: new Date().toISOString(),
      data: {
        shipmentId: shipment.id,
        trackingCode: shipment.trackingCode,
        fromStatus,
        toStatus,
      },
    };
    await tx.webhookEvent.create({
      data: {
        id: eventId,
        shipmentId: shipment.id,
        eventType: payload.eventType,
        payload,
      },
    });
    const subscriptions = await tx.webhookSubscription.findMany({
      where: { active: true },
      select: { id: true },
    });
    if (subscriptions.length)
      await tx.webhookDelivery.createMany({
        data: subscriptions.map((s) => ({ eventId, subscriptionId: s.id })),
      });
  }
  async subscribe(input: SubscriptionDto) {
    const row = await this.db.webhookSubscription.create({
      data: { url: validateDestination(input.url), secret: input.secret },
    });
    return {
      id: row.id,
      url: row.url,
      active: row.active,
      createdAt: row.createdAt,
    };
  }
  events(page: PageDto) {
    return this.db.webhookEvent.findMany({
      skip: (page.page - 1) * page.limit,
      take: page.limit,
      orderBy: { createdAt: "desc" },
      include: {
        deliveries: {
          select: {
            id: true,
            subscriptionId: true,
            status: true,
            attempts: true,
            nextAttemptAt: true,
            lastError: true,
            deliveredAt: true,
          },
        },
      },
    });
  }
  @Interval(1000)
  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.sendBatch();
    } catch (error) {
      this.logger.error(String(error));
    } finally {
      this.running = false;
    }
  }
  async sendBatch() {
    // Short transaction claims work. Network I/O happens after commit.
    const leaseToken = randomUUID();
    const claimed = await this.db.$queryRaw<{ id: string }[]>`
   UPDATE "WebhookDelivery" SET "lockedUntil"=now()+interval '30 seconds',"leaseToken"=${leaseToken}::uuid
   WHERE id IN (SELECT id FROM "WebhookDelivery" WHERE status='PENDING' AND "nextAttemptAt"<=now()
   AND ("lockedUntil" IS NULL OR "lockedUntil"<now()) ORDER BY "nextAttemptAt" LIMIT 10 FOR UPDATE SKIP LOCKED)
   RETURNING id`;
    await Promise.all(claimed.map((row) => this.sendOne(row.id, leaseToken)));
  }
  async sendOne(id: string, leaseToken: string) {
    const delivery = await this.db.webhookDelivery.findUniqueOrThrow({
      where: { id },
      include: { event: true, subscription: true },
    });
    const attempt = delivery.attempts + 1;
    let failure: string | null = null;
    try {
      if (!delivery.subscription.active)
        throw new Error("Subscription disabled");
      const url = validateDestination(delivery.subscription.url);
      const body = JSON.stringify(delivery.event.payload);
      const response = await fetch(url, {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(5000),
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Signature": signPayload(
            body,
            delivery.subscription.secret,
          ),
          "X-Webhook-Event-Id": delivery.eventId,
        },
        body,
      });
      await response.body?.cancel();
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      failure = String(error).slice(0, 1000);
    }
    const failed = failure !== null && attempt >= 6; // Initial send + five retries.
    await this.db.webhookDelivery.updateMany({
      where: { id, leaseToken },
      data: {
        attempts: attempt,
        status: failure ? (failed ? "FAILED" : "PENDING") : "DELIVERED",
        lastError: failure,
        deliveredAt: failure ? null : new Date(),
        nextAttemptAt: new Date(
          Date.now() + (RETRY_DELAYS_MS[attempt - 1] ?? 0),
        ),
        lockedUntil: null,
        leaseToken: null,
      },
    });
  }
}
