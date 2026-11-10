import test from "node:test";
import assert from "node:assert/strict";
import {
  AbortableRequest,
  GeocodingClient,
  debounce,
} from "../map/api-clients.js";

test("AbortableRequest aborts the previous in-flight request and keeps the latest response", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = (url, options) => new Promise((resolve) => {
    calls.push({ url, signal: options.signal, resolve });
  });

  try {
    const request = new AbortableRequest();
    const first = request.fetch("/first");
    const second = request.fetch("/second");

    assert.equal(calls[0].signal.aborted, true);
    assert.equal(calls[1].signal.aborted, false);
    calls[0].resolve({ id: "old" });
    calls[1].resolve({ id: "new" });
    assert.deepEqual(await first, { id: "old" });
    assert.deepEqual(await second, { id: "new" });
    assert.equal(request.controller, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AbortableRequest explicit abort is safe both idle and in flight", async () => {
  const originalFetch = globalThis.fetch;
  let resolveFetch;
  let signal;
  globalThis.fetch = (_url, options) => new Promise((resolve) => {
    signal = options.signal;
    resolveFetch = resolve;
  });

  try {
    const request = new AbortableRequest();
    request.abort();
    const pending = request.fetch("/pending");
    request.abort();
    assert.equal(signal.aborted, true);
    assert.equal(request.controller, null);
    resolveFetch({ ok: true });
    await pending;
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("debounce invokes only the latest call and preserves receiver and arguments", async () => {
  const received = [];
  const receiver = {
    value: 7,
    run: debounce(function run(value) {
      received.push([this.value, value]);
    }, 10),
  };

  receiver.run("old");
  receiver.run("new");
  await new Promise((resolve) => setTimeout(resolve, 25));

  assert.deepEqual(received, [[7, "new"]]);
});

test("GeocodingClient suppresses blank and short searches without a network request", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return { ok: true, json: async () => [] };
  };

  try {
    const client = new GeocodingClient("/api/v1/");
    assert.deepEqual(await client.search("  "), []);
    assert.deepEqual(await client.search("ab"), []);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("GeocodingClient trims and encodes search input with the latest bearer token", async () => {
  const originalFetch = globalThis.fetch;
  let captured;
  let token = "token-1";
  globalThis.fetch = async (url, options) => {
    captured = { url, options };
    return { ok: true, json: async () => [{ label: "Nguyễn Trãi" }] };
  };

  try {
    const client = new GeocodingClient("/api/v1/", () => token);
    token = "token-2";
    const result = await client.search("  Nguyễn Trãi & Q5  ", 3);

    assert.equal(captured.url, "/api/v1/geocoding/search?q=Nguy%E1%BB%85n%20Tr%C3%A3i%20%26%20Q5&limit=3");
    assert.equal(captured.options.headers.Authorization, "Bearer token-2");
    assert.deepEqual(result, [{ label: "Nguyễn Trãi" }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("GeocodingClient reverse sends coordinates and reports upstream HTTP status", async () => {
  const originalFetch = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(url);
    return { ok: false, status: 503, json: async () => ({}) };
  };

  try {
    const client = new GeocodingClient("/api/v1");
    await assert.rejects(
      client.reverse(10.754, 106.663),
      /Reverse geocoding failed \(503\)/,
    );
    assert.equal(urls[0], "/api/v1/geocoding/reverse?lat=10.754&lng=106.663");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

