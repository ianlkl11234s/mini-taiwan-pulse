/**
 * 社福長照主題群 9 層的分類、配色與 Mapbox 表達式單一真實來源。
 * 給 overlayRegistry 配色/篩選、LegendPanel 圖例、featureInfo popup 三處共用
 * （同 funeralTypes.ts / religionTypes.ts / educationTypes.ts 慣例）。
 *
 * ⚠️ 本檔的表達式一律**不含 ["zoom"]** —— 例外只有明確標註「含 zoom」的兩個
 *    precision 函式，那兩個回傳的是最外層 interpolate，只能直接放進 paint。
 *
 * 契約 SSOT：taipei-gis-analytics/docs/handoff/welfare-layers.md
 * 類別中文名 SSOT：taipei-gis-analytics/docs/topic-research/welfare/code-table.md
 *   —— 那份是對全量 9,124 筆機構名稱分組**歸納**出來的高信心推論，
 *      上游 API 的欄位說明全空、目錄下只有一個 CSV，**官方沒有發布代碼表**。
 *      要寫類別中文名一律照抄那份，不要自己猜。
 *
 * ── 🔴 三個會接錯的地方（handoff 開場必讀）────────────────────────────
 *
 * 1. **「長照」有兩套互不相容的登記體系，不要 UNION。**
 *    `welfareLtcInstitutions`（本批，3,117）是《長期照顧服務法》**立案機構**；
 *    既有的 `medLTC`（23,894）是長照 2.0 **特約單位**（同一機構每個特約服務項目一列）。
 *    名稱交集只有 2,365 —— 併起來會重複計算又漏算。要做長照覆蓋分析請明確選一邊。
 *    （另：線上 `medical.ltc` 仍是舊版 30,764 筆，上游已縮量 -20.7%、C 級 -86.8%，
 *      2026-08-11 用戶拍板先不同步。要顯示「C 級據點數」前先跟上游確認版本。）
 *
 * 2. **`welfareCenters`（既有，掛 civic_facilities）不是這批的一員。**
 *    它走不同 pipeline、不同主題。本批的 `welfareGovOffices` 已經把 `T0103`
 *    社福服務中心排掉正是為了不跟它重複 —— **兩層零重疊，可以放心同時開**。
 *    要算「全部公部門社福據點」時記得把 welfareCenters 的 162 筆加回來。
 *
 * 3. **`permit_status` 不是有效/失效，不可拿來過濾。**
 *    上游沒發代碼表；本專案用兩份*現行*名冊回推證偽：T0501 護理之家不論在不在
 *    現行名冊**全是 C04**、T0705-08 老人機構不論在不在現行名冊**全是 C01**。
 *    它是隨次類別走的法規／來源代碼空間。C05-C08 共 243 筆語意仍未知。
 *    → 本檔與 UI **完全不使用** permit_status（連 popup 都不顯示，免得被當狀態讀）。
 */

// ══════════════════════════════════════════════════════════════════
//  圖層代表色（9 層各一色；LAYER_COLORS 與 manifest 都引用這裡，不複製字面）
// ══════════════════════════════════════════════════════════════════

export const WELFARE_LAYER_COLORS = {
  welfareNursingHomes: "#4dabf7",
  welfareElderlyHomes: "#f59f00",
  welfareDisability: "#9775fa",
  welfareLtcInstitutions: "#20c997",
  welfareChildcare: "#ff8787",
  welfareChildServices: "#e64980",
  welfareGovOffices: "#4c6ef5",
  welfareMentalHealth: "#cc5de8",
  /** 灰色是刻意的 —— 這層是**組織**不是服務設施，地址多為辦公室，
   *  放在「服務可近性」地圖上會誤導，故降低視覺存在感。 */
  welfareSocialWorkOrgs: "#868e96",
} as const;

/** 未列入分類表的值與缺值一律落中性灰（不要讓它消失，也不要假裝有分類） */
export const WELFARE_MISSING_COLOR = "#8a8a8a";

