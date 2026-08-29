import type { BenchRunExport } from "./metrics";

export const BENCH_RESULT_WINDOW_KEY = "__GFW_V4_BENCH_RESULT__" as const;

declare global {
  interface Window {
    readonly __GFW_V4_BENCH_RESULT__?: BenchRunExport | null;
  }
}

/** Local-bench-only read bridge for browser automation; no mutable control API. */
export function installBenchResultBridge(
  target: object,
  readLatest: () => BenchRunExport | null,
): () => void {
  const previous = Object.getOwnPropertyDescriptor(target, BENCH_RESULT_WINDOW_KEY);
  Object.defineProperty(target, BENCH_RESULT_WINDOW_KEY, {
    configurable: true,
    enumerable: false,
    get: readLatest,
  });
  return () => {
    if (previous) Object.defineProperty(target, BENCH_RESULT_WINDOW_KEY, previous);
    else Reflect.deleteProperty(target, BENCH_RESULT_WINDOW_KEY);
  };
}
