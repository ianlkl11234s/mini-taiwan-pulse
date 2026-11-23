/**
 * 30 天地圖挑戰 Day 23「味覺 Taste」（模擬入口，2026-11-22）：店名裡的味道。
 * 網址、詞、色、家數、半徑公式的單一資料源，overlayRegistry／圖例／說明框／參數規格都從這裡 import。
 * 零 import（layerManifest 會引用本檔的代表色）。
 *
 * 資料（taipei-gis-analytics pipelines/analysis/mapchallenge_2026_day23_taste，研究文件同名 topic-research）：
 * 財政部稅籍登記 2026-08-16 快照，營業中且主要行業為餐飲業（行業代號 56 開頭，181,255 家，其中 179,672 家有座標），
 * 用「店名含該詞」分類後彙總到 H3 六角格，點畫在格心。
 * - day23_taste_terms_v2.geojson：每個（詞 × 格）一點（24 詞；v1 是前 12 詞）。屬性 term（詞 id）、n（家數）、res（6｜7）、h3。
 * - day23_taste_variants.geojson：每個（組 × 寫法 × 格）一點。屬性 group、w（寫法序號）、n、c0／c1／c2（同格同組各寫法家數）、res、h3。
 * - day23_taste_places.geojson（第二批）：店名裡的地名。kind=cell（格心點：sign、n、res、h3）、origin（原產地點：sign）、arc（原產地→格心弧線：sign、n、res）。
 * - day23_taste_foreign.geojson（第二批）：外來料理九組，每個（組 × 格）一點。屬性 group、n、res、h3。
 * 隱私：稅籍表含獨資行號地址，公開檔只有六角格彙總家數，沒有店名、地址、統編、單店座標。
 * 用語：只描述「店名含該詞的登記餐飲店家數」；不寫口味偏好、不寫哪裡最愛吃。
 */

/** v2（2026-11-23）：24 詞。v1（day23_taste_terms.geojson，12 詞）已上傳、同 key 不可換內容，所以另起檔名；原 12 詞的內容與 v1 相同。 */
export const MAPCHALLENGE_DAY23_TERMS_URL = "./mapchallenge/day23_taste_terms_v2.geojson";
export const MAPCHALLENGE_DAY23_PLACES_URL = "./mapchallenge/day23_taste_places.geojson";
export const MAPCHALLENGE_DAY23_FOREIGN_URL = "./mapchallenge/day23_taste_foreign.geojson";
export const MAPCHALLENGE_DAY23_VARIANTS_URL = "./mapchallenge/day23_taste_variants.geojson";
export const MAPCHALLENGE_DAY23_ATTRIBUTION = "財政部財政資訊中心 全國營業（稅籍）登記資料 · 政府資料開放授權條款第 1 版";
export const MAPCHALLENGE_DAY23_DATA_DATE = "2026-08-16";
/** 母體：營業中、主要行業為餐飲業的稅籍登記家數（圖例說明用） */
export const MAPCHALLENGE_DAY23_BASE_STORES = 181255;

/** 代表色（sidebar） */
export const MAPCHALLENGE_DAY23_TERMS_COLOR = "#ff6b5e"; // 牛肉湯
export const MAPCHALLENGE_DAY23_VARIANTS_COLOR = "#7fd6c2"; // 滷肉飯
export const MAPCHALLENGE_DAY23_PLACES_COLOR = "#ffd166"; // 池上
export const MAPCHALLENGE_DAY23_FOREIGN_COLOR = "#64aaff"; // 越南

/** 格網兩級：低縮放 res 6（約 36 km²），z ≥ SWITCH_ZOOM 換 res 7（約 5.2 km²） */
export const MAPCHALLENGE_DAY23_SWITCH_ZOOM = 9;
export const MAPCHALLENGE_DAY23_RES = [6, 7] as const;
export const MAPCHALLENGE_DAY23_CELL_KM2: Readonly<Record<number, number>> = { 6: 36, 7: 5.2 };

