import { createVerifiedPointDatasetAdapter } from "./verifiedPointDataset";

/**
 * Fixed, three-city urban-park source snapshot.  Despite the historic asset
 * filename, its verified coverage includes Taipei, Taichung, and Tainan.
 */
export const parksFixedPointAdapter = createVerifiedPointDatasetAdapter({
  datasetId: "tw-urban-parks-fixed-20260705",
  label: "都會公園綠地（2026-07-05 固定快照）",
  description: "臺北、臺中與臺南三市公園綠地的 2,917 筆固定來源 Point。座標只作公園或設施的點位參考，不是公園邊界；不能用於面積相交、範圍涵蓋、入口、步行、大眾運輸或其他可達性判定。",
  sourceUrl: "/urban/parks_taipei.geojson",
  expectedSha256: "2f015b8f1f5cccc33db3abb1dae6d8bc9918c937288dbfb0a5c2aa43e9acf38a",
  expectedSourceRows: 2_917,
  expectedSelectedRows: 2_917,
  fullSource: true,
  selection: {},
  layerRefs: ["parksTaipei"],
  fields: [
    { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "park_id", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "city", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "district", type: "string", nullable: true, nullMeaning: "來源未提供行政區；臺北 128366 與臺南 6182 的來源欄位沒有區名", unit: null },
    { name: "name", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "category", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "address", type: "string", nullable: true, nullMeaning: "來源未提供地址或座落位置；不表示沒有地址", unit: null },
    { name: "area_sqm", type: "number", nullable: true, nullMeaning: "來源未提供可用面積；不表示面積為 0 或沒有公園範圍", unit: "m²" },
    { name: "has_playground", type: "boolean", nullable: true, nullMeaning: "來源無法判定是否有兒童遊戲場；不表示沒有", unit: null },
    { name: "source_dataset", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
  ],
  publisher: "臺北市公園路燈工程管理處、臺中市建設局、臺南市工務局",
  license: "政府資料開放授權條款第 1 版（OGDL-Taiwan-1.0）",
  precision: "各來源提供或由臺北 136476 TWD97 TM2 轉換的 WGS84 Point；點位代表公園／設施位置參考，不是公園 polygon、法定界址、入口或可達路徑。",
  coverageDescription: "2026-07-05 固定處理快照共 2,917 筆 Point：臺北市 1,350（136476 520、128366 830）、臺中市 1,081（88288）、臺南市 486（6182）。這是三市 MVP，bbox 無結果不代表該地沒有公園。檔名 parks_taipei.geojson 是既有靜態路徑，不能推論只涵蓋臺北。",
  sourceLineage: "臺北 136476 公園設施資料（EPSG:3826→4326，972 設施列依名稱／行政區／座標聚合為 520 Point）+ 臺北 128366 公園基本資料（830 Point）+ 臺中 88288 公園綠地清冊（1,081 Point）+ 臺南 6182 資源 7ed7d9a6（486 Point）-> analytics parks_20260705.geojson -> Mini /urban/parks_taipei.geojson；兩檔 SHA-256 2f015b8f1f5cccc33db3abb1dae6d8bc9918c937288dbfb0a5c2aa43e9acf38a 相同。來源未跨源去重，臺北設施與公園基本資料可能對應同一公園。",
});
