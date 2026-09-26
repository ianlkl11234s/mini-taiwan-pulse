import { createVerifiedPointDatasetAdapter } from "./verifiedPointDataset";

/** Fixed 2026-07-17 iPost Box source-coordinate snapshot. */
export const iPostBoxesSourceCoordinatesAdapter = createVerifiedPointDatasetAdapter({
  datasetId: "tw-ipost-boxes-source-coordinates", label: "全國 i 郵箱來源座標",
  description: "中華郵政 2026-07-17 取得的 2,345 筆 i 郵箱來源座標快照。每筆是來源清冊中的包裹櫃位置；不代表目前可用、櫃體空位、收寄服務、付款方式或步行可達性。",
  sourceUrl: "/civic_facilities/ibox_national.geojson",
  expectedSha256: "0c0dccddc71a8dec9d51353be2439529c10f93b174d8acc4f7bf4f735a81e572",
  expectedSourceRows: 2345, expectedSelectedRows: 2345, fullSource: true, selection: {}, layerRefs: ["iPostBoxes"],
  fields: [
    { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "name", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "postal_code", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "address", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "relative_location", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "business_hours", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "locker_count", type: "number", nullable: false, nullMeaning: null, unit: "櫃格" },
    { name: "cabinet_type", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "payment_method", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
  ],
  publisher: "中華郵政（data.gov.tw/dataset/52779）；existing source-coordinate artifact",
  license: "政府資料開放授權條款-第1版（OGDL-Taiwan-1.0）",
  precision: "來源 WGS84 Point；上游已校正 1 筆 swapped 座標，未另行驗證櫃體入口或測量精度。",
  coverageDescription: "全臺來源快照 2,345 筆 i 郵箱 Point records；全部具有有效座標。2026-07-17 是 source 取得日，不是營業觀測日；官方更新頻率不定期，現況／可用性 unknown。來源未提供穩定 UID，record_id 是固定 SHA 加來源列序，僅在此版本有效；122 個重複座標均保留，不能依座標去重。",
  sourceLineage: "中華郵政 data.gov.tw 52779 i 郵箱資料集 -> pipeline coordinate validation (1 swapped coordinate corrected) -> fixed 2,345-Point GeoJSON bytes -> SHA/count validation; source has no stable UID so record_id is version-scoped SHA plus source row index; repeated coordinates and all source fields are retained unchanged. payment_method is an empty string in all 2,345 rows and means source did not supply payment-method semantics; it must not be interpreted as free, unavailable, zero, or verified.",
});
