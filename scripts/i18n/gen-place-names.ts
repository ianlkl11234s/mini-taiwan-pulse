/**
 * 由內政部地名羅馬拼音 CSV 產生縣市／鄉鎮市區的英日文對照（locales/{en,ja}/enums.place.json）。
 *
 *   npx tsx scripts/i18n/gen-place-names.ts <place_name_romanization_moi_YYYYMMDD.csv>
 *
 * CSV 來自 taipei-gis-analytics `data/processed/base_map/place_name_romanization_moi/`
 * （說明：docs/data-catalog/base_map/place_name_romanization_moi.md）。只取 category=admin 的
 * 縣市（無 town 欄）與鄉鎮市區（有 town_code）；村里不做。
 *
 * key 三種（皆 `enum.place.` 開頭，查詢端見 src/i18n/placeText.ts）：
 * - `<代碼>`：縣市 5 碼、鄉鎮 8 碼（與 R2 統計 area_code 相同），可分辨同名的東區、中正區
 * - `<縣市><鄉鎮>`：該縣市底下的鄉鎮譯名（例：臺北市中正區 → 只有「中正區」的譯名；查詢端再接上縣市）
 * - `<名稱>`：單獨名稱，只在所有同名者譯名相同時才給（中正區在臺北與基隆都是 Zhongzheng District）
 * 一律用「臺」寫法；查詢端會把「台」換成「臺」。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..", "..");
const csvPath = process.argv[2];
if (!csvPath) throw new Error("用法：npx tsx scripts/i18n/gen-place-names.ts <csv>");

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false; } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (c !== "\r") cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows;
  return body.filter((r) => r.length === head!.length).map((r) => Object.fromEntries(head!.map((h, i) => [h, r[i]!])));
}

/** CSV 的「臺」「台」混用，key 一律用「臺」 */
const norm = (s: string) => s.replace(/台/g, "臺");
/** 新字體：臺→台、縣→県、區→区、鄉→郷（鎮、市維持） */
const toJa = (s: string) => norm(s).replace(/臺/g, "台").replace(/縣/g, "県").replace(/區/g, "区").replace(/鄉/g, "郷");

interface Place { code: string; county: string; town: string | null; en: string }

// 補充：CSV 沒有、但 R2 統計邊界用的鄉鎮（來源註記在 README／回報）。三民區：高雄市三民區，MOI 檔無此列。
const SUPPLEMENT: Place[] = [{ code: "64000050", county: "高雄市", town: "三民區", en: "Sanmin District" }];
// 新竹市三個區在 CSV 沒有 town_code；代碼取 R2 邊界（TOWN_MOI_1140318）
const HSINCHU_CITY_CODES: Record<string, string> = { 東區: "10018010", 北區: "10018020", 香山區: "10018030" };

const rows = parseCsv(readFileSync(csvPath, "utf8")).filter((r) => r.category === "admin");
const places: Place[] = [];
for (const r of rows) {
  if (!r.town && r.name === r.county) {
    places.push({ code: r.county_code, county: norm(r.county), town: null, en: r.suggested_romanization });
  } else if (r.town_code && r.name === r.town) {
    places.push({ code: r.town_code, county: norm(r.county), town: norm(r.town), en: r.suggested_romanization });
  } else if (r.town_code && r.name !== r.town && r.town.endsWith("市") && r.name.endsWith("鎮")) {
    // 鎮升格為市（頭份、員林）：CSV 的 name 仍是舊名，town 是新名；譯名把 Township 換成 City
    places.push({ code: r.town_code, county: norm(r.county), town: norm(r.town), en: r.suggested_romanization.replace(/ Township$/, " City") });
  } else if (r.county === "新竹市" && r.name in HSINCHU_CITY_CODES) {
    places.push({ code: HSINCHU_CITY_CODES[r.name]!, county: "新竹市", town: r.name, en: r.suggested_romanization });
  }
}
places.push(...SUPPLEMENT);

const byCode = new Map<string, Place>();
for (const p of places) byCode.set(p.code, p);
const all = [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code));
const counties = all.filter((p) => !p.town);
const towns = all.filter((p) => p.town);
if (counties.length !== 22) throw new Error(`縣市應為 22，實得 ${counties.length}`);
if (towns.length !== 368) throw new Error(`鄉鎮市區應為 368，實得 ${towns.length}`);

type Mapper = (p: Place, zh: string) => string;
function build(translate: Mapper): Record<string, string> {
  const out: Record<string, string> = {};
  const nameVariants = new Map<string, Set<string>>();
  const note = (name: string, value: string) => (nameVariants.get(name) ?? nameVariants.set(name, new Set()).get(name)!).add(value);
  for (const p of all) {
    const own = translate(p, p.town ?? p.county);
    out[`enum.place.${p.code}`] = own;
    note(p.town ?? p.county, own);
    if (p.town) out[`enum.place.${p.county}${p.town}`] = own;
  }
  for (const [name, values] of nameVariants) if (values.size === 1) out[`enum.place.${name}`] = [...values][0]!;
  return out;
}

const en = build((p) => p.en);
const ja = build((_p, zh) => toJa(zh));

for (const [locale, data] of [["en", en], ["ja", ja]] as const) {
  writeFileSync(join(root, `src/i18n/locales/${locale}/enums.place.json`), JSON.stringify(data, null, 2) + "\n");
  console.log(`${locale}: ${Object.keys(data).length} 筆`);
}
