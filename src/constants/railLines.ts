/**
 * `rsys=` 的鐵路代碼表（營運者級 + 線路級）—— **純資料模組，零相依**。
 *
 * 為什麼要有這張表：`rsys=trtc` 字面是「台北捷運」，但資料裡的 `trtc` 系統其實是
 * 「台北都會區軌道」的大雜燴 —— 除北捷本體五線外，還掛著桃捷機場線（A）、
 * 新北捷運的環狀／淡海／安坑／三鶯（Y/V/K/LB）與貓空纜車（MK）。
 * 讀者寫 `rsys=trtc` 想要的是北捷，不是連桃園中壢都入鏡，所以把代碼拆成三種粒度：
 *
 *   系統／營運者級   `trtc` `tymc` `ntm` `krtc` `klrt` `tmrt` `tra` `thsr`
 *   線路級           `trtc-bl` `trtc-r` `krtc-r` `tmrt-g` …（**必帶營運者前綴**）
 *
 * 前綴不是裝飾：北捷與高捷都有 `R`（淡水信義線 vs 高雄紅線）與 `O`（中和新蘆 vs 高雄橘線），
 * 裸的 `r` 無法分辨。代碼一律小寫（同 `style=` 的網址契約）。
 *
 * ⚠️ **`trtc-mk`（貓空纜車）刻意不在表內**：它掛在 trtc 底下但不是軌道運輸，
 * 主站 `railLoader.postProcess` 與 `railReplayData` 都排除，故也不給它代碼 ——
 * 打 `rsys=trtc-mk` 會被當未知代碼 drop（全 drop → 顯示全部，不白畫面）。
 *
 * 三個消費端共用本表，任何一端都不准自己重寫這套聯集邏輯：
 *   `lib/urlState.ts`（白名單）／`embed/railReplayData.ts`（組裝過濾）／
 *   `components/LegendPanel.tsx`（圖例收斂）
 */

/** 走 `RailEngine` / `TraTrainEngine` 的底層系統 id（＝快照列與幾何 bundle 的 key）。 */
export type RailSystemId = "tra" | "thsr" | "trtc" | "krtc" | "klrt" | "tmrt";

export interface RailLineInfo {
  /** `rsys=` 代碼（小寫，恆為 `<operator>-<line>`） */
  code: string;
  /** 所屬營運者代碼（＝ code 的前綴，明列出來免得消費端去 split 字串） */
  operator: string;
  /** 底層系統 id —— 注意 `tymc` / `ntm` 的線路都住在 `trtc` 系統裡 */
  system: RailSystemId;
  /** 資料裡的 `line_id`（見 railLineIdOf 的取得方式） */
  lineId: string;
  name: string;
  /**
   * 官方線色 —— 抄自 `public/embed-rail/rail_slim.json.gz` 各線 **direction 0 主軌道**
   * 的 `properties.color`（例：`BL-1-0` → #0070c0）。
   * 為什麼不是從 bundle 現讀：圖例是靜態元件、手上沒有那份幾何資料；
   * 且同一條線的反向／區間車軌道帶的是變體色（`R-1-1` 是 #ff6b6b、`R-2-0` 是 #e63946），
   * 逐條讀反而拿不到「這條線的顏色」。改動時對齊 bundle。
   */
  color: string;
}

export interface RailOperatorInfo {
  /** `rsys=` 代碼 */
  id: string;
  name: string;
  system: RailSystemId;
  /**
   * 限定收哪幾個 `line_id`；`undefined` ＝ 整個系統全收
   * （krtc/klrt/tmrt/tra/thsr 的系統與營運者一對一，不必逐線列，日後上新線也自動涵蓋）。
   */
  lineIds?: readonly string[];
  /** 沒有線路級代碼的系統（klrt）在圖例上用的色，同 railLoader 的系統預設色 */
  color?: string;
}

/**
 * 線路級代碼表。**只收資料裡真的有 `line_id` 的線** ——
 * klrt（高雄輕軌環狀線）與 thsr、tra 的軌道沒有 `line_id`，系統級即最細粒度，
 * 故意不給 `klrt-c` 之類的代碼，避免出現「查不到東西的合法代碼」。
 */
