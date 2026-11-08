/**
 * #30DayMapChallenge 2026（每年 11 月，每天一個題目）。
 * 題目英文名照官方網站；中文說明是官方一句說明的意譯（2026-11-07 對照 https://30daymapchallenge.com/ ）。
 * 文章 front matter 填 `challengeDay: N`（1–30）就成為挑戰文章，出現在總覽頁 /blog/30daymapchallenge/。
 */
export const MAP_CHALLENGE_SERIES = "30 天地圖挑戰";
export const MAP_CHALLENGE_YEAR = 2026;
export const MAP_CHALLENGE_PATH = "/blog/30daymapchallenge/";
export const MAP_CHALLENGE_SITE = "https://30daymapchallenge.com/";

export interface MapChallengeDay {
  day: number;
  /** 官方英文題目 */
  theme: string;
  /** 官方說明的中文意譯 */
  description: string;
}

export const MAP_CHALLENGE_DAYS: readonly MapChallengeDay[] = [
  { day: 1, theme: "Points", description: "經典題：用點畫地圖。" },
  { day: 2, theme: "Lines", description: "經典題：用線畫地圖。" },
  { day: 3, theme: "Polygons", description: "經典題：用面畫地圖。" },
  { day: 4, theme: "Clusters", description: "群聚：熱點、群組，聚在一起的東西。" },
  { day: 5, theme: "Senses: Sight", description: "你怎麼看見？例如視域分析。" },
  { day: 6, theme: "Vintage", description: "做一張像古地圖的地圖，或主題本身是過去。" },
  { day: 7, theme: "10 minute map", description: "十分鐘內完成的地圖。" },
  { day: 8, theme: "Utopia", description: "一張「可能會是這樣」的地圖。" },
  { day: 9, theme: "Urban-rural", description: "城市或鄉村，都市與田野。" },
  { day: 10, theme: "Prompting only", description: "只靠 AI 對話或指令列，從頭到尾做出地圖。" },
  { day: 11, theme: "Senses: Sound", description: "你怎麼聽見？聲景或噪音地圖。" },
  { day: 12, theme: "Power", description: "電力、力量或影響力，怎麼解讀都可以。" },
  { day: 13, theme: "Interactions", description: "事物之間的互動，或做成互動地圖。" },
  { day: 14, theme: "Borgesian map", description: "精細到等於實地的地圖（波赫士〈論科學的精確〉）。" },
  { day: 15, theme: "Inside out", description: "裡外翻轉、上下顛倒，地圖上有什麼不太對。" },
  { day: 16, theme: "Collaborative map", description: "和朋友、同事或陌生人合作（AI 不算朋友）。" },
  { day: 17, theme: "Light & dark", description: "玩光影：只用光與影能畫出什麼？" },
  { day: 18, theme: "NULL", description: "官方未附說明。" },
  { day: 19, theme: "Senses: Smell", description: "鼻子聞得到的東西怎麼畫成地圖？" },
  { day: 20, theme: "Hexagons", description: "六角形，老朋友了。" },
  { day: 21, theme: "OpenStreetMap", description: "用 OpenStreetMap 資料，或這天去編輯 OSM。" },
  { day: 22, theme: "Projections", description: "把球面攤平的各種投影。" },
  { day: 23, theme: "Senses: Taste", description: "食物、飲料，或其他嚐得到的東西。" },
  { day: 24, theme: "Network", description: "路網、運輸網、人際網路，或完全不同的網絡。" },
  { day: 25, theme: "Is this a map?", description: "把地圖混進藝術或創意資料視覺化：什麼時候它不再是地圖？" },
  { day: 26, theme: "Water", description: "地表約七成是水。" },
  { day: 27, theme: "New tool", description: "在製圖流程裡試一個新工具。" },
  { day: 28, theme: "Senses: Feeling", description: "感官系列最抽象的一題：感受怎麼畫成地圖？" },
  { day: 29, theme: "Raster", description: "用像素做點有趣的事。" },
  { day: 30, theme: "Pen & paper", description: "闔上電腦，用紙筆手繪一張地圖。" },
];

export function challengeDayInfo(day: number): MapChallengeDay | undefined {
  return MAP_CHALLENGE_DAYS.find((d) => d.day === day);
}
