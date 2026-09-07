import { useEffect, useRef, useState } from "react";
import { isAccessDenied } from "../lib/layerGates";

export type IntelQueryStatus = "unknown" | "ready" | "error" | "denied";

export interface IntelQueryResult<T> {
  status: Exclude<IntelQueryStatus, "unknown">;
  data: T;
  /** 最近一次成功讀取時間；error 時仍指向保留資料的時間。 */
  lastSuccessAt: number | null;
  message?: string | null;
}

export interface IntelQueryState<T> extends Omit<IntelQueryResult<T>, "status"> {
  status: IntelQueryStatus;
  queryKey: string;
}

export function initialIntelQueryState<T>(data: T, queryKey = ""): IntelQueryState<T> {
  return { status: "unknown", data, lastSuccessAt: null, message: null, queryKey };
}

/**
 * 只在同一個 query 的最新回應套用資料。
 * error 保留最後一次成功結果，但以 error 標記，呼叫端不可再把舊資料判成正常；
 * denied 則清掉可能受限的舊資料。
 */
export function applyIntelQueryResult<T>(
  previous: IntelQueryState<T>,
  result: IntelQueryResult<T>,
  emptyData: T,
): IntelQueryState<T> {
  if (result.status === "ready") return { ...result, queryKey: previous.queryKey };
  if (result.status === "denied") return { ...result, data: emptyData, lastSuccessAt: null, queryKey: previous.queryKey };
  return {
    ...result,
    data: previous.lastSuccessAt === null ? emptyData : previous.data,
    lastSuccessAt: previous.lastSuccessAt,
    queryKey: previous.queryKey,
  };
}

interface Options<T> {
  enabled: boolean;
  queryKey: string;
  intervalMs: number;
  emptyData: T;
  load: () => Promise<IntelQueryResult<T>>;
}

/**
 * 專給 Intel/Monitor 的小型 polling hook：同時只保留一個 RPC，卸載與 query
 * 切換後的舊回應不會覆寫新 query。慢請求結束後才排下一輪，避免 interval 堆疊。
 */
export function useIntelPollingQuery<T>({
  enabled, queryKey, intervalMs, emptyData, load,
}: Options<T>): IntelQueryState<T> {
  const [state, setState] = useState<IntelQueryState<T>>(() => initialIntelQueryState(emptyData, queryKey));
  const generationRef = useRef(0);
  const inFlightRef = useRef(false);
  const kickRef = useRef<() => void>(() => {});

  useEffect(() => {
    const generation = ++generationRef.current;
    let disposed = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    setState(initialIntelQueryState(emptyData, queryKey));

    const run = () => {
      if (disposed || !enabled || inFlightRef.current) return;
      inFlightRef.current = true;
      load()
        .then((result) => {
          if (!disposed && generation === generationRef.current) {
            setState((previous) => ({ ...applyIntelQueryResult(previous, result, emptyData), queryKey }));
          }
        })
        .catch((error: unknown) => {
          if (!disposed && generation === generationRef.current) {
            const message = error instanceof Error ? error.message : String(error ?? "讀取失敗");
            setState((previous) => ({ ...applyIntelQueryResult(previous, {
              status: isAccessDenied(error) ? "denied" : "error", data: emptyData, lastSuccessAt: null, message,
            }, emptyData), queryKey }));
          }
        })
        .finally(() => {
          inFlightRef.current = false;
          if (generation !== generationRef.current) {
            // query 在慢請求途中切換：舊請求結束後才啟動最新 query，絕不重疊。
            kickRef.current();
          } else if (!disposed) {
            timeout = globalThis.setTimeout(run, intervalMs);
          }
        });
    };
    kickRef.current = run;
    if (enabled) run();
    return () => {
      disposed = true;
      if (timeout !== undefined) globalThis.clearTimeout(timeout);
    };
  }, [enabled, queryKey, intervalMs, emptyData, load]);

  // effect 在 render 後才 reset；此 guard 避免 query 切換的那一幀拿舊範圍資料。
  return state.queryKey === queryKey ? state : initialIntelQueryState(emptyData, queryKey);
}
