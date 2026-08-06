// Timeline 驅動「整日時序 → 依 currentTime 切片重畫」圖層的共用編排。
//
// 背景：rainGauge / riverLevel / groundwater / iotWraRiver 四個 hook 的
// attach 輪詢、loadDay、redraw、timeStore 訂閱、cleanup 完全相同（相似度
// ~95%），只差 layer 樣式與資料整形。這裡把編排抽成 controller（純函式、
// 可注入 mock map / timeStore 單元測試），hook 退化成 useEffect 薄包裝。
//
// 時間模型遵守 CLAUDE.md 規則 6：
//   - currentTime 不進 useEffect deps
//   - 跨日 subscribeDate、切片 subscribeThrottled、同步讀 getTime()

import { useEffect } from "react";
import type { Map as MapboxMap, GeoJSONSource } from "mapbox-gl";
import { keepLoadingUntilMapIdle } from "../../lib/loadingRegistry";
import { timeStore as realTimeStore } from "../../state/timeStore";
import { useMapReadyTick } from "../useMapReadyTick";

export interface TimelineSliceLayerConfig<D> {
  sourceId: string;
  /** 本圖層全部 style layer ids（visibility 切換用） */
  layerIds: string[];
  /** console log 前綴，如 "[RainGauge]" */
  consoleTag: string;
  /** loadingRegistry 的渲染 task id / label */
  loadingId: string;
  loadingLabel: string;
  /** 切片重畫節流（預設 500ms） */
  throttleMs?: number;
  /** 抓整日資料並整形成內部索引結構 D */
  loadDay(dateKey: string): Promise<D>;
  /** 空資料（換日清空用） */
  emptyData(): D;
  /** 依 currentTime 切片成 FeatureCollection */
  buildFC(data: D, t: number): GeoJSON.FeatureCollection;
  /** 建 source + layers（須冪等；source 不存在時自行 addSource） */
  ensureLayers(map: MapboxMap, isDark: boolean, scale: number, opacity: number): void;
  /** params / theme 變動時更新 paint */
  updatePaint(map: MapboxMap, isDark: boolean, scale: number, opacity: number): void;
  /** log 用資料量描述（選配） */
  describeData?(data: D): string;
}

/** timeStore 介面子集（測試可注入 mock） */
export interface TimeStoreLike {
  getTime(): number;
  getDateKey(): string;
  subscribeDate(cb: (key: string) => void): () => void;
  subscribeThrottled(ms: number, cb: (t: number) => void): () => void;
}

interface ControllerDeps {
  timeStore?: TimeStoreLike;
  /** attach 輪詢間隔（預設 200ms） */
  attachPollMs?: number;
  /** keepLoadingUntilMapIdle 注入點（測試替換） */
  keepLoading?: typeof keepLoadingUntilMapIdle;
}

/**
 * 啟動 controller（等同原 hook useEffect body）。回傳 dispose。
 * 呼叫端負責只在 visible=true 且 map 存在時啟動。
 */
export function startTimelineSliceController<D>(
  map: MapboxMap,
  config: TimelineSliceLayerConfig<D>,
  isDark: boolean,
  scale: number,
  opacity: number,
  deps: ControllerDeps = {},
): () => void {
  const ts = deps.timeStore ?? realTimeStore;
  const keepLoading = deps.keepLoading ?? keepLoadingUntilMapIdle;
  const throttleMs = config.throttleMs ?? 500;

  let cancelled = false;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let data: D = config.emptyData();
  let currentDate = "";

  const setVisibility = (visible: boolean) => {
    for (const id of config.layerIds) {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
      }
    }
  };

  const attach = () => {
    if (cancelled) return;
    if (!map.isStyleLoaded()) return;
    config.ensureLayers(map, isDark, scale, opacity);
    config.updatePaint(map, isDark, scale, opacity);
    setVisibility(true);
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  };

  if (map.isStyleLoaded()) attach();
  else pollTimer = setInterval(attach, deps.attachPollMs ?? 200);

  const redraw = () => {
    if (cancelled) return;
    const src = map.getSource(config.sourceId) as GeoJSONSource | undefined;
    if (!src) return;
    src.setData(config.buildFC(data, ts.getTime()));
  };

  const loadDay = async (dateKey: string) => {
    if (cancelled) return;
    try {
      const loaded = await config.loadDay(dateKey);
      // 換日競態：載入期間日期又變了 → 丟棄
      if (cancelled || currentDate !== dateKey) return;
      data = loaded;
      console.log(
        `${config.consoleTag} loaded ${config.describeData?.(loaded) ?? "day data"} (${dateKey})`,
      );
      redraw();
      keepLoading(map, config.loadingId, config.loadingLabel, config.sourceId);
    } catch (err) {
      console.warn(`${config.consoleTag} fetch failed:`, err);
    }
  };

  currentDate = ts.getDateKey();
  void loadDay(currentDate);

  const unsubDate = ts.subscribeDate((key) => {
    currentDate = key;
    data = config.emptyData();
    void loadDay(key);
  });
  const unsubTime = ts.subscribeThrottled(throttleMs, redraw);

  return () => {
    cancelled = true;
    if (pollTimer) clearInterval(pollTimer);
    unsubDate();
    unsubTime();
    if (config.layerIds.some((id) => map.getLayer(id))) {
      setVisibility(false);
    }
  };
}

/**
 * React hook 薄包裝：visible 時啟動 controller，deps 變動 / 卸載時 dispose。
 * 參數表沿用四個水文 hook 的既有慣例（mapRef, visible, isDark, scale, opacity）。
 */
export function useTimelineSliceLayer<D>(
  config: TimelineSliceLayerConfig<D>,
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  isDark: boolean,
  scale = 1,
  opacity = 1,
) {
  /** map 就緒通知：mapRef 是 ref，.current 變動不觸發 re-render（見 useMapReadyTick） */
  const mapTick = useMapReadyTick(mapRef, visible);

  useEffect(() => {
    if (!visible) return;
    const map = mapRef.current;
    if (!map) return;
    return startTimelineSliceController(map, config, isDark, scale, opacity);
    // config 為模組層常數，不進 deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapRef, visible, isDark, scale, opacity, mapTick]);
}
