import { useEffect, useState } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import { timeStore } from "../state/timeStore";
import { useMapReadyTick } from "./useMapReadyTick";
import { feedDynamicSource } from "../map/dynamicSourceFeed";
import { isAccessDenied } from "../lib/layerGates";
import { registerOwnerGateReset } from "../lib/ownerGateRevoke";
import {
  fetchElectionEvents,
  isMissingRpc,
  setElectionEventsMeta,
  type ElectionEventsData,
} from "../data/electionEventsLoader";
import {
  inElectionRange,
  isElectionApproxPrecision,
  matchesElectionLocation,
  type ElectionApproxPrecision,
  type ElectionCampKey,
  type ElectionLocationFilter,
  type ElectionRange,
} from "../data/electionEventsTypes";
import {
  CATEGORY_FILTERS,
  CATEGORY_OTHER_VALUE,
  categoryDefs,
  categoryOptionId,
  categoryParamOptions,
} from "../data/categoryFilters";
import { allMultiSelectBitmask } from "../data/multiSelectMapbox";
import {
  electionGroupIconId,
  ensureElectionGroupIcon,
  isElectionGroupIconId,
  type ElectionGroupIconSpec,
} from "../map/electionGroupIcon";

/**
 * 2026 選舉活動（owner-only）資料供應 hook。
 *
 * - 一個 session 只打一次 RPC（module-level cache，無 TTL；資料每日人工更新）。
 * - 時間軸：訂閱 `timeStore.subscribeThrottled`（currentTime 不進 deps）。
 *   每次只重算「哪些已過時間軸時間（_past）」與「是否落在時間範圍內」，
 *   結果與上一次相同就不 setData；樣式全在 overlayRegistry（讀 `_past`），不在這裡改 paint。
 * - 未來的預定活動永遠照畫（這份資料的重點）；已過的變淡變小。
 * - 無權限（42501）靜默；函式尚未部署（PGRST202）只記一次 info。
 * - 位置精度（2026-11-08 設計稿 A＋B 版）：代表點（聚落／鄉鎮市區／縣市）依「精度＋座標」分組，
 *   不隨縮放；同一代表點只剩 1 場照常畫（overlay 另畫精度外環），2 場以上合成一個 `_grp` 圖徵，
 *   圖示由 map/electionGroupIcon.ts 依陣營比例畫。分組在「時間範圍、位置、陣營篩選」之後做，
 *   所以篩到只剩 1 場的代表點會回到單點。陣營篩選因此也在這裡套一次（overlay 的 group 子圖層不吃 V-4 filter）。
 * - 確切地點（地址／地標／路口）座標完全相同的 2 場以上也合成 `_grp`（2026-11-12：否則只點得到最上面那場）。
 *   key＝`venue|座標`，不分 address／landmark／intersection；座標用原始數值字串，與代表點分組同精度（不四捨五入）。
 *   圖示是不帶精度外環的實心分色圓（precision＝"venue"），和代表點看得出差別。
 */

const SOURCE_ID = "election-events-2026";
const TIME_THROTTLE_MS = 500;

let cache: ElectionEventsData | null = null;
let inflight: Promise<ElectionEventsData> | null = null;
let missingRpcLogged = false;
/** 撤權時遞增：撤權前發出、撤權後才回來的請求不得寫回 cache */
let generation = 0;

function loadOnce(): Promise<ElectionEventsData> {
  if (cache) return Promise.resolve(cache);
  if (inflight) return inflight;
  const gen = generation;
  const p = fetchElectionEvents()
    .then((d) => {
      if (gen !== generation) throw new Error("[ElectionEvents] access revoked");
      cache = d;
      inflight = null;
      setElectionEventsMeta(d.meta);
      return d;
    })
    .catch((err: unknown) => {
      if (inflight === p) inflight = null;
      throw err;
    });
  inflight = p;
  return p;
}

/** 撤權（登出／失去站主權限，review F088）：清 module cache 與圖例 meta */
export function clearElectionEventsCache(): void {
  generation += 1;
  cache = null;
  inflight = null;
  setElectionEventsMeta(null);
}

/**
 * 陣營多選（V-4，`electionEvents2026CatMask`）→ 判斷函式；全選回 null（不篩）。
 * 選項順序與 categoryFilters/groupE 相同（bitmask 位元順序）。
 */
export function electionCampPredicate(mask: number | undefined): ((campKey: string) => boolean) | null {
  const entry = CATEGORY_FILTERS.electionEvents2026;
  const def = entry ? categoryDefs(entry)[0] : undefined;
  if (!def) return null;
  const opts = categoryParamOptions(def);
  const all = allMultiSelectBitmask(opts.map((o) => o.value));
  const m = mask === undefined || !Number.isFinite(mask) ? all : Math.trunc(mask) & all;
  if (m === all) return null;
  const listed = new Set(def.options.map(categoryOptionId));
  const on = new Set(opts.filter((_, i) => (m & (1 << i)) !== 0).map((o) => o.value));
  return (k) => (listed.has(k) ? on.has(k) : on.has(CATEGORY_OTHER_VALUE));
}

export interface ElectionDisplayOptions {
  location?: ElectionLocationFilter;
  /** 陣營篩選（electionCampPredicate 的結果）；null／undefined＝全部 */
  camp?: ((campKey: string) => boolean) | null;
}

export interface ElectionDisplay {
  fc: GeoJSON.FeatureCollection;
  signature: string;
  /** 本次要用到的多場代表點圖示（id → 畫法） */
  icons: Map<string, ElectionGroupIconSpec>;
}

