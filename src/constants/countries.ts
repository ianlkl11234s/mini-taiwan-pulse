/**
 * 國家主體（議題 1「國家主體化」）：圖層面板與統計面板共用的國家清單。
 *
 * 資料來自 `countries.generated.ts`（2026-11-23 起）：正本是私有 repo pulse-data 的 `countries/countries.json`，
 * 網站與 MCP 共用；改國家、框、鏡頭、時區請改正本再跑 `scripts/countries/gen-countries.ts`，不要改產生檔。
 * 各國框與鏡頭的取捨說明也搬到正本旁的 `countries/README.md`。
 *
 * - `code` 是兩字國碼，也是 UI chip 的文字（不用國旗 emoji，2026-10-28 使用者決定）。
 * - `camera` 只在使用者從國家選單選國家時 flyTo；網址、場景快照都不飛。
 * - `bboxes` 用多個矩形近似國土（供「網址相機中心屬於哪國」與右上視野提示判斷），刻意排除爭議海域
 *   （例：釣魚台一帶判為無國家）。矩形近似：邊境上的小城鎮可能判錯，單元測試釘住常見城市。
 * - 陣列順序＝國家選單由上到下，也是判國順序（先比國家、再比框，第一個命中就算）；不可重排。
 */
import { COUNTRY_LABEL_KEYS, GENERATED_COUNTRIES, type CountryCode } from "./countries.generated";

export type { CountryCode };

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
  /** 預設／主要時區（IANA 名稱）；時間軸一律顯示台北時間，這欄用在「資料依各國當地日切分」 */
  timeZone: string;
  /** 跨時區國家的時區清單（例：CA）；單一時區國家省略 */
  timeZones?: readonly string[];
  camera: CountryCamera;
  bboxes: readonly CountryBbox[];
  /** 站主限定國家（2026-11-13 中國）：非站主的國家選單、圖層面板國家清單不列；網址或鏡頭落在這國時退回台灣（`countryStore`）。 */
  ownerOnly?: true;
}

export const DEFAULT_COUNTRY: CountryCode = "TW";

/** 陣列順序＝國家選單由上到下（也是判國順序）。 */
export const COUNTRIES: readonly CountryDef[] = GENERATED_COUNTRIES.map((country) => ({
  code: country.code,
  chip: country.chip,
  labelKey: COUNTRY_LABEL_KEYS[country.code],
  timeZone: country.timeZone,
  ...(country.timeZones ? { timeZones: country.timeZones } : {}),
  camera: country.camera,
  ...(country.ownerOnly ? { ownerOnly: true as const } : {}),
  bboxes: country.bboxes,
}));

const COUNTRY_CODES = new Set<string>(COUNTRIES.map((country) => country.code));

/** 某身分看得到的國家（陣列順序不變）：非站主不列 `ownerOnly` 國家。 */
export function visibleCountries(isOwner: boolean): readonly CountryDef[] {
  return isOwner ? COUNTRIES : COUNTRIES.filter((country) => !country.ownerOnly);
}

/** 非站主不可停在站主限定國家：回傳應顯示的國家（`ownerOnly` 國退回預設國）。 */
export function countryForViewer(code: CountryCode, isOwner: boolean): CountryCode {
  return !isOwner && countryDef(code).ownerOnly ? DEFAULT_COUNTRY : code;
}

export function isCountryCode(value: unknown): value is CountryCode {
  return typeof value === "string" && COUNTRY_CODES.has(value);
}

export function countryDef(code: CountryCode): CountryDef {
  return COUNTRIES.find((country) => country.code === code)!;
}

/** 日本：主要島嶼中心估算（含沖繩可改用 fitBounds([[127.6,26.2],[146.5,45.8]])）。 */
export const JAPAN_CAMERA: CountryCamera = countryDef("JP").camera;
/** 法國本土＋科西嘉（海外領地先不列）。 */
export const FRANCE_CAMERA: CountryCamera = countryDef("FR").camera;
/** 英國（大不列顛＋北愛；含 Shetland、Scilly）。 */
export const UK_CAMERA: CountryCamera = countryDef("GB").camera;
/** 南韓（本土＋濟州、鬱陵島、獨島）。 */
export const KOREA_CAMERA: CountryCamera = countryDef("KR").camera;
/** 加拿大（國家全覽 z3.5，map-layers §3.8 V-1）。 */
export const CANADA_CAMERA: CountryCamera = countryDef("CA").camera;
/** 愛爾蘭（國家全覽 z6）。 */
export const IRELAND_CAMERA: CountryCamera = countryDef("IE").camera;
/** 菲律賓（國家全覽 z5）。 */
export const PHILIPPINES_CAMERA: CountryCamera = countryDef("PH").camera;
/** 越南（國家全覽 z5）。 */
export const VIETNAM_CAMERA: CountryCamera = countryDef("VN").camera;
/** 泰國（國家全覽 z5）。 */
export const THAILAND_CAMERA: CountryCamera = countryDef("TH").camera;
/** 中國大陸（國家全覽 z3.4，站主限定）。 */
export const CHINA_CAMERA: CountryCamera = countryDef("CN").camera;

/** 經緯度落在哪一國的 bbox；都不在（含公海、爭議海域）回 undefined。 */
export function countryForPoint(lng: number, lat: number): CountryCode | undefined {
  for (const country of COUNTRIES) {
    for (const [west, south, east, north] of country.bboxes) {
      if (lng >= west && lng <= east && lat >= south && lat <= north) return country.code;
    }
  }
  return undefined;
}