// ══════════════════════════════════════════════════════════════════
//  ⚠️ 座標精度 coord_precision —— 98 筆（約 1%）是路段／區中心
// ══════════════════════════════════════════════════════════════════
//
// 9 層合計 10,004 點，座標覆蓋 99.7%（8/9 層 100%，child_services 98.0%）。
// 但**精度層內不均勻**，而且精度**不是**品質等第 —— `upstream` 是骨幹 165355
// 自帶的 TGOS geocode（地址級），跟 `exact`（OSM 門牌節點／Google ROOFTOP）
// 同屬可用；真正要當心的只有 `approximate` 那 98 筆。
//
// 逐層 approximate 筆數：child_services 48／childcare 16／socialWorkOrgs 10／
// elderlyHomes 9／ltcInstitutions 6／govOffices 4／disability 3／mentalHealth 2
// （nursingHomes 0 —— 該層 1,610 筆 upstream ＋ 1 筆 exact）。
//
// 🔴 **不要把它們刪掉** —— 那些機構是真的存在，只是地址解不到門牌。
//    做法：高 zoom（z≥15）降透明度＋加粗描邊變空心圈，popup 明講「概略位置」。

export const WELFARE_PRECISION_LABELS: Record<string, string> = {
  upstream: "上游自帶（TGOS／來源系統 geocode）",
  exact: "門牌級（OSM 門牌節點／Google ROOFTOP）",
  cached: "門牌級（TGOS 快取）",
  interpolated: "同路段內插",
  approximate: "路段／區中心（可能差數百公尺）",
};

/** ⚠️ 本主題自有的精度值域，與 funeralTypes 的 PRECISION_MODES **不同套**
 *  （那邊有 source/tgos/parcel_centroid，這邊有 upstream/cached）。
 *  借用另一套會靜默濾錯 —— 值對不上的分支永遠不成立。
 *
 *  ⚠️ **label 最多 4 個中文字**（development-rules §4a 鐵則 4）：3 個選項會被渲染成
 *  橫向 button row（`options.length > 3` 才走原生 select），~240px 側欄裡每顆按鈕只有
 *  約 55px。初版寫「排除概略點」/「只看概略點 (98)」實測三顆全部折行、連「全部」都被
 *  拆成「全」「部」兩行。筆數（98）改寫在圖例，不塞進按鈕。 */
export const WELFARE_PRECISION_MODES: { label: string; value: string }[] = [
  { label: "全部", value: "all" },
  { label: "排除概略", value: "precise" },
  { label: "僅概略點", value: "approx" },
];

export function welfarePrecisionLabel(value: string | null | undefined): string {
  if (!value) return "";
  return WELFARE_PRECISION_LABELS[value] ?? value;
}

export function isApproxPrecision(value: string | null | undefined): boolean {
  return value === "approximate";
}

/** 精度篩選：idx 0=全部、1=排除概略、2=只看概略 */
export function welfarePrecisionFilter(idx: number): unknown[] {
  if (idx === 1) return ["!=", ["coalesce", ["get", "coord_precision"], ""], "approximate"];
  if (idx === 2) return ["==", ["coalesce", ["get", "coord_precision"], ""], "approximate"];
  return ["has", "uid"];
}

/**
 * 9 層共用的 filter 組裝：精度 ＋ 可選的層內分類條件。
 * 回傳恆為 `["all", …]`，即使只有一個條件 —— registry 的 filter 型別統一。
 */
export function welfareFilter(precisionIdx: number, extra?: unknown[]): unknown[] {
  const parts: unknown[] = [welfarePrecisionFilter(precisionIdx)];
  if (extra) parts.push(extra);
  return ["all", ...parts];
}

/**
 * ⚠️ **含 ["zoom"]，只能直接放進 paint 的 circle-opacity**。
 *
 * z<14 概略點與一般點一視同仁（那個尺度下差幾百公尺看不出來，淡掉只會讓人以為沒資料）；
 * z≥15 概略點降到三成 —— 使用者放大到看得見門牌的尺度時，不該讓一個區中心的點
 * 裝成門牌級定位。
 */
export function welfarePrecisionOpacityExpr(opacity: number): unknown[] {
  const dim = Math.max(0.05, opacity * 0.3);
  return [
    "interpolate", ["linear"], ["zoom"],
    14, opacity,
    15, ["case", ["==", ["coalesce", ["get", "coord_precision"], ""], "approximate"], dim, opacity],
  ];
}

/**
 * ⚠️ **含 ["zoom"]，只能直接放進 paint 的 circle-stroke-width**。
 * 搭配上面的 opacity 降階 —— 高 zoom 時概略點加粗描邊 + 淡填色 = 讀起來像空心圈。
 */
export function welfarePrecisionStrokeWidthExpr(): unknown[] {
  return [
    "interpolate", ["linear"], ["zoom"],
    6, 0.3,
    14, 1,
    15, ["case", ["==", ["coalesce", ["get", "coord_precision"], ""], "approximate"], 1.8, 1],
  ];
}

