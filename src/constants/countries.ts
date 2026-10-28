/**
 * 國家主體（議題 1「國家主體化」）：圖層面板與統計面板共用的國家清單。
 *
 * - `code` 是兩字國碼，也是 UI chip 的文字（不用國旗 emoji，2026-10-28 使用者決定）。
 * - `camera` 只在使用者從國家選單選國家時 flyTo；網址、場景快照都不飛。
 * - `bboxes` 用多個矩形近似國土（供「網址相機中心屬於哪國」與右上視野提示判斷），刻意排除爭議海域
 *   （例：釣魚台一帶判為無國家）。2026-10-28 細修鄰國邊境（日內瓦、杜林、安道爾、廈門等不再誤判），
 *   但仍是矩形近似：邊境上的小城鎮（例：摩納哥、聖讓德呂茲）可能判錯，單元測試釘住常見城市。
 */
import { ALL_PRESETS } from "../map/cameraPresets";

export type CountryCode = "TW" | "JP" | "FR";

export interface CountryCamera {
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
}

/** [west, south, east, north]（WGS84 經緯度） */
export type CountryBbox = readonly [number, number, number, number];

export interface CountryDef {
  code: CountryCode;
  /** 面板 chip 顯示的兩字國碼 */
  chip: string;
  /** 國名的 i18n 鍵（`country.TW` …） */
  labelKey: `country.${CountryCode}`;
  camera: CountryCamera;
  bboxes: readonly CountryBbox[];
}

export const DEFAULT_COUNTRY: CountryCode = "TW";

/**
 * 日本：主要島嶼中心估算（原 cameraPresets `JAPAN_CAMERA`，2026-10-28 搬來）。
 * 含沖繩可改用 fitBounds([[127.6,26.2],[146.5,45.8]])。
 */
export const JAPAN_CAMERA: CountryCamera = { center: [137.5, 37.5], zoom: 4.7, pitch: 0, bearing: 0 };

/** 法國本土＋科西嘉（海外領地先不列）。 */
export const FRANCE_CAMERA: CountryCamera = { center: [2.6, 46.4], zoom: 4.9, pitch: 0, bearing: 0 };

/** 全台總覽（同 cameraPresets「全台總覽」；開站預設鏡頭 `DEFAULT_CAMERA` 仍是台北，2026-10-28 使用者要求選台灣時看全台）。 */
const TAIWAN_CAMERA: CountryCamera = (() => {
  const overview = ALL_PRESETS.find((preset) => preset.id === "overview")!;
  return { center: overview.center, zoom: overview.zoom, pitch: overview.pitch, bearing: overview.bearing };
})();

/** 陣列順序＝國家選單由上到下。 */
export const COUNTRIES: readonly CountryDef[] = [
  {
    code: "TW",
    chip: "TW",
    labelKey: "country.TW",
    camera: TAIWAN_CAMERA,
    bboxes: [
      [119.9, 21.8, 122.1, 25.4],   // 台灣本島（含蘭嶼、綠島、龜山島）
      [119.3, 23.1, 119.8, 23.8],   // 澎湖
      [118.2, 24.35, 118.5, 24.55], // 金門（西緣 118.2 避開廈門島）
      [119.9, 25.93, 120.1, 26.3],  // 馬祖南竿、北竿、莒光（北緣 26.3 避開黃岐半島）
      [120.4, 26.33, 120.55, 26.42], // 東引
    ],
  },
  {
    code: "JP",
    chip: "JP",
    labelKey: "country.JP",
    camera: JAPAN_CAMERA,
    bboxes: [
      [128.5, 30.9, 132.1, 34.0],   // 九州
      [129.1, 34.0, 129.5, 34.75],  // 對馬
      [130.8, 32.6, 136.0, 36.0],   // 本州西部、四國
      [136.0, 33.4, 142.2, 41.6],   // 本州中部、東部
      [139.3, 41.3, 145.9, 45.6],   // 北海道
      [126.5, 26.0, 130.5, 30.9],   // 沖繩本島、奄美
      [122.9, 24.0, 125.6, 25.0],   // 先島諸島（與那國、石垣、宮古；不含釣魚台一帶）
    ],
  },
  {
    code: "FR",
    chip: "FR",
    labelKey: "country.FR",
    camera: FRANCE_CAMERA,
    bboxes: [
      [-4.8, 46.3, 6.0, 48.9],      // 西部、中部（布列塔尼～勃艮第；東緣 6.0 避開日內瓦）
      [-1.8, 43.4, 6.0, 46.3],      // 西南、中南（南緣 43.4 避開西班牙北岸）
      [-1.4, 42.85, 6.0, 43.4],     // 庇里牛斯山北麓、地中海岸（南緣 42.85 避開安道爾、阿蘭谷）
      [1.8, 42.45, 3.3, 42.85],     // 魯西永（西緣 1.8 避開安道爾）
      [6.0, 43.95, 6.95, 46.1],     // 阿爾卑斯（北緣 46.1 避開日內瓦、東緣 6.95 避開義大利）
      [6.0, 43.0, 7.5, 44.15],      // 蔚藍海岸
      [6.0, 46.6, 6.3, 47.6],       // 汝拉
      [6.3, 47.2, 7.0, 47.6],       // 蒙貝利亞、貝爾福（避開瑞士汝拉、巴塞爾）
      [6.0, 47.6, 7.55, 48.4],      // 亞爾薩斯南部（東緣萊茵河）
      [6.0, 48.4, 7.8, 48.9],       // 亞爾薩斯北部（史特拉斯堡）
      [6.7, 48.9, 8.2, 49.08],      // 亞爾薩斯最北（避開薩爾、普法爾茨）
      [4.2, 48.9, 6.7, 49.45],      // 洛林（北緣 49.45 避開盧森堡）
      [4.2, 49.45, 4.95, 49.95],    // 阿登（避開比利時布永）
      [-2.0, 48.9, 4.2, 50.1],      // 諾曼第、皮卡第（北緣 50.1 避開比利時）
      [1.5, 50.1, 3.15, 50.78],     // 上法蘭西（里爾；東緣避開圖爾奈、穆斯克龍）
      [1.5, 50.78, 2.6, 51.1],      // 敦克爾克（避開伊珀爾）
      [3.15, 50.1, 4.2, 50.3],      // 瓦朗謝訥、莫伯日（北緣避開蒙斯）
      [8.5, 41.3, 9.6, 43.1],       // 科西嘉
    ],
  },
];

const COUNTRY_CODES = new Set<string>(COUNTRIES.map((country) => country.code));

export function isCountryCode(value: unknown): value is CountryCode {
  return typeof value === "string" && COUNTRY_CODES.has(value);
}

export function countryDef(code: CountryCode): CountryDef {
  return COUNTRIES.find((country) => country.code === code)!;
}

/** 經緯度落在哪一國的 bbox；都不在（含公海、爭議海域）回 undefined。 */
export function countryForPoint(lng: number, lat: number): CountryCode | undefined {
  for (const country of COUNTRIES) {
    for (const [west, south, east, north] of country.bboxes) {
      if (lng >= west && lng <= east && lat >= south && lat <= north) return country.code;
    }
  }
  return undefined;
}
