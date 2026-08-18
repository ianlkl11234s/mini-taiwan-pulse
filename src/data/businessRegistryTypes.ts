/**
 * 共同登記地址 B4 的視覺編碼 SSOT。
 *
 * - 點大小：同址公司數 `n_companies`，用 log10 壓縮 5–794 家的長尾。
 * - 點顏色：資本額中位數 `capital_median`，用固定非線性級距避免極端值拉爆色階，
 *   並讓不同月份仍可直接比較。
 *
 * overlayRegistry 與 LegendPanel 必須共用這些常數，不可各自複製 stops。
 */

export const COMMON_REGISTRATION_BASE_COLOR = "#3b82f6";
export const FACTORY_LOCATION_COLOR = "#0d9488";
export const INDUSTRIAL_PARK_COLOR = "#22c55e";
export const REGULATED_FACILITY_COLOR = "#d97706";

/** B1/A4 202608 快照：capital_q=0 是缺值，不得併入最低分位。 */
export const COMPANY_CAPITAL_Q_BANDS = [
  { value: 0, color: "#94a3b8", label: "資本額缺值" },
  { value: 1, color: "#dbeafe", label: "Q1" },
  { value: 2, color: "#93c5fd", label: "Q2" },
  { value: 3, color: "#60a5fa", label: "Q3" },
  { value: 4, color: "#2563eb", label: "Q4" },
  { value: 5, color: "#7c3aed", label: "Q5" },
] as const;

export const COMPANY_INDUSTRY_MID_OPTIONS = [
  { label: "01 農、牧業", value: "01" },
  { label: "02 林業", value: "02" },
  { label: "03 漁業", value: "03" },
  { label: "05 石油及天然氣礦業", value: "05" },
  { label: "06 砂、石採取及其他礦業", value: "06" },
  { label: "08 食品及飼品製造業", value: "08" },
  { label: "09 飲料製造業", value: "09" },
  { label: "10 菸草製造業", value: "10" },
  { label: "11 紡織業", value: "11" },
  { label: "12 成衣及服飾品製造業", value: "12" },
  { label: "13 皮革、毛皮及其製品製造業", value: "13" },
  { label: "14 木竹製品製造業", value: "14" },
  { label: "15 紙漿、紙及紙製品製造業", value: "15" },
  { label: "16 印刷及資料儲存媒體複製業", value: "16" },
  { label: "17 石油及煤製品製造業", value: "17" },
  { label: "18 化學材料及肥料製造業", value: "18" },
  { label: "19 其他化學製品製造業", value: "19" },
  { label: "20 藥品及醫用化學製品製造業", value: "20" },
  { label: "21 橡膠製品製造業", value: "21" },
  { label: "22 塑膠製品製造業", value: "22" },
  { label: "23 非金屬礦物製品製造業", value: "23" },
  { label: "24 基本金屬製造業", value: "24" },
  { label: "25 金屬製品製造業", value: "25" },
  { label: "26 電子零組件製造業", value: "26" },
  { label: "27 電腦、電子產品及光學製品製造業", value: "27" },
  { label: "28 電力設備及配備製造業", value: "28" },
  { label: "29 機械設備製造業", value: "29" },
  { label: "30 汽車及其零件製造業", value: "30" },
  { label: "31 其他運輸工具及其零件製造業", value: "31" },
  { label: "32 家具製造業", value: "32" },
  { label: "33 其他製造業", value: "33" },
  { label: "34 產業用機械設備維修及安裝業", value: "34" },
  { label: "35 電力及燃氣供應業", value: "35" },
  { label: "36 用水供應業", value: "36" },
  { label: "37 廢水及污水處理業", value: "37" },
  { label: "38 廢棄物清除、處理及資源物回收處理業", value: "38" },
  { label: "39 污染整治業", value: "39" },
  { label: "41 建築工程業", value: "41" },
  { label: "42 土木工程業", value: "42" },
  { label: "43 專門營造業", value: "43" },
  { label: "45 批發業", value: "45" },
  { label: "46 批發業", value: "46" },
  { label: "47 零售業", value: "47" },
  { label: "48 零售業", value: "48" },
  { label: "49 陸上運輸業", value: "49" },
  { label: "50 水上運輸業", value: "50" },
  { label: "51 航空運輸業", value: "51" },
  { label: "52 運輸輔助業", value: "52" },
  { label: "53 倉儲業", value: "53" },
  { label: "54 郵政及遞送服務業", value: "54" },
  { label: "55 住宿業", value: "55" },
  { label: "56 餐飲業", value: "56" },
  { label: "58 出版業", value: "58" },
  { label: "59 影片及電視節目業；聲音錄製及音樂發行業", value: "59" },
  { label: "60 廣播、電視節目編排及傳播業", value: "60" },
  { label: "61 電信業", value: "61" },
  { label: "62 電腦程式設計、諮詢及相關服務業", value: "62" },
  { label: "63 資訊服務業", value: "63" },
  { label: "64 金融服務業", value: "64" },
  { label: "65 保險業", value: "65" },
  { label: "66 證券期貨及金融輔助業", value: "66" },
  { label: "67 不動產開發業", value: "67" },
  { label: "68 不動產經營及相關服務業", value: "68" },
  { label: "69 法律及會計服務業", value: "69" },
  { label: "70 企業總管理機構及管理顧問業", value: "70" },
  { label: "71 建築、工程服務及技術檢測、分析服務業", value: "71" },
  { label: "72 研究發展服務業", value: "72" },
  { label: "73 廣告業及市場研究業", value: "73" },
  { label: "74 專門設計業", value: "74" },
  { label: "75 獸醫業", value: "75" },
  { label: "76 其他專業、科學及技術服務業", value: "76" },
  { label: "77 租賃業", value: "77" },
  { label: "78 人力仲介及供應業", value: "78" },
  { label: "79 旅行及其他相關服務業", value: "79" },
  { label: "80 保全及偵探業", value: "80" },
  { label: "81 建築物及綠化服務業", value: "81" },
  { label: "82 行政支援服務業", value: "82" },
  { label: "83 公共行政及國防；強制性社會安全", value: "83" },
  { label: "85 教育業", value: "85" },
  { label: "86 醫療保健業", value: "86" },
  { label: "87 居住型照顧服務業", value: "87" },
  { label: "88 其他社會工作服務業", value: "88" },
  { label: "90 創作及藝術表演業", value: "90" },
  { label: "91 圖書館、檔案保存、博物館及類似機構", value: "91" },
  { label: "92 博弈業", value: "92" },
  { label: "93 運動、娛樂及休閒服務業", value: "93" },
  { label: "94 宗教、職業及類似組織", value: "94" },
  { label: "95 個人及家庭用品維修業", value: "95" },
  { label: "96 未分類其他服務業", value: "96" },
] as const;

