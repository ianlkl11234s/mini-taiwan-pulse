import { useEffect, useRef } from "react";
import { timeStore } from "../state/timeStore";
import {
  fetchJmaTimeCoverage, getJmaLiveStatus, jmaCoverageGate, jmaHumanError, jmaTimeRequest, setJmaLiveStatus,
  type JmaTimeRequest, type JmaTimedKey, type JmaTimedResult,
} from "../data/jmaLiveLoaders";

/**
 * JMA 時間軸驅動（點層、警報、梅雨共用）：
 *   - subscribeThrottled → 算時間桶；同一桶不重查（loader 端再有 per-bucket LRU 快取）
 *   - 往回拉：先查 get_jma_time_coverage，t 不在涵蓋期 → apply(null)＋狀態 uncovered，不打圖層 RPC
 *   - 停在現在：照 pollMs 輪詢（清掉 live 桶重查）；往回拉時不輪詢
 *   - 每次換桶都清掉舊結果：未涵蓋／失敗一律 apply(null)，不留上一個時刻的資料
 */

const SCRUB_THROTTLE_MS = 400;

export function useJmaTimeDriver<T>(opts: {
  visible: boolean;
  key: JmaTimedKey;
  pollMs: number;
  fetch: (req: JmaTimeRequest) => Promise<JmaTimedResult<T>>;
  invalidate: (req: JmaTimeRequest) => void;
  /** null＝清空（未涵蓋／失敗） */
  apply: (value: T | null, req: JmaTimeRequest | null) => void;
  /** 額外的重查觸發（例如 map 重新就緒） */
  tick?: unknown;
}) {
  const { visible, key, pollMs, tick } = opts;
  const fetchRef = useRef(opts.fetch);
  const invalidateRef = useRef(opts.invalidate);
  const applyRef = useRef(opts.apply);
  fetchRef.current = opts.fetch;
  invalidateRef.current = opts.invalidate;
  applyRef.current = opts.apply;

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let currentKey: string | null = null;
    let seq = 0;

    const load = (req: JmaTimeRequest, mySeq: number) => {
      const prev = getJmaLiveStatus(key);
      setJmaLiveStatus(key, { ...prev, state: "loading", message: undefined });
      fetchRef.current(req)
        .then((result) => {
          if (cancelled || mySeq !== seq) return;
          const mode = req.history ? "history" : "live";
          if (req.emptyIsUncovered && (result.status.rows ?? 0) === 0) {
            applyRef.current(null, req);
            setJmaLiveStatus(key, { state: "uncovered", uncovered: "no_rows", mode, asOf: req.at ?? undefined, loadedAt: Date.now(), rows: 0 });
            return;
          }
          applyRef.current(result.value, req);
          setJmaLiveStatus(key, { state: "ok", loadedAt: Date.now(), mode, asOf: req.at ?? undefined, ...result.status });
        })
        .catch((err) => {
          if (cancelled || mySeq !== seq) return;
          console.warn(`[jmaTime/${key}] load failed:`, err);
          applyRef.current(null, req);
          setJmaLiveStatus(key, { state: "error", message: jmaHumanError(err) });
        });
    };

    const run = (tSec: number, force = false) => {
      const nowSec = Date.now() / 1000;
      const req = jmaTimeRequest(key, tSec, nowSec);
      if (!force && req.cacheKey === currentKey) return;
      currentKey = req.cacheKey;
      const mySeq = ++seq;
      if (!req.history || !req.coverageLayer) { load(req, mySeq); return; }
      fetchJmaTimeCoverage()
        .catch(() => new Map())
        .then((cov) => {
          if (cancelled || mySeq !== seq) return;
          const layerCov = cov.get(req.coverageLayer!);
          const gate = jmaCoverageGate(layerCov, tSec, nowSec);
          if (gate !== "ok") {
            applyRef.current(null, req);
            setJmaLiveStatus(key, { state: "uncovered", uncovered: gate, mode: "history", asOf: req.at ?? undefined, coverageFrom: layerCov?.fromIso ?? null, loadedAt: Date.now(), rows: 0 });
            return;
          }
          load(req, mySeq);
        });
    };

    run(timeStore.getTime(), true);
    const unsub = timeStore.subscribeThrottled(SCRUB_THROTTLE_MS, (t) => run(t));
    const id = window.setInterval(() => {
      const t = timeStore.getTime();
      const req = jmaTimeRequest(key, t);
      if (req.history && key !== "jmaVolcanoes") return; // 歷史時刻不輪詢
      invalidateRef.current(req);
      run(t, true);
    }, pollMs);

    return () => {
      cancelled = true;
      unsub();
      window.clearInterval(id);
    };
  }, [visible, key, pollMs, tick]);
}
