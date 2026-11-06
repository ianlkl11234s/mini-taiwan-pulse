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
import { inElectionRange, type ElectionRange } from "../data/electionEventsTypes";

/**
 * 2026 選舉活動（owner-only）資料供應 hook。
 *
 * - 一個 session 只打一次 RPC（module-level cache，無 TTL；資料每日人工更新）。
 * - 時間軸：訂閱 `timeStore.subscribeThrottled`（currentTime 不進 deps）。
 *   每次只重算「哪些已過時間軸時間（_past）」與「是否落在時間範圍內」，
 *   結果與上一次相同就不 setData；樣式全在 overlayRegistry（讀 `_past`），不在這裡改 paint。
 * - 未來的預定活動永遠照畫（這份資料的重點）；已過的變淡變小。
 * - 無權限（42501）靜默；函式尚未部署（PGRST202）只記一次 info。
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

/** 依時間軸時間 t 產生要上圖的 FeatureCollection（純函式，測試用） */
export function buildElectionDisplay(
  fc: GeoJSON.FeatureCollection,
  t: number,
  range: ElectionRange,
): { fc: GeoJSON.FeatureCollection; signature: string } {
  const features: GeoJSON.Feature[] = [];
  const sig: string[] = [];
  for (const f of fc.features) {
    const p = f.properties ?? {};
    const span = { start: Number(p.start_ts), end: Number(p.end_ts) };
    if (!inElectionRange(span, t, range)) continue;
    const past = span.end < t ? 1 : 0;
    features.push({ ...f, properties: { ...p, _past: past } });
    sig.push(`${String(p.event_id ?? features.length)}:${past}`);
  }
  return { fc: { type: "FeatureCollection", features }, signature: sig.join(",") };
}

export function useElectionEventsLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  range: ElectionRange,
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
        if (isAccessDenied(err)) return;
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
    let lastSig: string | null = null;
    const apply = (t: number) => {
      const next = buildElectionDisplay(data.fc, t, range);
      if (next.signature === lastSig) return;
      lastSig = next.signature;
      feed.set(next.fc);
    };
    apply(timeStore.getTime());
    const unsubscribe = timeStore.subscribeThrottled(TIME_THROTTLE_MS, apply);
    return () => {
      unsubscribe();
      feed.dispose();
    };
  }, [mapRef, mapTick, visible, data, range]);
}
