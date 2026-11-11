/**
 * City Sound Atlas — 所有模型假設參數的**唯一出處**。
 *
 * 規則：
 * - 引擎與 adapter 不得自帶魔術數字；要調整就改這裡並升 MODEL_VERSION。
 * - 每個參數都附 `assumption` 說明「為什麼是這個值、它代表什麼、不代表什麼」。
 * - 這裡的輸出全部是**無單位、0–1 的相對潛勢**，不是 dB；任何地方都不得把它稱為 dB。
 *   modeledDbA 在通過聲學校準 gate 之前一律為 null。
 */

export const MODEL_VERSION = "sound-atlas-mvp-a-0.1.0";

export interface AssumedParam<T> {
  value: T;
  assumption: string;
}

const p = <T>(value: T, assumption: string): AssumedParam<T> => ({ value, assumption });

// ── 共用物理／幾何 ──────────────────────────────────────────

export const COMMON = {
  speedOfSoundMps: p(343, "乾燥空氣約 20°C 的聲速；未依氣溫／濕度修正。"),
  receiverDefaultHeightM: p(1.5, "接收者離地高度預設 1.5 m（站立耳高）；使用者未提供時採用。"),
  earthRadiusM: p(6_371_008.8, "地球平均半徑（IUGG），haversine 測地距離用；不做橢球修正。"),
} as const;

// ── 飛機（A01，移動 3D 點）──────────────────────────────────

export const AVIATION = {
  candidateRadiusM: p(20_000, "只查接收者水平 20 km 內的航機；更遠的飛機在相對潛勢上可忽略。純候選篩選，非可聽距離宣稱。"),
  maxInterpolationGapS: p(600, "段內兩點間隔 ≤10 分鐘才線性插值位置；更長的間隔直線插值偏離實際航路的風險太高，回 unknown。"),
  intervalSampleStepS: p(30, "24h 區間查詢時，每 30 秒細取樣一次航機位置再取最大值，避免 5–15 分鐘格點漏掉一兩分鐘的飛越。"),
  halfPotentialDistanceM: p(2_000, "斜距 2 km 時相對潛勢為 0.5 的距離衰減尺度（啟發式，未經機型噪音資料校準）。"),
  feetToMeters: p(0.3048, "國際英尺換算公尺。"),
  displayMinPotential: p(
    0.1,
    "**只影響面板顯示**：「此刻主要來源」只逐筆列相對潛勢 ≥0.1 的航機（依上方衰減尺度約為斜距 6 km 內），更遠的併成一行「遠方航機 N 架」。候選半徑 20 km 內大多數航機落在 0.01–0.05，逐筆列出會把雨、垃圾車擠出前幾名。引擎計算、24h 曲線與家族潛勢仍用真實值，不受此門檻影響（因此不升 MODEL_VERSION）。",
  ),
} as const;

// ── 雷聲（N02，脈衝事件）────────────────────────────────────

export const THUNDER = {
  candidateRadiusM: p(25_000, "雷聲通常在 ~15–25 km 內可能聽見；只查 25 km 內的落雷。候選篩選，非可聽保證。"),
  envelopeDurationS: p(8, "雷聲持續 envelope 8 秒（閃電通道各段先後到達）；第一版固定值，不依距離／通道長度變化。"),
  envelopeTailFloor: p(0.3, "envelope 在持續時間末端衰減到起始的 30%（線性），之後歸零；只表達「持續數秒」而非瞬間。"),
  halfPotentialDistanceM: p(3_000, "距離 3 km 時相對潛勢為 0.5 的衰減尺度（啟發式）；不使用 intensity_ka 換算聲壓。"),
  sources: p(["cwa", "taipower"] as const, "預設讀氣象署與台電兩源；jma 只覆蓋日本，不納入。某源空集合不代表無雷。"),
  possibleLinkMaxDtS: p(1, "跨來源兩筆落雷時間差 ≤1 秒且距離 <1 km（見下一參數）視為同一事件的 possible-link。"),
  possibleLinkMaxDistanceM: p(1_000, "possible-link 的距離門檻；連結後只計一次，但原始兩筆都保留在 linkedRecordIds，不刪資料。"),
} as const;

// ── 雨（N01，分布式場；站點代理）─────────────────────────────

export const RAIN = {
  maxStationDistanceM: p(5_000, "接收者到最近雨量站超過 5 km 視為 unknown；雨勢空間變異大，不把遠站外推到街區。"),
  potentialScaleMmPerHour: p(10, "rainPotential = 1 − exp(−R/10)：10 mm/h 約 0.63、40 mm/h 約 0.98。單調遞增啟發式，不是聲壓公式。"),
  bucketDurationS: p(3_600, "get_rain_gauge_day 每站每小時一筆（DISTINCT ON 小時、取該小時最後一筆）；bucket_at 起算 1 小時視為該筆代表區間。"),
} as const;

// ── 垃圾車（W01，表定停點）──────────────────────────────────

export type CalendarPolicy = "unknown" | "candidate";

export const WASTE = {
  candidateRadiusM: p(500, "只查接收者 500 m 內的表定停點。"),
  halfPotentialDistanceM: p(150, "距停點 150 m 時相對潛勢為 0.5（啟發式；音樂車聲未量測）。"),
  approachBufferS: p(120, "到站前 2 分鐘起算可能聽到（車輛接近）；只在停點位置計算，不沿停點間直線發聲。"),
  minAudibleDwellS: p(60, "arrival == departure 的停點給 1 分鐘最小停靠窗。"),
  weekdayListedCities: p(["高雄市", "新北市", "宜蘭縣", "基隆市"] as readonly string[], "gis-platform 079 檔頭與 docs/features/waste-collection/research/schedule-data-quirks.md 證實這 4 城有星期欄位 → calendar_confidence=weekday_listed。個別停點仍可能缺值（RPC 輸出看不出來）。"),
  weekdayUnknownCities: p(["臺北市"] as readonly string[], "來源沒有星期欄位，RPC 端把空值當每日 → calendar_confidence=weekday_unknown。"),
  weekdayUnknownPolicy: p<CalendarPolicy>("unknown", "weekday_unknown 的停點預設回 unknown（不顯示成確定收運）；改 candidate 則以 evidence=inferred 顯示候選。"),
  weekdayUnverifiedPolicy: p<CalendarPolicy>("candidate", "其餘城市（星期欄位現況未查證）→ calendar_confidence=weekday_unverified，以 evidence=inferred 顯示候選，不標 scheduled。"),
} as const;

// ── 24h profile ─────────────────────────────────────────────

export const PROFILE = {
  defaultStepMinutes: p(10, "24h 構成圖預設 10 分鐘一格；格內用區間重疊／細取樣聚合，不做瞬時取樣。"),
  binRule: p("active>unknown>inactive", "格內只要有任一 active 證據即 active（值取最大）；否則有任何 unknown 即 unknown（值 null）；否則 inactive（值 0）。"),
} as const;
