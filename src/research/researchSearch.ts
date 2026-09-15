/** Vocabulary expands discovery only; it never selects an analysis or proves a claim. */
const CONCEPTS = [
  ["教育", "教育資源", "學習", "education", "學校", "圖書館", "幼兒園", "補習", "school", "library"],
  ["醫療", "醫療資源", "健康", "hospital", "醫院", "診所", "衛生"],
  ["交通", "運輸", "transport", "捷運", "公車", "車站"],
  ["人口", "居住", "population", "住宅"],
  ["農業", "農地", "水田", "水稻", "paddy"],
];
export function normalizeSearch(value: string): string { return value.normalize("NFKC").toLowerCase().replace(/臺/g, "台").trim(); }
export function searchScore(query: string, text: string): number {
  const needle = normalizeSearch(query); const haystack = normalizeSearch(text);
  if (!needle) return 1;
  if (haystack.includes(needle)) return 100;
  const tokens = needle.split(/[\s,，、。？?]+/).filter(Boolean);
  let score = tokens.filter(token => haystack.includes(token)).length * 10;
  for (const group of CONCEPTS) if (group.some(term => needle.includes(term))) {
    score += group.filter(term => haystack.includes(term)).length;
  }
  return score;
}
