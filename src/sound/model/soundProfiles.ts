/**
 * City Sound Atlas — 所有模型假設參數的**唯一出處**。
 *
 * 規則：
 * - 引擎與 adapter 不得自帶魔術數字；要調整就改這裡並升 MODEL_VERSION。
 * - 每個參數都附 `assumption` 說明「為什麼是這個值、它代表什麼、不代表什麼」。
 * - 這裡的輸出全部是**無單位、0–1 的相對潛勢**，不是 dB；任何地方都不得把它稱為 dB。
 *   modeledDbA 在通過聲學校準 gate 之前一律為 null。
 */

/**
 * 0.2.0（W4）：新增 MVP-B 三族（RAIL／ROAD_TRAFFIC／ROADWORK）參數；MVP-A 四族參數不變。
 * 0.3.0（W5）：新增自然聲源三族（WIND_VEGETATION／COASTAL_WAVE／RIVER_WATER）與路線剖面（ROUTE）參數；既有七族參數不變。
 * 0.3.1（W2）：臺北市 VD 平日典型車流（TYPICAL_TRAFFIC）流量換算尺度 1500 → 600 輛／小時（使用者 2026-11-11 決定）。
 */
export const MODEL_VERSION = "sound-atlas-mvp-b-0.3.1";

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

// ── 鐵道 R01（移動點；地面／高架，排除地下段）─────────────────

export const RAIL = {
  candidateRadiusM: p(1_500, "只查接收者 1.5 km 內的軌道；純候選篩選，非可聽距離宣稱。"),
  halfPotentialDistanceM: p(250, "與列車水平距離 250 m 時相對潛勢為 0.5（啟發式；未依車種、速度、軌道結構、隔音牆校準）。"),
  structureWeight: p(
    { elevated: 1, at_grade: 1, surface: 1 } as const,
    "高架與地面目前不分輕重（都 1）：兩者聲學差異（結構噪音 vs 輪軌、隔音牆）未量測，先只區分『會不會直接傳到戶外』。地下段不產生貢獻；結構不明（unknown）→ 潛勢 null。",
  ),
  calendarDaySystems: p(
    ["tra", "thsr"] as readonly string[],
    "台鐵、高鐵的每日班表來自 TDX DailyTimetable，以日曆日（TrainDate）編列：班表 D 的 04:57 班是 D 日 04:57。捷運類用 RailEngine 的延長日制（05:50 前算前一營運日的末班車）。此分界依資料來源慣例判斷，未逐班驗證；地圖上的 RailEngine 一律用延長日制。",
  ),
  scheduleIsObservation: p(false, "班表是 scheduled 證據，不是觀測：列車實際位置、誤點、停駛都不反映。"),
} as const;

// ── 道路車流 T01（線聲源；只有道路類型時只給 proxy）────────────

export const ROAD_TRAFFIC = {
  candidateRadiusM: p(500, "只查接收者 500 m 內的已載入路段（目前只有國道路段幾何）。"),
  halfPotentialDistanceM: p(100, "距路段 100 m 時相對潛勢為 0.5（啟發式；未依車道數、車速、路面、隔音牆校準）。"),
  roadTypeProxyWeight: p(
    { freeway: 1 } as const,
    "只有道路類型時的 proxy 權重：目前只有國道路段（freeway）一種，權重 1。這不是流量，UI 必須標『道路類型 proxy』。",
  ),
  volumeMaxAgeS: p(900, "注入的車流量樣本只代表其後 15 分鐘；更久沒有樣本 → unknown（不沿用舊值、不退回 proxy）。"),
  volumeScaleVehPerHour: p(1_500, "有觀測車流量時：volumePotential = 1 − exp(−Q/1500)，Q＝每小時車輛數（單調遞增啟發式，非聲功率公式）。目前前端沒有車流量來源，此參數只在注入流量時使用。"),
} as const;

// ── 道路施工 C01（點／線／面；許可期間＝可能活動）───────────────

export type PermitWindowPolicy = "possible_activity" | "unknown";