// ══════════════════════════════════════════════════════════════════
//  welfare_class —— 11 類主分類（本批用到 9 個）
// ══════════════════════════════════════════════════════════════════
//
// ⚠️ 語意是**本專案歸納**的，不是官方定義（見檔頭 code-table.md 註記）。

export const WELFARE_CLASS_LABELS: Record<string, string> = {
  nursing_home: "護理機構",
  elderly_residential: "老人住宿機構",
  disability: "身心障礙福利機構",
  ltc_institution: "長照服務機構（立案）",
  childcare_infant: "托嬰中心",
  child_dev: "兒童發展／早期療育",
  parent_child_center: "親子館／育兒支持",
  child_welfare: "兒少福利與安置",
  gov_welfare_office: "公部門社福單位",
  mental_health: "心理衛生機構",
  ngo_social_work: "民間團體／社工事務所",
};

export function welfareClassLabel(value: string | null | undefined): string {
  if (!value) return "未分類";
  return WELFARE_CLASS_LABELS[value] ?? value;
}

// ══════════════════════════════════════════════════════════════════
//  sub_code —— 165355 次類別（popup 顯示細分型別用）
// ══════════════════════════════════════════════════════════════════
//
// 逐字照抄 code-table.md 的「次類別（實證語意）」表；本批 9 檔實際出現的全在這裡。
// T0201/T0202（大學/技專）、T03xx（矯正）、T04xx（醫療）在上游就被剔除，故不列。

export const WELFARE_SUB_CODE_LABELS: Record<string, string> = {
  T0101: "縣市局處",
  T0102: "家庭暴力暨性侵害防治中心",
  T0104: "老人服務中心（公設民營）",
  T0105: "社區心理衛生中心",
  T0106: "毒品危害防制中心",
  T0107: "區／鄉／鎮公所",
  T0108: "衛生所",
  T0109: "長期照顧管理中心",
  T0199: "其他公部門",
  T0203: "家庭教育中心",
  T0501: "一般護理之家",
  T0502: "社區復健中心／日間型機構",
  T0503: "康復之家",
  T0504: "心理諮商所／心理治療所",
  T0601: "居家式長照機構",
  T0602: "社區式長照機構（日間照顧）",
  T0603: "住宿式長照機構",
  T0604: "綜合式長照機構",
  T0605: "榮譽國民之家",
  T0701: "托嬰中心",
  T0703: "兒童發展中心／聽語中心",
  T0705: "老人長期照護中心（長期照護型）",
  T0706: "老人養護所／長期照顧中心（養護型）",
  T0707: "失智型老人照顧中心",
  T0708: "老人公寓／安養中心／敬老院",
  T0709: "身障發展中心（公設民營）",
  T0710: "身障發展中心（私立）／啟能中心",
  T0711: "身障服務中心／潛能發展",
  T0801: "社會服務協會／社區發展協會",
  T0802: "全國性專業團體",
  T0803: "社會工作師事務所",
  T0804: "社會工作師公會",
  T0805: "照顧服務勞動合作社",
  T0901: "基金會",
};

export function welfareSubCodeLabel(value: string | null | undefined): string {
  if (!value) return "";
  return WELFARE_SUB_CODE_LABELS[value] ?? value;
}

// ══════════════════════════════════════════════════════════════════
//  🛏️ 護理之家 nursing_homes —— nh_type 三分色 ＋ 床數泡泡
// ══════════════════════════════════════════════════════════════════
//
// count = 2026-08-12 成品實測（1,611 點中 1,499 帶專屬欄位，112 筆只有骨幹基本欄）。

export const NURSING_HOME_TYPES: { value: string; label: string; color: string; count: number }[] = [
  { value: "一般護理之家", label: "一般護理之家", color: "#4dabf7", count: 510 },
  { value: "居家護理所", label: "居家護理所（無床）", color: "#63e6be", count: 732 },
  { value: "產後護理之家", label: "產後護理之家", color: "#f783ac", count: 257 },
];

export function nursingTypeColorExpr(): unknown[] {
  return [
    "match", ["coalesce", ["get", "nh_type"], "unknown"],
    ...NURSING_HOME_TYPES.flatMap((t) => [t.value, t.color]),
    WELFARE_MISSING_COLOR,
  ];
}

export function nursingTypeLabel(value: string | null | undefined): string {
  if (!value) return "未標示型別";
  return NURSING_HOME_TYPES.find((t) => t.value === value)?.label ?? value;
}

