import { useCallback, useEffect, useRef } from "react";
import type { Map as MapboxMap, ImageSource } from "mapbox-gl";
import { useMapReadyTick } from "./useMapReadyTick";
import { timeStore } from "../state/timeStore";
import { withLoading, keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import {
  loadClimateManifest,
  pickNearestFrame,
  frameImageUrl,
  FRAME_PICK_TOLERANCE_MS,
  type ClimateFrame,
} from "../data/climateFrames";

interface DustMeta {
  width: number;
  height: number;
  bbox: [number, number, number, number]; // [lonMin, latMin, lonMax, latMax]
  dust_min: number;
  dust_max: number;
  dataset: string;
  valid_at: string;
}

const SOURCE_ID = "dust-forecast-img";
const LAYER_ID = "dust-forecast-raster";

/** manifest.datasets 的 key（上游 climate_bake 尚未產出時 → 走 dust_latest fallback）。 */
const FRAME_DATASET = "dust";
/** 換幀節流：同 useClimateParticleLineLayer，400ms 已足夠平滑。 */
const FRAME_THROTTLE_MS = 400;

/**
 * 沙塵預報 raster overlay（CAMS duaod550，PNG 已預烤棕色色階 + alpha mask）。
 *
 * 時間軸：manifest 有 `datasets.dust` → 依 timeline 時間換 image source 的 URL；
 * 沒有（目前 S3 只烤 dust_latest）→ 維持 dust_latest.png 一次性行為（graceful fallback）。
 * 有 frames 但 timeline 落在窗口外（超過 {@link FRAME_PICK_TOLERANCE_MS}）→ 隱藏圖層
 * 表示「這段沒資料」，而不是默默留著一張過期的圖。
 *
 * 鐵則：currentTime 不進 React deps，一律走 timeStore 訂閱（見 docs/TIMELINE_ARCHITECTURE.md）。
 */
export function useDustForecastLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
) {
  /** map 就緒通知：mapRef 是 ref，.current 變動不觸發 re-render（見 useMapReadyTick） */
  const mapTick = useMapReadyTick(mapRef, visible);

  const visibleRef = useRef(visible);
  const opacityRef = useRef(opacity);
  /** 有 frames 但當前時間無可用幀 → 隱藏（與 visible 一起決定實際 visibility）。 */
  const noDataRef = useRef(false);
  visibleRef.current = visible;
  opacityRef.current = opacity;

  const applyStyle = useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer(LAYER_ID)) return;
    const show = visibleRef.current && !noDataRef.current;
    map.setLayoutProperty(LAYER_ID, "visibility", show ? "visible" : "none");
    map.setPaintProperty(LAYER_ID, "raster-opacity", opacityRef.current);
    // mapTick：map 首載較晚就緒時換一份新 callback，讓下面兩個 effect 一起重跑
  }, [mapRef, mapTick]);

  // 載 meta + 加 image source；有 frames 就訂閱 timeline 換幀
  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      console.log("[DustForecast] mapRef.current=null，等下次 visible 變化");
      return;
    }
    if (!visible) {
      console.log("[DustForecast] visible=false，延後 addLayer");
      return;
    }
    let cancelled = false;
    let frames: ClimateFrame[] = [];
    /** 已套用的幀 png（null = 目前顯示 dust_latest 或尚未套幀）。 */
    let currentKey: string | null = null;
    let unsubDate: (() => void) | null = null;
    let unsubThrottled: (() => void) | null = null;

    /** 換 image source 的 URL；source 尚未就緒回 false（由 ensureLayer 完成後補套）。 */
    const applyFrame = (frame: ClimateFrame): boolean => {
      const src = map.getSource(SOURCE_ID) as ImageSource | undefined;
      if (!src || typeof src.updateImage !== "function") return false;
      src.updateImage({ url: frameImageUrl(frame) });
      keepLoadingUntilMapIdle(map, "dust-forecast-frame", "沙塵預報幀", SOURCE_ID);
      return true;
    };

    const setNoData = (next: boolean) => {
      if (noDataRef.current === next) return;
      noDataRef.current = next;
      applyStyle();
    };

    const selectForTime = (tSec: number) => {
      if (cancelled || frames.length === 0) return;
      const frame = pickNearestFrame(frames, tSec * 1000, FRAME_PICK_TOLERANCE_MS);
      if (!frame) {
        // 窗口外 → 誠實顯示「無資料」（隱藏），並清 currentKey 讓回到窗口內時必定重套
        currentKey = null;
        setNoData(true);
        return;
      }
      if (frame.png === currentKey) {
        setNoData(false);
        return;
      }
      if (!applyFrame(frame)) return; // source 未就緒 → 不記 currentKey，稍後由 ensureLayer 補
      currentKey = frame.png;
      setNoData(false);
      // 預載相鄰 ±1 幀（只暖瀏覽器快取）
      const idx = frames.indexOf(frame);
      for (const j of [idx - 1, idx + 1]) {
        if (j >= 0 && j < frames.length) new Image().src = frameImageUrl(frames[j]!);
      }
    };

    const ensureLayer = async () => {
      if (cancelled) return;
      // 已存在 → 不重複加
      if (map.getLayer(LAYER_ID)) return;
      try {
        const meta: DustMeta = await withLoading(
          "dust-forecast-meta",
          "沙塵預報中繼資料",
          fetch("./climate/dust_latest.json", { cache: "no-cache" }).then((r) => r.json()),
        );
        if (cancelled) return;
        const [lonMin, latMin, lonMax, latMax] = meta.bbox;
        // valid_at 帶進 PNG URL 破快取（S3 每日重烤 → 前端追得上）
        const pngUrl = "./climate/dust_latest.png" + (meta.valid_at ? `?v=${encodeURIComponent(meta.valid_at)}` : "");
        if (!map.getSource(SOURCE_ID)) {
          map.addSource(SOURCE_ID, {
            type: "image",
            url: pngUrl,
            coordinates: [
              [lonMin, latMax], // top-left
              [lonMax, latMax], // top-right
              [lonMax, latMin], // bottom-right
              [lonMin, latMin], // bottom-left
            ],
          });
        }
        if (!map.getLayer(LAYER_ID)) {
          map.addLayer({
            id: LAYER_ID,
            type: "raster",
            source: SOURCE_ID,
            paint: {
              "raster-opacity": opacityRef.current,
              "raster-resampling": "linear",
              "raster-fade-duration": 0,
            },
          });
        }
        console.log(`[DustForecast] ready: ${meta.width}×${meta.height} bbox=[${meta.bbox.join(", ")}] AOD∈[${meta.dust_min.toFixed(3)}, ${meta.dust_max.toFixed(3)}]`);
        // source 重建（首次 / style.load 重掛）後畫的是 latest → 重置 currentKey 再補套當前幀
        currentKey = null;
        applyStyle();
        selectForTime(timeStore.getTime());
      } catch (e) {
        console.warn("[DustForecast] load failed:", e);
      }
    };

    if (map.isStyleLoaded()) void ensureLayer();
    else map.once("load", ensureLayer);
    map.on("style.load", ensureLayer);

    // ── Time-aware 換幀（timeStore 訂閱；鐵則：currentTime 不進 React deps）──
    void (async () => {
      const manifest = await loadClimateManifest();
      if (cancelled || !manifest) return; // 無 manifest → fallback（dust_latest 已顯示）
      const ds = manifest.datasets[FRAME_DATASET];
      if (!ds || ds.frames.length === 0) {
        console.log("[DustForecast] manifest 無 dust frames → 維持 dust_latest");
        return;
      }
      frames = ds.frames;
      console.log(`[DustForecast] frames=${frames.length} ${frames[0]!.t} → ${frames[frames.length - 1]!.t}`);
      selectForTime(timeStore.getTime()); // 初始套用
      // 跨日 + 同日 scrub：兩種訂閱都掛（selectForTime idempotent，key 沒變不動作）
      unsubDate = timeStore.subscribeDate(() => selectForTime(timeStore.getTime()));
      unsubThrottled = timeStore.subscribeThrottled(FRAME_THROTTLE_MS, (t) => selectForTime(t));
    })();

    return () => {
      cancelled = true;
      unsubDate?.();
      unsubThrottled?.();
      noDataRef.current = false;
      map.off("style.load", ensureLayer);
      try {
        if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      } catch { /* style 已沒 */ }
    };
  }, [mapRef, visible, mapTick, applyStyle]);

  // visibility / opacity 即時切
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    applyStyle();
    map.on("style.load", applyStyle);
    return () => { map.off("style.load", applyStyle); };
  }, [mapRef, visible, opacity, mapTick, applyStyle]);
}
