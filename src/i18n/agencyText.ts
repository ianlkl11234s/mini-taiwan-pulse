/**
 * 發布機關與授權的顯示層翻譯。資料裡的機關、授權是人寫的自由文字（「經濟部水利署 (WRA)」「政府資料開放授權條款 1.0」
 * 「政府資料開放授權條款-第 1 版」…），所以先正規化再查表；查不到一律退回原文，不猜、不拼。
 *
 * - 統計配方／R2 的 publisher、license：`statisticsPublisher`／`statisticsLicense`（先查原文整句，再走通用規則）
 * - 資料來源總覽（Supabase data_catalog 的 provider_agency、license）：`catalogAgency`／`catalogLicense`
 *
 * 對照表在 `locales/{en,ja}/enums.{agency,agencySuffix,statPublisher,statLicense,license}.json`。
 * 授權只歸入 6 類（OGDL、CC BY、CC BY-SA、ODbL、未表示、未確認）；帶註記、混合或其他授權的長句原樣顯示。
 */
import type { I18nContext } from "./layerText";
import { placeName } from "./placeText";

const CJK = /[㐀-鿿]/u;
const COUNTY = "連江縣|金門縣|宜蘭縣|新竹縣|苗栗縣|彰化縣|南投縣|雲林縣|嘉義縣|屏東縣|臺東縣|花蓮縣|澎湖縣|基隆市|新竹市|嘉義市|臺北市|高雄市|新北市|臺中市|臺南市|桃園市";
const LOCAL_GOV = new RegExp(`^(${COUNTY})(?:政府)?(政府|環保局|環境保護局|消防局|交通局|衛生局|教育局|民政局|城鄉發展局|都市發展局|產業發展局|資訊局|工務局|建設局|交通處)?$`);
const SPLIT = /[、／/＋+→]/;

/** 台→臺、去空白、半形括號→全形、拿掉結尾的純英數括號（(WRA)、（NLSC）、（data.gov.tw）） */
export function normalizeAgency(zh: string): string {
  let text = zh.replace(/台/g, "臺").replace(/\s+/g, "").replace(/\(/g, "（").replace(/\)/g, "）").replace(/[。.]+$/u, "");
  for (let guard = 0; guard < 3; guard++) {
    const next = text.replace(/（[A-Za-z0-9,.:/_\-=+]*）$/u, "");
    if (next === text) break;
    text = next;
  }
  return text;
}

function agencyOne(key: string, i18n: I18nContext): string | null {
  const { lookup } = i18n;
  const hit = lookup(`enum.agency.${key}`);
  if (hit) return hit;
  const local = LOCAL_GOV.exec(key);
  if (local) {
    const place = placeName(local[1]!, i18n);
    const suffix = local[2] ?? "政府";
    const text = lookup(`enum.agencySuffix.${suffix}`);
    if (text) return `${place}${text}`;
  }
  return null;
}

/** 機關名（正規化後查表；「、」「／」「＋」連接的多機關需每一段都查得到才翻） */
export function agencyName(zh: string, i18n: I18nContext): string {
  if (i18n.active === "zh-TW" || !CJK.test(zh)) return zh;
  const key = normalizeAgency(zh);
  const whole = agencyOne(key, i18n);
  if (whole) return whole;
  const parts = key.split(SPLIT).filter(Boolean);
  if (parts.length > 1) {
    // 沒有中文的片段（data.taipei、TDX）本來就不用翻；其餘片段每一段都查得到才翻
    const translated = parts.map((part) => (CJK.test(part) ? agencyOne(part, i18n) : part));
    if (translated.every((part): part is string => part != null)) {
      return translated.join(key.includes("→") ? " → " : i18n.active === "ja" ? "、" : "; ");
    }
  }
  return zh;
}

/** 統計配方／R2 的發布機關：先查整句（含註記的長句），再走通用機關規則 */
export function statisticsPublisher(zh: string, i18n: I18nContext): string {
  if (i18n.active === "zh-TW" || !CJK.test(zh)) return zh;
  return i18n.lookup(`enum.statPublisher.${zh}`) ?? agencyName(zh, i18n);
}

/** 資料來源總覽的機關（Supabase data_catalog.provider_agency） */
export const catalogAgency = agencyName;

type LicenseCategory = "ogdl" | "ccBy" | "ccBySa" | "odbl" | "unspecified" | "unverified";

const OGDL_CORE = "(?:政府資料開放授權條款|政府資料開放授權|OGDL-Taiwan-1\\.0)";
const OGDL = new RegExp(
  `^${OGDL_CORE}(?:-?第1版|1\\.0|v1)?(?:OGDL-Taiwan-1\\.0)?(?:（(?:OGDL-Taiwan-1\\.0|政府資料開放授權條款1\\.0|政府資料開放授權條款|data\\.gov\\.tw(?:license=1|上架)?)）)?$`,
);

/** 去空白與 markdown 記號，破折號統一，括號全形 */
function normalizeLicense(zh: string): string {
  return zh
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*⚠️]/gu, "")
    .replace(/\s+/g, "")
    .replace(/[－—–‑]/g, "-")
    .replace(/\(/g, "（").replace(/\)/g, "）")
    .replace(/[。;；]+$/u, "");
}

function classifyLicense(zh: string): { category: LicenseCategory; version?: string } | null {
  const text = normalizeLicense(zh);
  if (OGDL.test(text)) return { category: "ogdl" };
  if (/^CC-?BY-?4\.0$/i.test(text)) return { category: "ccBy" };
  const sa = /^CC-?BY-?SA-?(\d\.\d)$/i.exec(text);
  if (sa) return { category: "ccBySa", version: sa[1] };
  if (/^ODbL(?:-?1\.0)?(?:（OpenDatabaseLicense）)?$/i.test(text)) return { category: "odbl" };
  if (/^(?:unknown|unspecified|未標示)$/i.test(text)) return { category: "unspecified" };
  if (/^unverified$/i.test(text)) return { category: "unverified" };
  return null;
}

/**
 * 授權（資料來源總覽用）：歸類得出來的換成固定譯名，其餘（帶註記、混合、其他授權）原樣。
 * 純英文縮寫（OGDL-Taiwan-1.0、ODbL 1.0）也會換成可讀的全名，日文介面才看得懂。
 */
export function catalogLicense(zh: string, { active, lookup }: I18nContext): string {
  if (active === "zh-TW") return zh;
  const hit = classifyLicense(zh);
  if (!hit) return zh;
  const label = lookup(`enum.license.${hit.category}`);
  if (!label) return zh;
  return hit.version ? `${label} ${hit.version}` : label;
}

/** 統計配方／R2 的授權：先查整句（含註記的長句），再走歸類，最後退回原文 */
export function statisticsLicense(zh: string, i18n: I18nContext): string {
  if (i18n.active === "zh-TW") return zh;
  const exact = i18n.lookup(`enum.statLicense.${zh.trim()}`);
  if (exact) return exact;
  const page = /^政府資料開放授權條款第 ?1 ?版（依 ?data\.gov\.tw (\d+) 資料集頁標示）$/.exec(zh.trim());
  if (page) {
    const text = i18n.lookup("enum.statLicense.ogdlDatasetPage");
    if (text) return text.replace("{id}", page[1]!);
  }
  return catalogLicense(zh, i18n);
}
