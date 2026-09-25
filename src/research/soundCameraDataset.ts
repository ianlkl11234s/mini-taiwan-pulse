import { createVerifiedPointDatasetAdapter } from "./verifiedPointDataset";

/** Official equipment list, including unlocated records; geocoded positions are proxies. */
export const soundCameraListedLocationsAdapter = createVerifiedPointDatasetAdapter({
  datasetId: "tw-sound-camera-listed-locations", label: "彰化與臺南聲音照相官方列點",
  description: "兩個地方政府的固定式聲音照相清單 333 筆。267 筆由離線地址／路段匹配產生代理 Point，66 筆沒有可信座標；資料不含即時設備狀態、噪音值或告發事件。",
  sourceUrl: "/environment/sound_camera_locations.geojson",
  expectedSha256: "671dcc019a074d5e702bcd0fa0f803a79ce03d9133511151b2d126563db5a5db",
  expectedSourceRows: 333, expectedSelectedRows: 333, fullSource: true, selection: {},
  preserveUnlocatedRecords: true, geometryRole: "proxy", layerRefs: ["soundCameraLocations"],
  fields: [
    { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "location_id", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "location_name", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "county", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "source_dataset_id", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "source_updated_at", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "spatial_precision", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "spatial_validation_status", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "is_renderable", type: "boolean", nullable: false, nullMeaning: null, unit: null },
    { name: "equipment_status", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "geometry", type: "json", nullable: true, nullMeaning: "來源列未能以可信地址或路段定位；不是縣市中心，也不是設備不存在", unit: null },
  ],
  publisher: "彰化縣環境保護局（173697）與臺南市政府環境保護局（156743）",
  license: "政府資料開放授權條款-第1版（OGDL-Taiwan-1.0）",
  precision: "267 個 Point 是離線地址／路段匹配的代理位置（75 geocoded_address、135 road_segment、57 fuzzy）；不能用於設備精確附近距離或最近點。66 列 geometry=null。",
  coverageDescription: "固定快照含彰化 9、臺南 324，共 333 個官方清單紀錄；267 個可顯示代理 Point、66 個未定位紀錄仍可按屬性查詢。來源 metadata 分別為 2026-04-15 與 2026-04-21；2026-08-27 是本地建置日，不是設備觀測日。equipment_status=not_provided；未定位不能算沒有設備，也不能用代理點回答精確空間問題。",
  sourceLineage: "彰化 173697 CSV SHA 29e5d9d583af7caffc8a280c10ec7814355f0402eb9d10a0028b3389924796fd、臺南 156743 JSON SHA 6a900fe489aa1a4a6d6291ab173768c90d9f93eec7e1a4625e781aaf694adc9d -> 既有離線 geocoder 與行政界驗證 -> analytics processed GeoJSON 與 Mini public asset 同 SHA -> 保留 333 筆及 66 個 null geometry；record_id 為發布 SHA 加列索引。",
});