/**
 * 圖層 1 的 24 個詞（順序＝選單順序；選單以序號編碼進分享連結，新詞只能接在後面、不可插隊）。
 * 前 12 個是第一批人工挑的詞；後 12 個（米干起）是第二批用「店名片段的縣市集中倍數」自動找出、再人工挑的詞，沒有排除規則。dark＝原型預覽圖的顏色（暗底）；light＝同色相壓低 OKLCH 亮度到淡底陸地對比 ≥ 3。
 * stores＝店名含該詞的登記家數；mapped＝其中有座標、畫在地圖上的家數（analytics day23_layer_stats.json）。
 * 「意麵」排除店名含「鍋燒」者；「粄條／板條」「塩水雞／鹽水雞」兩種寫法合計。
 */
export const MAPCHALLENGE_DAY23_TERMS = [
  { value: "beefSoup", label: "牛肉湯", dark: "#ff6b5e", light: "#db4a40", stores: 169, mapped: 167 },
  { value: "kongRou", label: "爌肉", dark: "#d9905a", light: "#ae6932", stores: 168, mapped: 166 },
  { value: "turkeyRice", label: "火雞肉飯", dark: "#ffd166", light: "#987300", stores: 337, mapped: 336 },
  { value: "fanTang", label: "飯湯", dark: "#7fd6c2", light: "#2b8775", stores: 34, mapped: 33 },
  { value: "yiMian", label: "意麵", dark: "#f4a259", light: "#b46712", stores: 202, mapped: 197 },
  { value: "eel", label: "鱔魚", dark: "#c9a0ff", light: "#8e66bf", stores: 112, mapped: 111 },
  { value: "rouZaoFan", label: "肉燥飯", dark: "#ff8fab", light: "#c15775", stores: 119, mapped: 117 },
  { value: "banTiao", label: "粄條／板條", dark: "#8ecae6", light: "#3281a1", stores: 94, mapped: 93 },
  { value: "rouYuan", label: "肉圓", dark: "#b8e986", light: "#59841e", stores: 498, mapped: 492 },
  { value: "wanGuo", label: "碗粿", dark: "#f1e3c0", light: "#8e7533", stores: 150, mapped: 150 },
  { value: "urn", label: "甕（甕缸雞類）", dark: "#e07a5f", light: "#c05d43", stores: 105, mapped: 104 },
  { value: "liveFish", label: "活魚", dark: "#64aaff", light: "#357bcc", stores: 24, mapped: 23 },
  // ── 第二批（2026-11-23）
  { value: "miGan", label: "米干", dark: "#ffd166", light: "#987300", stores: 40, mapped: 40 },
  { value: "mungBeanSoup", label: "綠豆湯", dark: "#b8e986", light: "#59841e", stores: 93, mapped: 93 },
  { value: "waiShengMian", label: "外省麵", dark: "#f4a259", light: "#b46712", stores: 51, mapped: 51 },
  { value: "xianChao", label: "現炒", dark: "#ff6b5e", light: "#db4a40", stores: 175, mapped: 174 },
  { value: "daMian", label: "大麵", dark: "#c9a0ff", light: "#8e66bf", stores: 42, mapped: 42 },
  { value: "shrimp", label: "蝦仁", dark: "#ff8fab", light: "#c15775", stores: 39, mapped: 39 },
  { value: "milkfishCongee", label: "虱目魚粥", dark: "#7fd6c2", light: "#2b8775", stores: 60, mapped: 60 },
  { value: "qieZaiMian", label: "切仔麵", dark: "#8ecae6", light: "#3281a1", stores: 53, mapped: 53 },
  { value: "springRoll", label: "春捲", dark: "#f1e3c0", light: "#8e7533", stores: 49, mapped: 48 },
  { value: "saltedChicken", label: "塩水雞／鹽水雞", dark: "#64aaff", light: "#357bcc", stores: 82, mapped: 80 },
  { value: "stew", label: "燉品", dark: "#e07a5f", light: "#c05d43", stores: 20, mapped: 20 },
  { value: "bianShi", label: "扁食", dark: "#d9905a", light: "#ae6932", stores: 52, mapped: 52 },
] as const;
export type MapchallengeDay23Term = (typeof MAPCHALLENGE_DAY23_TERMS)[number];
export type MapchallengeDay23TermId = MapchallengeDay23Term["value"];