export const ROADWORK = {
  candidateRadiusM: p(300, "只查接收者 300 m 內的施工範圍（多邊形內＝距離 0）。"),
  halfPotentialDistanceM: p(80, "距施工範圍 80 m 時相對潛勢為 0.5（啟發式；機具種類、工時未知）。"),
  eventTypes: p([2] as readonly number[], "TDX RoadEvent EventType=2（施工）。EventType=7（樣本中 EventSubType=798，標題多為『挖掘管制』）是管制區不是施工，不納入。"),
  permitWindowPolicy: p<PermitWindowPolicy>(
    "possible_activity",
    "許可（EffectiveTime～ExpireTime）期間內視為『可能有施工活動』（evidence=scheduled）。許可≠機具運轉：多數許可跨月甚至跨年、沒有每日工時，不自行假設工時。改 'unknown' 則許可期間內一律回 unknown。",
  ),
  possibleActivityWeight: p(0.5, "許可期間內只是『可能』施工：潛勢乘 0.5，避免與有觀測證據的來源同級（啟發式）。"),
  coveredCities: p(
    ["新北市", "桃園市", "臺中市", "基隆市", "嘉義縣", "宜蘭縣"] as readonly string[],
    "即時路徑視為有施工資料的縣市：2026-11-08 S3 road_event_planned 歸檔中 EventType=2 筆數 >0 的 6 城。**臺北市只發布 EventType 7（挖掘管制區）、0 筆施工 → 不涵蓋（unknown）**；臺南、高雄、金門回 0 筆，視為沒有發布而非沒有施工。其餘縣市 collector 沒查。外框重疊：臺北市外框蓋住板橋、三重、汐止等新北地點，這些地點也會是 unknown。",
  ),
} as const;

// ── W5 風×植被 N03（站點風速 × 接收點周圍樹冠）───────────────────

export const WIND_VEGETATION = {
  maxStationDistanceM: p(8_000, "接收者到最近有風速的氣象站超過 8 km → unknown；風受地形、建物影響大，不把遠站外推。"),
  windOnsetMs: p(1.5, "平均風速 ≤1.5 m/s（蒲福 1 級以下）視為葉片幾乎不動 → 0。啟發式門檻，非量測。"),
  windScaleMs: p(6, "windPotential = 1 − exp(−(v − onset)/6)：5 m/s ≈ 0.44、10 m/s ≈ 0.76、20 m/s ≈ 0.96。單調遞增啟發式，**風速不直接等於聲級**。"),
  canopyRadiusM: p(100, "只看接收點 100 m 內的樹冠覆蓋（樹葉沙沙聲是近場聲音）。"),
  minCanopyHeightM: p(3, "樹冠高度 ≥3 m 才算『有樹』（Meta/WRI 2020 10 m 樹冠高度；矮灌叢、草地不算）。"),
  coverSaturation: p(0.5, "100 m 內樹冠覆蓋達 50% 起植被係數＝1，以下線性；啟發式。"),
  bucketDurationS: p(3_600, "CWA O-A0001-001 每站整點一筆；整點觀測代表其後 1 小時。"),
  urbanTurbulence: p(false, "不推論建築區紊流／風切聲：樹冠覆蓋 0 → inactive，不因風大就給潛勢。"),
} as const;

// ── W5 海浪×海岸 N04（浮標浪高週期 × 離海岸距離）───────────────────

export const COASTAL_WAVE = {
  coastMaxDistanceM: p(1_000, "接收者離『近岸海域』邊界超過 1 km → inactive（不在海浪可能聽見的帶狀範圍內）。海岸線用國家公園署海岸地區範圍的近岸海域面當 proxy，不是現行海岸線。"),
  halfPotentialDistanceM: p(250, "離近岸海域邊界 250 m 時距離係數 0.5（啟發式；不推近岸衰減、地形遮蔽、岸型）。"),
  maxStationDistanceM: p(40_000, "最近有浪高的浮標／測站超過 40 km → unknown；浮標稀疏，同一海域才勉強代表。"),
  powerScaleM2S: p(18, "wavePotential = 1 − exp(−Hs²·T / 18)：Hs 1.5 m、T 8 s → 0.63。Hs²T 正比於波浪能通量（深水近似），只取其單調性，不換算聲壓。"),
  bucketDurationS: p(3_600, "CWA O-B0075 逐時一筆；代表其後 1 小時。"),
} as const;

// ── W5 河川水聲 N05（水位相對自身歷史分位 × 離河道距離）─────────────

export const RIVER_WATER = {
  channelMaxDistanceM: p(300, "接收者離河道線超過 300 m → inactive。河道線是水利署河川線（public/geo/water_rivers.geojson），不含野溪、瀑布。"),
  halfPotentialDistanceM: p(80, "離河道 80 m 時距離係數 0.5（啟發式；不分堤防、河寬、落差）。"),
  maxStationDistanceM: p(5_000, "最近水位站超過 5 km → unknown。未驗證測站與河道是否同一條河（station_river_match_unverified）。"),
  minHistorySamples: p(24 * 14, "分位數至少要 14 天×24 小時的歷史；不足 → unknown（no_station_history_quantiles）。"),
  liveStationExtent: p(
    [118, 21.5, 123, 26.5] as readonly [number, number, number, number],
    "即時 RPC 回全台水位站：站點清單的完整範圍＝臺灣本島與離島外框（接收點在外 → unknown）。",
  ),
  historyWindowDays: p(60, "分位數用場景日之前 60 天（不含當天）的每小時水位；當天不進基準，避免自我比較。"),
  bucketDurationS: p(3_600, "水位每站每小時取最後一筆（與 get_river_water_level_day 同口徑），代表該小時。"),
} as const;

