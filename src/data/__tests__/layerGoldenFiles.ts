/**
 * layer-golden 目錄的讀寫與拆組（B1 P1）
 * ══════════════════════════════════════════════════════════════════
 *
 * fixture 從單一 5.8MB 的 `layer-golden.json` 改成目錄 `layer-golden/`：
 *
 *   layer-golden/<group>.json   { count, gisLayers:{key→entry}, overlays:{key→entry}, params:{layerKey→控件} }
 *   layer-golden/_order.json    { gisLayers:[key…], overlays:[key…] }   —— 一行一個 key
 *
 * 為什麼：舊檔每個 PR 都改同一處（meta.keyCount、兩個陣列的尾端），保證衝突。
 * 現在每個 PR 只動自己主題那一檔，順序另存、一行一個，只有「相鄰兩行同時被改」才衝突。
 *
 * ⚠️ 本檔只依賴 node:fs（不 import 任何登記簿），讓只想讀 fixture 的測試不必載入整個 manifest。
 *    「哪個 key 屬於哪個 group」的判斷在 layerGoldenExtract.ts（它本來就載入全部登記簿）。
 *
 * ── 零失真約束 ───────────────────────────────────────────────────
 *   `assembleFixture(split(x))` 的 canonical JSON 必須和 x 位元組相同。
 *   - `params` 本來就是以 layer key 為鍵的物件（鍵已排序）。
 *   - `gisLayers`／`overlays` 本來是陣列，且 id／type **會重複**（例如 stationsTRA 有 3 筆、
 *     gbGolfCourses 有 2 筆；GIS_LAYERS 是 first-hit-wins，重複與順序都有語意）。
 *     所以檔內用「唯一鍵」：第一筆用原 id，之後依序是 `id#2`、`id#3`…；順序檔記的也是唯一鍵。
 *     entry 本體原封不動（仍含自己的 id／type）。
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const GOLDEN_DIR = "src/data/__tests__/__fixtures__/layer-golden";
export const ORDER_FILE = "_order.json";
/** 進 fixture 的 section 與順序（同 layerGoldenExtract 的 FIXTURE_SECTIONS） */
export const GOLDEN_SECTIONS = ["gisLayers", "overlays", "params"];

export interface GoldenGroupFile {
  count: number;
  gisLayers: Record<string, unknown>;
  overlays: Record<string, unknown>;
  params: Record<string, unknown>;
}

export interface GoldenOrder {
  gisLayers: string[];
  overlays: string[];
}

export interface GoldenFixture {
  meta: { keyCount: number; sections: string[] };
  gisLayers: Record<string, unknown>[];
  overlays: Record<string, unknown>[];
  params: Record<string, unknown>;
}

/** 決定每個項目屬於哪個 group（檔名不含 .json） */
export interface GoldenGrouper {
  /** layer key（params 的鍵、overlay 的 id） */
  layerKey(key: string): string;
  /** GIS_LAYERS entry 的 popup layerType */
  gisType(type: string): string;
}

const sortKeys = <T>(o: Record<string, T>): Record<string, T> =>
  Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k] as T]));

/** 重複的 id 之後加 `#n`，回傳與輸入等長的唯一鍵 */
export function uniqueKeys(ids: string[]): string[] {
  const seen = new Map<string, number>();
  return ids.map((id) => {
    const n = (seen.get(id) ?? 0) + 1;
    seen.set(id, n);
    return n === 1 ? id : `${id}#${n}`;
  });
}

