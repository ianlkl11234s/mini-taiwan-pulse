import type { ExpressionSpecification } from "mapbox-gl";

/** 国土数値情報 P11 バス区分（本版無「需求應答」）。 */
export interface JpBusStopClass {
  value: "route_private" | "community" | "route_public" | "other" | "mixed";
  label: string;
  color: string;
  count: number;
}

/** Map、legend 與 popup 共用的分類／色票 SSOT（沿用日本點層既有色票）。 */
export const JP_BUS_STOP_CLASSES = [
  { value: "route_private", label: "民營路線", color: "#2563eb", count: 171_127 },
  { value: "community", label: "社區巴士", color: "#14b8a6", count: 91_867 },
  { value: "route_public", label: "公營路線", color: "#f59e0b", count: 14_856 },
  { value: "other", label: "其他", color: "#94a3b8", count: 337 },
  { value: "mixed", label: "公營＋社區共站", color: "#a855f7", count: 328 },
] as const satisfies readonly JpBusStopClass[];

export const JP_BUS_STOP_LAYER_COLOR = JP_BUS_STOP_CLASSES[0].color;

export const JP_BUS_STOP_CLASS_COLOR_EXPRESSION: ExpressionSpecification = [
  "match", ["get", "bus_class"],
  ...JP_BUS_STOP_CLASSES.flatMap((c) => [c.value, c.color]),
  "#94a3b8",
] as unknown as ExpressionSpecification;

export const JP_BUS_STOP_ATTRIBUTION =
  "出典：国土数値情報（バス停留所データ）（国土交通省）を加工して作成";

export const JP_BUS_STOP_SOURCE_URL = "https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-P11-2022.html";
export const JP_BUS_STOP_LICENSE = "CC BY 4.0 / PDL1.0";

export const JP_BUS_STOP_DATA_AS_OF = "2022-08";
export const JP_BUS_STOP_POINT_COUNT = 278_515;

/** 都道府縣代碼 → 日文名（PMTiles 只帶 pref_code；JIS X 0401）。 */
export const JP_PREFECTURE_NAMES: Readonly<Record<string, string>> = {
  "01": "北海道", "02": "青森県", "03": "岩手県", "04": "宮城県", "05": "秋田県", "06": "山形県", "07": "福島県",
  "08": "茨城県", "09": "栃木県", "10": "群馬県", "11": "埼玉県", "12": "千葉県", "13": "東京都", "14": "神奈川県",
  "15": "新潟県", "16": "富山県", "17": "石川県", "18": "福井県", "19": "山梨県", "20": "長野県", "21": "岐阜県",
  "22": "静岡県", "23": "愛知県", "24": "三重県", "25": "滋賀県", "26": "京都府", "27": "大阪府", "28": "兵庫県",
  "29": "奈良県", "30": "和歌山県", "31": "鳥取県", "32": "島根県", "33": "岡山県", "34": "広島県", "35": "山口県",
  "36": "徳島県", "37": "香川県", "38": "愛媛県", "39": "高知県", "40": "福岡県", "41": "佐賀県", "42": "長崎県",
  "43": "熊本県", "44": "大分県", "45": "宮崎県", "46": "鹿児島県", "47": "沖縄県",
};

/** 都道府縣代碼 → 英文名（英文介面用；JIS X 0401）。 */
export const JP_PREFECTURE_NAMES_EN: Readonly<Record<string, string>> = {
  "01": "Hokkaido", "02": "Aomori", "03": "Iwate", "04": "Miyagi", "05": "Akita", "06": "Yamagata", "07": "Fukushima",
  "08": "Ibaraki", "09": "Tochigi", "10": "Gunma", "11": "Saitama", "12": "Chiba", "13": "Tokyo", "14": "Kanagawa",
  "15": "Niigata", "16": "Toyama", "17": "Ishikawa", "18": "Fukui", "19": "Yamanashi", "20": "Nagano", "21": "Gifu",
  "22": "Shizuoka", "23": "Aichi", "24": "Mie", "25": "Shiga", "26": "Kyoto", "27": "Osaka", "28": "Hyogo",
  "29": "Nara", "30": "Wakayama", "31": "Tottori", "32": "Shimane", "33": "Okayama", "34": "Hiroshima", "35": "Yamaguchi",
  "36": "Tokushima", "37": "Kagawa", "38": "Ehime", "39": "Kochi", "40": "Fukuoka", "41": "Saga", "42": "Nagasaki",
  "43": "Kumamoto", "44": "Oita", "45": "Miyazaki", "46": "Kagoshima", "47": "Okinawa",
};

/** 都道府縣代碼 → 依語系的人讀名稱；查無對照回 undefined（呼叫端不印代碼）。 */
export function jpPrefectureName(code: unknown, locale: string): string | undefined {
  const raw = code == null ? "" : String(code).trim();
  if (!/^\d{1,2}$/.test(raw)) return undefined;
  const key = raw.padStart(2, "0");
  return locale === "en" ? JP_PREFECTURE_NAMES_EN[key] : JP_PREFECTURE_NAMES[key];
}
