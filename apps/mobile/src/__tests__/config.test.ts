import { APP_SCHEMES } from "@personbrief/shared/app";
import { resolveApiConfig } from "../lib/config";
import { routeFromLink } from "../components/link-router";

describe("server address", () => {
  it("uses the configured address and requires https outside development", () => {
    expect(resolveApiConfig({ url: "https://brief.example.org/", variant: "production" })).toEqual({ ok: true, baseUrl: "https://brief.example.org", source: "build" });
    expect(resolveApiConfig({ url: "http://brief.example.org", variant: "preview" })).toMatchObject({ ok: false, reason: "insecure" });
    expect(resolveApiConfig({ url: "http://192.168.1.20:3000", variant: "development" })).toMatchObject({ ok: true, baseUrl: "http://192.168.1.20:3000" });
    expect(resolveApiConfig({ url: "not a url", variant: "production" })).toMatchObject({ ok: false, reason: "invalid" });
  });

  it("falls back to the computer running Metro only in development builds", () => {
    // A phone cannot reach the developer's machine through "localhost".
    expect(resolveApiConfig({ url: null, variant: "development", hostUri: "192.168.1.20:8081", platform: "ios" })).toEqual({ ok: true, baseUrl: "http://192.168.1.20:3000", source: "metro-host" });
    expect(resolveApiConfig({ url: null, variant: "production", hostUri: "192.168.1.20:8081", platform: "ios" })).toEqual({ ok: false, reason: "missing" });
    expect(resolveApiConfig({ url: null, variant: "preview", hostUri: null, platform: "android" })).toEqual({ ok: false, reason: "missing" });
  });

  it("keeps the app schemes in step with the server's trusted origins", () => {
    const config = require("../../app.config.ts").default;
    for (const variant of ["development", "preview", "production"] as const) {
      process.env.APP_VARIANT = variant;
      jest.isolateModules(() => {
        const fresh = require("../../app.config.ts").default({ config: {} });
        expect(fresh.scheme).toBe(APP_SCHEMES[variant]);
      });
    }
    delete process.env.APP_VARIANT;
    expect(typeof config).toBe("function");
  });
});

describe("deep links", () => {
  const id = "0d7f6a4e-8f7a-4b1c-9d2e-3a4b5c6d7e8f";
  it("accepts profile and research links only", () => {
    expect(routeFromLink(`personbrief://profile/${id}`)).toBe(`/profile/${id}`);
    expect(routeFromLink(`personbrief://research/${id.toUpperCase()}`)).toBe(`/research/${id}`);
    expect(routeFromLink("personbrief://settings")).toBeNull();
    expect(routeFromLink(`personbrief://profile/${id}/../../etc`)).toBeNull();
    expect(routeFromLink("personbrief://profile/not-an-id")).toBeNull();
    expect(routeFromLink(null)).toBeNull();
  });
});
