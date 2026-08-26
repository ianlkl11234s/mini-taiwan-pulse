import { describe, expect, it } from "vitest";
import {
  GFW_HOURLY_V3_SHADOW_ROOT_PATH,
  resolveGfwHourlyRootManifestUrl,
} from "../gfwHourlyReleaseManifest";

describe("resolveGfwHourlyRootManifestUrl", () => {
  const localPoc = "/gfw_hourly_grid_poc/manifest.json";

  it("DEV 預設走同域 production root，讓 Vite proxy 接手", () => {
    expect(resolveGfwHourlyRootManifestUrl(localPoc, "", true, false, false))
      .toBe("/global-maritime/gfw-hourly/manifest.json");
    expect(resolveGfwHourlyRootManifestUrl(localPoc, "https://cdn.example/", true, true, false))
      .toBe(`/${GFW_HOURLY_V3_SHADOW_ROOT_PATH}`);
  });

  it("只有明確 local POC opt-in 才在 DEV 使用 fallback", () => {
    expect(resolveGfwHourlyRootManifestUrl(localPoc, "https://cdn.example/", true, false, true))
      .toBe(localPoc);
    expect(resolveGfwHourlyRootManifestUrl(localPoc, "https://cdn.example/", true, true, true))
      .toBe(localPoc);
  });

  it("production 忽略 local POC opt-in，仍遵守 CDN 與 shadow 選擇", () => {
    expect(resolveGfwHourlyRootManifestUrl(localPoc, "https://cdn.example/", false, false, true))
      .toBe("https://cdn.example/global-maritime/gfw-hourly/manifest.json");
    expect(resolveGfwHourlyRootManifestUrl(localPoc, "https://cdn.example/", false, true, true))
      .toBe(`https://cdn.example/${GFW_HOURLY_V3_SHADOW_ROOT_PATH}`);
  });
});
