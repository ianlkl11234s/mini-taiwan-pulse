import { useCallback } from "react";
import { useIntelPollingQuery } from "./useIntelPollingQuery";

/** Raw loaders must reject failures; null/[] are successful empty observations. */
export function useMonitorResource<T>({
  open, queryKey, intervalMs, emptyData, load,
}: {
  open: boolean;
  queryKey: string;
  intervalMs: number;
  emptyData: T;
  load: () => Promise<T>;
}) {
  const read = useCallback(async () => ({
    status: "ready" as const,
    data: await load(),
    lastSuccessAt: Date.now(),
  }), [load]);
  return useIntelPollingQuery({ enabled: open, queryKey, intervalMs, emptyData, load: read });
}