/** 選單 encode 序號 → 詞（越界回第一個） */
export function mapchallengeDay23TermAt(idx: number | undefined): MapchallengeDay23Term {
  return MAPCHALLENGE_DAY23_TERMS[Math.trunc(idx ?? 0)] ?? MAPCHALLENGE_DAY23_TERMS[0];
}
export function mapchallengeDay23TermById(id: unknown): MapchallengeDay23Term | undefined {
  return MAPCHALLENGE_DAY23_TERMS.find((t) => t.value === id);
}
export const mapchallengeDay23TermColor = (t: { dark: string; light: string }, isDark: boolean): string => (isDark ? t.dark : t.light);

/**
 * 圖層 2 的同物異字三組（順序＝選單順序）。同組內各寫法各自比對、不互斥（店名同時含兩種寫法會各算一次）；
 * 「粿條」全台只有 1 家，不列。色＝原型預覽圖（暗底）；light 規則同上。
 */
export const MAPCHALLENGE_DAY23_VARIANT_GROUPS = [
  {
    value: "rice", label: "魯肉飯／滷肉飯／肉燥飯",
    words: [
      { label: "魯肉飯", dark: "#64aaff", light: "#357bcc", stores: 249, mapped: 247 },
      { label: "滷肉飯", dark: "#7fd6c2", light: "#2b8775", stores: 88, mapped: 87 },
      { label: "肉燥飯", dark: "#ff8fab", light: "#c15775", stores: 119, mapped: 117 },
    ],
  },
  {
    value: "banTiao", label: "粄條／板條",
    words: [
      { label: "粄條", dark: "#ffd166", light: "#987300", stores: 74, mapped: 74 },
      { label: "板條", dark: "#64aaff", light: "#357bcc", stores: 20, mapped: 19 },
    ],
  },
  {
    value: "kongRou", label: "爌肉／焢肉／控肉",
    words: [
      { label: "爌肉", dark: "#ffd166", light: "#987300", stores: 168, mapped: 166 },
      { label: "焢肉", dark: "#64aaff", light: "#357bcc", stores: 49, mapped: 48 },
      { label: "控肉", dark: "#ff8fab", light: "#c15775", stores: 20, mapped: 20 },
    ],
  },
] as const;
export type MapchallengeDay23VariantGroup = (typeof MAPCHALLENGE_DAY23_VARIANT_GROUPS)[number];

export function mapchallengeDay23GroupAt(idx: number | undefined): MapchallengeDay23VariantGroup {
  return MAPCHALLENGE_DAY23_VARIANT_GROUPS[Math.trunc(idx ?? 0)] ?? MAPCHALLENGE_DAY23_VARIANT_GROUPS[0];
}
export function mapchallengeDay23GroupById(id: unknown): MapchallengeDay23VariantGroup | undefined {
  return MAPCHALLENGE_DAY23_VARIANT_GROUPS.find((g) => g.value === id);
}

/**
 * 圓半徑：面積正比於家數 → r = k × √n（不加底、不設上限；兩級格網同一條公式，圖例大小列兩級都成立）。
 * 小吃詞與同物異字：單格家數 res 6 最多 34、res 7 最多 20；n＝1 時半徑 3 px。外來料理家數多的組另有較小的 k（見 MAPCHALLENGE_DAY23_FOREIGN）。
 */
export const MAPCHALLENGE_DAY23_RADIUS_K = 3;
export function mapchallengeDay23Radius(n: number, scale = 1, k: number = MAPCHALLENGE_DAY23_RADIUS_K): number {
  return k * Math.sqrt(Math.max(1, n)) * scale;
}
/** 光暈（原型三層發光圓的外兩層合成一層模糊圓）：半徑 ×、透明度 × 圖層透明度（淡底再減半） */
export const MAPCHALLENGE_DAY23_GLOW = { radiusFactor: 2.1, opacity: 0.32, blur: 0.7 } as const;

