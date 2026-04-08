import { useSyncExternalStore } from "react";
import { loadingRegistry, type LoadingTask } from "../lib/loadingRegistry";

/** 訂閱當前所有 loading 任務（自動 re-render） */
export function useLoadingTasks(): LoadingTask[] {
  return useSyncExternalStore(
    loadingRegistry.subscribe,
    loadingRegistry.snapshot,
    loadingRegistry.snapshot,
  );
}