export function nursingTypeColor(value: string | null | undefined): string {
  if (!value) return WELFARE_MISSING_COLOR;
  return NURSING_HOME_TYPES.find((t) => t.value === value)?.color ?? WELFARE_MISSING_COLOR;
}

/** nh_type 篩選：idx 0=全部，1..3 對應 NURSING_HOME_TYPES */
export function nursingTypeFilter(idx: number): unknown[] | undefined {
  const t = idx > 0 ? NURSING_HOME_TYPES[idx - 1]?.value : undefined;
  if (!t) return undefined;
  return ["==", ["coalesce", ["get", "nh_type"], ""], t];
}

/**
 * 總床數 = 一般 ＋ 產後 ＋ 嬰兒室。
 *
 * 🔴 **不要只用 `beds_nh`** —— 1,499 筆裡有 989 筆是 0，因為居家護理所（732，
 *    本來就沒有床）與產後護理之家（257，床數在 beds_postpartum/beds_infant）。
 *    只看 beds_nh 會讓三分之二的點縮成同一顆最小點，看起來像資料壞了。
 *
 * ⚠️ 三個欄位上游給的都是**字串**（`"56"`），且 112 筆整組 key 不存在
 *    （空值在匯出時整個拿掉，不是留空字串）→ coalesce 補 0 再 to-number。
 */
export function nursingBedsExpr(): unknown[] {
  const n = (field: string): unknown[] => ["to-number", ["coalesce", ["get", field], 0]];
  return ["+", n("beds_nh"), n("beds_postpartum"), n("beds_infant")];
}

/** popup / 圖例用的純 JS 版（同上，字串欄位要自己轉數字） */
export function nursingBeds(props: Record<string, unknown>): {
  nh: number; postpartum: number; infant: number; total: number; hasData: boolean;
} {
  const n = (v: unknown): number => {
    const x = Number(v);
    return Number.isFinite(x) ? x : 0;
  };
  const nh = n(props.beds_nh);
  const postpartum = n(props.beds_postpartum);
  const infant = n(props.beds_infant);
  return { nh, postpartum, infant, total: nh + postpartum + infant, hasData: "beds_nh" in props };
}

// ══════════════════════════════════════════════════════════════════
//  👵 老人住宿機構 elderly_care_homes —— attr_type 公私別 ＋ 核定床數泡泡
// ══════════════════════════════════════════════════════════════════
//
// ⚠️ `attr_type` 上游有 5 種寫法，其中「公設\n民營」帶**字面換行**（9 筆）。
//    raw 全列出來給 classificationCoverage 擋，前端 fold 成 3 群。

export const ELDERLY_ATTR_GROUPS: {
  value: string; label: string; color: string; raw: string[]; count: number;
}[] = [
  { value: "public", label: "公立", color: "#4c6ef5", raw: ["公立"], count: 14 },
  {
    value: "ppp", label: "公設民營／公辦民營", color: "#22b8cf",
    raw: ["公設民營", "公辦民營", "公設\n民營"], count: 12,
  },
  { value: "private", label: "私立", color: "#f59f00", raw: ["私立"], count: 1064 },
];

export function elderlyAttrColorExpr(): unknown[] {
  return [
    "match", ["coalesce", ["get", "attr_type"], "unknown"],
    ...ELDERLY_ATTR_GROUPS.flatMap((g) => [g.raw, g.color] as [string[], string]),
    WELFARE_MISSING_COLOR,
  ];
}

export function elderlyAttrLabel(value: string | null | undefined): string {
  if (!value) return "未標示";
  return ELDERLY_ATTR_GROUPS.find((g) => g.raw.includes(value))?.label ?? value;
}

export function elderlyAttrColor(value: string | null | undefined): string {
  if (!value) return WELFARE_MISSING_COLOR;
  return ELDERLY_ATTR_GROUPS.find((g) => g.raw.includes(value))?.color ?? WELFARE_MISSING_COLOR;
}

/** 核定床數（`beds_approved` 同樣是字串，1,160 筆中 70 筆整個 key 不存在） */
export function elderlyBedsExpr(): unknown[] {
  return ["to-number", ["coalesce", ["get", "beds_approved"], 0]];
}