/**
 * 第二批圖層「店名裡的地名」的 8 個招牌（順序＝選單順序）。比對：店名同時含地名與品項（「北港」不限品項）。
 * 圖上只畫「登記縣市在原產縣市（home）以外」的店：stores＝全台符合的家數、outside＝其中登記在原產縣市以外、mapped＝outside 中有座標畫在圖上的。
 * origin＝店名裡那個地名的代表位置（[lng, lat]，空心圈與弧線起點）。「嘉義」的原產縣市含嘉義市與嘉義縣。
 * 弧線只是把地名和店的所在格連起來，不代表人或貨的移動。
 */
export const MAPCHALLENGE_DAY23_PLACES = [
  { value: "chishang", label: "池上＋飯包／便當", home: "臺東縣", dark: "#ffd166", light: "#987300", origin: [121.22, 23.12], stores: 196, outside: 194, mapped: 194 },
  { value: "chiayi", label: "嘉義＋雞肉飯", home: "嘉義縣市", dark: "#f4a259", light: "#b46712", origin: [120.45, 23.48], stores: 124, outside: 113, mapped: 113 },
  { value: "tainan", label: "臺南＋虱目魚", home: "臺南市", dark: "#7fd6c2", light: "#2b8775", origin: [120.2, 23.0], stores: 49, outside: 48, mapped: 48 },
  { value: "gangshan", label: "岡山＋羊肉", home: "高雄市", dark: "#ff6b5e", light: "#db4a40", origin: [120.3, 22.8], stores: 48, outside: 41, mapped: 41 },
  { value: "changhua", label: "彰化＋肉圓", home: "彰化縣", dark: "#b8e986", light: "#59841e", origin: [120.54, 24.07], stores: 22, outside: 19, mapped: 19 },
  { value: "dongshiBudai", label: "東石／布袋＋蚵", home: "嘉義縣市", dark: "#8ecae6", light: "#3281a1", origin: [120.15, 23.42], stores: 22, outside: 19, mapped: 19 },
  { value: "beigang", label: "北港＋任何品項", home: "雲林縣", dark: "#c9a0ff", light: "#8e66bf", origin: [120.3, 23.57], stores: 114, outside: 80, mapped: 79 },
  { value: "meinong", label: "美濃＋粄條", home: "高雄市", dark: "#64aaff", light: "#357bcc", origin: [120.54, 22.9], stores: 20, outside: 11, mapped: 11 },
] as const;
export type MapchallengeDay23Place = (typeof MAPCHALLENGE_DAY23_PLACES)[number];
export type MapchallengeDay23PlaceId = MapchallengeDay23Place["value"];
export function mapchallengeDay23PlaceAt(idx: number | undefined): MapchallengeDay23Place {
  return MAPCHALLENGE_DAY23_PLACES[Math.trunc(idx ?? 0)] ?? MAPCHALLENGE_DAY23_PLACES[0];
}
export function mapchallengeDay23PlaceById(id: unknown): MapchallengeDay23Place | undefined {
  return MAPCHALLENGE_DAY23_PLACES.find((p) => p.value === id);
}
/** 原產地空心圈（暗底白、淡底深色）與弧線（線寬＝base＋perStore×該格家數，透明度×圖層透明度） */
export const MAPCHALLENGE_DAY23_ORIGIN = { radius: 7, strokeWidth: 2, dark: "#ffffff", light: "#1a1a2e" } as const;
export const MAPCHALLENGE_DAY23_ARC = { base: 0.6, perStore: 0.4, opacityDark: 0.4, opacityLight: 0.55 } as const;
export const mapchallengeDay23ArcWidth = (n: number, scale = 1): number => (MAPCHALLENGE_DAY23_ARC.base + MAPCHALLENGE_DAY23_ARC.perStore * Math.max(1, n)) * scale;

