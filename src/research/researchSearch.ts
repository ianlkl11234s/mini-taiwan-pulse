/// <reference lib="es2022.intl" />
/** Small synonym groups expand discovery, never select an analysis or prove a claim. */
const CONCEPTS = [
  ["教育", "教育資源", "學習", "education", "學校", "圖書館", "幼兒園", "補習", "school", "library"],
  ["醫療", "醫療資源", "健康", "hospital", "醫院", "診所", "衛生"],
  ["交通", "運輸", "transport", "捷運", "公車", "車站"],
  ["人口", "居住", "population", "住宅"],
  ["農業", "農田", "農地", "田區", "水田", "水稻", "paddy", "farmland"],
  ["殯葬", "殯儀", "火化", "公墓", "墓地", "納骨", "funeral", "cemetery"],
  ["觀光", "旅遊", "景點", "旅宿", "tourism", "attraction"],
  ["新聞", "時事", "消息", "news"],
];
const FILLER = new Set(["我", "我想", "我們", "你", "想", "想要", "要", "知道", "看看", "看", "了解", "請", "幫", "幫我", "一下", "目前", "現在", "有", "有哪些", "哪些", "什麼", "哪裡", "如何", "怎麼", "是否", "可能", "相關", "關於", "的", "跟", "和", "與", "是", "在", "分布", "分佈", "情形", "資料", "圖層", "台灣", "全台", "台"]);
const segmenter = new Intl.Segmenter("zh-Hant", { granularity: "word" });
export function normalizeSearch(value: string): string { return value.normalize("NFKC").toLowerCase().replace(/臺/g, "台").trim(); }

export function searchTerms(query: string): string[] {
  const words = [...segmenter.segment(normalizeSearch(query))].filter(part => part.isWordLike).map(part => part.segment);
  const terms: string[] = [];
  let singles = "";
  const flush = () => { if (singles.length > 1) terms.push(singles); singles = ""; };
  for (const word of words) {
    if (FILLER.has(word)) { flush(); continue; }
    if (word.length === 1 && /\p{Script=Han}/u.test(word)) singles += word;
    else { flush(); if (word.length > 1) terms.push(word); }
  }
  flush();
  return [...new Set(terms)];
}

export function searchScore(query: string, text: string): number {
  const needle = normalizeSearch(query); const haystack = normalizeSearch(text);
  if (!needle) return 1;
  if (haystack.includes(needle)) return 100;
  const tokens = searchTerms(needle);
  let score = tokens.filter(token => haystack.includes(token)).length * 10;
  for (const group of CONCEPTS) if (group.some(term => needle.includes(term))) {
    score += group.filter(term => haystack.includes(term)).length;
  }
  return score;
}
