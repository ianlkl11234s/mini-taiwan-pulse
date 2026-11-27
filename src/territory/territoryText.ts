/**
 * 「領土格」原型（v0）的使用者可見中文字串集中在這裡，之後要搬 locale 時一次搬走。
 * 英日文尚未提供：原型只在本機看。
 */
export const TERRITORY_TEXT = {
  railTooltip: "領土格",
  panelEyebrow: "格網",
  panelTitle: "領土格",
  intro: "台灣切成六角格，點一格就看這塊地的所有屬性。縮小時格子自動變大。",
  tagSection: "標籤",
  tagHint: "選一個標籤，格子依分數上色",
  attrSection: "屬性",
  attrHint: "單選一項屬性上色",
  clearColor: "只看格子",
  opacity: "透明度",
  legendUncovered: "未涵蓋",
  legendGrayBase: "灰格＝尚未選標籤或屬性",
  legendOther: "其他",
  legendLowHigh: "淺＝少　深＝多",
  legendLowHighDistance: "淺＝近　深＝遠",
  legendScore: "分數 0–100（百分位）",
  legendNoBreaks: "這一層的數值都相同，無法分級",
  legendNoStatsAtRes: "此屬性在這個縮放沒有資料，請縮小地圖（格子變大）再看",
  loading: "格子屬性載入中…",
  loadFailed: "格子屬性載入失敗",
  resNote: (label: string) => `目前畫面：${label}`,
  coverageOnly: (areas: string) => `涵蓋：${areas}`,
  legendZeroSplit: "大多數格子是 0：0 單獨一階，其餘由少到多分級",
  zoomOut: "此縮放沒有資料，請縮小",
  bizGroup: (n: number) => `各產業大類家數（${n} 類）`,
  bizOther: (n: number) => `其他 ${n} 類`,
  bizNone: "這格沒有登記公司",
  villageValue: "村里值",
  villageValueNote: "村里值＝格子所在村里的統計值，同一村里的格子數值相同",
  uncovered: "未涵蓋",
  cardEyebrow: "領土卡",
  cardClose: "關閉領土卡",
  cardAbilities: "能力值",
  beatAll: (n: number) => `贏過全台 ${n}% 的格子`,
  beatArea: (n: number, areas: string) => `贏過${areas} ${n}% 的格子`,
  sourceLine: (source: string, date: string) => (date ? `${source} · ${date}` : source),
  loadingLabel: "領土格屬性",
} as const;

/** 解析度白話（H3 平均邊長：res7 約 1.2 km、res8 約 460 m、res9 約 170 m，站主拍板 res9 叫「約 200 公尺格」） */
export const RES_LABEL: Record<number, string> = {
  7: "約 1.2 公里格",
  8: "約 500 公尺格",
  9: "約 200 公尺格",
};

/** 三個標籤（站主拍板名稱；不叫治安） */
export const SCORE_TAGS = [
  { key: "score_response", label: "應變速度", blurb: "出事時，消防、救護、警察多快趕得到" },
  { key: "score_wealth", label: "財力", blurb: "這塊地的房價、所得看起來有多「富」" },
  { key: "score_convenience", label: "便利度", blurb: "走出門，買東西、搭車、辦事有多方便" },
] as const;

export type ScoreKey = (typeof SCORE_TAGS)[number]["key"];

/** 屬性區的 tag 顯示順序（契約的 tag 列舉；「標籤」由上方三顆大按鈕處理，不在屬性區重列） */
export const TAG_ORDER = ["交通", "生活機能", "應變", "房價", "產業", "土地", "人口", "地形"] as const;