/** 同一地點多場的地名：取出現最多次的非空 location_text（同票取先出現者）；都沒有回 null */
function commonLocationText(list: GeoJSON.Feature[]): string | null {
  const counts = new Map<string, number>();
  for (const f of list) {
    const v = f.properties?.location_text;
    const s = typeof v === "string" ? v.trim() : "";
    if (s) counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [s, n] of counts) if (n > bestN) { best = s; bestN = n; }
  return best;
}

/** 依時間軸時間 t 產生要上圖的 FeatureCollection（純函式，測試用） */
export function buildElectionDisplay(
  fc: GeoJSON.FeatureCollection,
  t: number,
  range: ElectionRange,
  opts: ElectionDisplayOptions = {},
): ElectionDisplay {
  const location = opts.location ?? "all";
  const venues: GeoJSON.Feature[] = [];
  const groups = new Map<string, GeoJSON.Feature[]>();
  const sig: string[] = [];
  for (const f of fc.features) {
    const p = f.properties ?? {};
    const span = { start: Number(p.start_ts), end: Number(p.end_ts) };
    if (!inElectionRange(span, t, range)) continue;
    if (!matchesElectionLocation(p.location_precision, location)) continue;
    if (opts.camp && !opts.camp(String(p.camp_key ?? "other"))) continue;
    const past = span.end < t ? 1 : 0;
    const out: GeoJSON.Feature = { ...f, properties: { ...p, _past: past } };
    sig.push(`${String(p.event_id ?? sig.length)}:${past}`);
    if (f.geometry?.type === "Point") {
      const approx = isElectionApproxPrecision(p.location_precision);
      const k = `${approx ? p.location_precision : "venue"}|${f.geometry.coordinates.join(",")}`;
      const list = groups.get(k);
      if (list) list.push(out); else groups.set(k, [out]);
    } else {
      venues.push(out);
    }
  }
  const features: GeoJSON.Feature[] = [...venues];
  const icons = new Map<string, ElectionGroupIconSpec>();
  for (const list of groups.values()) {
    if (list.length === 1) { features.push(list[0]!); continue; }
    const counts: Partial<Record<ElectionCampKey, number>> = {};
    for (const f of list) {
      const k = String(f.properties?.camp_key ?? "other") as ElectionCampKey;
      counts[k] = (counts[k] ?? 0) + 1;
    }
    const allPast = list.every((f) => f.properties?._past === 1);
    const p0 = list[0]!.properties ?? {};
    const approx = isElectionApproxPrecision(p0.location_precision);
    const spec: ElectionGroupIconSpec = { counts, precision: approx ? (p0.location_precision as ElectionApproxPrecision) : "venue", allPast };
    const img = electionGroupIconId(spec);
    icons.set(img, spec);
    const events = list
      .map((f) => f.properties ?? {})
      .sort((a, b) => Number(b.start_ts) - Number(a.start_ts));
    features.push({
      type: "Feature",
      geometry: list[0]!.geometry,
      properties: {
        _grp: 1,
        _img: img,
        _past: allPast ? 1 : 0,
        n: list.length,
        location_precision: p0.location_precision,
        city: p0.city ?? null,
        town: p0.town ?? null,
        settlement_name: p0.settlement_name ?? null,
        // 確切地點：清單標題用的地名（各場最常見的地點寫法）
        location_text: approx ? null : commonLocationText(list),
        // Mapbox 會把巢狀陣列轉成字串，這裡直接存 JSON，popup 端解析
        events: JSON.stringify(events),
      },
    });
  }
  return { fc: { type: "FeatureCollection", features }, signature: sig.join(","), icons };
}

export function useElectionEventsLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  range: ElectionRange,
  location: ElectionLocationFilter = "all",
  campMask?: number,
) {
  const [data, setData] = useState<ElectionEventsData | null>(cache);
  const mapTick = useMapReadyTick(mapRef, visible);

  useEffect(() => registerOwnerGateReset(["electionEvents2026"], () => {
    clearElectionEventsCache();
    setData(null);
  }), []);

  useEffect(() => {
    if (!visible || data) return;
    let cancelled = false;
    loadOnce()
      .then((d) => { if (!cancelled) setData(d); })
      .catch((err: unknown) => {
        if (cancelled || isAccessDenied(err)) return;
        if (isMissingRpc(err)) {
          if (!missingRpcLogged) console.info("[ElectionEvents] get_election_events_2026 尚未部署，圖層暫無資料");
          missingRpcLogged = true;
          return;
        }
        console.warn("[ElectionEvents] load failed:", err);
      });
    return () => { cancelled = true; };
  }, [visible, data]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !visible || !data) return;
    const feed = feedDynamicSource(map, SOURCE_ID);
    const camp = electionCampPredicate(campMask);
    // 已畫過的多場圖示（換底圖後 style 清空 image → styleimagemissing 依此重畫）
    const iconSpecs = new Map<string, ElectionGroupIconSpec>();
    const onMissing = (e: { id: string }) => {
      const spec = iconSpecs.get(e.id);
      if (spec && isElectionGroupIconId(e.id)) ensureElectionGroupIcon(map, e.id, spec);
    };
    map.on("styleimagemissing", onMissing);
    let lastSig: string | null = null;
    const apply = (t: number) => {
      const next = buildElectionDisplay(data.fc, t, range, { location, camp });
      if (next.signature === lastSig) return;
      lastSig = next.signature;
      for (const [id, spec] of next.icons) {
        iconSpecs.set(id, spec);
        ensureElectionGroupIcon(map, id, spec);
      }
      feed.set(next.fc);
    };
    apply(timeStore.getTime());
    const unsubscribe = timeStore.subscribeThrottled(TIME_THROTTLE_MS, apply);
    return () => {
      unsubscribe();
      feed.dispose();
      map.off("styleimagemissing", onMissing);
    };
  }, [mapRef, mapTick, visible, data, range, location, campMask]);
}
