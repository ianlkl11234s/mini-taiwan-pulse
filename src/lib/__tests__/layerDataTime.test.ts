import { describe, expect, it } from "vitest";
import { LAYER_MANIFEST, MANIFEST_KEYS, type ManifestKey } from "../../data/layerManifest";
import { jmaJstDateKey } from "../../data/jmaPointTypes";
import { gibsUtcDate } from "../../data/gibsSnowTypes";
import { dataDateKeyFor, dataDayRangeSecFor, layerDataTimeZone } from "../layerDataTime";
import { taipeiDateKeyFromMs, taipeiMidnightMs } from "../taipeiDay";
import { shiftDateKey } from "../zonedTime";

const entryOf = (k: ManifestKey) => LAYER_MANIFEST[k] as { dataTimeZone?: string; country?: string };
const declared = (k: ManifestKey) => entryOf(k).dataTimeZone;
const ts = (iso: string) => Date.parse(iso) / 1000;

// 台北日界前後、跨年、英國 DST 切換日前後、台北 08:00（倫敦冬令換日）各取樣
const SAMPLES = [
  "2026-01-01T00:00:00Z", "2025-12-31T15:59:59Z", "2025-12-31T16:00:00Z",
  "2026-03-29T00:30:00Z", "2026-03-29T01:30:00Z", "2026-10-25T00:30:00Z", "2026-10-25T01:30:00Z",
  "2026-11-22T14:59:59Z", "2026-11-22T15:00:00Z", "2026-11-22T15:59:59Z", "2026-11-22T16:00:00Z",
  "2026-11-22T23:59:59Z", "2026-11-23T00:00:00Z", "2026-07-14T22:59:59Z", "2026-07-14T23:00:00Z",
].map(ts);

describe("manifest dataTimeZone", () => {
  it("宣告的值都是合法 IANA 時區名稱", () => {
    const bad: string[] = [];
    for (const k of MANIFEST_KEYS) {
      const tz = declared(k);
      if (tz === undefined) continue;
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: tz });
        // Intl 也接受 "+08:00"、"EST"：固定位移與縮寫不算 IANA 名稱（DST 會算錯），一律擋
        if (tz !== "UTC" && !tz.includes("/")) bad.push(`${k}: ${tz}`);
      } catch {
        bad.push(`${k}: ${tz}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("台灣圖層不寫多餘的 Asia/Taipei（缺席即預設）", () => {
    expect(MANIFEST_KEYS.filter((k) => entryOf(k).country === "TW" && declared(k) === "Asia/Taipei")).toEqual([]);
  });
});

describe("dataDateKeyFor：沒宣告的圖層（台灣）輸出與原本台北日期完全相同", () => {
  const undeclared = MANIFEST_KEYS.filter((k) => declared(k) === undefined);
  it("有大量未宣告圖層", () => {
    expect(undeclared.length).toBeGreaterThan(100);
  });
  it("逐層逐樣本等於 taipeiDateKeyFromMs（timeStore.getDateKey 同一函式）", () => {
    for (const k of undeclared) {
      expect(layerDataTimeZone(k)).toBe("Asia/Taipei");
      for (const s of SAMPLES) expect(dataDateKeyFor(k, s)).toBe(taipeiDateKeyFromMs(s * 1000));
    }
  });
  it("日界範圍等於台北零時起算 24 小時", () => {
    const [a, b] = dataDayRangeSecFor(undeclared[0]!, "2026-11-23");
    expect(a).toBe(taipeiMidnightMs("2026-11-23") / 1000);
    expect(b - a).toBe(86_400);
  });
});

describe("dataDateKeyFor：有宣告的圖層與原本各自的日界算法一致", () => {
  it("日本季節類（Asia/Tokyo）＝ jmaJstDateKey", () => {
    for (const k of ["jmaSnowcap", "jmaAutumnLeaves", "jmaSakura", "jmaRainySeason"] as const) {
      expect(layerDataTimeZone(k)).toBe("Asia/Tokyo");
      for (const s of SAMPLES) expect(dataDateKeyFor(k, s)).toBe(jmaJstDateKey(s));
    }
  });
  it("日本落雷沿用台北日 RPC（明寫 Asia/Taipei）", () => {
    expect(layerDataTimeZone("jmaLightning")).toBe("Asia/Taipei");
  });
  it("GIBS／GFW（UTC）＝ toISOString 的 UTC 日", () => {
    for (const k of ["gibsSnowCover", "gfwFishingEffort", "gfwHourlyTracks", "gfwHourlyGrid"] as const) {
      expect(layerDataTimeZone(k)).toBe("UTC");
      for (const s of SAMPLES) expect(dataDateKeyFor(k, s)).toBe(gibsUtcDate(s));
    }
  });
  it("英國（Europe/London）：台北 00:00–07:59 在倫敦仍是前一天；夏令差 7 小時；DST 日 23／25 小時", () => {
    const k = "gbRailReplay" as const;
    expect(dataDateKeyFor(k, ts("2026-11-22T16:00:00Z"))).toBe("2026-11-22"); // 台北 11/23 00:00
    expect(dataDateKeyFor(k, ts("2026-11-22T23:59:59Z"))).toBe("2026-11-22"); // 台北 11/23 07:59
    expect(dataDateKeyFor(k, ts("2026-11-23T00:00:00Z"))).toBe("2026-11-23"); // 台北 11/23 08:00
    expect(dataDateKeyFor(k, ts("2026-07-14T22:59:59Z"))).toBe("2026-07-14");
    expect(dataDateKeyFor(k, ts("2026-07-14T23:00:00Z"))).toBe("2026-07-15"); // 台北 07/15 07:00
    const [a, b] = dataDayRangeSecFor(k, "2026-03-29");
    expect(b - a).toBe(23 * 3600);
    const [c, d] = dataDayRangeSecFor(k, "2026-10-25");
    expect(d - c).toBe(25 * 3600);
  });
});

describe("shiftDateKey（落雷前一天的修正）", () => {
  it("純日曆加減，跨月跨年閏年", () => {
    expect(shiftDateKey("2026-11-23", -1)).toBe("2026-11-22");
    expect(shiftDateKey("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftDateKey("2028-03-01", -1)).toBe("2028-02-29");
    expect(shiftDateKey("2026-01-01", -1)).toBe("2025-12-31");
    expect(shiftDateKey("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftDateKey("bad", 1)).toBe("Invalid Date");
  });
  it("舊算式（setDate＋toISOString）會抓到前兩天；新算式是前一天", () => {
    const old = new Date("2026-11-23T00:00:00+08:00");
    old.setDate(old.getDate() - 1);
    // 舊寫法：在 UTC 或任何 UTC+ 時區執行都是 11-21（node 測試環境亦然）
    expect(old.toISOString().slice(0, 10)).not.toBe("2026-11-22");
    expect(shiftDateKey("2026-11-23", -1)).toBe("2026-11-22");
  });
});
