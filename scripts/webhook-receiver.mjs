import { createServer } from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";
const secret = process.env.WEBHOOK_RECEIVER_SECRET;
if (!secret || secret.length < 32)
  throw new Error("Set WEBHOOK_RECEIVER_SECRET (32+ characters)");
const seen = new Set();
createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/webhooks/shipment") {
    res.writeHead(404).end();
    return;
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 65536) {
      res.writeHead(413).end();
      return;
    }
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks);
  const expected = Buffer.from(
    "sha256=" + createHmac("sha256", secret).update(body).digest("hex"),
  );
  const signature = Buffer.from(
    String(req.headers["x-webhook-signature"] ?? ""),
  );
  if (
    signature.length !== expected.length ||
    !timingSafeEqual(signature, expected)
  ) {
    res.writeHead(401).end();
    return;
  }
  try {
    const event = JSON.parse(body.toString());
    if (typeof event.eventId !== "string") throw new Error("Missing eventId");
    if (!seen.has(event.eventId)) {
      console.log(JSON.stringify(event));
      seen.add(event.eventId);
    }
    res.writeHead(200).end("ok");
  } catch {
    res.writeHead(400).end();
  }
}).listen(4000, "0.0.0.0", () =>
  console.log("Demo receiver listening on :4000; deduplication is in memory"),
);
