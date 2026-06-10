// PMTiles SourceType 常數（純常數模組，不 import mapbox runtime，
// 讓 overlayManager 等模組可在 node 測試環境下被 import）。
// 值必須與 mapbox-pmtiles 的 PmTilesSource.SOURCE_TYPE 一致，
// pmtilesSourceType.ts 註冊時會 dev-assert。
export const PMTILES_SOURCE_TYPE = "pmtile-source";
