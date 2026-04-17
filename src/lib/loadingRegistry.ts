/**
 * 全域 loading registry
 *
 * 用法：
 *   const { data } = await withLoading("disaster-alerts:2026-04-08", "災害示警 2026-04-08",
 *     supabase.rpc("get_disaster_alerts_day", { target_date: date })
 *   );
 *
 * UI 端用 useLoadingTasks() 訂閱當前進行中的任務列表。
 */

type Listener = () => void;

const active = new Map<string, number>();   // taskId → 同 id 同時併發 count
const labels = new Map<string, string>();   // taskId → 顯示文字
const listeners = new Set<Listener>();

let cachedSnapshot: LoadingTask[] = [];

function rebuildSnapshot() {
  const out: LoadingTask[] = [];
  for (const [id] of active) {
    out.push({ id, label: labels.get(id) ?? id });
  }
  cachedSnapshot = out;
}

function emit() {
  rebuildSnapshot();
  for (const l of listeners) l();
}

export interface LoadingTask {
  id: string;
  label: string;
}

export const loadingRegistry = {
  start(id: string, label: string): void {
    active.set(id, (active.get(id) ?? 0) + 1);
    labels.set(id, label);
    emit();
  },
  end(id: string): void {
    const n = (active.get(id) ?? 0) - 1;
    if (n <= 0) {
      active.delete(id);
      labels.delete(id);
    } else {
      active.set(id, n);
    }
    emit();
  },
  snapshot(): LoadingTask[] {
    return cachedSnapshot;
  },
  subscribe(l: Listener): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

/** 包裝 Promise / thenable（含 Supabase query builder）：自動 start / end */
export function withLoading<T>(id: string, label: string, p: PromiseLike<T>): Promise<T> {
  loadingRegistry.start(id, label);
  return Promise.resolve(p).finally(() => loadingRegistry.end(id));
}

/**
 * 在 Mapbox `setData` / `updateImage` 之後呼叫，延續 loading 狀態直到畫面實際更新完成。
 * 否則 withLoading 只涵蓋 RPC 返回，使用者會看到 loading 消失但資料還沒畫出來的空窗。
 *
 * 結束條件（任一）：
 *  - sourceId 指定時：map `sourcedata` 事件命中且 `isSourceLoaded`
 *  - sourceId null：map `idle` 事件（所有 source/render 完成）
 *  - timeout（預設 3000ms）超時保底，避免 stuck
 *
 * 注意：helper 會 `start(id, label)` 自己的 loading entry；呼叫端不要再包 withLoading。
 */
export function keepLoadingUntilMapIdle(
  map: {
    on: (type: string, cb: (e: unknown) => void) => void;
    off: (type: string, cb: (e: unknown) => void) => void;
    once: (type: string, cb: () => void) => void;
  },
  id: string,
  label: string,
  sourceId: string | null = null,
  timeoutMs = 3000,
): void {
  loadingRegistry.start(id, label);
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    loadingRegistry.end(id);
  };

  if (sourceId) {
    const onSourceData = (e: unknown) => {
      const evt = e as { sourceId?: string; isSourceLoaded?: boolean };
      if (evt.sourceId === sourceId && evt.isSourceLoaded) {
        map.off("sourcedata", onSourceData);
        finish();
      }
    };
    map.on("sourcedata", onSourceData);
    setTimeout(() => {
      map.off("sourcedata", onSourceData);
      finish();
    }, timeoutMs);
  } else {
    map.once("idle", finish);
    setTimeout(finish, timeoutMs);
  }
}
