/**
 * Abortable API clients and debounce helpers for MoveFlow map interactions.
 */

export class AbortableRequest {
  constructor() {
    this.controller = null;
  }

  abort() {
    if (this.controller) {
      this.controller.abort();
      this.controller = null;
    }
  }

  async fetch(url, options = {}) {
    this.abort();
    const ctrl = new AbortController();
    this.controller = ctrl;

    try {
      const response = await fetch(url, {
        ...options,
        signal: ctrl.signal,
      });
      return response;
    } finally {
      if (this.controller === ctrl) {
        this.controller = null;
      }
    }
  }
}

export function debounce(fn, ms = 350) {
  let timer;
  return function debounced(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

export class GeocodingClient {
  constructor(apiBaseUrl = "/api/v1", tokenGetter = () => null) {
    this.apiBaseUrl = apiBaseUrl.replace(/\/+$/, "");
    this.tokenGetter = tokenGetter;
    this.searchReq = new AbortableRequest();
    this.reverseReq = new AbortableRequest();
  }

  getHeaders() {
    const token = this.tokenGetter();
    const headers = { Accept: "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }

  async search(query, limit = 5) {
    const trimmed = (query ?? "").trim();
    if (trimmed.length < 3) return [];

    const url = `${this.apiBaseUrl}/geocoding/search?q=${encodeURIComponent(trimmed)}&limit=${limit}`;
    const res = await this.searchReq.fetch(url, { headers: this.getHeaders() });
    if (!res.ok) {
      throw new Error(`Geocoding search failed (${res.status})`);
    }
    return res.json();
  }

  async reverse(lat, lng) {
    const url = `${this.apiBaseUrl}/geocoding/reverse?lat=${lat}&lng=${lng}`;
    const res = await this.reverseReq.fetch(url, { headers: this.getHeaders() });
    if (!res.ok) {
      throw new Error(`Reverse geocoding failed (${res.status})`);
    }
    return res.json();
  }

  abort() {
    this.searchReq.abort();
    this.reverseReq.abort();
  }
}