/** 唯一鍵 → 原 id */
export const baseId = (uniqueKey: string): string => uniqueKey.replace(/#\d+$/, "");

export function serializeGoldenFile(v: unknown): string {
  return `${JSON.stringify(v, null, 2)}\n`;
}

/** 把整份舊格式 fixture 拆成 group 檔＋順序檔（檔名 → 內容物件，含 _order.json） */
export function splitFixture(fixture: GoldenFixture, grouper: GoldenGrouper): Map<string, unknown> {
  const groups = new Map<string, GoldenGroupFile>();
  const group = (name: string): GoldenGroupFile => {
    let g = groups.get(name);
    if (!g) groups.set(name, (g = { count: 0, gisLayers: {}, overlays: {}, params: {} }));
    return g;
  };
  const order: GoldenOrder = { gisLayers: [], overlays: [] };

  for (const [k, v] of Object.entries(fixture.params)) {
    const g = group(grouper.layerKey(k));
    g.params[k] = v;
    g.count++;
  }
  for (const section of ["overlays", "gisLayers"] as const) {
    const entries = fixture[section];
    const idOf = (e: Record<string, unknown>) => String(section === "overlays" ? e.id : e.type);
    const uniq = uniqueKeys(entries.map(idOf));
    entries.forEach((e, i) => {
      const id = idOf(e);
      const name = section === "overlays" ? grouper.layerKey(id) : grouper.gisType(id);
      group(name)[section][uniq[i]!] = e;
    });
    order[section] = uniq;
  }

  const out = new Map<string, unknown>();
  for (const name of [...groups.keys()].sort()) {
    const g = groups.get(name)!;
    out.set(`${name}.json`, {
      count: g.count,
      gisLayers: sortKeys(g.gisLayers),
      overlays: sortKeys(g.overlays),
      params: sortKeys(g.params),
    });
  }
  out.set(ORDER_FILE, order);
  return out;
}

/** 依順序檔把 group 檔組回舊格式（鍵順序與 pickFixture 的輸出相同） */
export function assembleFixture(files: Map<string, GoldenGroupFile>, order: GoldenOrder): GoldenFixture {
  const params: Record<string, unknown> = {};
  let keyCount = 0;
  for (const g of files.values()) {
    Object.assign(params, g.params);
    keyCount += g.count;
  }
  const pick = (section: "gisLayers" | "overlays") => {
    const byKey = new Map<string, Record<string, unknown>>();
    for (const [name, g] of files) {
      for (const [k, e] of Object.entries(g[section])) {
        if (byKey.has(k)) throw new Error(`${section} 的鍵 ${k} 同時出現在多個 group 檔（含 ${name}）`);
        byKey.set(k, e as Record<string, unknown>);
      }
    }
    return order[section].map((k) => {
      const e = byKey.get(k);
      if (!e) throw new Error(`${ORDER_FILE} 的 ${section} 有 ${k}，但沒有任何 group 檔含它`);
      return e;
    });
  };
  return {
    meta: { keyCount, sections: GOLDEN_SECTIONS },
    gisLayers: pick("gisLayers"),
    overlays: pick("overlays"),
    params: sortKeys(params),
  };
}

export function readGoldenDir(dir = GOLDEN_DIR): { files: Map<string, GoldenGroupFile>; order: GoldenOrder } {
  const files = new Map<string, GoldenGroupFile>();
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".json") && n !== ORDER_FILE).sort()) {
    files.set(f, JSON.parse(readFileSync(join(dir, f), "utf8")) as GoldenGroupFile);
  }
  const order = JSON.parse(readFileSync(join(dir, ORDER_FILE), "utf8")) as GoldenOrder;
  return { files, order };
}

/** 讀目錄並組回舊格式（給只想讀 fixture 的測試用） */
export function loadGoldenFixture(dir = GOLDEN_DIR): GoldenFixture {
  const { files, order } = readGoldenDir(dir);
  return assembleFixture(files, order);
}

export const goldenDirExists = (dir = GOLDEN_DIR): boolean => existsSync(join(dir, ORDER_FILE));

/**
 * 把拆好的檔寫進目錄：只重寫內容有變的檔，並刪掉已不存在的 group 檔。
 * @returns 寫了哪些、刪了哪些、沒動幾個
 */
export function writeGoldenDir(
  split: Map<string, unknown>,
  dir = GOLDEN_DIR,
): { written: string[]; removed: string[]; unchanged: number } {
  mkdirSync(dir, { recursive: true });
  const written: string[] = [];
  let unchanged = 0;
  for (const [name, value] of split) {
    const path = join(dir, name);
    const text = serializeGoldenFile(value);
    if (existsSync(path) && readFileSync(path, "utf8") === text) { unchanged++; continue; }
    writeFileSync(path, text, "utf8");
    written.push(name);
  }
  const removed = readdirSync(dir).filter((n) => n.endsWith(".json") && !split.has(n));
  for (const n of removed) rmSync(join(dir, n));
  return { written, removed, unchanged };
}
