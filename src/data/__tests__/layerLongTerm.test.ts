/**
 * 長期時間欄位（manifest `longTerm`）的檢查。規範：docs/features/longterm-time/STANDARD.md。
 *
 * 1. 欄位齊全、日期合法、起訖對齊粒度邊界
 * 2. 類別與粒度、資料形式相容（每日數值只能 day、分期不可 day、大量事件要件數檔…）
 * 3. 斷點與細節分層落在涵蓋內
 * 4. 宣告的檔案有部署路徑：
 *    - `./dir/file` 必須是本層 manifest source 已宣告的檔（url／staticAssets／companionAssets），
 *      於是由 deployContract 測試逐檔驗 nginx、上傳與拉取清單。
 *    - `/static-rpc/…` 快照不在 lock 清單（S3 整夾同步、檔案不進 git），能驗的只有：
 *      export 腳本會產生該檔族、nginx 有 /static-rpc/ location、上傳腳本整夾上傳、
 *      loader 以完整路徑樣板引用（site_manifest.py 才認得、同步到 R2）。檔案實際在不在 S3 驗不到。
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LAYER_MANIFEST, MANIFEST_KEYS, type LayerManifestEntry } from "../layerManifest";
import {
  LONG_TERM_GRANULARITIES, LONG_TERM_RANGE_SELECT,
  type LongTermAssetPattern, type LongTermSpec,
} from "../layerLongTerm";
import { RANGE_END, RANGE_START, tsToDate } from "../../lib/realEstateTime";
import { LONG_TERM_HEATMAP_MIN_MONTHS, LONG_TERM_PLAY_SPEEDS, LONG_TERM_MS_PER_PERIOD_AT_1X } from "../../lib/longTermTime";

const ENTRIES = MANIFEST_KEYS
  .map((key) => [key, (LAYER_MANIFEST[key] as LayerManifestEntry).longTerm] as const)
  .filter((x): x is readonly [typeof x[0], LongTermSpec] => x[1] !== undefined);

const ISO = /^\d{4}-\d{2}-\d{2}$/;
function validDate(s: string): boolean {
  if (!ISO.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
function lastDayOfMonth(s: string): boolean {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.getUTCDate() === 1;
}
function startAligned(s: string, g: LongTermSpec["granularity"]): boolean {
  const [, m, d] = s.split("-").map(Number) as [number, number, number];
  if (g === "day") return true;
  if (g === "month") return d === 1;
  if (g === "quarter") return d === 1 && (m - 1) % 3 === 0;
  return d === 1 && m === 1;
}
function endAligned(s: string, g: LongTermSpec["granularity"]): boolean {
  const m = Number(s.slice(5, 7));
  if (g === "day") return true;
  if (!lastDayOfMonth(s)) return false;
  if (g === "month") return true;
  if (g === "quarter") return m % 3 === 0;
  return m === 12;
}

/** `<year>`／`<rocYear>` 依 from–to 的年份展開；其他佔位一律視為錯誤。 */
function expand(pattern: LongTermAssetPattern, from: string, to: string): string[] {
  const placeholders = pattern.match(/<[^>]*>/g) ?? [];
  const bad = placeholders.filter((p) => p !== "<year>" && p !== "<rocYear>");
  if (bad.length) throw new Error(`${pattern}：不認得的佔位 ${bad.join(", ")}`);
  if (!placeholders.length) return [pattern];
  const out: string[] = [];
  for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) {
    out.push(pattern.replace(/<year>/g, String(y)).replace(/<rocYear>/g, String(y - 1911)));
  }
  return out;
}

function patternsOf(spec: LongTermSpec): LongTermAssetPattern[] {
  const d = spec.data;
  if (d.form === "periodFiles") return [...d.files];
  if (d.form === "singleFile") return [d.file];
  if (d.form === "tilesWithCounts") return [d.tiles, d.counts];
  return [d.file, ...(d.perStationFile ? [d.perStationFile] : [])];
}