export const COMPANY_COUNTY_OPTIONS = [
  "臺北市", "新北市", "桃園市", "臺中市", "臺南市", "高雄市",
  "基隆市", "新竹市", "嘉義市", "新竹縣", "苗栗縣", "彰化縣",
  "南投縣", "雲林縣", "嘉義縣", "屏東縣", "宜蘭縣", "花蓮縣",
  "臺東縣", "澎湖縣", "金門縣",
] as const;

export const COMPANY_SETUP_YEAR_MIN = 1918;
export const COMPANY_SETUP_YEAR_MAX = 2026;

export function companyCapitalQColorExpr(): unknown[] {
  return [
    "match", ["to-number", ["get", "capital_q"], 0],
    ...COMPANY_CAPITAL_Q_BANDS.flatMap((band) => [band.value, band.color]),
    COMPANY_CAPITAL_Q_BANDS[0].color,
  ];
}

/** B3 最小 production filter subset；所有選項索引由 layerParamsSpec 的同一常數編碼。 */
export function companyPointFilter(params?: Record<string, number>): unknown[] {
  const filters: unknown[][] = [];
  const industryIdx = params?.companyIndustryMidIdx ?? 0;
  if (industryIdx > 0) {
    filters.push(["==", ["get", "industry_mid"], COMPANY_INDUSTRY_MID_OPTIONS[industryIdx - 1]?.value ?? ""]);
  }
  const countyIdx = params?.companyCountyIdx ?? 0;
  if (countyIdx > 0) {
    filters.push(["==", ["get", "county"], COMPANY_COUNTY_OPTIONS[countyIdx - 1] ?? ""]);
  }
  const capitalQIdx = params?.companyCapitalQIdx ?? 0;
  if (capitalQIdx > 0) filters.push(["==", ["to-number", ["get", "capital_q"], -1], capitalQIdx - 1]);

  const yearMin = params?.companySetupYearMin ?? COMPANY_SETUP_YEAR_MIN;
  const yearMax = params?.companySetupYearMax ?? COMPANY_SETUP_YEAR_MAX;
  if (yearMin > COMPANY_SETUP_YEAR_MIN) {
    filters.push([">=", ["to-number", ["get", "setup_year"], -1], yearMin]);
  }
  if (yearMax < COMPANY_SETUP_YEAR_MAX) {
    filters.push(["<=", ["to-number", ["get", "setup_year"], 9999], yearMax]);
  }

  for (const [param, field] of [
    ["companyManufacturingIdx", "is_manufacturing"],
    ["companyListedIdx", "is_listed"],
    ["companyTrademarkIdx", "has_trademark"],
    ["companyAddressMismatchIdx", "addr_mismatch"],
  ] as const) {
    const idx = params?.[param] ?? 0;
    if (idx > 0) filters.push(["==", ["to-number", ["get", field], -1], idx === 1 ? 1 : 0]);
  }
  return ["all", ...filters];
}