// ── W5 路線剖面（移動接收者）───────────────────────────────────

export type RouteMode = "walk" | "bike" | "custom";

export const ROUTE = {
  speedMps: p(
    { walk: 1.3, bike: 4 } as const,
    "步行 1.3 m/s（約 4.7 km/h）、自行車 4 m/s（約 14 km/h）：等速假設，不含停等紅燈、坡度、上下車。custom 模式由呼叫端給速度。",
  ),
  sampleSpacingM: p(50, "沿路線每 50 m 取一個樣本（含終點）；每點時間＝出發時間＋累積距離÷速度。"),
  maxSamples: p(2_000, "單次剖面最多 2,000 點（約 100 km @50 m）；超過就加大間距，不截斷路線。"),
} as const;

// ── 24h profile ─────────────────────────────────────────────

export const PROFILE = {
  defaultStepMinutes: p(10, "24h 構成圖預設 10 分鐘一格；格內用區間重疊／細取樣聚合，不做瞬時取樣。"),
  binRule: p("active>unknown>inactive", "格內只要有任一 active 證據即 active（值取最大）；否則有任何 unknown 即 unknown（值 null）；否則 inactive（值 0）。"),
} as const;

// ── 道路車流：臺北市 VD 平日典型值（W2，2026-11-11 新增；只新增區塊，不改上方參數）────────

export const TYPICAL_TRAFFIC = {
  assetUrl: p("/sound-atlas/vd-baseline-taipei.json", "scripts/preprocess/build-sound-vd-baseline.py 產出（public-assets lock 登記）。"),
  candidateRadiusM: p(300, "只查接收者 300 m 內的 VD（VD 是單向斷面點，不是路段；300 m 約市區兩三個街廓）。候選篩選，非可聽距離宣稱。"),
  halfPotentialDistanceM: p(100, "距 VD 100 m 時距離項為 0.5（啟發式；與國道 proxy 同尺度，未依車道數、車速、建物遮蔽校準）。"),
  volumeScaleVehPerHour: p(600, "潛勢流量項 = 1 − exp(−Q/600)，Q＝典型每小時車輛數。使用者 2026-11-11 決定（原 1500）；滿格約對應大馬路尖峰的持續車聲，非 dB。單調啟發式，非聲功率公式；國道 ROAD_TRAFFIC.volumeScaleVehPerHour 不受影響。"),
  minFlowDays: p(3, "某小時的典型流量有效天數 <3 → unknown「樣本不足」（不當 0）。基準期間平日有效流量最多 9 天、中位 8 天。"),
  baselinePeriod: p({ start: "2025-12-26", end: "2026-01-14" } as const, "基準期間（VD S3 只保留這 20 天）；UI 必須寫明是此期間平日典型值、非當日觀測。"),
  nonWorkdays: p(
    [
      "2025-01-01", "2025-01-27", "2025-01-28", "2025-01-29", "2025-01-30", "2025-01-31", "2025-02-28", "2025-04-03", "2025-04-04",
      "2025-05-30", "2025-09-29", "2025-10-06", "2025-10-10", "2025-10-24", "2025-12-25",
      "2026-01-01", "2026-02-16", "2026-02-17", "2026-02-18", "2026-02-19", "2026-02-20", "2026-02-27", "2026-04-03", "2026-04-06",
      "2026-05-01", "2026-06-19", "2026-09-25", "2026-09-28", "2026-10-09", "2026-10-26", "2026-12-25",
    ] as readonly string[],
    "週一～五的放假日：人事行政總處 114 年（1141020 更新）、115 年政府行政機關辦公日曆表（data.gov.tw 資料集 14718）中「是否放假=2」且為平日者。週末一律非平日；補行上班的週六不當平日（基準沒有這種日子）。",
  ),
  calendarCoverage: p({ start: "2025-01-01", end: "2026-12-31" } as const, "放假日表只涵蓋 114–115 年；範圍外日期無法判斷是否平日 → unknown（不猜）。"),
  anomalyDays: p(
    {
      "2026-10-24": "Champi 颱風（場景 taipei-typhoon-1024）：當日無 VD 觀測，颱風日交通型態不能套用典型值",
    } as Readonly<Record<string, string>>,
    "異常日清單：即使是平日也不套典型值（颱風、重大事件等）。新增日期要附理由；邏輯只讀這張表，不在程式寫死日期。",
  ),
} as const;
