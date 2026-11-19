/**
 * 私人圖層存取探測的快取：只快取「明確」的授權結果（200 allowed／401／403／404），
 * 網路錯誤、5xx 等暫時性失敗不留在快取，下次探測可重試（review 2026-11-18 F016／F019）。
 */
export type ProbeOutcome = { allowed: boolean; definitive: boolean };

export function cachedAccessProbe(
  cache: Map<string, Promise<boolean>>,
  id: string,
  run: () => Promise<ProbeOutcome>,
): Promise<boolean> {
  const hit = cache.get(id);
  if (hit) return hit;
  const promise: Promise<boolean> = run().then(
    (outcome) => {
      if (!outcome.definitive && cache.get(id) === promise) cache.delete(id);
      return outcome.allowed;
    },
    (error) => {
      if (cache.get(id) === promise) cache.delete(id);
      throw error;
    },
  );
  cache.set(id, promise);
  return promise;
}

/** HTTP 狀態是否為明確授權結果（200 或 401／403／404）。 */
export const isDefinitiveAccessStatus = (status: number): boolean => status === 200 || status === 401 || status === 403 || status === 404;
