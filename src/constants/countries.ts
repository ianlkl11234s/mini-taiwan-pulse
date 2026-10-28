/**
 * 國家主體（議題 1「國家主體化」）：圖層面板與統計面板共用的國家清單。
 *
 * - `code` 是兩字國碼，也是 UI chip 的文字（不用國旗 emoji，2026-10-28 使用者決定）。
 * - `camera` 只在使用者從國家選單選國家時 flyTo；網址、場景快照都不飛。
 * - `bboxes` 用多個矩形近似國土（供「網址相機中心屬於哪國」判斷），刻意排除爭議海域
 *   （例：釣魚台一帶判為無國家）。矩形是概略範圍，鄰國邊境附近可能誤判。
 */
import { DEFAULT_CAMERA } from "../map/cameraPresets";

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

const TAIWAN_CAMERA: CountryCamera = {
  center: DEFAULT_CAMERA.center,
  zoom: DEFAULT_CAMERA.zoom,
  pitch: DEFAULT_CAMERA.pitch,
  bearing: DEFAULT_CAMERA.bearing,
};

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
      [118.1, 24.3, 118.6, 24.6],   // 金門
      [119.8, 25.9, 120.6, 26.4],   // 馬祖
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
      [-5.2, 42.3, 8.3, 49.0],      // 法國本土（南、中部）
      [-2.0, 49.0, 4.2, 51.1],      // 法國本土北部（避開比利時）
      [4.2, 49.0, 8.3, 49.55],      // 東北（洛林、亞爾薩斯）
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
