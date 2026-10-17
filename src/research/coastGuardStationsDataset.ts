import { createVerifiedPointDatasetAdapter } from "./verifiedPointDataset";

/** Fixed safe-field sidecar derived from the verified analytics coast-guard snapshot. */
export const coastGuardStationsSourceCoordinatesAdapter = createVerifiedPointDatasetAdapter({
  datasetId: "tw-coast-guard-stations-source-coordinates", label: "全國海巡據點來源座標",
  description: "海巡署安檢所、海巡隊與海洋驛站的 2026-06-26 固定 269-Point 快照。entity_id 有一筆重複，唯一列識別使用 version-scoped record_id。",
  sourceUrl: "/research/coast-guard-stations-20260626.geojson",
  expectedSha256: "f8ec09536e9a2e3df7f2da6ee039c4ec000dc36ad1fa9a5d0270058ab044c702", expectedSourceRows: 269, expectedSelectedRows: 269, fullSource: true, selection: {},
  layerRefs: ["coastGuardStation"],
  fields: [
    { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "entity_id", type: "string", nullable: false, nullMeaning: "來源 entity_id 有 268 個不同值對應 269 個 Point 列；唯一列識別使用 version-scoped record_id", unit: null },
    { name: "name", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "area", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "facility_subtype", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "source", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "source_tier", type: "number", nullable: false, nullMeaning: null, unit: null },
    { name: "fetched_at", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "confidence", type: "number", nullable: true, nullMeaning: "patrol_station 來源未提供 trust-chain confidence；不是零信心", unit: null },
    { name: "n_sources", type: "number", nullable: true, nullMeaning: "patrol_station 為單一來源直出，未提供 trust-chain source count；不是零來源", unit: null },
    { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
  ],
  publisher: "海洋委員會海巡署（data.gov.tw 7089、160068、166260）",
  license: "政府資料開放授權條款-第1版（OGDL-Taiwan-1.0）",
  precision: "processed GeoJSON 保留來源 WGS84 Point；不保證入口、服務範圍、現場開放狀態或道路可達性。",
  coverageDescription: "2026-06-26 固定快照的全國 269 個海巡據點 Point 列：安檢所／海巡隊 252、海洋驛站 17。safe sidecar 不含地址、郵遞區號、電話混入的地址欄、服務內容、aliases 與 _provenance。fetched_at 是 pipeline 擷取日，不代表現時配置、開放或服務狀態；既有 coastGuardStation display asset 不存在，未建立同版對齊證據。",
  sourceLineage: "海巡署 data.gov.tw 7089、160068、166260 -> analytics coast_guard_stations_20260626.geojson SHA 8a4624f2d3d821b24052203a28af06808c174d2cee161cb4c199e8bf6fa78183 -> deterministic safe-field sidecar SHA/count/Point validation；entity_id 重複 1 列，保留原始列且 record_id 為 sidecar SHA 加列索引；layerRef 僅指向 coastGuardStation，不構成 display 資產同版證據。",
});
