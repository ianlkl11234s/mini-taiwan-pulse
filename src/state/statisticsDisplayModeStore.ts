import type { LayerVisibility } from "../types";
import {
  STATISTICS_CHOROPLETH_KEYS,
  isStatisticsChoropleth,
  type StatisticsChoroplethKey,
} from "../data/statisticsLayerRegistry";

export type StatisticsDisplayMode = "single" | "overlap";

/** URL 有明示模式時必定優先；舊連結只要列出統計面，安全 fallback 是 single。 */
export function resolveStatisticsModeForUrl(
  urlMode: StatisticsDisplayMode | undefined,
  hasStatisticsLayers: boolean,
): StatisticsDisplayMode | undefined {
  return urlMode ?? (hasStatisticsLayers ? "single" : undefined);
}

interface StatisticsDisplayModeSnapshot {
  mode: StatisticsDisplayMode;
  /** 由舊版 localStorage 寫入的單一最近 key，讀取時升級成 recency stack。 */
  lastEnabledKey: StatisticsChoroplethKey | null;
  /** 可見統計面由舊到新的啟用順序；關閉時移除，切回單一時取尾端。 */
  recentEnabledKeys: StatisticsChoroplethKey[];
}

type Listener = () => void;

const STORAGE_KEY = "mini-taiwan:statistics-display-mode:v1";
const DEFAULT_SNAPSHOT: StatisticsDisplayModeSnapshot = {
  mode: "single",
  lastEnabledKey: null,
  recentEnabledKeys: [],
};

function readPersisted(): StatisticsDisplayModeSnapshot {
  try {
    if (typeof localStorage === "undefined") return DEFAULT_SNAPSHOT;
    const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return DEFAULT_SNAPSHOT;
    const value = raw as Partial<StatisticsDisplayModeSnapshot>;
    const savedRecency = Array.isArray(value.recentEnabledKeys)
      ? value.recentEnabledKeys.filter((key): key is StatisticsChoroplethKey => isStatisticsChoropleth(key))
      : [];
    const legacyLast = typeof value.lastEnabledKey === "string" && isStatisticsChoropleth(value.lastEnabledKey) ? value.lastEnabledKey : null;
    const recentEnabledKeys = [...new Set([...savedRecency, ...(legacyLast ? [legacyLast] : [])])];
    return {
      mode: value.mode === "overlap" ? "overlap" : "single",
      lastEnabledKey: recentEnabledKeys[recentEnabledKeys.length - 1] ?? null,
      recentEnabledKeys,
    };
  } catch {
    return DEFAULT_SNAPSHOT;
  }
}

let snapshot = readPersisted();
const listeners = new Set<Listener>();

function persist() {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // localStorage 是可選的 enhancement（private mode / quota 失敗仍可正常使用）。
  }
}

function equalKeys(a: readonly StatisticsChoroplethKey[], b: readonly StatisticsChoroplethKey[]) {
  return a.length === b.length && a.every((key, index) => key === b[index]);
}

function publish(next: StatisticsDisplayModeSnapshot) {
  if (next.mode === snapshot.mode && next.lastEnabledKey === snapshot.lastEnabledKey && equalKeys(next.recentEnabledKeys, snapshot.recentEnabledKeys)) return;
  snapshot = next;
  persist();
  for (const listener of listeners) listener();
}

/**
 * 以 activation recency 選出保留層。沒有紀錄的 legacy / raw snapshot 才依 registry
 * 的順序取最後一個可見 key，讓 fallback 穩定可測。
 */
function visibleKeyToKeep(visibility: LayerVisibility): StatisticsChoroplethKey | null {
  return [...snapshot.recentEnabledKeys].reverse().find((key) => visibility[key])
    ?? [...STATISTICS_CHOROPLETH_KEYS].reverse().find((key) => visibility[key])
    ?? null;
}

function statisticsVisibility(keys: readonly StatisticsChoroplethKey[], visible: boolean): Partial<LayerVisibility> {
  return Object.fromEntries(keys.map((key) => [key, visible])) as Partial<LayerVisibility>;
}

export const statisticsDisplayModeStore = {
  getSnapshot(): StatisticsDisplayModeSnapshot {
    return snapshot;
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /** 將任意 visibility 快照送入唯一 admission gate，供歷史／preset／restore 使用。 */
  admitVisibility(next: LayerVisibility): LayerVisibility {
    const visible = STATISTICS_CHOROPLETH_KEYS.filter((key) => next[key]);
    const retainedRecency = visible.length === 0
      ? snapshot.recentEnabledKeys
      : snapshot.recentEnabledKeys.filter((key) => visible.includes(key));
    const recentEnabledKeys = [
      ...retainedRecency,
      ...visible.filter((key) => !snapshot.recentEnabledKeys.includes(key)),
    ];
    const tracked = {
      ...snapshot,
      lastEnabledKey: recentEnabledKeys[recentEnabledKeys.length - 1] ?? null,
      recentEnabledKeys,
    };
    publish(tracked);
    if (snapshot.mode === "overlap" || visible.length <= 1) return next;
    const keep = visibleKeyToKeep(next);
    return { ...next, ...statisticsVisibility(STATISTICS_CHOROPLETH_KEYS, false), ...(keep ? { [keep]: true } : {}) };
  },

  /** 開啟一個統計面；單一模式只保留此面，絕不觸碰一般 layer 或行政邊界線。 */
  enable(key: StatisticsChoroplethKey, current: LayerVisibility): LayerVisibility {
    const recentEnabledKeys = [...snapshot.recentEnabledKeys.filter((item) => item !== key), key];
    publish({ ...snapshot, lastEnabledKey: key, recentEnabledKeys });
    if (snapshot.mode === "overlap") return { ...current, [key]: true };
    return { ...current, ...statisticsVisibility(STATISTICS_CHOROPLETH_KEYS, false), [key]: true };
  },

  setVisible(key: StatisticsChoroplethKey, visible: boolean, current: LayerVisibility): LayerVisibility {
    if (visible) return this.enable(key, current);
    const recentEnabledKeys = snapshot.recentEnabledKeys.filter((item) => item !== key);
    publish({ ...snapshot, lastEnabledKey: recentEnabledKeys[recentEnabledKeys.length - 1] ?? null, recentEnabledKeys });
    return { ...current, [key]: false };
  },

  /** 統計 theme 的全開／全關也套用模式，避免批次操作繞過 admission gate。 */
  setBulk(keys: readonly StatisticsChoroplethKey[], visible: boolean, current: LayerVisibility): LayerVisibility {
    if (!visible) {
      let next = current;
      for (const key of keys) next = this.setVisible(key, false, next);
      return next;
    }
    let next = current;
    for (const key of keys) next = this.enable(key, next);
    return next;
  },

  setMode(mode: StatisticsDisplayMode, current: LayerVisibility): LayerVisibility {
    publish({ ...snapshot, mode });
    return this.admitVisibility(current);
  },

  /** 測試／重置用：回到預設模式並移除偏好。 */
  reset(): void {
    snapshot = DEFAULT_SNAPSHOT;
    try {
      if (typeof localStorage !== "undefined") localStorage.removeItem(STORAGE_KEY);
    } catch {
      // 同 persist：瀏覽器儲存不可用不影響記憶體中的預設狀態。
    }
    for (const listener of listeners) listener();
  },
};

export { STORAGE_KEY as STATISTICS_DISPLAY_MODE_STORAGE_KEY };