export const COMPANY_GRID_MODES = [
  { value: "capital_sum", label: "資本額總和" },
  { value: "n_companies", label: "公司數" },
  { value: "capital_median", label: "資本額中位數" },
] as const;

export const COMPANY_GRID_COLORS = [
  "#f5f3ff", "#ddd6fe", "#c4b5fd", "#a78bfa", "#8b5cf6", "#7c3aed", "#5b21b6",
] as const;
export const COMPANY_GRID_NULL_COLOR = "#64748b";

export const COMPANY_GRID_STOPS = [
  [0, 3_000_000, 14_000_000, 57_000_000, 212_000_000, 581_000_000, 5_330_000_000],
  [1, 2, 4, 8, 16, 32, 72],
  [0, 1_000_000, 2_500_000, 5_600_000, 18_500_000, 40_000_000, 500_000_000],
] as const;

export function companyGridColorExpr(modeIdx: number): unknown[] {
  const safeMode = Math.min(Math.max(Math.round(modeIdx), 0), 2);
  const field = COMPANY_GRID_MODES[safeMode]!.value;
  const value: unknown[] = ["to-number", ["get", field], -1];
  const stops = COMPANY_GRID_STOPS[safeMode]!;
  const step: unknown[] = ["step", value, COMPANY_GRID_COLORS[0]];
  for (let i = 1; i < stops.length; i++) step.push(stops[i], COMPANY_GRID_COLORS[i]);
  if (field === "capital_median") {
    return ["case", ["==", ["typeof", ["get", field]], "number"], step, COMPANY_GRID_NULL_COLOR];
  }
  return step;
}

export const INDUSTRIAL_PARK_COMPARISON_MODES = [
  { value: "factory_count", label: "工廠數" },
  { value: "company_count", label: "製造業公司數" },
  { value: "company_capital_total_sum", label: "公司資本額總和" },
] as const;

export const INDUSTRIAL_PARK_COMPARISON_STOPS = [
  [1, 10, 50, 150, 400, 800],
  [1, 10, 50, 150, 400, 800],
  [1, 10_000_000, 100_000_000, 1_000_000_000, 10_000_000_000, 100_000_000_000],
] as const;

export const INDUSTRIAL_PARK_COMPARISON_COLORS = [
  "#ede9fe", "#ddd6fe", "#c4b5fd", "#a78bfa", "#8b5cf6", "#5b21b6",
] as const;
export const INDUSTRIAL_PARK_COMPARISON_ZERO_COLOR = "#64748b";

/** A6 的 0 是「沒有被觀測並指派的實體」，不是實際不存在，故獨立 neutral。 */
export function industrialParkComparisonColorExpr(modeIdx: number): unknown[] {
  const safeMode = Math.min(Math.max(Math.round(modeIdx), 0), 2);
  const field = INDUSTRIAL_PARK_COMPARISON_MODES[safeMode]!.value;
  const value: unknown[] = ["to-number", ["get", field], 0];
  const stops = INDUSTRIAL_PARK_COMPARISON_STOPS[safeMode]!;
  const step: unknown[] = ["step", value, INDUSTRIAL_PARK_COMPARISON_COLORS[0]];
  for (let i = 1; i < stops.length; i++) step.push(stops[i], INDUSTRIAL_PARK_COMPARISON_COLORS[i]);
  return ["case", ["<=", value, 0], INDUSTRIAL_PARK_COMPARISON_ZERO_COLOR, step];
}