// ══════════════════════════════════════════════════════════════════
//  ♿ 身障機構 disability_facilities —— 使用率分色（全主題最有故事的欄位）
// ══════════════════════════════════════════════════════════════════
//
// 使用率 = (actual_resident + actual_night + actual_day) / (quota_* 三者之和)。
//
// 🔴 **兩道分母守門，缺一就會生出假象**：
//   1. 334 筆中有 **68 筆整組 quota/actual key 不存在**（空值匯出時被拿掉）
//   2. 剩下 266 筆中有 **20 筆三項核定量都是 "0"**（多為福利服務中心，本來就不收容）
//   → 合計 88 筆落「無資料」灰色。**不可**當成使用率 0%（那會畫成一片「空床最多」）。
//
// 分佈（2026-08-12 實測 334 筆）：<50% 17／50-80% 68／80-100% 160／>100% 1／無資料 88。

export const DISABILITY_USAGE_BUCKETS: {
  value: string; label: string; color: string; max: number; count: number;
}[] = [
  { value: "low", label: "未滿 50%（空床多）", color: "#4dabf7", max: 0.5, count: 17 },
  { value: "mid", label: "50–80%", color: "#38d9a9", max: 0.8, count: 68 },
  { value: "high", label: "80–100%", color: "#fab005", max: 1.0, count: 160 },
  { value: "over", label: "超過 100%（超收）", color: "#fa5252", max: Infinity, count: 1 },
];

export const DISABILITY_USAGE_NA_LABEL = "無核定量資料 (88)";

/**
 * 使用率分色。分母 0（含 key 不存在）→ 灰。
 * ⚠️ Mapbox 的 `/` 除以 0 得到 Infinity 而不是報錯 —— 一定要先 case 擋掉，
 *    否則那 88 筆會全部落進「超過 100%」桶，變成「全台身障機構嚴重超收」的假象。
 */
export function disabilityUsageColorExpr(): unknown[] {
  const n = (field: string): unknown[] => ["to-number", ["coalesce", ["get", field], 0]];
  const quota: unknown[] = ["+", n("quota_resident"), n("quota_night"), n("quota_day")];
  const actual: unknown[] = ["+", n("actual_resident"), n("actual_night"), n("actual_day")];
  return [
    "case",
    ["<=", quota, 0], WELFARE_MISSING_COLOR,
    [
      "step", ["/", actual, quota],
      DISABILITY_USAGE_BUCKETS[0]?.color ?? WELFARE_MISSING_COLOR,
      0.5, DISABILITY_USAGE_BUCKETS[1]?.color ?? WELFARE_MISSING_COLOR,
      0.8, DISABILITY_USAGE_BUCKETS[2]?.color ?? WELFARE_MISSING_COLOR,
      1.0, DISABILITY_USAGE_BUCKETS[3]?.color ?? WELFARE_MISSING_COLOR,
    ],
  ];
}

/** popup 用的純 JS 版；`hasData:false` 時 ratio 不可信，呼叫端要顯示「無資料」 */
export function disabilityUsage(props: Record<string, unknown>): {
  quota: number; actual: number; ratio: number; hasData: boolean; color: string; label: string;
} {
  const n = (v: unknown): number => {
    const x = Number(v);
    return Number.isFinite(x) ? x : 0;
  };
  const quota = n(props.quota_resident) + n(props.quota_night) + n(props.quota_day);
  const actual = n(props.actual_resident) + n(props.actual_night) + n(props.actual_day);
  if (quota <= 0) {
    return { quota, actual, ratio: 0, hasData: false, color: WELFARE_MISSING_COLOR, label: "無核定量資料" };
  }
  const ratio = actual / quota;
  const b = DISABILITY_USAGE_BUCKETS.find((x) => ratio < x.max) ?? DISABILITY_USAGE_BUCKETS[3];
  return {
    quota, actual, ratio, hasData: true,
    color: b?.color ?? WELFARE_MISSING_COLOR,
    label: b?.label ?? "",
  };
}

/** 身障機構型別（266 筆有值；純 popup 顯示，不做分色 —— 使用率已經佔用了顏色軸） */
export const DISABILITY_INST_TYPES = [
  "全日型住宿式機構", "日間型機構", "福利服務中心", "夜間型住宿式機構",
];

/**
 * ⚠️ `accreditation` 是**髒欄位**：除了「優/甲/乙/丙/免評鑑/無」，還混了
 * 「112年11月1日立案」「112年1月1日起停業」這種日期敘述（共 4 筆）。
 * → **只原樣顯示在 popup，絕不拿來分色或過濾**（護理之家那層的 accreditation
 *   是乾淨的「合格/尚未評鑑」，但為了一致也一樣只顯示）。
 */
