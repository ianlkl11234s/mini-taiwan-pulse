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
import { existsSync, openSync, readFileSync, readSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
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

interface Entry { id: string; file: string; sourceLayer: string; minzoom: number; maxzoom: number }

const BUSINESS_REGISTRY_CONTRACTS: Record<string, { count?: number; fields: string[]; sha256?: string }> = {
  company_points: {
    count: 654165,
    sha256: "44210b690c0267e7667f514df4510e79d9b557ec400f6cc7db4cbdf638eb1184",
    fields: [
      "company_name", "capital_total", "capital_q", "is_manufacturing", "categories", "industry_mid",
      "setup_year", "county", "addr_mismatch", "is_listed", "has_trademark",
    ],
  },
  company_points_overview: {
    count: 5745,
    sha256: "9352dfcc2e7d83406a1c99e6c29ff50ef8c8509e9872cf580239b883907b6d78",
    fields: ["grid_id", "n_companies", "n_manufacturing"],
  },
  company_capital_grid: {
    count: 89754,
    sha256: "153aed9746622b2b230fec6d9b3a30e5153d3544028dde1361f10cfd095c2d5c",
    fields: ["grid_id", "capital_sum", "n_companies", "capital_median"],
  },
  company_capital_grid_450m: {
    count: 26834,
    sha256: "a9c9a97b8e79ba6e94658a97e43e25b2d9fe826d1fd7b1ab3480381a280eb1cb",
    fields: ["grid_id", "capital_sum", "n_companies", "capital_median"],
  },
  company_capital_grid_1500m: {
    count: 5745,
    sha256: "3feaf851d6755e6c21f50e1e8e053141940b4a3e39f8f070148b419bf25cb1e9",
    fields: ["grid_id", "capital_sum", "n_companies", "capital_median"],
  },
  factory_locations: {
    count: 90652,
    sha256: "efe9e7c543bb3905eca646a6fc121383bdc3a1095d93c5778b2ef4ce41be0630",
    fields: [
      "factory_id", "factory_name", "uniform_no", "factory_address", "county",
      "org_type", "registered_date", "industry_categories", "main_products", "geocode_precision",
    ],
  },
  factory_locations_overview: {
    count: 3673,
    sha256: "226ca5c9fa934298fcf6396fc2677eb7efa8dff800a07759ce059aa2eabd6c17",
    fields: ["grid_id", "n_factories"],
  },
  industrial_park_boundaries: {
    count: 215,
    sha256: "3956ee1d232293102a34e26a9f1bfacbc9bcccbe859631a0350a929cb05b93ad",
    fields: [
      "park_id", "park_name", "park_name_en", "county", "manage_unit", "dev_status",
      "zone_grade", "industry_load", "area_ha", "coord_source", "n_sources", "official_park_id_80190",
    ],
  },
  regulated_facilities: {
    count: 80732,
    sha256: "01bd113e218efd3fd6ffbe684ed7f4236d40bae3498bbde7bbeb5e30a1428147",
    fields: [
      "emsno", "facility_name", "uniform_no", "facility_address", "county", "township",
      "industry_area_name", "industry_group", "industry_name", "isair", "iswater", "iswaste",
      "istoxic", "issoil", "coord_source", "company_joined", "company_name",
      "company_categories", "company_industry_code", "company_capital_total",
    ],
  },
  industrial_park_comparison: {
    count: 215,
    sha256: "211776fe7e0d307438ab64985cb48c78c74c937228e432436ba8646ba5711ee1",
    fields: [
      "park_id", "park_name", "county", "area_ha", "factory_count", "company_count",
      "company_capital_nonnull_count", "company_capital_total_sum",
    ],
  },
};

const OOKLA_PMTILES_CONTRACTS = [
  {
    file: "public/geo/ookla_tw_z14.pmtiles",
    bytes: 4_095_539,
    sha256: "96729ae6f44d179a4755e76959b54ea2e31f286e97e7dcc7b8d0aebe042ebdc6",
    minZoom: 6,
    maxZoom: 14,
  },
  {
    file: "public/geo/ookla_tw_z16.pmtiles",
    bytes: 10_035_995,
    sha256: "45eb9953e43443900cb7e4edc7e9bda28905a9d41f1e729fa9311c0c746b8bb3",
    minZoom: 15,
    maxZoom: 16,
  },
] as const;

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
      maxzoom: config.pmtiles!.maxzoom,
    });
  }
  return out;
}

