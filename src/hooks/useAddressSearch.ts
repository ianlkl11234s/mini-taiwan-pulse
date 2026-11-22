import { useEffect, useMemo, useState } from "react";
import { useMemberGate } from "../lib/auth";
import { useLocale } from "../state/localeStore";
import type { PlaceSearchIndex } from "../lib/placeSearch";
import {
  buildAddressGazetteer, looksLikeAddress, resolveShardTargets, searchShard,
  type AddressGazetteer, type AddressHit, type AddressManifest,
} from "../lib/addressSearch";
import { loadAddressManifest, loadAddressRoads, loadAddressShard } from "../data/addressIndexLoader";
import { clearOwnerAddressCache, loadOwnerAddressCounty } from "../data/addressOwnerLoader";

export type AddressSearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; hits: AddressHit[]; manifest: AddressManifest; ownerFailed: boolean }
  | { status: "error" };

const LIMIT = 8;
/** 只打路名時最多同時抓幾片（中山路這類全台很多區都有） */
const MAX_SHARDS = 4;
const DEBOUNCE_MS = 200;
const LOADING_LABEL = {
  manifest: "addressSearch.loading.manifest",
  roads: "addressSearch.loading.roads",
  shard: "addressSearch.loading.shard",
  owner: "addressSearch.loading.owner",
} as const;

export async function runAddressSearch(
  query: string, g: AddressGazetteer, isOwner: boolean, label: (k: "manifest" | "roads" | "shard" | "owner") => string,
): Promise<{ hits: AddressHit[]; manifest: AddressManifest; ownerFailed: boolean }> {
  const manifest = await loadAddressManifest(label("manifest"));
  const scale = manifest.coord_scale;
  const codeByKey = new Map<string, string>();
  for (const [code, c] of Object.entries(manifest.counties)) codeByKey.set([...g.counties].find(([, name]) => name === c.name)?.[0] ?? c.name, code);
  let resolved = resolveShardTargets(g, query, codeByKey, null, MAX_SHARDS);
  if (resolved.needsRoads) resolved = resolveShardTargets(g, query, codeByKey, await loadAddressRoads(manifest, label("roads")), MAX_SHARDS);
  let ownerFailed = false;
  const perTarget = await Promise.all(resolved.targets.map(async ({ countyCode, townKey, parsed }) => {
    const county = manifest.counties[countyCode];
    const countyKey = [...g.counties].find(([, name]) => name === county?.name)?.[0];
    const town = countyKey ? g.towns.get(countyKey)?.get(townKey) : undefined;
    if (!county || !town) return [];
    const shard = await loadAddressShard(manifest, countyCode, town, label("shard"));
    const hits = shard
      ? searchShard({ countyCode, county: county.name, town, source: county.source.kind, shard }, parsed, scale, LIMIT)
      : [];
    if (isOwner) {
      try {
        const owner = await loadOwnerAddressCounty(countyCode, label("owner"));
        const ownerShard = owner?.get(town);
        if (ownerShard) {
          const seen = new Set(hits.map((h) => h.label));
          for (const h of searchShard({ countyCode, county: county.name, town, source: "owner", shard: ownerShard }, parsed, scale, LIMIT)) {
            if (!seen.has(h.label)) hits.push(h);
          }
        }
      } catch {
        ownerFailed = true;
      }
    }
    return hits;
  }));
  // 完整門牌命中優先於路段與「以此開頭」的建議
  const hits = perTarget.flat().sort((a, b) => Number(b.kind === "address") - Number(a.kind === "address"));
  return { hits: hits.slice(0, LIMIT), manifest, ownerFailed };
}

/** Locations 搜尋：輸入像門牌時才查門牌分片（懶載入）；站主登入時另查站主版。 */
export function useAddressSearch(query: string, placeIndex: PlaceSearchIndex | null): AddressSearchState {
  const { t } = useLocale();
  const { isOwner } = useMemberGate();
  const [state, setState] = useState<AddressSearchState>({ status: "idle" });
  const gazetteer = useMemo(
    () => (placeIndex ? buildAddressGazetteer(placeIndex.places.map((p) => ({ name: p.hit.label, kind: p.hit.kind, parent: p.hit.parent }))) : null),
    [placeIndex],
  );

  // 撤權（登出、換成非站主）時清掉站主分片快取，舊結果也一起丟掉（下一個 effect 會重查）
  useEffect(() => {
    if (!isOwner) clearOwnerAddressCache();
  }, [isOwner]);

  useEffect(() => {
    const q = query.trim();
    if (!gazetteer || !q || !looksLikeAddress(q)) { setState({ status: "idle" }); return; }
    let alive = true;
    setState({ status: "loading" });
    const timer = setTimeout(() => {
      runAddressSearch(q, gazetteer, isOwner, (k) => t(LOADING_LABEL[k])).then(
        (r) => { if (alive) setState({ status: "ready", ...r }); },
        () => { if (alive) setState({ status: "error" }); },
      );
    }, DEBOUNCE_MS);
    return () => { alive = false; clearTimeout(timer); };
  }, [query, gazetteer, isOwner, t]);

  return state;
}
