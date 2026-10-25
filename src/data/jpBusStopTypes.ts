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