export interface CommonRegistrationCapitalBand {
  min: number;
  color: string;
  label: string;
}

/** 固定資本額級距（新臺幣元），接近本版分位數但不隨月份漂移。 */
export const COMMON_REGISTRATION_CAPITAL_BANDS: CommonRegistrationCapitalBand[] = [
  { min: 0, color: "#dbeafe", label: "未滿 100 萬" },
  { min: 1_000_000, color: "#bfdbfe", label: "100–300 萬" },
  { min: 3_000_000, color: "#93c5fd", label: "300–600 萬" },
  { min: 6_000_000, color: "#60a5fa", label: "600–1,500 萬" },
  { min: 15_000_000, color: "#3b82f6", label: "1,500–3,000 萬" },
  { min: 30_000_000, color: "#1d4ed8", label: "3,000 萬–1 億" },
  { min: 100_000_000, color: "#7c3aed", label: "1 億以上" },
];

export const COMMON_REGISTRATION_COUNT_STOPS = [
  { count: 5, radius: 3 },
  { count: 10, radius: 4 },
  { count: 25, radius: 6 },
  { count: 50, radius: 8 },
  { count: 100, radius: 10 },
  { count: 800, radius: 18 },
] as const;

export const COMMON_REGISTRATION_LEGEND_COUNTS = [5, 20, 100] as const;

/** `capital_median` → 固定非線性色階。資料契約保證 number，fallback 僅防破損檔。 */
export function commonRegistrationCapitalColorExpr(): unknown[] {
  const value: unknown[] = ["to-number", ["get", "capital_median"], 0];
  const expression: unknown[] = [
    "step",
    value,
    COMMON_REGISTRATION_CAPITAL_BANDS[0]!.color,
  ];
  for (let i = 1; i < COMMON_REGISTRATION_CAPITAL_BANDS.length; i++) {
    const band = COMMON_REGISTRATION_CAPITAL_BANDS[i]!;
    expression.push(band.min, band.color);
  }
  return expression;
}

/** `n_companies` → log10 半徑，再乘上 zoom 與使用者 scale。 */
export function commonRegistrationRadiusExpr(scale: number): unknown[] {
  const count: unknown[] = [
    "log10",
    ["max", ["to-number", ["get", "n_companies"], 5], 5],
  ];
  const radius: unknown[] = ["interpolate", ["linear"], count];
  for (const stop of COMMON_REGISTRATION_COUNT_STOPS) {
    radius.push(Math.log10(stop.count), stop.radius);
  }
  // Mapbox 限制 ["zoom"] 只能是最外層 step/interpolate 的 input，不能包在乘法裡。
  return [
    "interpolate", ["linear"], ["zoom"],
    6, ["*", scale, 0.55, radius],
    10, ["*", scale, 0.85, radius],
    14, ["*", scale, 1.2, radius],
    16, ["*", scale, 1.5, radius],
  ];
}

/** 圖例圓點使用 z10 的視覺基準；CSS 尺寸另外限制在可讀範圍。 */
export function commonRegistrationLegendDiameter(count: number): number {
  const logCount = Math.log10(Math.max(count, 5));
  for (let i = 1; i < COMMON_REGISTRATION_COUNT_STOPS.length; i++) {
    const lo = COMMON_REGISTRATION_COUNT_STOPS[i - 1]!;
    const hi = COMMON_REGISTRATION_COUNT_STOPS[i]!;
    if (count <= hi.count) {
      const t = (logCount - Math.log10(lo.count)) /
        (Math.log10(hi.count) - Math.log10(lo.count));
      return Math.round((lo.radius + t * (hi.radius - lo.radius)) * 1.7);
    }
  }
  return Math.round(
    COMMON_REGISTRATION_COUNT_STOPS[COMMON_REGISTRATION_COUNT_STOPS.length - 1]!.radius * 1.7,
  );
}
