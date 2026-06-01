/**
 * 救援等時圈縣市下拉選單選項（單一真實來源）。
 * 給 useTransportParams 的 select 控制與 fireIsochroneLayerFactory 的 setFilter 共用，
 * 避免下拉標籤與篩選邏輯漂移。
 *
 * - index 0 = 「全台」(value "all")：不套 filter，顯示所有縣市。
 * - 其餘 value = county 名稱，對應 fire_isochrone_coverage.geojson 的 properties.county。
 * - 順序與有資料縣市由 scripts/fetch/fetch-fire-isochrones.py 輸出（21 縣市，屏東縣上游缺座標無資料）。
 */
export const FIRE_ISOCHRONE_COUNTY_OPTIONS: { label: string; value: string }[] = [
  { label: "全台", value: "all" },
  { label: "基隆市", value: "基隆市" },
  { label: "臺北市", value: "臺北市" },
  { label: "新北市", value: "新北市" },
  { label: "桃園市", value: "桃園市" },
  { label: "新竹市", value: "新竹市" },
  { label: "新竹縣", value: "新竹縣" },
  { label: "苗栗縣", value: "苗栗縣" },
  { label: "臺中市", value: "臺中市" },
  { label: "彰化縣", value: "彰化縣" },
  { label: "南投縣", value: "南投縣" },
  { label: "雲林縣", value: "雲林縣" },
  { label: "嘉義市", value: "嘉義市" },
  { label: "嘉義縣", value: "嘉義縣" },
  { label: "臺南市", value: "臺南市" },
  { label: "高雄市", value: "高雄市" },
  { label: "宜蘭縣", value: "宜蘭縣" },
  { label: "花蓮縣", value: "花蓮縣" },
  { label: "臺東縣", value: "臺東縣" },
  { label: "澎湖縣", value: "澎湖縣" },
  { label: "金門縣", value: "金門縣" },
  { label: "連江縣", value: "連江縣" },
];

/** index → county 名稱（all → null = 不篩選）。 */
export function fireIsochroneCountyByIndex(idx: number): string | null {
  const opt = FIRE_ISOCHRONE_COUNTY_OPTIONS[idx];
  if (!opt || opt.value === "all") return null;
  return opt.value;
}