/**
 * 第二批圖層「外來料理店名」的九組（順序＝選單順序）。words＝實際比對的詞（店名含任一個就算，同一家只算一次）。
 * k＝半徑係數：家數多的組（日、港、義、美）整體縮小，避免都會區糊成一片；所以不同組之間不能用圓的大小互比。
 * 單格家數最多（res 6／res 7）：越南 37／19、泰 22／10、印尼 18／16、雲南滇緬 30／29、日 132／60、韓 19／8、港 54／15、義 43／13、美 56／16。
 * 占比（analytics day23_layer_stats2.json）：「美」1,485 家中 1,226 家（83%）店名含「漢堡」；「港」1,342 家中 702 家（52%）含「燒臘」。
 */
export const MAPCHALLENGE_DAY23_FOREIGN = [
  { value: "vietnam", label: "越南", dark: "#64aaff", light: "#357bcc", stores: 883, mapped: 879, k: 3, words: ["越南", "越式", "河粉", "越娘", "西貢", "河內"] },
  { value: "thai", label: "泰", dark: "#ffd166", light: "#987300", stores: 495, mapped: 493, k: 3, words: ["泰式", "泰國", "打拋", "泰味", "曼谷", "清邁", "月亮蝦"] },
  { value: "indonesia", label: "印尼", dark: "#ff6b5e", light: "#db4a40", stores: 125, mapped: 123, k: 3, words: ["印尼", "爪哇", "峇里", "巴東"] },
  { value: "yunnan", label: "雲南／滇緬", dark: "#b8e986", light: "#59841e", stores: 137, mapped: 137, k: 3, words: ["雲南", "滇", "米干", "緬甸", "擺夷", "傣"] },
  { value: "japan", label: "日", dark: "#ff8fab", light: "#c15775", stores: 2733, mapped: 2722, k: 1.6, words: ["拉麵", "壽司", "丼", "居酒屋", "日式", "日本料理", "燒鳥", "串燒", "壽喜", "天婦羅", "烏龍麵", "蕎麥"] },
  { value: "korea", label: "韓", dark: "#c9a0ff", light: "#8e66bf", stores: 330, mapped: 330, k: 3, words: ["韓式", "韓國", "石鍋拌飯", "泡菜鍋", "韓食", "首爾", "釜山"] },
  { value: "hongKong", label: "港", dark: "#f4a259", light: "#b46712", stores: 1342, mapped: 1331, k: 2.5, words: ["港式", "茶餐廳", "燒臘", "香港", "廣東粥", "飲茶"] },
  { value: "italy", label: "義", dark: "#7fd6c2", light: "#2b8775", stores: 746, mapped: 742, k: 2.5, words: ["義式", "義大利", "披薩", "比薩", "義麵"] },
  { value: "america", label: "美", dark: "#8ecae6", light: "#3281a1", stores: 1485, mapped: 1480, k: 2.5, words: ["美式", "漢堡", "熱狗"] },
] as const;
export type MapchallengeDay23Foreign = (typeof MAPCHALLENGE_DAY23_FOREIGN)[number];
export type MapchallengeDay23ForeignId = MapchallengeDay23Foreign["value"];
export function mapchallengeDay23ForeignAt(idx: number | undefined): MapchallengeDay23Foreign {
  return MAPCHALLENGE_DAY23_FOREIGN[Math.trunc(idx ?? 0)] ?? MAPCHALLENGE_DAY23_FOREIGN[0];
}
export function mapchallengeDay23ForeignById(id: unknown): MapchallengeDay23Foreign | undefined {
  return MAPCHALLENGE_DAY23_FOREIGN.find((g) => g.value === id);
}
/** 圖例與說明框要另外註明的單一用詞占比（share＝hits／stores） */
export const MAPCHALLENGE_DAY23_FOREIGN_DOMINANT: Partial<Record<MapchallengeDay23ForeignId, { word: string; hits: number }>> = {
  america: { word: "漢堡", hits: 1226 },
  hongKong: { word: "燒臘", hits: 702 },
};