export const RAIL_LINES: readonly RailLineInfo[] = [
  // ── 台北捷運本體 5 線 ──
  { code: "trtc-br", operator: "trtc", system: "trtc", lineId: "BR", name: "文湖線", color: "#c48c31" },
  { code: "trtc-r", operator: "trtc", system: "trtc", lineId: "R", name: "淡水信義線", color: "#d90023" },
  { code: "trtc-g", operator: "trtc", system: "trtc", lineId: "G", name: "松山新店線", color: "#008659" },
  { code: "trtc-o", operator: "trtc", system: "trtc", lineId: "O", name: "中和新蘆線", color: "#f8b61c" },
  { code: "trtc-bl", operator: "trtc", system: "trtc", lineId: "BL", name: "板南線", color: "#0070c0" },
  // ── 桃園捷運（機場線）── 資料掛在 trtc 系統底下
  { code: "tymc-a", operator: "tymc", system: "trtc", lineId: "A", name: "機場捷運", color: "#8246af" },
  // ── 新北捷運 4 線 ── 同樣掛在 trtc 系統底下
  { code: "ntm-y", operator: "ntm", system: "trtc", lineId: "Y", name: "環狀線", color: "#fedb00" },
  { code: "ntm-v", operator: "ntm", system: "trtc", lineId: "V", name: "淡海輕軌", color: "#a4ce4e" },
  { code: "ntm-k", operator: "ntm", system: "trtc", lineId: "K", name: "安坑輕軌", color: "#8cc540" },
  { code: "ntm-lb", operator: "ntm", system: "trtc", lineId: "LB", name: "三鶯線", color: "#6db7d0" },
  // ── 高雄捷運 ──
  { code: "krtc-r", operator: "krtc", system: "krtc", lineId: "R", name: "高雄紅線", color: "#e2211c" },
  { code: "krtc-o", operator: "krtc", system: "krtc", lineId: "O", name: "高雄橘線", color: "#f8981d" },
  // ── 台中捷運 ──
  { code: "tmrt-g", operator: "tmrt", system: "tmrt", lineId: "G", name: "台中捷運綠線", color: "#0cab2c" },
];

/**
 * 營運者／系統級代碼表。
 *
 * ⚠️ `trtc` 的語意在 2026-08 **刻意縮小**（breaking change，owner 拍板）：
 * 舊版 `rsys=trtc` ＝ 整個 trtc 系統（含機場捷運與新北四線，94 條軌道）；
 * 新版 ＝ 台北捷運本體五線（76 條）。要回到舊範圍請寫 `rsys=trtc,tymc,ntm`。
 */
export const RAIL_OPERATORS: readonly RailOperatorInfo[] = [
  { id: "tra", name: "台鐵", system: "tra" },
  { id: "thsr", name: "高鐵", system: "thsr" },
  { id: "trtc", name: "台北捷運", system: "trtc", lineIds: ["BR", "R", "G", "O", "BL"] },
  { id: "tymc", name: "桃園捷運", system: "trtc", lineIds: ["A"] },
  { id: "ntm", name: "新北捷運", system: "trtc", lineIds: ["Y", "V", "K", "LB"] },
  { id: "krtc", name: "高雄捷運", system: "krtc" },
  { id: "klrt", name: "高雄輕軌", system: "klrt", color: "#43aa8b" },
  { id: "tmrt", name: "台中捷運", system: "tmrt" },
];

const OPERATOR_BY_ID = new Map(RAIL_OPERATORS.map((o) => [o.id, o]));
const LINE_BY_CODE = new Map(RAIL_LINES.map((l) => [l.code, l]));

/** `rsys=` 收得下的全部代碼（營運者級 + 線路級）。urlState 的白名單就是這一份。 */
export const RAIL_CODES: readonly string[] = [
  ...RAIL_OPERATORS.map((o) => o.id),
  ...RAIL_LINES.map((l) => l.code),
];
const RAIL_CODE_SET = new Set<string>(RAIL_CODES);

/** 代碼是否合法（大小寫敏感，網址契約一律小寫）。 */
export function isRailCode(code: string): boolean {
  return RAIL_CODE_SET.has(code);
}

/** 單一系統要收哪些線。`all` ＝ 不做線路過濾（該系統整包收）。 */
export interface RailSelection {
  all: boolean;
  /** `all === false` 時才有意義：要收的 `line_id` 集合 */
  lineIds: Set<string>;
}

/**
 * `rsys=` 代碼陣列 → 「哪個系統收哪些線」。
 *
 * - 回傳 `null` ＝ 未指定 ＝ 全部都要（呼叫端不得把它當成空集合）。
 * - **同系統的多個代碼取聯集**：`rsys=trtc,trtc-bl` ＝ trtc 五線（`trtc-bl` 已被涵蓋）；
 *   `rsys=trtc-bl,tymc` ＝ 板南線 + 機場捷運。混用不是錯誤，就是加法。
 * - 只要有任一代碼是「整個系統」（如 `krtc`），該系統就變 `all`，後續線路級代碼不再收斂它。
 *
 * @param codes urlState 已濾過未知代碼；空陣列與 undefined 一律當「未指定」。
 */
