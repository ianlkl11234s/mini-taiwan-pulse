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

export type CountryCode = "TW" | "JP" | "FR" | "GB" | "KR" | "CA" | "IE";

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

/** 英國（大不列顛＋北愛；含 Shetland、Scilly，2026-10-29 英國第 0b 波）。 */
export const UK_CAMERA: CountryCamera = { center: [-2.5, 54.5], zoom: 4.8, pitch: 0, bearing: 0 };

/** 南韓（本土＋濟州、鬱陵島、獨島；2026-10-31 南韓第 0 波）。 */
export const KOREA_CAMERA: CountryCamera = { center: [127.8, 36.3], zoom: 6.3, pitch: 0, bearing: 0 };

/** 加拿大（13 省／地區；國家全覽 z3.5，map-layers §3.8 V-1；2026-11-04 加拿大第 0 波）。 */
export const CANADA_CAMERA: CountryCamera = { center: [-96, 60], zoom: 3.5, pitch: 0, bearing: 0 };

/** 愛爾蘭（26 郡、31 地方政府；國家全覽 z6，map-layers §3.8 V-1；2026-11-07 愛爾蘭第 0 波）。 */
export const IRELAND_CAMERA: CountryCamera = { center: [-8.0, 53.4], zoom: 6, pitch: 0, bearing: 0 };

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
  {
    code: "GB",
    chip: "GB",
    labelKey: "country.GB",
    camera: UK_CAMERA,
    // 邊界依 ONS LAD May 2026（361 區）四地外框切矩形（2026-10-29）。刻意排除：愛爾蘭共和國、
    // 曼島（Crown dependency，不在 LAD 內）、海峽群島（緯度 < 49.85）、法國北岸（加萊、布洛涅）。
    // 北愛與共和國邊界不規則：Strabane／Lifford、Derry／Bridgend 隔河相鄰，矩形只保證測試釘住的城市。
    bboxes: [
      [-6.45, 49.85, -6.2, 50.0],     // Isles of Scilly
      [-5.8, 49.95, 1.2, 51.0],       // 英格蘭南岸（東緣 1.2 避開布洛涅、勒特雷波爾）
      [-5.8, 51.0, 1.5, 51.3],        // 肯特（東緣 1.5 避開加萊）
      [-5.7, 51.3, 1.8, 53.9],        // 英格蘭中部、威爾斯（北緣 53.9 避開曼島，西緣避開愛爾蘭東岸）
      [-3.7, 53.9, 0.2, 54.6],        // 英格蘭北部（西緣 -3.7 避開曼島）
      [-5.3, 54.6, 0.2, 55.45],       // 蘇格蘭南部、諾森伯蘭（西緣 -5.3 避開北愛 Ards）
      [-5.85, 55.27, -5.3, 55.45],    // Kintyre 南端
      [-8.7, 55.45, -0.7, 60.9],      // 蘇格蘭本土、外赫布里底、St Kilda、Orkney、Shetland（南緣 55.45 避開 Malin Head）
      [-6.65, 54.12, -5.4, 55.32],    // 北愛東部（貝爾法斯特、Newry；西緣避開 Monaghan）
      [-6.1, 54.02, -5.4, 54.12],     // 北愛 Mourne 海岸（西緣避開 Cooley 半島）
      [-6.95, 54.7, -6.65, 55.2],     // 北愛 Coleraine、Limavady（西緣避開 Inishowen 東岸）
      [-7.25, 54.4, -6.65, 55.05],    // 北愛中部 Tyrone、Mid Ulster
      [-6.8, 54.3, -6.65, 54.4],      // Armagh 市（西緣避開 Glaslough）
      [-7.6, 54.2, -7.25, 54.3],      // Lisnaskea、Newtownbutler（東緣避開 Clones）
      [-7.42, 54.95, -7.25, 55.05],   // Derry／Londonderry（北緣避開 Muff、Buncrana）
      [-7.47, 54.75, -7.25, 54.95],   // Strabane（西緣 -7.47 避開 Lifford）
      [-7.6, 54.6, -7.25, 54.75],     // Castlederg
      [-8.1, 54.3, -7.25, 54.6],      // Fermanagh、Omagh（西緣避開 Ballyshannon，南緣避開 Clones、Belturbet）
    ],
  },
  {
    code: "KR",
    chip: "KR",
    labelKey: "country.KR",
    camera: KOREA_CAMERA,
    // 邊界依 admdongkor ver20261001（시·도 16）外框 124.61–131.87E、33.11–38.62N 切矩形（2026-10-31）。
    // 刻意排除：北韓（軍事分界線以北：開城、海州、甕津半島）、對馬（屬 JP，與 JP 矩形只共用 34.75N 一條邊）。
    // 分界線一段以每 0.1° 經度帶內南韓邊界的最低北緣為上限（保守）：256 시군구代表點全中，
    // 3,559 행정동代表點有 4 個貼著分界線的判不到（연천 장남면、백학면，철원 근북면，고성 현내면）。
    bboxes: [
      [125.9, 33.0, 127.0, 34.0],     // 濟州島、馬羅島、楸子島
      [124.9, 34.0, 129.1, 34.75],    // 南海岸、多島海（東緣 129.1 避開對馬）
      [124.9, 34.75, 129.6, 35.6],    // 木浦、光州、釜山、蔚山南部（對馬北端 34.70 以北）
      [124.9, 35.6, 129.6, 37.68],    // 中部（首爾、仁川、延坪島、大田、大邱、浦項）
      [124.55, 37.65, 124.95, 38.0],  // 白翎島、大青島（北緣 38.0 避開甕津半島長山串）
      [126.1, 37.68, 126.7, 37.81],   // 江華島、喬桐島、金浦（北緣避開開豐、開城）
      [126.7, 37.68, 126.8, 37.96],   // 坡州、汶山（北緣避開板門店以北）
      [126.8, 37.68, 126.9, 37.99],   // 坡州積城
      [126.9, 37.68, 127.0, 38.12],   // 漣川西部
      [127.0, 37.68, 127.1, 38.22],   // 漣川全谷
      [127.1, 37.68, 127.8, 38.28],   // 鐵原、抱川、華川
      [127.8, 37.68, 128.1, 38.27],   // 楊口
      [128.1, 37.68, 128.2, 38.33],   // 楊口東部
      [128.2, 37.68, 128.3, 38.37],   // 麟蹄北部
      [128.3, 37.68, 128.5, 38.38],   // 高城內陸
      [128.3, 38.38, 128.42, 38.46],  // 高城北部
      [128.5, 37.68, 129.6, 38.38],   // 束草、襄陽、江陵（東緣海上）
      [130.7, 37.1, 131.95, 37.6],    // 鬱陵島、獨島
    ],
  },
  {
    code: "CA",
    chip: "CA",
    labelKey: "country.CA",
    camera: CANADA_CAMERA,
    // 2026-11-04 加拿大第 0 波：以 49°N 與五大湖—聖羅倫斯河界為主幹切矩形。刻意排除：阿拉斯加（-141° 以西、
    // panhandle）、美國邊境城市（Seattle、Bellingham、Detroit、Buffalo、Watertown、Plattsburgh、Houlton）、
    // 格陵蘭（巴芬島東緣 -61°、Ellesmere 東緣 -70°）、法屬聖皮耶與密克隆。矩形近似：溫莎（與底特律隔河）、
    // Sault Ste. Marie 一帶、新布藍茲維西北角（Edmundston）判不到，Isle Royale 等美國湖中小島可能誤判為加拿大。
    bboxes: [
      [-141.0, 60.0, -75.0, 84.0],     // 北部三地區、哈德遜灣、魁北克北部（阿拉斯加以 -141° 切）
      [-75.0, 60.0, -61.0, 74.0],      // 巴芬島、昂加瓦、拉布拉多北部（東緣避開格陵蘭西岸）
      [-75.0, 74.0, -70.0, 84.0],      // Ellesmere／Devon 東段（Thule -68.7° 在框外）
      [-130.0, 49.0, -52.0, 60.0],     // BC 本土到紐芬蘭北部（49°N 以北；西緣 -130° 避開 panhandle）
      [-133.5, 51.5, -130.0, 54.65],   // Haida Gwaii、Prince Rupert（Ketchikan 55.3°N 在框外）
      [-128.5, 48.3, -123.25, 49.0],   // 溫哥華島南端、維多利亞（東緣避開聖胡安群島與 Bellingham）
      [-89.6, 47.6, -64.0, 49.0],      // 雷灣到加斯佩（北緣以下避開密西根上半島與緬因北端）
      [-84.2, 46.0, -74.5, 47.6],      // 薩德伯里、北灣、魁北克西部
      [-82.4, 43.0, -79.05, 46.0],     // 多倫多、巴里、喬治亞灣（西緣避開 Port Huron）
      [-82.95, 42.2, -79.05, 43.0],    // 倫敦、尼加拉（溫莎與底特律同經度，西緣切在兩者東邊）
      [-79.05, 43.7, -76.3, 46.0],     // 奧沙瓦、京士頓（東緣避開 Watertown）
      [-76.3, 44.95, -74.5, 46.0],     // 渥太華、康沃爾（南緣避開 Massena、Ogdensburg）
      [-74.5, 45.01, -71.0, 47.6],     // 蒙特婁、舍布魯克、魁北克市（南緣 45.01 避開 Rouses Point）
      [-67.2, 45.0, -59.5, 49.0],      // 新布藍茲維、愛德華王子島、布雷頓角（西緣避開 Calais、Houlton）
      [-66.5, 43.3, -59.5, 45.0],      // 新斯科細亞（哈利法克斯；西緣避開 Eastport）
      [-59.5, 47.2, -52.0, 49.0],      // 紐芬蘭（南緣避開聖皮耶與密克隆）
      [-55.9, 46.5, -52.0, 47.2],      // 亞瓦隆半島南部（西緣避開聖皮耶與密克隆）
    ],
  },
  {
    code: "IE",
    chip: "IE",
    labelKey: "country.IE",
    camera: IRELAND_CAMERA,
    // 2026-11-07 愛爾蘭第 0 波：外框依 Tailte Local Authorities 2026（-10.66–-5.99E、51.42–55.39N）。
    // 與 GB 北愛矩形互斥（只共用邊、不重疊，countries.test 守）；依緯度帶切，東緣停在該帶北愛矩形的西緣。
    // 矩形近似：邊界上的北愛小鎮（Crossmaglen、Newtownbutler、Caledon、Belleek 一帶）可能誤判為愛爾蘭，
    // 愛爾蘭的 Bridgend、Pettigo 等貼邊村落可能判不到；單元測試釘住常見城市。
    bboxes: [
      [-10.75, 51.35, -5.9, 54.0],    // 南部、中部、都柏林、Dundalk（北緣 54.0 避開 Mourne 海岸）
      [-6.4, 54.0, -6.1, 54.12],      // Cooley 半島、Omeath（西緣避開 South Armagh，北緣避開 Newry）
      [-10.75, 54.0, -6.65, 54.2],    // Cavan、Monaghan 南部、Clones、Castleblayney（東緣避開 South Armagh）
      [-7.25, 54.2, -6.8, 54.4],      // Monaghan 鎮、Glaslough、Emyvale（東緣避開 Armagh、北緣避開 Tyrone）
      [-10.75, 54.2, -7.6, 54.3],     // Sligo、Leitrim、Blacklion（東緣避開 Lisnaskea）
      [-10.75, 54.3, -8.1, 54.6],     // Mayo 北岸、Bundoran、Ballyshannon（東緣避開 Belleek、Fermanagh）
      [-10.75, 54.6, -7.6, 54.75],    // Donegal 南部（東緣避開 Castlederg）
      [-10.75, 54.75, -7.47, 54.95],  // Letterkenny、Lifford、Ballybofey（東緣避開 Strabane）
      [-10.75, 54.95, -7.42, 55.05],  // Donegal 北部（東緣避開 Derry）
      [-10.75, 55.05, -6.97, 55.45],  // Inishowen（Buncrana、Moville、Malin Head）、Tory 島（東緣避開 Magilligan）
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
