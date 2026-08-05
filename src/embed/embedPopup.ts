/**
 * 嵌入版的通用 popup（EM-20）
 *
 * 主站的 popup 是 30 個檔、7379 行的客製面板系統（`useMapInteraction` +
 * 各 layerType 專屬 panel），而且只覆蓋 38 種 layerType —— embed 支援 145 層，
 * 多數本來就沒有對應面板。把那套拉進來既撐大 bundle 也蓋不全。
 *
 * 這裡改走通用路線：**點到哪個 feature 就列出它的欄位**。犧牲主站的排版與單位格式化，
 * 換到「所有圖層都能點」與極小的體積。
 *
 * ⚠️ 安全：嵌入頁跑在別人的網站裡，properties 全部來自資料檔 ——
 *    一律 escape 後才進 innerHTML，不得直接拼接。
 */

/** 不值得顯示給讀者的欄位：內部 id、幾何殘留、繪圖用的衍生欄位 */
const HIDDEN_KEYS = new Set([
  // 幾何與繪圖用的衍生欄位
  "lon", "lat", "geom_json", "geometry", "kind_color", "days_ago", "shape_no",
  // 各式內部 id
  "osm_id", "id", "gid", "fid", "objectid", "entity_id", "uid", "code",
  // 資料血緣／後設 —— 對讀者無意義（出處已統一標在右下角）
  "source", "source_org", "source_url", "source_id", "dataset", "provider",
  "updated_at", "created_at", "fetched_at", "ingested_at", "version",
]);

/**
 * 用 pattern 擋後設欄位 —— 逐個列舉擋不完（各資料源的血緣欄位命名各異），
 * 而且新資料進來時會再冒出來。
 */
const HIDDEN_PATTERNS: RegExp[] = [
  /^source[_-]/, /[_-]source$/,      // source_tier / coord_source …
  /^license$/, /^confidence$/, /^score$/, /^rank$/,
  /[_-]tier$/, /^raw[_-]/, /[_-]id$/,
  /^is[_-]/, /[_-]flag$/,            // 旗標類：true 才有資訊，見 isEmpty
  /precision$/, /^geocode[_-]/,      // 地理編碼品質：內部品保用，不是給讀者看的
];

/** 常見欄位的中文標籤；查不到就用原 key（英文欄位名對讀者仍有基本可讀性） */
const FIELD_LABELS: Record<string, string> = {
  name: "名稱",
  name_zh: "名稱",
  address: "地址",
  operator: "營運者",
  capacity_mw: "裝置容量 (MW)",
  area_m2: "面積 (m²)",
  county: "縣市",
  town: "鄉鎮",
  type: "類型",
  category: "類別",
  status: "狀態",
  year: "年份",
  report_date: "通報日期",
  shape_kind: "形狀類型",
  kind_label: "類型",
  vertices: "頂點數",
  deity: "主祀神明",
  religion: "宗教",
  religion_type: "宗教類別",
  deity_family: "神明系統",
  main_deity: "主祀神明",
  denomination: "教派",
  phone: "電話",
  plant_source: "能源類型",
  plant_method: "發電方式",
  modules: "模組數",
};

export function escapeHtml(v: unknown): string {
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** 數字加千分位；其餘原樣（已 escape）。 */
function formatValue(v: unknown): string {
  if (v === true || v === "true") return "是";
  if (typeof v === "number" && Number.isFinite(v)) {
    return escapeHtml(Number.isInteger(v) ? v.toLocaleString("en-US") : v.toFixed(2));
  }
  return escapeHtml(v);
}

function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  // 布林 false 是噪音：「不是古蹟」「不在名錄」對讀者沒有資訊量，只有 true 值得列
  if (v === false || v === "false") return true;
  if (Array.isArray(v)) return v.length === 0;
  const t = typeof v === "string" ? v.trim() : v;
  // MVT/GeoJSON 常把空集合塞成字串；"[]" / "{}" 對讀者等同沒有值
  return t === "" || t === "null" || t === "[]" || t === "{}" || t === "undefined";
}

/**
 * 組 popup 的 HTML。最多列 `limit` 個欄位 —— 有些圖層帶數十個欄位，
 * 全列出來會把小小的嵌入框塞滿。
 */
export function buildPopupHtml(
  layerLabel: string,
  properties: Record<string, unknown>,
  isDark: boolean,
  limit = 8,
): string {
  const rows = Object.entries(properties)
    .filter(([k, v]) =>
      !HIDDEN_KEYS.has(k) &&
      !k.startsWith("_") &&
      !HIDDEN_PATTERNS.some((re) => re.test(k)) &&
      !isEmpty(v))
    .slice(0, limit)
    .map(([k, v]) => {
      const label = escapeHtml(FIELD_LABELS[k] ?? k);
      return `<div class="ep-row"><span class="ep-k">${label}</span><span class="ep-v">${formatValue(v)}</span></div>`;
    })
    .join("");

  const body = rows || `<div class="ep-empty">此圖徵沒有可顯示的欄位</div>`;
  return (
    `<div class="ep-wrap${isDark ? "" : " ep-light"}">` +
    `<div class="ep-title">${escapeHtml(layerLabel)}</div>` +
    body +
    `</div>`
  );
}

/** popup 樣式。MapLibre 原生 popup 預設是白底，暗色主題要整組覆寫。 */
export const POPUP_CSS = `
.maplibregl-popup-content {
  padding: 0; border-radius: 8px; overflow: hidden;
  box-shadow: 0 4px 18px rgba(0,0,0,.35);
  background: rgba(16,20,26,.96);
}
.maplibregl-popup-tip { border-top-color: rgba(16,20,26,.96) !important; border-bottom-color: rgba(16,20,26,.96) !important; }
.maplibregl-popup-close-button { color: #8b949e; font-size: 17px; padding: 2px 7px; }
.maplibregl-popup-close-button:hover { background: transparent; color: #fff; }
.ep-wrap {
  min-width: 168px; max-width: 264px; padding: 9px 11px 10px;
  font-family: system-ui, -apple-system, "Noto Sans TC", sans-serif;
  font-size: 12px; line-height: 1.5; color: #d7dee6;
}
.ep-title {
  font-weight: 700; font-size: 12.5px; color: #4fc3f7;
  margin-bottom: 6px; padding-bottom: 5px;
  border-bottom: 1px solid rgba(255,255,255,.1);
}
.ep-row { display: flex; gap: 10px; justify-content: space-between; padding: 1.5px 0; }
.ep-k { color: #8b949e; flex-shrink: 0; }
.ep-v { text-align: right; word-break: break-word; }
.ep-empty { color: #8b949e; }
.ep-light .ep-title { color: #0b5f8a; border-bottom-color: rgba(0,0,0,.1); }
.ep-light { color: #23292f; }
.ep-light .ep-k, .ep-light .ep-empty { color: #6b737b; }
`;

/** 淺色主題時，連 popup 外殼一起換色 */
export const POPUP_CSS_LIGHT = `
.maplibregl-popup-content { background: rgba(255,255,255,.97); }
.maplibregl-popup-tip { border-top-color: rgba(255,255,255,.97) !important; border-bottom-color: rgba(255,255,255,.97) !important; }
.maplibregl-popup-close-button { color: #888; }
.maplibregl-popup-close-button:hover { color: #222; }
`;
