import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  GeocodingService,
  normalizeNominatimResult,
  OSM_ATTRIBUTION,
} from "../src/modules/geocoding/geocoding.service";

describe("GeocodingService and Nominatim normalization", () => {
  describe("normalizeNominatimResult", () => {
    it("normalizes complete Vietnamese address with house number and road", () => {
      const input = {
        display_name: "12, Đường Nguyễn Trãi, Phường 1, Quận 5, Thành phố Hồ Chí Minh, Việt Nam",
        lat: "10.754000",
        lon: "106.663000",
        address: {
          house_number: "12",
          road: "Đường Nguyễn Trãi",
          quarter: "Phường 1",
          city_district: "Quận 5",
          city: "Thành phố Hồ Chí Minh",
          country: "Việt Nam",
          country_code: "vn",
        },
      };

      const result = normalizeNominatimResult(input);
      expect(result).toEqual({
        label: "12, Đường Nguyễn Trãi, Phường 1, Quận 5, Thành phố Hồ Chí Minh, Việt Nam",
        lat: 10.754,
        lng: 106.663,
        address: {
          line: "12 Đường Nguyễn Trãi",
          ward: "Phường 1",
          district: "Quận 5",
          city: "Thành phố Hồ Chí Minh",
        },
        attribution: OSM_ATTRIBUTION,
      });
    });

    it("falls back through ward aliases: quarter -> suburb -> neighbourhood -> village", () => {
      expect(
        normalizeNominatimResult({
          lat: 10.75,
          lon: 106.66,
          address: { suburb: "Phường Bến Thành" },
        }).address.ward,
      ).toBe("Phường Bến Thành");

      expect(
        normalizeNominatimResult({
          lat: 10.75,
          lon: 106.66,
          address: { neighbourhood: "Khu phố 3" },
        }).address.ward,
      ).toBe("Khu phố 3");

      expect(
        normalizeNominatimResult({
          lat: 10.75,
          lon: 106.66,
          address: { village: "Xã Tân Kiên" },
        }).address.ward,
      ).toBe("Xã Tân Kiên");
    });

    it("falls back through district aliases: city_district -> district -> county", () => {
      expect(
        normalizeNominatimResult({
          lat: 10.75,
          lon: 106.66,
          address: { district: "Quận 1" },
        }).address.district,
      ).toBe("Quận 1");

      expect(
        normalizeNominatimResult({
          lat: 10.75,
          lon: 106.66,
          address: { county: "Huyện Bình Chánh" },
        }).address.district,
      ).toBe("Huyện Bình Chánh");
    });

    it("falls back through city aliases: city -> town -> state -> province", () => {
      expect(
        normalizeNominatimResult({
          lat: 10.75,
          lon: 106.66,
          address: { town: "Thị xã Bến Cát" },
        }).address.city,
      ).toBe("Thị xã Bến Cát");

      expect(
        normalizeNominatimResult({
          lat: 10.75,
          lon: 106.66,
          address: { state: "Tỉnh Bình Dương" },
        }).address.city,
      ).toBe("Tỉnh Bình Dương");
    });

    it("handles missing optional components gracefully", () => {
      const minimal = {
        lat: 10.77,
        lon: 106.69,
        display_name: "Chợ Bến Thành",
        address: {},
      };

      const result = normalizeNominatimResult(minimal);
      expect(result.address).toEqual({
        line: "",
        ward: "",
        district: "",
        city: "",
      });
      expect(result.lat).toBe(10.77);
      expect(result.lng).toBe(106.69);
    });

    it("rejects malformed coordinates", () => {
      expect(() =>
        normalizeNominatimResult({ lat: "not-a-number", lon: "106.66" }),
      ).toThrow(BadRequestException);
    });
  });

  describe("GeocodingService proxy & cache", () => {
    let service: GeocodingService;
    let originalEnv: string | undefined;
    let originalTimeout: string | undefined;

    beforeEach(() => {
      originalEnv = process.env.GEOCODER_BASE_URL;
      originalTimeout = process.env.GEOCODER_TIMEOUT_MS;
      process.env.GEOCODER_BASE_URL = "http://mock-geocoder.local";
      service = new GeocodingService();
      service.clearCache();
    });

    afterEach(() => {
      process.env.GEOCODER_BASE_URL = originalEnv;
      process.env.GEOCODER_TIMEOUT_MS = originalTimeout;
      jest.restoreAllMocks();
    });

    it("fails with 503 when GEOCODER_BASE_URL is not set", async () => {
      delete process.env.GEOCODER_BASE_URL;
      await expect(service.search("Nguyen Trai")).rejects.toThrow(
        ServiceUnavailableException,
      );
      await expect(service.reverse(10.754, 106.663)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it("validates search query length (3..200)", async () => {
      await expect(service.search("ab")).rejects.toThrow(BadRequestException);
      await expect(service.search("a".repeat(201))).rejects.toThrow(
        BadRequestException,
      );
    });

    it("validates reverse geocoding coordinate ranges", async () => {
      await expect(service.reverse(95, 106)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.reverse(10, 195)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("searches upstream with proper headers, countrycodes, and vi language", async () => {
      const mockFetch = jest.spyOn(global, "fetch" as any).mockResolvedValue({
        ok: true,
        json: async () => [
          {
            display_name: "12 Nguyen Trai",
            lat: "10.754",
            lon: "106.663",
            address: { house_number: "12", road: "Nguyen Trai", city: "HCMC" },
          },
        ],
      } as any);

      const results = await service.search("12 Nguyen Trai", 3);
      expect(results).toHaveLength(1);
      expect(results[0].address.line).toBe("12 Nguyen Trai");

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain("/search?q=12%20Nguyen%20Trai");
      expect(url).toContain("countrycodes=vn");
      expect(url).toContain("limit=3");
      expect(init.headers).toMatchObject({
        "Accept-Language": "vi",
      });
    });

    it("caches exact search queries for 24h and reuses without second upstream fetch", async () => {
      const mockFetch = jest.spyOn(global, "fetch" as any).mockResolvedValue({
        ok: true,
        json: async () => [
          {
            display_name: "12 Nguyen Trai",
            lat: "10.754",
            lon: "106.663",
            address: { road: "Nguyen Trai" },
          },
        ],
      } as any);

      const res1 = await service.search("Nguyen Trai", 5);
      const res2 = await service.search("nguyen trai", 5); // case-insensitive match in cache key

      expect(res1).toEqual(res2);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("reverses upstream coordinates and caches result", async () => {
      const mockFetch = jest.spyOn(global, "fetch" as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          display_name: "Cho Ben Thanh",
          lat: "10.7725",
          lon: "106.6980",
          address: { amenity: "Cho Ben Thanh", city: "HCMC" },
        }),
      } as any);

      const res1 = await service.reverse(10.7725, 106.698);
      expect(res1.label).toBe("Cho Ben Thanh");

      const res2 = await service.reverse(10.7725, 106.698);
      expect(res2).toEqual(res1);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("returns 404 when reverse upstream reports no result", async () => {
      jest.spyOn(global, "fetch" as any).mockResolvedValue({
        ok: true,
        json: async () => ({ error: "Unable to geocode" }),
      } as any);

      await expect(service.reverse(0, 0)).rejects.toThrow(NotFoundException);
    });

    it("handles upstream 5xx/429 failures by returning 503", async () => {
      jest.spyOn(global, "fetch" as any).mockResolvedValue({
        ok: false,
        status: 503,
      } as any);

      await expect(service.search("Nguyen Trai")).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it("handles upstream invalid JSON response by returning 503", async () => {
      jest.spyOn(global, "fetch" as any).mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error("SyntaxError: Unexpected token");
        },
      } as any);

      await expect(service.search("Nguyen Trai")).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it("handles upstream timeout by returning 503", async () => {
      jest.spyOn(global, "fetch" as any).mockImplementation((_url, init: any) => {
        return new Promise((_, reject) => {
          init.signal?.addEventListener("abort", () => {
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          });
        });
      });

      process.env.GEOCODER_TIMEOUT_MS = "50";
      await expect(service.search("Nguyen Trai")).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });
});
