import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * 靜態資料快取政策契約：nginx.conf 的 `map $uri $static_cache_control` 是單一來源，
 * 且每個 location 只能輸出一條 Cache-Control（不得再用 `expires` 造成雙 header）。
 * 上傳端 upload-deploy-assets.sh 的 cache_control_for() 須與此同規則。
 */
const nginx = readFileSync("nginx.conf", "utf8");

const MUTABLE = "public, max-age=300, must-revalidate";
const IMMUTABLE = "public, max-age=31536000, immutable";
const ONE_DAY = "public, max-age=86400";

const mapBody = nginx.match(/map \$uri \$static_cache_control \{([\s\S]*?)\n\}/)?.[1] ?? "";
const rules = [...mapBody.matchAll(/^\s*"~\*(.+)"\s+"([^"]+)";/gm)].map(
  ([, re, value]) => ({ re: new RegExp(re ?? "", "i"), value: value ?? "" }),
);
const defaultValue = mapBody.match(/default\s+"([^"]+)";/)?.[1];

function policyFor(uri: string): string | undefined {
  return rules.find((r) => r.re.test(uri))?.value ?? defaultValue;
}

describe("nginx 靜態快取政策", () => {
  it("map 有預設值與 4 條規則", () => {
    expect(defaultValue).toBe(ONE_DAY);
    expect(rules).toHaveLength(4);
  });

  it.each([
    ["/world/jp_accommodation_density_450m_20260910.pmtiles", IMMUTABLE],
    ["/network_structures/official_bridges_hsinchu_20260924.pmtiles", IMMUTABLE],
    ["/embed-rail/rail_slim.0a1b2c3d4e.json.gz", IMMUTABLE],
    ["/public_life/manifest.json", MUTABLE],
    ["/police_justice/crime_area_monthly/_manifest.json", MUTABLE],
    ["/world/jp_world_heritage_unesco_current.geojson", MUTABLE],
    ["/world/jp_railways.pmtiles", ONE_DAY],
    ["/world/jp_wildlife_protection_moe_202504.pmtiles", ONE_DAY],
    ["/geo/h3_8a2a1072b59ffff.json", ONE_DAY],
  ])("%s → %s", (uri, expected) => {
    expect(policyFor(uri)).toBe(expected);
  });

  it("指標規則優先於日期規則（manifest_20260101.json 仍為短快取）", () => {
    expect(policyFor("/x/manifest_20260101.json")).toBe(MUTABLE);
  });

  it("沒有 expires 指令（會與 add_header 疊出兩條 Cache-Control）", () => {
    expect(nginx).not.toMatch(/^\s*expires\s/m);
  });

  it("每個 location 區塊至多一條 Cache-Control", () => {
    const blocks = nginx.split(/\n\s*location\s/).slice(1);
    for (const block of blocks) {
      const body = block.split(/\n {4}\}/)[0] ?? "";
      const count = (body.match(/add_header\s+Cache-Control\b/g) ?? []).length;
      expect(count, body.slice(0, 80)).toBeLessThanOrEqual(1);
    }
  });

  it("/assets/ 一年 immutable、SPA 入口 no-cache", () => {
    const assets = nginx.match(/location \^~ \/assets\/ \{([\s\S]*?)\n    \}/)?.[1] ?? "";
    expect(assets).toContain('Cache-Control "public, max-age=31536000, immutable"');
    const root = nginx.match(/location \/ \{([\s\S]*?)\n    \}/)?.[1] ?? "";
    expect(root).toContain('Cache-Control "no-cache"');
  });
});