function manifestAssetsOf(entry: LayerManifestEntry): Set<string> {
  const out = new Set<string>();
  for (const s of Array.isArray(entry.source) ? entry.source : [entry.source]) {
    if (s.kind === "geojson" || s.kind === "pmtiles") {
      out.add(s.url);
      if (s.kind === "pmtiles") for (const a of s.companionAssets ?? []) out.add(a);
    } else if (s.kind === "supabase") out.add(s.fallbackUrl);
    else for (const a of s.staticAssets ?? []) out.add(a);
  }
  return out;
}

function companionAssetsOf(entry: LayerManifestEntry): Set<string> {
  const out = new Set<string>();
  for (const s of Array.isArray(entry.source) ? entry.source : [entry.source]) {
    if (s.kind === "pmtiles") for (const a of s.companionAssets ?? []) out.add(a);
  }
  return out;
}

const exportScript = readFileSync("scripts/export/export-static-rpc-snapshots.sh", "utf8");
const nginxConf = readFileSync("nginx.conf", "utf8");
const uploadScript = readFileSync("scripts/deploy/upload-deploy-assets.sh", "utf8");
function srcFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === "__tests__" ? [] : srcFiles(p);
    return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) && !p.endsWith("layerManifest.ts") ? [p] : [];
  });
}
let loaderSources: string | null = null;
function loaderText(): string {
  loaderSources ??= srcFiles("src").map((p) => readFileSync(p, "utf8")).join("\n");
  return loaderSources;
}

