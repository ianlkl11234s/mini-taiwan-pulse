/**
 * 縣市、鄉鎮市區名的顯示層翻譯（村里不翻）。對照表 `locales/{en,ja}/enums.place.json` 由
 * `scripts/i18n/gen-place-names.ts` 從內政部地名羅馬拼音 CSV 產生，不要手改。
 *
 * 同名鄉鎮（東區、中正區、大安區…分屬不同縣市）：
 * - 有代碼就傳代碼（縣市 5 碼、鄉鎮 8 碼，與統計 area_code 相同），最準
 * - 沒代碼時用「縣市＋鄉鎮」連寫（`臺北市中正區`），或用 `placeTown(county, town)`
 * - 單獨名稱只在所有同名者譯名相同時才查得到（中正區），其餘退回中文原文，不猜
 * 台／臺兩種寫法都查得到。查不到、或沒有中文的字串一律原樣回傳。
 */
import type { I18nContext } from "./layerText";

const CJK = /[㐀-鿿]/u;
const norm = (zh: string) => zh.trim().replace(/台/g, "臺");
const COUNTY_RE = /^(連江縣|金門縣|宜蘭縣|新竹縣|苗栗縣|彰化縣|南投縣|雲林縣|嘉義縣|屏東縣|臺東縣|花蓮縣|澎湖縣|基隆市|新竹市|嘉義市|臺北市|高雄市|新北市|臺中市|臺南市|桃園市)/;
const SEPARATORS = /[、，,／/；;]\s*/;

function lookupPlace(key: string, { lookup }: I18nContext): string | null {
  return lookup(`enum.place.${key}`);
}

/** 目前語系下「鄉鎮 + 縣市」的連接（英文倒過來加逗號，日文直接連寫） */
function join(county: string, town: string, active: I18nContext["active"]): string {
  return active === "en" ? `${town}, ${county}` : `${county}${town}`;
}

/**
 * 縣市或鄉鎮名 → 目前語系。可傳「臺北市」「板橋區」「臺北市中正區」；有代碼時優先用代碼。
 */
export function placeName(zh: string, i18n: I18nContext, code?: string | number | null): string {
  if (i18n.active === "zh-TW" || !CJK.test(zh)) return zh;
  if (code != null && /^\d{5}(\d{3})?$/.test(String(code))) {
    const byCode = lookupPlace(String(code), i18n);
    if (byCode) return byCode;
  }
  const key = norm(zh);
  // 縣市＋鄉鎮連寫：連寫 key 存的是鄉鎮譯名，要接回縣市；先於單獨名稱查，才不會丟掉縣市
  const county = COUNTY_RE.exec(key)?.[1];
  if (county && key.length > county.length) {
    const countyText = lookupPlace(county, i18n);
    const townText = lookupPlace(key, i18n);
    if (countyText && townText) return join(countyText, townText, i18n.active);
  }
  const whole = lookupPlace(key, i18n);
  if (whole) return whole;
  return zh;
}

/** 縣市＋鄉鎮分開給的資料（county／town 欄）：只翻鄉鎮部分，用縣市消除同名 */
export function placeTown(county: string, town: string, i18n: I18nContext, townCode?: string | number | null): string {
  if (i18n.active === "zh-TW" || !CJK.test(town)) return town;
  if (townCode != null) {
    const byCode = placeName(town, i18n, townCode);
    if (byCode !== town) return byCode;
  }
  return lookupPlace(norm(county) + norm(town), i18n) ?? placeName(town, i18n);
}

/** 以頓號／逗號／斜線分隔的地名清單（例：地檢署轄區的涵蓋縣市） */
export function placeNameList(zh: string, i18n: I18nContext): string {
  if (i18n.active === "zh-TW" || !CJK.test(zh)) return zh;
  const parts = zh.split(SEPARATORS).map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return zh;
  return parts.map((part) => placeName(part, i18n)).join(i18n.active === "ja" ? "、" : ", ");
}
