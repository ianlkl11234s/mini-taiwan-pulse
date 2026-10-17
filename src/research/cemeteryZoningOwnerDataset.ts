import { withLoading } from "../lib/loadingRegistry";
import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type SourceReceipt } from "./dataContracts";
import type { AdapterReadResult, QueryAdapter } from "./queryExecutor";
import { parseSpatialGeometry } from "./spatialKernel";

const URL = "/__local-research-owner-only/cemetery-zoning/cemetery-zoning.geojson";
const SHA = "f469e494a476194614b91d9abe71ed55a5f296699361d834b57f9eb2e4404df3";
const BYTES = 1_113_258;
const ROWS = 114;
const fields = [
  { name: "zoning_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "zone_label", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "county", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "source_dataset", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "area_ha", type: "number", nullable: false, nullMeaning: null, unit: "ha" },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
] as const;

export const cemeteryZoningOwnerDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-cemetery-zoning-urban-owner-20260805",
  label: "北北都市計畫墓葬類用地（固定版）", description: "臺北與新北都市計畫分區中含墓、殯葬、殯儀名稱的 114 個面；這是依分區名稱衍生的查詢集，正式法定解釋以兩市公告與圖資為準。",
  layerRefs: ["cemeteryZoning"], kind: "polygon", recordGrain: "feature", primaryKey: ["zoning_id"], fields: [...fields],
  geometry: { type: "MultiPolygon", crs: "EPSG:4326", role: "derived", precision: "臺北與新北完整上游 WGS84 分區面，依來源名稱 regex 萃取，114/114 與處理表幾何拓撲相等；Mini 展示版為另一份降低精度的檔案。", spatialAnalysisEligible: true },
  timeFields: [], coverage: "臺北 12 面、新北 102 面；僅都市計畫區的墓葬類分區。其他縣市、非都市土地墳墓用地及任何現況使用不在此資料集。bbox 無命中不代表沒有墓地。",
  license: "兩市來源記 OGDL-Taiwan-1.0；本 reader 限 localhost owner-only，未驗公開發布。",
  valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, missing: "無命中只是此固定萃取版未相交，不可解釋為沒有墓地或合法用途。", stale: "2026-08-05 是本地萃取版次，非逐筆都市計畫公告生效日期。", zero: "面積 0 只能解讀為來源明示值，不可補零。" },
  versions: [{ versionId: `derived-geojson-sha256:${SHA}`, observedAt: null, availableAt: "2026-08-05", checksumSha256: SHA, mutable: false }],
  source: { publisher: "臺北市政府都市發展局、新北市政府城鄉發展局", reference: URL, lineage: "taipei_detail.zip SHA d89e3ab3dcdc60de2b2b83987c0774d87ae3037d53af2adf5a28f47b3a44a21b; newtaipei_detail.zip SHA 6a59efb20a75e18ba7e71cb7953b03454cab0717c28558841a506acf7113d215; processed city Parquet SHA 26f8729a3b5162f213c84e7ea493d22cfbf6219585fa2f51e1c1950f4cd31483 and cc49e80ed1d59b4630ab836c3487543a07cda390b206ddebb8adf65631f23418; 01_extract.py selects zone_name in Taipei and zone_raw in New Taipei with 墓|殯葬|殯儀, then transforms to WGS84. Independently rederived all 114 labels and topologically equal geometries. Mini public display SHA 55302cbf68ab98cf5608b6c5ac626eaef4eaa0dc3f80c46814f8b86f5d1a844e is a separate precision-reduced version." },
  access: boundedAccess({ mode: "owner_only", method: "local_asset", fields: fields.map(f => f.name), filters: ["zoning_id", "zone_label", "county", "source_dataset"], supportsBbox: true, maxRowsPerQuery: ROWS, maxScanRows: ROWS, maxSourceBytes: 2 * 1024 * 1024 }),
  supportedOperations: ["query_records", "aggregate"], adapterId: "cemetery-zoning-urban-owner-v1",
};

async function sha256(bytes: Uint8Array): Promise<string> { const digest = await crypto.subtle.digest("SHA-256", bytes); return [...new Uint8Array(digest)].map(v => v.toString(16).padStart(2, "0")).join(""); }
function fail(): never { throw new Error("CEMETERY_ZONING_ASSET_MISMATCH"); }

export const cemeteryZoningOwnerAdapter: QueryAdapter = {
  descriptor: cemeteryZoningOwnerDescriptor, allowedParameters: {},
  read: (_parameters, signal): Promise<AdapterReadResult> => withLoading("research:cemetery-zoning-owner", "墓葬分區完整面", (async () => {
    const response = await fetch(URL, { credentials: "same-origin", redirect: "error", signal: signal ?? AbortSignal.timeout(15_000) });
    if (!response.ok || !response.body || response.headers.get("content-type")?.includes("text/html")) fail();
    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > 2 * 1024 * 1024) fail();
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength !== BYTES || await sha256(bytes) !== SHA) fail();
    const data = JSON.parse(new TextDecoder().decode(bytes)) as { type?: unknown; features?: unknown[] };
    if (data.type !== "FeatureCollection" || !Array.isArray(data.features) || data.features.length !== ROWS) fail();
    const ids = new Set<string>(); let taipei = 0, newtaipei = 0;
    const rows = data.features.map((raw, index) => {
      const feature = raw as { type?: unknown; properties?: Record<string, unknown>; geometry?: unknown }, p = feature.properties;
      if (feature.type !== "Feature" || !p || p.zoning_id !== `Z${String(index + 1).padStart(4, "0")}` || typeof p.zoning_id !== "string" || ids.has(p.zoning_id)
        || typeof p.zone_label !== "string" || !/墓|殯葬|殯儀/.test(p.zone_label) || typeof p.area_ha !== "number" || !Number.isFinite(p.area_ha)
        || !((p.county === "臺北市" && p.source_dataset === "urban_zoning_taipei") || (p.county === "新北市" && p.source_dataset === "urban_zoning_newtaipei"))) fail();
      ids.add(p.zoning_id); if (p.county === "臺北市") taipei++; else newtaipei++;
      const geometry = parseSpatialGeometry(feature.geometry);
      if (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") fail();
      return { zoning_id: p.zoning_id, zone_label: p.zone_label, county: p.county, source_dataset: p.source_dataset, area_ha: p.area_ha,
        geometry: geometry.type === "Polygon" ? { type: "MultiPolygon", coordinates: [geometry.coordinates] } : geometry };
    });
    if (taipei !== 12 || newtaipei !== 102) fail();
    const sourceRefs: SourceReceipt[] = [{ sourceId: cemeteryZoningOwnerDescriptor.datasetId, version: `owner-sidecar-sha256:${SHA}`, checksumSha256: SHA, reference: URL, acquiredAt: new Date().toISOString() }];
    return { rows, sourceRefs, coverage: cemeteryZoningOwnerDescriptor.coverage, freshness: "stale", exclusions: {}, rowsScanned: ROWS, bytesScanned: BYTES, downloadedBytes: BYTES, requests: 1, cacheHit: false, expiresAt: null };
  })()),
};
