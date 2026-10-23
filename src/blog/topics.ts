/**
 * /blog 主題（一篇一個，進網址 /blog/<id>/<slug>/）。
 * id 是網址契約：定了就不要改；name／description 可以改。列表頁依此順序排主題分區。
 */
export interface BlogTopic {
  id: string;
  name: string;
  description: string;
}

export const BLOG_TOPICS: readonly BlogTopic[] = [
  { id: "rail", name: "軌道", description: "高鐵、台鐵、捷運與輕軌怎麼變成地圖上會動的列車。" },
  { id: "aviation", name: "航空", description: "航班軌跡、機場與空域的資料視覺化。" },
  { id: "maritime", name: "海運", description: "船舶 AIS 動態、港口與海域。" },
  { id: "statistics", name: "統計與人口", description: "人口、區域統計與開放資料圖層。" },
  { id: "terrain", name: "地形與環境", description: "地形、建物、行道樹、氣象與環境資料。" },
  { id: "ai", name: "AI 與分析", description: "用 AI Agent 在地圖上做空間分析。" },
];

export function topicById(id: string): BlogTopic | undefined {
  return BLOG_TOPICS.find((t) => t.id === id);
}
