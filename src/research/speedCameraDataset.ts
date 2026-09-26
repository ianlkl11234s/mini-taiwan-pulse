import { createVerifiedPointDatasetAdapter } from "./verifiedPointDataset";

const common = {
  sourceUrl: "/research/speed-cameras-source-20260824.geojson",
  expectedSha256: "749c5fce5c6a54a0327160a7882f3373c4535bb6769e557f439097c3ba57ea3c", expectedSourceRows: 2805, layerRefs: ["speedCamera"],
  fields: [
    { name: "record_id", type: "string" as const, nullable: false, nullMeaning: null, unit: null },
    { name: "entity_id", type: "string" as const, nullable: false, nullMeaning: null, unit: null },
    { name: "name", type: "string" as const, nullable: true, nullMeaning: "此來源類型未提供可顯示的地點名稱；不是無設備", unit: null },
    { name: "facility_subtype", type: "string" as const, nullable: false, nullMeaning: null, unit: null },
    { name: "city", type: "string" as const, nullable: true, nullMeaning: "來源未提供設置縣市", unit: null },
    { name: "region", type: "string" as const, nullable: true, nullMeaning: "來源未提供設置鄉鎮區", unit: null },
    { name: "limit_kph", type: "number" as const, nullable: true, nullMeaning: "來源未提供速限；不是零速限", unit: "km/h" },
    { name: "source", type: "string" as const, nullable: false, nullMeaning: null, unit: null },
    { name: "source_tier", type: "number" as const, nullable: false, nullMeaning: null, unit: null },
    { name: "fetched_at", type: "string" as const, nullable: true, nullMeaning: "來源列未保留擷取日期；固定快照版本仍是 2026-08-24", unit: null },
    { name: "coord_suspect", type: "boolean" as const, nullable: false, nullMeaning: null, unit: null },
    { name: "confidence", type: "number" as const, nullable: false, nullMeaning: null, unit: null },
    { name: "n_sources", type: "number" as const, nullable: false, nullMeaning: null, unit: null },
    { name: "geometry", type: "json" as const, nullable: false, nullMeaning: null, unit: null },
  ] as const,
  publisher: "內政部 TGOS 與警政署／高速公路局／交通部鐵道局資料來源",
  license: "政府資料開放授權條款-第1版（OGDL-Taiwan-1.0）",
  sourceLineage: "警政署 data.gov.tw 7320、13940、100856、31908 與 TGOS Theme_Id=kJqZSMsB -> analytics 2026-08-24 processed GeoJSON SHA ce46f68a1ae617a0ae6a14ecaf470613b5a7587cb5b2c5f57709a80c596bb740 -> deterministic safe-field sidecar SHA/count/Point/suspect validation。speedCamera 既有 display asset 仍為 2026-06-26，未建立同版本 display 對齊證據。",
} as const;

/** All source rows remain attribute-queryable; points marked coord_suspect are not spatial evidence. */
export const speedCameraListedAdapter = createVerifiedPointDatasetAdapter({
  ...common,
  datasetId: "tw-speed-cameras-listed", label: "全國交通取締點官方清單",
  description: "2026-08-24 固定 2,805 筆測速、闖紅燈與平交道照相設備清單。62 筆座標落在台灣 bbox 外而標記 coord_suspect，保留供屬性查詢，不作空間分析。",
  expectedSelectedRows: 2805, fullSource: true, selection: {}, geometryRole: "proxy",
  precision: "來源 Point；62 筆 coord_suspect 落在台灣 bbox 外，整份清單不提供附近或距離證據。座標不保證設備實際朝向、執法狀態或有效取締範圍。",
  coverageDescription: "2026-08-24 固定快照共 2,805 筆：一般測速 2,620、國道測速 169、闖紅燈 10、平交道 6。所有列保留；62 筆 coord_suspect=true（25 筆亦未保留列級 fetched_at）不能據此判定設備不存在或失效。",
});

/** Only coordinates inside the source's Taiwan-bbox validation may answer bounded straight-line queries. */
export const speedCameraTaiwanCoordinatesAdapter = createVerifiedPointDatasetAdapter({
  ...common,
  datasetId: "tw-speed-cameras-taiwan-coordinates", label: "全國交通取締點台灣座標",
  description: "同版固定清單中 coord_suspect=false 的 2,743 筆 Point；可做有界直線距離或 bbox 候選查詢，不能代表目前執法或道路可達性。",
  expectedSelectedRows: 2743, selection: { coord_suspect: false },
  precision: "來源 WGS84 Point 且 coord_suspect=false；不是設備朝向、執法啟用狀態、有效取締範圍或道路網可達性。",
  coverageDescription: "同版 2,805 筆清單中，僅 2,743 筆 coord_suspect=false 可作空間查詢；62 筆 bbox 外座標均排除。這是座標驗證篩選，不是完整的全國設備覆蓋或現役狀態。",
});
