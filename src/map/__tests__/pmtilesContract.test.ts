/**
 * PMTiles 契約 ratchet —— registry 宣告的 `pmtiles.sourceLayer` 必須真的存在於切片檔內。
 *
 * 守的失敗模式：sourceLayer 名字打錯（或上游重切時改了 `--layer`），
 * Mapbox **不會報錯**，只是那個 layer 永遠查不到任何 feature ——
 * 圖層在畫面上完全空白，看起來像「這區沒有資料」。
 *
 * 本機沒有的切片（大檔走 S3、gitignored）自動略過；CI 上只驗 git 內的那批。
 */
import { describe, it, expect } from "vitest";
import { existsSync, openSync, readSync } from "node:fs";
import { PMTiles, type Source, type RangeResponse } from "pmtiles";
import { OVERLAY_REGISTRY } from "../overlayRegistry";

/** pmtiles 套件的 Source 介面 node 版（套件只內建 fetch 版） */
class NodeFileSource implements Source {
  private fd: number;
  constructor(private path: string) { this.fd = openSync(path, "r"); }
  getKey() { return this.path; }
  async getBytes(offset: number, length: number): Promise<RangeResponse> {
    const buf = Buffer.alloc(length);
    readSync(this.fd, buf, 0, length, offset);
    return { data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer };
  }
}

interface Entry { id: string; file: string; sourceLayer: string; minzoom: number }

function pmtilesEntries(): Entry[] {
  const out: Entry[] = [];
  for (const config of OVERLAY_REGISTRY) {
    const layer = config.pmtiles?.sourceLayer;
    if (!layer) continue; // raster PMTiles 無 sourceLayer
    out.push({
      id: String(config.id),
      file: `public/${config.sourceUrl.replace(/^\.\//, "")}`,
      sourceLayer: layer,
      minzoom: config.pmtiles!.minzoom,
    });
  }
  return out;
}

describe("PMTiles 契約", () => {
  it("registry 的 sourceLayer 都存在於切片檔內（打錯 = 圖層永遠空白且不報錯）", async () => {
    const entries = pmtilesEntries();
    const checked: string[] = [];
    const broken: string[] = [];
    const zoomHygiene: string[] = [];

    for (const e of entries) {
      if (!existsSync(e.file)) continue; // S3 管理的大檔本機/CI 可能沒有
      const tiles = new PMTiles(new NodeFileSource(e.file));
      const meta = (await tiles.getMetadata()) as { vector_layers?: { id: string }[] };
      const header = await tiles.getHeader();
      const names = (meta.vector_layers ?? []).map((l) => l.id);
      checked.push(e.id);
      if (!names.includes(e.sourceLayer)) {
        broken.push(`${e.id}: registry 寫 "${e.sourceLayer}"，檔案內實際是 [${names.join(", ")}] — ${e.file}`);
      }
      if (e.minzoom < header.minZoom) {
        zoomHygiene.push(`${e.id}: registry minzoom=${e.minzoom} < 切片 minzoom=${header.minZoom}`);
      }
    }

    console.log(`✓ 驗了 ${checked.length}/${entries.length} 個 PMTiles（其餘本機無檔，由 S3 管理）`);

    // 2026-08-02 一次清完 11 個後轉為硬性守門（ratchet 只進不退）：
    // registry minzoom 低於切片實際值 → 低 zoom 會送出必然落空的 tile request。
    // 畫面行為不變，但是白花的網路往返，且代表 registry 與切片認知不一致。
    expect(
      zoomHygiene,
      `registry 的 minzoom 低於切片實際 minzoom —— 低 zoom 會打不存在的磚：\n  ${zoomHygiene.join("\n  ")}\n` +
      `→ 把 registry 的 pmtiles.minzoom 改成切片實際值`,
    ).toEqual([]);

    expect(
      broken,
      `PMTiles source-layer 名稱對不上 —— 該圖層會永遠查不到 feature（畫面空白、無錯誤）：\n  ${broken.join("\n  ")}\n` +
      `→ 對照上游 tippecanoe 的 --layer 參數，或用 \`tippecanoe-decode\` 看實際 layer 名`,
    ).toEqual([]);
  });
});
