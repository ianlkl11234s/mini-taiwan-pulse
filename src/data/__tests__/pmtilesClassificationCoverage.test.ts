/**
 * PMTiles 分類覆蓋測試（backlog EDU-11）
 *
 * `classificationCoverage.test.ts` 靠 `JSON.parse` 讀 GeoJSON，**吃不到 PMTiles**，
 * 所以走切片的分類欄位一直沒有守門 —— 上游哪天新增一個類別值，那批 feature 會
 * 靜默落 fallback 色而沒人發現。（`schools` 就是這樣累積出 289 校錯色的，見
 * docs/features/education-layers/changelog.md 的 W1 段。）
 *
 * 本測試用 PMTiles 檔頭的 `tilestats` 拿到每個屬性的 **distinct values**，
 * 比對前端分色表有沒有全涵蓋。順帶對帳 feature 總數，擋「上游換資料但下游
 * baseline 沒更新」。
 *
 * `pmtiles` 套件的 `FileSource` 是給瀏覽器 File 物件用的，Node 端要自己實作
 * Source 介面（只需要 `getKey` / `getBytes`）。
 */
import { describe, it, expect } from "vitest";
import { existsSync, openSync, readSync, closeSync } from "node:fs";
import { PMTiles } from "pmtiles";
import {
  CAMPUS_LEVEL_COLORS,
  CRAM_CATEGORY_ORDER,
  CRAM_CATEGORY_GROUPS,
  DISTRICT_PRECISION_COUNTS,
} from "../educationTypes";

/** Node 端的 PMTiles Source（pmtiles 的 FileSource 只吃瀏覽器 File 物件） */
class NodeFileSource {
  constructor(private readonly path: string) {}
  getKey() {
    return this.path;
  }
  async getBytes(offset: number, length: number) {
    const fd = openSync(this.path, "r");
    try {
      const buf = Buffer.alloc(length);
      readSync(fd, buf, 0, length, offset);
      return { data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) };
    } finally {
      closeSync(fd);
    }
  }
}

interface TileStatsAttribute {
  attribute: string;
  values?: unknown[];
}
interface TileStatsLayer {
  layer: string;
  count: number;
  attributes: TileStatsAttribute[];
}

async function readTileStats(file: string): Promise<TileStatsLayer[]> {
  const p = new PMTiles(new NodeFileSource(file) as never);
  const md = (await p.getMetadata()) as { tilestats?: { layers: TileStatsLayer[] } };
  return md.tilestats?.layers ?? [];
}

interface Case {
  /** public/ 底下的相對路徑 */
  file: string;
  /** 切片內的 layer 名（同時被 pmtilesContract 檢查） */
  layer: string;
  /** feature 總數 baseline —— 對不上代表上游換了資料 */
  count: number;
  /** 分類欄位 */
  field: string;
  /** 前端分色表涵蓋的值（一律從 educationTypes SSOT 推導，不手寫第二份） */
  covered: string[];
}

const CASES: Case[] = [
  {
    file: "education/campus_polygon.pmtiles",
    layer: "campus_polygon",
    count: 4336,
    field: "school_level",
    // 含 non_school —— 它被 CAMPUS_NON_SCHOOL_FILTER 濾掉不渲染，但仍在分色表內
    covered: Object.keys(CAMPUS_LEVEL_COLORS),
  },
  {
    file: "education/cram_schools.pmtiles",
    layer: "cram_schools",
    count: 17137,
    field: "短期補習班類別",
    covered: CRAM_CATEGORY_ORDER.flatMap((g) => [...CRAM_CATEGORY_GROUPS[g]]),
  },
  {
    file: "education/school_district_k12.pmtiles",
    layer: "school_district_k12",
    count: 860,
    field: "precision",
    covered: Object.keys(DISTRICT_PRECISION_COUNTS),
  },
];

describe("PMTiles 分類覆蓋", () => {
  for (const c of CASES) {
    const path = `public/${c.file}`;

    it(`${c.file} 的 ${c.field} 分色表涵蓋切片內所有值`, async () => {
      // 大檔 gitignore，CI 沒有本機資產時 graceful skip（與 staticDataContract 同慣例）
      if (!existsSync(path)) {
        console.log(`⚠ ${path} 不存在，skip`);
        return;
      }
      const layers = await readTileStats(path);
      const layer = layers.find((l) => l.layer === c.layer);
      expect(layer, `切片內找不到 layer "${c.layer}"（實際: ${layers.map((l) => l.layer).join(", ")}）`).toBeTruthy();

      const attr = layer!.attributes.find((a) => a.attribute === c.field);
      expect(attr, `layer "${c.layer}" 內找不到屬性 "${c.field}"（keep_attrs 沒帶到？）`).toBeTruthy();

      const values = (attr!.values ?? []).map(String);
      expect(values.length, `${c.field} 的 tilestats 沒有 values`).toBeGreaterThan(0);

      const coveredSet = new Set(c.covered);
      const uncovered = values.filter((v) => !coveredSet.has(v));
      expect(
        uncovered,
        `${c.file} 的 ${c.field} 出現分色表沒涵蓋的值（會靜默落 fallback 色）：\n  ${uncovered.join("\n  ")}`,
      ).toEqual([]);
    });

    it(`${c.file} 的 feature 數仍是 ${c.count}`, async () => {
      if (!existsSync(path)) {
        console.log(`⚠ ${path} 不存在，skip`);
        return;
      }
      const layers = await readTileStats(path);
      const layer = layers.find((l) => l.layer === c.layer);
      expect(layer?.count, `feature 數與 baseline 不符 —— 上游換資料了？記得同步 educationTypes 的 baseline 與圖例數字`).toBe(c.count);
    });
  }
});