describe("長期時間欄位（manifest longTerm）", () => {
  it("至少有登記（收集器沒壞）", () => {
    expect(ENTRIES.length).toBeGreaterThan(0);
  });

  it.each(ENTRIES)("%s：欄位齊全、日期合法、起訖對齊粒度", (_key, spec) => {
    expect(Object.keys(LONG_TERM_RANGE_SELECT)).toContain(spec.kind);
    expect(spec.data.note.trim(), "data.note 不可空白").not.toBe("");
    expect(Array.isArray(spec.breaks), "breaks 沒有也要寫 []").toBe(true);
    expect(typeof spec.summable).toBe("boolean");
    const { start, end } = spec.coverage;
    expect(validDate(start), `start ${start}`).toBe(true);
    expect(startAligned(start, spec.granularity), `start ${start} 沒對齊 ${spec.granularity}`).toBe(true);
    if (end !== "ongoing") {
      expect(validDate(end), `end ${end}`).toBe(true);
      expect(start <= end, `${start} > ${end}`).toBe(true);
      expect(endAligned(end, spec.granularity), `end ${end} 沒對齊 ${spec.granularity}`).toBe(true);
    }
  });

  it.each(ENTRIES)("%s：類別與粒度、資料形式相容", (_key, spec) => {
    expect(LONG_TERM_GRANULARITIES[spec.kind], `${spec.kind} 不可用粒度 ${spec.granularity}`).toContain(spec.granularity);
    const forms: Record<LongTermSpec["kind"], string[]> = {
      event: ["periodFiles", "singleFile"],
      eventTiles: ["tilesWithCounts"],
      dailyValue: ["series"],
      periodStats: ["series"],
      periodSnapshot: ["periodFiles", "singleFile"],
    };
    expect(forms[spec.kind]).toContain(spec.data.form);
    if (spec.data.form === "series" && spec.data.todayRpc) {
      expect(spec.kind, "只有每日數值用 RPC 補今天").toBe("dailyValue");
    }
  });

  it.each(ENTRIES)("%s：斷點與細節分層落在涵蓋內", (_key, spec) => {
    const { start } = spec.coverage;
    const end = spec.coverage.end === "ongoing" ? "9999-12-31" : spec.coverage.end;
    for (const b of spec.breaks) {
      expect(validDate(b.at), `break ${b.at}`).toBe(true);
      expect(b.at >= start && b.at <= end, `break ${b.at} 不在涵蓋內`).toBe(true);
      expect(b.note.trim()).not.toBe("");
    }
    const tiers = [...(spec.detailTiers ?? [])].sort((a, b) => a.from.localeCompare(b.from));
    tiers.forEach((t, i) => {
      expect(validDate(t.from) && validDate(t.to), `${t.from}–${t.to}`).toBe(true);
      expect(t.from <= t.to && t.from >= start && t.to <= end, `細節分層 ${t.from}–${t.to} 不在涵蓋內`).toBe(true);
      expect(t.note.trim()).not.toBe("");
      const prev = tiers[i - 1];
      if (prev) expect(prev.to < t.from, `細節分層 ${prev.from}–${prev.to} 與 ${t.from}–${t.to} 重疊`).toBe(true);
    });
  });

  it.each(ENTRIES)("%s：宣告的檔案有部署路徑", (key, spec) => {
    const entry = LAYER_MANIFEST[key] as LayerManifestEntry;
    const end = spec.coverage.end === "ongoing" ? `${new Date().getUTCFullYear()}-12-31` : spec.coverage.end;
    const patterns: [LongTermAssetPattern, string, string][] = [
      ...patternsOf(spec).map((p) => [p, spec.coverage.start, end] as [string, string, string]),
      ...(spec.detailTiers ?? []).flatMap((t) => (t.files ?? []).map((p) => [p, t.from, t.to] as [string, string, string])),
    ];
    const own = manifestAssetsOf(entry);
    for (const [pattern, from, to] of patterns) {
      const files = expand(pattern, from, to);
      if (pattern.startsWith("./")) {
        for (const f of files) expect(own.has(f), `${f} 不在 ${key} 的 manifest source（deployContract 驗不到）`).toBe(true);
      } else if (pattern.startsWith("/static-rpc/")) {
        expect(pattern.endsWith(".json")).toBe(true);
        const stemPrefix = pattern.slice("/static-rpc/".length).split("<")[0] as string;
        expect(stemPrefix.length, `${pattern} 固定字首太短`).toBeGreaterThan(8);
        expect(exportScript, `export 腳本沒有產生 ${stemPrefix}*`).toMatch(new RegExp(`run_sql "${stemPrefix}`));
        expect(loaderText(), `src 沒有以完整路徑樣板引用 /static-rpc/${stemPrefix}`).toContain(`/static-rpc/${stemPrefix}`);
      } else {
        throw new Error(`${pattern}：路徑必須是 ./dir/file 或 /static-rpc/*.json`);
      }
    }
    if (spec.data.form === "tilesWithCounts") {
      expect(companionAssetsOf(entry).has(spec.data.counts), "件數檔要登記在 pmtiles source 的 companionAssets").toBe(true);
    }
  });

  it("static-rpc 的部署管線：nginx location ＋上傳腳本整夾上傳", () => {
    expect(nginxConf).toMatch(/location \/static-rpc\/ \{/);
    expect(uploadScript).toContain("for f in public/static-rpc/*.json");
  });

  it("可拖選只限事件點與大量事件（站主 2026-11-20 拍板）", () => {
    expect(LONG_TERM_RANGE_SELECT).toEqual({
      event: true, eventTiles: true, dailyValue: false, periodStats: false, periodSnapshot: false,
    });
  });

  it("共用常數：熱區門檻 6 個月、速度 0.5／1／2／4、1× 每期 1 秒", () => {
    expect(LONG_TERM_HEATMAP_MIN_MONTHS).toBe(6);
    expect([...LONG_TERM_PLAY_SPEEDS]).toEqual([0.5, 1, 2, 4]);
    expect(LONG_TERM_MS_PER_PERIOD_AT_1X).toBe(1000);
  });

  it("房地產 6 層的涵蓋與 realEstateTime 常數一致（防漂移）", () => {
    const keys = ["realEstateRentalGrid", "realEstateSaleGrid", "realEstatePresaleGrid",
      "realEstateRentalPoint", "realEstateSalePoint", "realEstatePresalePoint"] as const;
    for (const k of keys) {
      const lt = (LAYER_MANIFEST[k] as LayerManifestEntry).longTerm;
      expect(lt?.coverage, k).toEqual({ start: tsToDate(RANGE_START), end: tsToDate(RANGE_END) });
    }
  });
});
