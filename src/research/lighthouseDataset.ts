import { createVerifiedPointDatasetAdapter } from "./verifiedPointDataset";

/** Fixed Maritime and Port Bureau source coordinates; this is not a live lighthouse-status feed. */
export const lighthousesSourceCoordinatesAdapter = createVerifiedPointDatasetAdapter({
  datasetId: "tw-lighthouses-source-coordinates", label: "全臺燈塔來源座標",
  description: "交通部航港局原始 Shapefile 經既有 pipeline 轉為 WGS84 的 36 筆固定燈塔點位。保留來源度分秒文字；來源／pipeline 日期未知，不代表目前啟用、開放、燈質或航安狀態。",
  sourceUrl: "/geo/lighthouse.geojson",
  expectedSha256: "83d159331d1a8b0e4251f9460894d0192d2538b90710d3186525c75ca6f96a00",
  expectedSourceRows: 36, expectedSelectedRows: 36, fullSource: true, selection: {}, layerRefs: ["lighthouses"],
  fields: [
    { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "name", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "source_lat_dms", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "source_lon_dms", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
  ],
  sourceFieldMap: { name: "Name", source_lat_dms: "Lat", source_lon_dms: "Lon" },
  publisher: "交通部航港局（原始 Shapefile；data.gov.tw/dataset/6091）",
  license: "OGDL-Taiwan-1.0",
  precision: "既有 pipeline 將來源 Shapefile 座標轉為 WGS84 Point；來源度分秒文字原樣保留，未驗證測量精度或設施入口。",
  coverageDescription: "全臺 36 筆來源座標 Point records；來源與 pipeline 日期 unknown；fullSource=true；current lighthouse status unknown。",
  sourceLineage: "交通部航港局燈塔原始 Shapefile -> existing pipeline DMS/source coordinates to WGS84 GeoJSON -> fixed bytes -> SHA/count validation; geometry is a direct source coordinate, not a live status assertion.",
});
