/**
 * /blog 主題（一篇一個）。依「文章在做什麼」分，不依資料種類分，避免一個主題只有一兩篇（2026-10-24 由六類收斂成三類）。
 * 主題頁網址 /blog/<id>/；文章網址不含主題，所以改主題不會讓文章連結斷掉，但主題頁網址改了要在 nginx 加 301。
 * 列表頁依此順序排主題分區。
 */
export interface BlogTopic {
  id: string;
  name: string;
  description: string;
}

export const BLOG_TOPICS: readonly BlogTopic[] = [
  { id: "layers", name: "圖層", description: "把開放資料畫成地圖：列車、船舶、公車、衛星、地形、建物、氣象與各種生活設施。" },
  { id: "analysis", name: "分析與模擬", description: "用地圖上的資料問問題：擁擠模擬、斷橋模擬、航線繞行、颱風疏散與 AI 空間分析。" },
  { id: "making", name: "製作筆記", description: "這張地圖怎麼做出來：資料庫、介面、設計系統與 AI 協作的工作流。" },
];

export function topicById(id: string): BlogTopic | undefined {
  return BLOG_TOPICS.find((t) => t.id === id);
}
