/**
 * 產生 countries.generated.ts 的內容（腳本 scripts/countries/gen-countries.ts 與測試共用，確保兩邊口徑一致）。
 *
 * 正本是私有 repo pulse-data 的 countries/countries.json（網站與 MCP 共用的國家清單，2026-11-23）。
 * 產生檔只收網站要用的欄位，JSON 夾在兩個標記之間：pulse-data CI（scripts/check_countries.py --mini-generated）
 * 直接解析它比對正本；檔頭的 payload-sha256 讓本 repo 的測試不需要 pulse-data 也能抓到手改。
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

export const GENERATED_PATH = "src/constants/countries.generated.ts";
export const BEGIN = "// countries-json:begin";
export const END = "// countries-json:end";

interface SourceCountry {
  code: string;
  chip: string;
  timeZone: string;
  timeZones?: string[];
  ownerOnly?: true;
  camera: { center: [number, number]; zoom: number; pitch: number; bearing: number };
  bboxes: { bbox: [number, number, number, number]; label?: string }[];
}

const sha256 = (text: string | Buffer) => createHash("sha256").update(text).digest("hex");

/** 正本的網站投影：順序不變，框只留 [w,s,e,n]（與 pulse-data check_countries.py 的 web_projection 相同）。 */
export function webProjection(source: { countries: SourceCountry[] }) {
  return source.countries.map((country) => ({
    code: country.code,
    chip: country.chip,
    timeZone: country.timeZone,
    ...(country.timeZones ? { timeZones: country.timeZones } : {}),
    ...(country.ownerOnly ? { ownerOnly: true as const } : {}),
    camera: country.camera,
    bboxes: country.bboxes.map((entry) => entry.bbox),
  }));
}

/** 每國一個物件、每個框一行（diff 好讀）；必須是合法 JSON。 */
function renderPayload(source: { countries: SourceCountry[] }): string {
  const countries = webProjection(source).map((country) => {
    const { bboxes, ...rest } = country;
    const head = Object.entries(rest).map(([key, value]) => `    ${JSON.stringify(key)}: ${JSON.stringify(value)},`);
    const boxes = bboxes.map((box, i) => `      ${JSON.stringify(box)}${i === bboxes.length - 1 ? "" : ","}`);
    return ["  {", ...head, '    "bboxes": [', ...boxes, "    ]", "  }"].join("\n");
  });
  return `[\n${countries.join(",\n")}\n]`;
}

export function renderCountriesModule(sourceText: string): string {
  const source = JSON.parse(sourceText) as { countries: SourceCountry[] };
  const payload = renderPayload(source);
  return [
    "// ⚠️ 自動產生，請勿手改：PULSE_DATA_ROOT=<pulse-data> npx tsx scripts/countries/gen-countries.ts",
    "// 正本：pulse-data countries/countries.json（網站與 MCP 共用；陣列順序是語意，判國先比國家順序、再比框順序）",
    `// source-sha256: ${sha256(sourceText)}`,
    `// payload-sha256: ${sha256(payload)}`,
    "",
    `export type CountryCode = ${source.countries.map((country) => JSON.stringify(country.code)).join(" | ")};`,
    "",
    "/** 國名 i18n 鍵（common.json 的 country.*）；寫成字面值，i18n 的「沒人用的 key」檢查才找得到。 */",
    `export const COUNTRY_LABEL_KEYS = { ${source.countries.map((country) => `${country.code}: ${JSON.stringify(`country.${country.code}`)}`).join(", ")} } as const;`,
    "",
    "export interface GeneratedCountry {",
    "  code: CountryCode;",
    "  chip: string;",
    "  timeZone: string;",
    "  timeZones?: readonly string[];",
    "  ownerOnly?: true;",
    "  camera: { center: [number, number]; zoom: number; pitch: number; bearing: number };",
    "  bboxes: readonly (readonly [number, number, number, number])[];",
    "}",
    "",
    "export const GENERATED_COUNTRIES: readonly GeneratedCountry[] =",
    BEGIN,
    payload,
    END,
    ";",
    "",
  ].join("\n");
}

/** 從產生檔取出標記間的 JSON 原文與檔頭雜湊（測試用來抓手改）。 */
export function readGenerated(text: string): { payload: string; payloadSha: string | undefined; computedSha: string } {
  const start = text.indexOf(BEGIN);
  const end = text.indexOf(END);
  if (start < 0 || end < start) throw new Error(`${GENERATED_PATH} 找不到 ${BEGIN}／${END}`);
  const payload = text.slice(start + BEGIN.length, end).replace(/^\n/, "").replace(/\n$/, "");
  return { payload, payloadSha: /^\/\/ payload-sha256: ([0-9a-f]{64})$/m.exec(text)?.[1], computedSha: sha256(payload) };
}

/** 正本位置：PULSE_DATA_ROOT 優先（設了卻沒有檔就報錯）；否則隔壁 ../pulse-data，或 .worktrees/<x> 往上三層。 */
export function findCountriesSource(root: string): string | undefined {
  const env = process.env.PULSE_DATA_ROOT;
  if (env) {
    const file = resolve(env, "countries/countries.json");
    if (!existsSync(file)) throw new Error(`PULSE_DATA_ROOT 沒有 countries/countries.json：${file}`);
    return file;
  }
  return [resolve(root, "../pulse-data"), resolve(root, "../../../pulse-data")]
    .map((dir) => resolve(dir, "countries/countries.json"))
    .find((file) => existsSync(file));
}