export function resolveRailCodes(
  codes: readonly string[] | undefined,
): Map<RailSystemId, RailSelection> | null {
  if (!codes || codes.length === 0) return null;

  const out = new Map<RailSystemId, RailSelection>();
  const pick = (system: RailSystemId): RailSelection => {
    let sel = out.get(system);
    if (!sel) {
      sel = { all: false, lineIds: new Set<string>() };
      out.set(system, sel);
    }
    return sel;
  };

  for (const code of codes) {
    const op = OPERATOR_BY_ID.get(code);
    if (op) {
      const sel = pick(op.system);
      if (!op.lineIds) sel.all = true;
      else for (const id of op.lineIds) sel.lineIds.add(id);
      continue;
    }
    const line = LINE_BY_CODE.get(code);
    if (line) pick(line.system).lineIds.add(line.lineId);
  }

  // 全部都是未知代碼時（理論上 urlState 已擋掉）比照「未指定」，不要回空 Map 造成白畫面
  return out.size > 0 ? out : null;
}

/** 這個系統的這條線要不要收。`sel` 為 undefined ＝ 該系統整個不收。 */
export function isLineWanted(sel: RailSelection | undefined, lineId: string | null): boolean {
  if (!sel) return false;
  if (sel.all) return true;
  return lineId != null && sel.lineIds.has(lineId);
}

/**
 * 取得一條軌道的 `line_id`。
 *
 * ⚠️ **`properties.line_id` 不是每條都有**：`rail_slim.json.gz` 裡 trtc 的 96 條軌道中，
 * 13 條淡水信義線的變體（`R-4-*` ~ `R-15-*`，如「大安 → 象山」「北投 → 淡水」）
 * 只有 `track_id` / `route_id` / `name` / `color`，**沒有 `line_id`**；
 * 時刻表快照（`departures` 那份）更是整份都沒有 `line_id`，只有 `track_id`。
 * 因此純靠 properties 過濾會讓 `rsys=trtc` 少掉 13 條淡水信義線軌道。
 *
 * 取法：`properties.line_id` 優先，缺了才退回 **trtc 專用**的 `track_id` 前綴解析
 * （trtc 的 id 格式恆為 `<LINE>-<route>-<direction>`；krtc/klrt/tmrt 是
 * `KRTC-R-0` 這種帶系統前綴的格式，前綴解析會得到系統名而不是線路，
 * 但那幾個系統的 `line_id` 都齊全，用不到 fallback）。
 *
 * follow-up：上游 `build-rail-slim-bundle.py` 補齊全部軌道的 `line_id` 後，可刪掉 fallback。
 */
export function railLineIdOf(
  system: RailSystemId,
  trackId: string,
  properties: Record<string, unknown> | null | undefined,
): string | null {
  const raw = properties?.line_id;
  if (typeof raw === "string" && raw) return raw;
  if (system === "trtc") {
    const prefix = trackId.split("-")[0];
    return prefix || null;
  }
  return null;
}

/**
 * 圖例要列的項目：被選到的線路（線路級）＋ 沒有線路概念的系統（如高雄輕軌整條）。
 * TRA 車種與高鐵不在此列（各有自己的圖例區塊）。
 */
export function railLegendLines(
  selection: Map<RailSystemId, RailSelection>,
): { color: string; name: string }[] {
  const rows: { color: string; name: string }[] = [];
  for (const line of RAIL_LINES) {
    const sel = selection.get(line.system);
    if (isLineWanted(sel, line.lineId)) rows.push({ color: line.color, name: line.name });
  }
  // klrt 這種「整個系統只有一條線、資料又沒有 line_id」的，用營運者名 + 系統色補一列
  for (const op of RAIL_OPERATORS) {
    if (!op.color || !selection.has(op.system)) continue;
    rows.push({ color: op.color, name: op.name });
  }
  return rows;
}

/**
 * 代碼 → 捷運／輕軌**營運者**中文名（去重、依代碼順序）。台鐵與高鐵不在內
 * （圖例各有自己的區塊）。用於圖例標題「鐵路 RAIL・台北捷運／桃園捷運」。
 */
export function railMetroOperatorNames(codes: readonly string[]): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  const push = (id: string) => {
    const op = OPERATOR_BY_ID.get(id);
    if (!op || op.system === "tra" || op.system === "thsr" || seen.has(id)) return;
    seen.add(id);
    names.push(op.name);
  };
  for (const code of codes) {
    const line = LINE_BY_CODE.get(code);
    push(line ? line.operator : code);
  }
  return names;
}