describe("PMTiles 契約", () => {
  it("Ookla 台灣兩個 PMTiles 固定版保持 v3、mobile/fixed layers、zoom 與 attribution", async () => {
    for (const contract of OOKLA_PMTILES_CONTRACTS) {
      expect(existsSync(contract.file), `${contract.file} 不存在；台灣細格會空白`).toBe(true);
      expect(statSync(contract.file).size, `${contract.file} bytes 已漂移`).toBe(contract.bytes);
      expect(createHash("sha256").update(readFileSync(contract.file)).digest("hex"), `${contract.file} SHA-256 已漂移`).toBe(contract.sha256);

      const archive = new PMTiles(new NodeFileSource(contract.file));
      const [header, metadata] = await Promise.all([
        archive.getHeader(),
        archive.getMetadata() as Promise<{ attribution?: string; vector_layers?: { id: string }[] }>,
      ]);
      expect(header.specVersion).toBe(3);
      expect(header.tileType, `${contract.file} 必須是 MVT`).toBe(1);
      expect([header.minZoom, header.maxZoom]).toEqual([contract.minZoom, contract.maxZoom]);
      expect((metadata.vector_layers ?? []).map((layer) => layer.id).sort()).toEqual(["fixed", "mobile"]);
      expect(metadata.attribution ?? "", `${contract.file} attribution 不可移除`).toContain("Ookla");
    }
  });

  it("registry 的 sourceLayer 都存在於切片檔內（打錯 = 圖層永遠空白且不報錯）", async () => {
    const entries = pmtilesEntries();
    const checked: string[] = [];
    const broken: string[] = [];
    const zoomHygiene: string[] = [];

    for (const e of entries) {
      if (!existsSync(e.file)) continue; // S3 管理的大檔本機/CI 可能沒有
      const tiles = new PMTiles(new NodeFileSource(e.file));
      const meta = (await tiles.getMetadata()) as {
        vector_layers?: { id: string; fields?: Record<string, string> }[];
        tilestats?: { layers?: { layer: string; count: number }[] };
      };
      const header = await tiles.getHeader();
      const names = (meta.vector_layers ?? []).map((l) => l.id);
      checked.push(e.id);
      if (!names.includes(e.sourceLayer)) {
        broken.push(`${e.id}: registry 寫 "${e.sourceLayer}"，檔案內實際是 [${names.join(", ")}] — ${e.file}`);
      }
      const contract = BUSINESS_REGISTRY_CONTRACTS[e.sourceLayer];
      if (contract) {
        const vectorLayer = meta.vector_layers?.find((l) => l.id === e.sourceLayer);
        const fields = Object.keys(vectorLayer?.fields ?? {}).sort();
        if (JSON.stringify(fields) !== JSON.stringify([...contract.fields].sort())) {
          broken.push(`${e.id}: 欄位白名單漂移，實際 [${fields.join(", ")}]`);
        }
        const count = meta.tilestats?.layers?.find((l) => l.layer === e.sourceLayer)?.count;
        if (contract.count != null && count !== contract.count) {
          broken.push(`${e.id}: feature count ${count} != ${contract.count}`);
        }
        if (header.minZoom !== e.minzoom || header.maxZoom !== e.maxzoom) {
          broken.push(`${e.id}: archive z${header.minZoom}-${header.maxZoom} != registry z${e.minzoom}-${e.maxzoom}`);
        }
        const sha256 = createHash("sha256").update(readFileSync(e.file)).digest("hex");
        if (contract.sha256 != null && sha256 !== contract.sha256) {
          broken.push(`${e.id}: SHA-256 ${sha256} != ${contract.sha256}`);
        }
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