export function accreditationDisplay(value: string | null | undefined): string {
  return value ? String(value) : "";
}

// ══════════════════════════════════════════════════════════════════
//  🏥 長照立案機構 ltc_institutions —— sub_code 四種服務型態分色
// ══════════════════════════════════════════════════════════════════

export const LTC_SERVICE_TYPES: { value: string; label: string; color: string; count: number }[] = [
  { value: "T0601", label: "居家式", color: "#ffd43b", count: 1798 },
  { value: "T0602", label: "社區式（日間照顧）", color: "#20c997", count: 1096 },
  { value: "T0603", label: "住宿式", color: "#845ef7", count: 60 },
  { value: "T0604", label: "綜合式", color: "#ff922b", count: 163 },
];

export function ltcServiceColorExpr(): unknown[] {
  return [
    "match", ["coalesce", ["get", "sub_code"], "unknown"],
    ...LTC_SERVICE_TYPES.flatMap((t) => [t.value, t.color]),
    WELFARE_MISSING_COLOR,
  ];
}

/** sub_code 篩選：idx 0=全部，1..4 對應 LTC_SERVICE_TYPES */
export function ltcServiceFilter(idx: number): unknown[] | undefined {
  const t = idx > 0 ? LTC_SERVICE_TYPES[idx - 1]?.value : undefined;
  if (!t) return undefined;
  return ["==", ["coalesce", ["get", "sub_code"], ""], t];
}

// ══════════════════════════════════════════════════════════════════
//  🧒 兒少服務 child_services —— welfare_class 三類混裝
// ══════════════════════════════════════════════════════════════════
//
// ⚠️ 這層是三類混裝，用 welfare_class 區分。早療的 `unit_type` **含醫院/診所**，
//    與 medical 主題重疊 —— 要做「純社福早療」得先切 unit_type。

export const CHILD_SERVICE_CLASSES: { value: string; label: string; color: string; count: number }[] = [
  { value: "child_dev", label: "兒童發展／早期療育", color: "#e64980", count: 1084 },
  { value: "parent_child_center", label: "親子館／育兒支持", color: "#ffa94d", count: 196 },
  { value: "child_welfare", label: "兒少福利與安置", color: "#7950f2", count: 116 },
];

export function childServiceColorExpr(): unknown[] {
  return [
    "match", ["coalesce", ["get", "welfare_class"], "unknown"],
    ...CHILD_SERVICE_CLASSES.flatMap((c) => [c.value, c.color]),
    WELFARE_MISSING_COLOR,
  ];
}

export function childServiceColor(value: string | null | undefined): string {
  if (!value) return WELFARE_MISSING_COLOR;
  return CHILD_SERVICE_CLASSES.find((c) => c.value === value)?.color ?? WELFARE_MISSING_COLOR;
}

/** welfare_class 篩選：idx 0=全部，1..3 對應 CHILD_SERVICE_CLASSES */
export function childServiceFilter(idx: number): unknown[] | undefined {
  const c = idx > 0 ? CHILD_SERVICE_CLASSES[idx - 1]?.value : undefined;
  if (!c) return undefined;
  return ["==", ["coalesce", ["get", "welfare_class"], ""], c];
}

// ══════════════════════════════════════════════════════════════════
//  🧠 心理衛生機構 mental_health_facilities —— sub_code 五類分色（70 點）
// ══════════════════════════════════════════════════════════════════

export const MENTAL_HEALTH_TYPES: { value: string; label: string; color: string; count: number }[] = [
  { value: "T0105", label: "社區心理衛生中心", color: "#cc5de8", count: 33 },
  { value: "T0106", label: "毒品危害防制中心", color: "#f76707", count: 21 },
  { value: "T0503", label: "康復之家", color: "#37b24d", count: 8 },
  { value: "T0504", label: "心理諮商所／治療所", color: "#4c6ef5", count: 4 },
  { value: "T0502", label: "社區復健中心", color: "#22b8cf", count: 4 },
];

export function mentalHealthColorExpr(): unknown[] {
  return [
    "match", ["coalesce", ["get", "sub_code"], "unknown"],
    ...MENTAL_HEALTH_TYPES.flatMap((t) => [t.value, t.color]),
    WELFARE_MISSING_COLOR,
  ];
}

export function mentalHealthColor(value: string | null | undefined): string {
  if (!value) return WELFARE_MISSING_COLOR;
  return MENTAL_HEALTH_TYPES.find((t) => t.value === value)?.color ?? WELFARE_MISSING_COLOR;
}
