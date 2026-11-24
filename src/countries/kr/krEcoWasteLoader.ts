// 南韓 KRH-1 靜態 JSON（public/world/，deploy-assets／R2）：生態自然圖分片索引、垃圾排出規則。各抓一次、模組快取。
import { withLoading } from "../../lib/loadingRegistry";
import { KR_ECO_INDEX_FILE, KR_ECO_TEXT, KR_WASTE_RULES_FILE, KR_WASTE_TEXT, type KrEcoIndexFile, type KrWasteRulesFile } from "./krEcoWasteTypes";

const url = (file: string) => `${import.meta.env.BASE_URL ?? "/"}world/${file}`;

async function getJson<T>(file: string): Promise<T> {
  const res = await fetch(url(file));
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

let ecoIndex: Promise<KrEcoIndexFile[]> | null = null;
let ecoIndexValue: KrEcoIndexFile[] | null = null;
/** 失敗時清掉快取，下次開圖層重試。 */
export function loadKrEcoIndex(): Promise<KrEcoIndexFile[]> {
  ecoIndex ??= withLoading("kr-eco-nature-index", KR_ECO_TEXT.loading.zh, getJson<{ files: KrEcoIndexFile[] }>(KR_ECO_INDEX_FILE).then((d) => d.files))
    .then((files) => { ecoIndexValue = files; return files; })
    .catch((err) => { ecoIndex = null; throw err; });
  return ecoIndex;
}

/** 已載入的分片索引（popup 同步讀；還沒載入回 null）。 */
export const krEcoIndexNow = () => ecoIndexValue;

let wasteRules: Promise<KrWasteRulesFile> | null = null;
let wasteRulesValue: KrWasteRulesFile | null = null;
export function loadKrWasteRules(): Promise<KrWasteRulesFile> {
  wasteRules ??= withLoading("kr-waste-rules", KR_WASTE_TEXT.loading.zh, getJson<KrWasteRulesFile>(KR_WASTE_RULES_FILE))
    .then((d) => { wasteRulesValue = d; return d; })
    .catch((err) => { wasteRules = null; throw err; });
  return wasteRules;
}
/** 已載入的規則（popup 同步讀；還沒載入回 null）。 */
export const krWasteRulesNow = () => wasteRulesValue;
