/**
 * 警察、法院、檢察署的階層 → C-5 類別色盤（mapStyleScale MAP_CATEGORICAL）索引。地圖（overlayRegistry）與圖例（civicServiceLegends）共用。
 * 2026-11-10 使用者同意：原本同色相深淺（警察 4 階藍、法院 6 階紫）在暗底看不到也分不開，改色相分明；
 * 量最多的一階維持機關原本的色相（派出所藍、地方法院／地檢署紫）。挑選與色弱模擬見 docs/design-system/map-layers.md §3.9 C-5。
 */
export const POLICE_TIER_COLOR_KEYS = [
  ["headquarters", 2],
  ["police_dept", 3],
  ["precinct", 6],
  ["substation", 0],
  ["specialized", 1],
  ["security", 4],
] as const;

export const COURT_TIER_COLOR_KEYS = [
  ["supreme", 3],
  ["high", 4],
  ["district", 7],
  ["admin", 2],
  ["ipc", 1],
  ["juvenile_family", 6],
] as const;

export const PROSECUTOR_TIER_COLOR_KEYS = [
  ["supreme", 3],
  ["high", 4],
  ["district", 7],
] as const;

export const tierColorIndex = (keys: ReadonlyArray<readonly [string, number]>, value: string) => keys.find(([v]) => v === value)?.[1];

/**
 * 警察覆蓋等時圈 overlap_count 色階（step 斷點：1、2、3、5、8、12、20 站）。重疊越多越醒目：
 * 淡底由淺到深（原色）；暗底 2026-11-10 改由暗紅到亮黃（原本最內圈 #7f1d1d 疊暗陸幾乎看不到）。地圖與圖例共用。
 */
export const POLICE_ISO_OVERLAP_BREAKS = [1, 2, 3, 5, 8, 12, 20] as const;
export const POLICE_ISO_OVERLAP_COLORS = {
  light: ["#fef2f2", "#fee2e2", "#fca5a5", "#f87171", "#ef4444", "#dc2626", "#991b1b", "#7f1d1d"],
  dark: ["#9b2c2c", "#b83232", "#d43d2f", "#e8592a", "#f47c2a", "#f9a23a", "#fcc55a", "#fde68a"],
} as const;
