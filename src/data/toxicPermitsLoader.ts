import { cachedByKey, cachedOnce } from "../lib/loaderCache";

/**
 * 毒化物運作 lookup（G19 決定 #7：併進污染潛勢設施 popup，不獨立成層）。
 * 資料：scripts/preprocess/build-toxic-permits-lookup.py → public/environment/toxic_permits/
 *   {首字母}.json：{ EMSNO: [化學物質索引[], 運作行為[], 有效許可數, 最大效期, "民國年-季"] }
 *   _chems.json：[[中文名, 英文名], ...]
 * 鍵＝upper(trim(emsno))；座標以污染設施為準（lookup 不帶座標）；統編不進 popup。
 */
export interface ToxicPermitInfo {
  chems: { zh: string; en: string }[];
  activities: string[];
  validPermits: number;
  latestEdate: string | null;
  /** 該設施最新出現的民國年與季，例 "115-2" */
  period: string;
}

type Entry = [number[], string[], number, string | null, string];

const chemList = cachedOnce(async (): Promise<[string, string][]> => {
  const res = await fetch("./environment/toxic_permits/_chems.json");
  if (!res.ok) throw new Error(`toxic chems ${res.status}`);
  return (await res.json()) as [string, string][];
}, 60 * 60_000);

const shard = cachedByKey(async (letter: string): Promise<Record<string, Entry>> => {
  const res = await fetch(`./environment/toxic_permits/${encodeURIComponent(letter)}.json`);
  if (res.status === 404) return {};
  if (!res.ok) throw new Error(`toxic shard ${letter} ${res.status}`);
  const text = await res.text();
  // dev server 對不存在的檔可能回 index.html（200）→ 視為無資料
  return text.trimStart().startsWith("{") ? (JSON.parse(text) as Record<string, Entry>) : {};
}, 60 * 60_000, 32);

export function normalizeEmsno(raw: unknown): string {
  return String(raw ?? "").trim().toUpperCase();
}

/** 查無（非毒化物運作場所或不在 EMS_S_05）回 null。 */
export async function fetchToxicPermits(emsno: unknown): Promise<ToxicPermitInfo | null> {
  const key = normalizeEmsno(emsno);
  if (!/^[A-Z0-9]/.test(key)) return null;
  const entry = (await shard(key[0]!))[key];
  if (!entry) return null;
  const chems = await chemList();
  const [chemIdx, activities, validPermits, latestEdate, period] = entry;
  return {
    chems: chemIdx.map((i) => ({ zh: chems[i]?.[0] ?? "", en: chems[i]?.[1] ?? "" })).filter((c) => c.zh),
    activities, validPermits, latestEdate, period,
  };
}
