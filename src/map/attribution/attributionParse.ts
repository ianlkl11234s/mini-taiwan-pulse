/**
 * 圖層資料來源（source.attribution 字串）→ 依授權分組的清單。純函式，無 DOM 依賴。
 *
 * 字串內容不改（registry／hook 各自維護，常見格式「機關 資料名（data.gov.tw nid）· 授權」），
 * 這裡只負責「讀得懂就分組、讀不懂就原文放進其他」：
 * - 一串含多個來源時，以「 | 」或「；©」切開，各自成一筆。
 * - 授權：以最後一個「·」後段為準（須像授權名稱）；否則在全文找已知授權關鍵字；都沒有 → 其他。
 * - 含 `<a href>` 的字串（GFW 等 hook 自帶）：取連結文字與 http(s) 網址，其餘標籤一律去除；
 *   一段內有多個連結以「·」相接時，每個連結各成一筆（不丟掉第二個之後的連結），
 *   **不輸出任何 HTML**，元件以 React `<a>` 自行渲染。
 */

/** 解析不了授權時的分組鍵（顯示文字由 i18n 提供）。 */
export const OTHER_LICENSE = "__other__";

export interface AttributionEntry {
  /** 去重鍵（正規化後的單一來源原文） */
  key: string;
  /** 顯示文字：已去除 HTML 標籤與尾段授權 */
  text: string;
  /** 原始頁網址（http/https）；沒有則 null */
  url: string | null;
  /** 授權分組鍵；OTHER_LICENSE＝無法辨識 */
  license: string;
}

export interface AttributionGroup {
  license: string;
  entries: AttributionEntry[];
}

const OGDL_LABEL = "政府資料開放授權條款第1版";

/** 已知授權：pattern → 正規化名稱（順序即全文搜尋的優先序）。 */
const LICENSE_PATTERNS: ReadonlyArray<{ re: RegExp; label: (m: RegExpMatchArray) => string }> = [
  { re: /政府資料開放授權條款\s*(?:-\s*)?第\s*1\s*版/, label: () => OGDL_LABEL },
  { re: /\bODbL\b/i, label: () => "ODbL" },
  { re: /\bCC\s?BY(?:-(?:NC|SA|ND))*\s?\d\.\d\b/i, label: (m) => m[0].replace(/\s+/g, " ").replace(/^cc\s?by/i, "CC BY") },
  { re: /\bCC0\b/i, label: () => "CC0" },
  { re: /\bPublic Domain\b/i, label: () => "Public Domain" },
  { re: /公共データ利用規約\s*(?:第\s*)?1\.0|\bPDL\s?1\.0\b/, label: () => "公共データ利用規約1.0" },
];

function detectLicense(text: string): string | null {
  for (const { re, label } of LICENSE_PATTERNS) {
    const m = text.match(re);
    if (m) return label(m);
  }
  return null;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };
function decodeEntities(s: string): string {
  return s.replace(/&(amp|lt|gt|quot|apos|nbsp|#39);/g, (_, k: string) => ENTITIES[k] ?? _);
}

function safeHttpUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  const url = decodeEntities(raw.trim());
  return /^https?:\/\/[^\s"'<>]+$/i.test(url) ? url : null;
}

/** 去 HTML：取第一個 `<a href>` 的網址，剩下的標籤全部移除。 */
function stripHtml(raw: string): { text: string; href: string | null } {
  let href: string | null = null;
  const anchor = raw.match(/<a\b[^>]*?\bhref\s*=\s*(["'])(.*?)\1[^>]*>/i);
  if (anchor) href = safeHttpUrl(anchor[2]);
  const text = decodeEntities(raw.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
  return { text, href };
}

/** 一串 attribution 可能含多個來源（「 | 」或「；© OSM」相接）。 */
export function splitAttribution(raw: string): string[] {
  return raw
    .split(/\s+\|\s+|；(?=\s*©)/)
    // 一段內有多個 <a href>（例：「來源」與「利用條件」兩個連結以「·」相接）→ 各自成一筆，
    // 否則 stripHtml 只取第一個連結，其餘（授權／利用條件）連結會遺失
    .flatMap((piece) => piece.split(/(?<=<\/a>)\s*[·・]\s*(?=<a\b)/i))
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 單一來源片段 → entry。 */
export function parseAttributionPart(part: string): AttributionEntry | null {
  const { text: plain, href } = stripHtml(part);
  if (!plain) return null;
  let text = plain;
  let license: string | null = null;
  // 「 · 」前常是全形括號「）·」而沒有空格，所以只認「·」本身
  const cut = plain.lastIndexOf("·");
  if (cut > 0) {
    const tail = plain.slice(cut + 1).trim();
    const tailLicense = detectLicense(tail);
    if (tailLicense) {
      license = tailLicense;
      text = plain.slice(0, cut).trim();
    }
  }
  if (!license) license = detectLicense(plain);
  const nid = text.match(/data\.gov\.tw\s*(\d{3,})/);
  const url = href ?? (nid ? `https://data.gov.tw/dataset/${nid[1]}` : null);
  return { key: plain, text, url, license: license ?? OTHER_LICENSE };
}

/** 多個 attribution 原字串 → 去重後的 entries。 */
export function parseAttributions(raws: readonly string[]): AttributionEntry[] {
  const seen = new Map<string, AttributionEntry>();
  for (const raw of raws) {
    for (const part of splitAttribution(raw)) {
      const entry = parseAttributionPart(part);
      if (entry && !seen.has(entry.key)) seen.set(entry.key, entry);
    }
  }
  return [...seen.values()];
}

function licenseRank(license: string): number {
  if (license === OGDL_LABEL) return 0;
  if (license === "ODbL") return 1;
  if (license === OTHER_LICENSE) return 3;
  return 2;
}

/** 依授權分組：政府開放資料 → ODbL → 其他具名授權（字母序）→ 無法辨識。組內依文字排序。 */
export function groupAttributions(entries: readonly AttributionEntry[]): AttributionGroup[] {
  const groups = new Map<string, AttributionEntry[]>();
  for (const e of entries) {
    const list = groups.get(e.license);
    if (list) list.push(e);
    else groups.set(e.license, [e]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => licenseRank(a) - licenseRank(b) || a.localeCompare(b))
    .map(([license, list]) => ({ license, entries: [...list].sort((a, b) => a.text.localeCompare(b.text, "zh-Hant")) }));
}
