/**
 * `/embed` — 給文章嵌入用的極簡地圖（EM-06）
 *
 * 與主站的關係：**共用資料與圖層邏輯，不共用地圖引擎與 UI**。
 * - 共用：`overlayRegistry`（189 個圖層定義）、`overlayManager`（source/layer/paint）、`LegendPanel`
 * - 不共用：地圖引擎（這裡是 MapLibre，主站是 mapbox-gl）、`App.tsx` 的 3000 行狀態機
 *
 * 刻意不做的事：
 * - 不呼叫 `useTransportParams`（3028 行）—— 參數全部由網址帶入，未指定者落到各 paint 的
 *   `?? fallback` 預設值
 * - 沒有圖層開關 UI —— 顯示什麼由網址決定，讀者不該能改
 *
 * EM-16 例外：**回放圖層**（`layers=flights&date=…`）會 `import()` 進 Three.js。
 * 只有這種網址才載，純靜態嵌入的基礎 bundle 依然不含 three。
 */
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { parseUrlState } from "../lib/urlState";
import { EMBED_ALLOWED, buildEmbedVisibility, configsFor } from "./embedWhitelist";
import { registerPmtilesProtocolOnce, maplibrePmtilesSource } from "./maplibreAdapters";
import { EMBED_CDN_LAYERS, fetchCdnLayer } from "./dynamicCdnLayers";
import { SNAPSHOT_LAYERS, fetchSnapshot } from "./snapshotLayers";
import { isReplayLayer } from "./replayLayers";
import { replayClock, formatReplayClock } from "./replayClock";
import { buildPopupHtml, POPUP_CSS, POPUP_CSS_LIGHT } from "./embedPopup";
import { LAYER_LABELS } from "../components/sidebar/layerCatalog";
import type { LayerVisibility } from "../types";
import { buildBasemapStyle } from "./basemapStyle";
import {
  addAllOverlays, hydrateOverlayIfNeeded, updateAllOverlayThemes,
} from "../map/overlayManager";
import { LegendPanel } from "../components/LegendPanel";

/**
 * 回放播放列（EM-16）。極簡：一顆播放/暫停 + `HH:MM`（台北時區）。
 *
 * 刻意**不做 scrubber** —— 嵌入版的定位是「文章裡的一格畫面」，拖曳互動屬於主站。
 * （follow-up：真的需要時再加，`replayClock.seek()` 已經備好。）
 */
function ReplayControls({ isDark }: { isDark: boolean }) {
  const snap = useSyncExternalStore(replayClock.subscribe, replayClock.getSnapshot);
  const fg = isDark ? "#e6edf3" : "#1a1d21";
  return (
    <div
      style={{
        position: "absolute", left: 8, bottom: 8, zIndex: 5,
        display: "flex", alignItems: "center", gap: 8,
        background: isDark ? "rgba(12,16,22,.82)" : "rgba(255,255,255,.9)",
        border: `1px solid ${isDark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.12)"}`,
        borderRadius: 6, padding: "4px 9px",
        backdropFilter: "blur(6px)", fontFamily: "system-ui, sans-serif",
      }}
    >
      <button
        type="button"
        onClick={() => replayClock.toggle()}
        aria-label={snap.playing ? "暫停 Pause" : "播放 Play"}
        style={{
          background: "none", border: "none", cursor: "pointer",
          color: fg, fontSize: 13, lineHeight: 1, padding: 0,
        }}
      >
        {snap.playing ? "❚❚" : "▶"}
      </button>
      <span
        style={{
          color: fg, fontSize: 12, letterSpacing: ".04em",
          fontVariantNumeric: "tabular-nums", minWidth: 40,
        }}
      >
        {formatReplayClock(snap.time)}
      </span>
    </div>
  );
}

const SITE = "https://mini-taiwan-pulse.itsmigu.com/";
/** 主站底圖 id 中屬於「淺色」的（與 App.tsx 的 isDarkTheme 判準一致） */
const LIGHT_STYLE_IDS = new Set(["light", "streets"]);

/** 預設視角：全台 */
const FALLBACK_CAMERA = { center: [120.9, 23.7] as [number, number], zoom: 6.9, pitch: 0, bearing: 0 };

export function EmbedApp() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);
  // 回放真的跑起來才顯示播放列 —— 快照 404 時不該留一顆按不動的孤兒按鈕
  const [replayOn, setReplayOn] = useState(false);

  // 網址只在 mount 時解析一次（嵌入頁沒有會改變它的互動）
  const urlRef = useRef(parseUrlState(window.location.search, { allowedLayers: EMBED_ALLOWED }));
  const url = urlRef.current;
  // 明暗來源有兩個：`theme=`（embed 專用）與 `style=`（主站底圖 id，分享按鈕會帶）。
  // 主站的判準是 `!["light","streets"].includes(mapStyleId)`（App.tsx），這裡對齊 ——
  // 否則使用者在主站選了淺色底圖、分享出去的嵌入版卻仍是暗的。
  const isDark = url.style ? !LIGHT_STYLE_IDS.has(url.style) : url.theme !== "light";
  const layerKeys = url.layers ?? [];
  const visibility = useRef(buildEmbedVisibility(layerKeys)).current;
  const params = url.params ?? {};

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // StrictMode 會把 effect 掛兩次；dynamic import + fetch 都是 async，
    // 第一輪 cleanup 之後才 resolve 的 callback 必須自己認得「我已經作廢了」，
    // 否則會對已 remove 的 map addLayer、把回放時鐘開兩次。
    let cancelled = false;
    let stopReplay: (() => void) | null = null;

    registerPmtilesProtocolOnce();

    // 行動裝置降級：小螢幕強制平視。3D 傾角在低階手機上既吃效能又難操作。
    const narrow = window.innerWidth < 640;
    const cam = url.camera ?? FALLBACK_CAMERA;

    const map = new maplibregl.Map({
      container,
      style: buildBasemapStyle(isDark),
      center: cam.center,
      zoom: cam.zoom,
      pitch: narrow ? 0 : cam.pitch,
      bearing: cam.bearing,
      attributionControl: false,   // 自繪於右下（不可被 ui= 關閉）
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

    // EM-20 popup：layer id → layer key。snapshot 層是非同步加入的，故用外層 Map 累加。
    const layerIdToKey = new Map<string, keyof LayerVisibility>();

    const onStyleLoad = () => {
      // 只註冊「這次真的要顯示」的圖層 —— 不必為 145 個白名單圖層都建 source
      const configs = configsFor(layerKeys);
      addAllOverlays(map, configs, isDark, visibility, params, {
        pmtilesSource: maplibrePmtilesSource,
      });
      for (const config of configs) {
        for (const spec of config.layers) {
          layerIdToKey.set(`${config.sourceId}-${spec.suffix}`, config.id);
        }
      }
      for (const config of configs) {
        void hydrateOverlayIfNeeded(map, config);   // 靜態 GeoJSON 才會真的 fetch
      }

      // EM-14：`dynamicData` 但已 CDN 化的圖層 —— addOverlay 已用空 FeatureCollection
      // 建好 source，這裡讀 /static-rpc 快照補上資料（不碰 Supabase）。
      for (const config of configs) {
        const rpcName = EMBED_CDN_LAYERS[config.id];
        if (!rpcName) continue;
        void fetchCdnLayer(rpcName).then((fc) => {
          if (!fc || !mapRef.current) return;      // 快照缺失 → 該層靜默留空，不 fallback 打 DB
          const src = map.getSource(config.sourceId);
          if (src && "setData" in src) (src as maplibregl.GeoJSONSource).setData(fc);
        });
      }

      // EM-15：歷史快照圖層（主站是專屬 hook 畫的，不在 registry）。
      // 需要 date= 指定哪一天；沒有 date 或快照不存在都靜默略過。
      if (url.date) {
        for (const key of layerKeys) {
          const spec = SNAPSHOT_LAYERS[key];
          if (!spec) continue;
          void fetchSnapshot(key, url.date).then((fc) => {
            if (!fc || !mapRef.current || map.getSource(spec.sourceId)) return;
            map.addSource(spec.sourceId, { type: "geojson", data: fc });
            for (const layer of spec.layers) {
              if (!map.getLayer(layer.id)) map.addLayer(layer);
              layerIdToKey.set(layer.id, key);
            }
          });
        }
      }

      // EM-16：回放圖層（Three.js CustomLayer + 回放時鐘）。
      // three 與 Scene 全部走 dynamic import —— 網址沒帶回放圖層就完全不下載。
      // 多個回放層可同時開（`layers=flights,ships`）—— 共用同一把 replayClock，
      // 時間範圍取聯集，由 startReplay 內部統一處理。
      const replayKeys = url.date ? layerKeys.filter((k) => isReplayLayer(k)) : [];
      if (replayKeys.length > 0 && url.date) {
        const date = url.date;
        void import("./replayRuntime")
          .then(async ({ startReplay }) => {
            if (cancelled) return;
            const handle = await startReplay({
              map,
              layerKeys: replayKeys,
              date,
              isDark,
              speedParam: params.speed,
              hour: url.hour,
              isCancelled: () => cancelled,
            });
            if (!handle) return;              // 快照缺失 → 靜默略過該層
            if (cancelled) { handle.stop(); return; }
            stopReplay = handle.stop;
            setReplayOn(true);
          })
          .catch((err) => console.warn("[embed] replay 載入失敗，略過該層", err));
      }

      updateAllOverlayThemes(map, configs, isDark, params);
      setReady(true);
    };

    // EM-20：點擊彈出 popup。主站那套 30 檔／7379 行的客製面板不適合嵌入版
    // （體積 + 只覆蓋 38 種 layerType），改為通用欄位列表，所有圖層皆可點。
    const hitLayers = () => [...layerIdToKey.keys()].filter((id) => map.getLayer(id));

    const onClick = (e: maplibregl.MapMouseEvent) => {
      const ids = hitLayers();
      if (!ids.length) return;
      const feats = map.queryRenderedFeatures(e.point, { layers: ids });
      const f = feats[0];
      if (!f) return;
      const key = layerIdToKey.get(f.layer.id);
      const label = (key ? LAYER_LABELS[key] : undefined) ?? key ?? "";
      new maplibregl.Popup({ closeButton: true, maxWidth: "280px", offset: 8 })
        .setLngLat(e.lngLat)
        .setHTML(buildPopupHtml(label, (f.properties ?? {}) as Record<string, unknown>, isDark))
        .addTo(map);
    };

    // 游標提示「這裡可以點」
    const onMove = (e: maplibregl.MapMouseEvent) => {
      const ids = hitLayers();
      const hit = ids.length > 0 && map.queryRenderedFeatures(e.point, { layers: ids }).length > 0;
      map.getCanvas().style.cursor = hit ? "pointer" : "";
    };

    map.on("click", onClick);
    map.on("mousemove", onMove);

    // 診斷用把手（同主站 window.__map 慣例）：方便在 console 查圖層與圖徵
    (window as unknown as { __embedMap?: maplibregl.Map }).__embedMap = map;

    if (map.isStyleLoaded()) onStyleLoad();
    else map.once("style.load", onStyleLoad);

    map.on("error", (e) => console.error("[embed]", e?.error ?? e));

    return () => {
      cancelled = true;
      stopReplay?.();          // 停時鐘 RAF + 移除 custom layer（→ scene.dispose）
      map.off("click", onClick);
      map.off("mousemove", onMove);
      mapRef.current = null;
      map.remove();
    };
    // mount 時跑一次；所有輸入都來自凍結的網址狀態
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fullUrl = (() => {
    const u = new URL(SITE);
    const q = new URLSearchParams({ v: "1" });
    const cam = url.camera;
    if (cam) {
      q.set("lng", String(cam.center[0]));
      q.set("lat", String(cam.center[1]));
      q.set("z", String(cam.zoom));
    }
    if (layerKeys.length) q.set("layers", layerKeys.join(","));
    u.search = q.toString();
    return u.toString();
  })();

  return (
    <div style={{ position: "absolute", inset: 0, background: isDark ? "#0d0f12" : "#f2f4f6" }}>
      <style>{POPUP_CSS}{isDark ? "" : POPUP_CSS_LIGHT}</style>
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />

      {/* 連回完整站台 */}
      <a
        href={fullUrl}
        target="_blank"
        rel="noopener"
        style={{
          position: "absolute", top: 8, right: 8, zIndex: 5,
          background: isDark ? "rgba(12,16,22,.82)" : "rgba(255,255,255,.9)",
          color: isDark ? "#e6edf3" : "#1a1d21",
          border: `1px solid ${isDark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.12)"}`,
          borderRadius: 6, padding: "5px 10px", fontSize: 12,
          textDecoration: "none", backdropFilter: "blur(6px)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        在 Mini Taiwan Pulse 開啟 ↗
      </a>

      {/* 回放控制（EM-16）—— 播放/暫停 + 時刻，刻意極簡不做 scrubber */}
      {replayOn && <ReplayControls isDark={isDark} />}

      {/* 圖例（圖層 UX 四鐵則之一）—— 有開圖層才顯示 */}
      {ready && layerKeys.length > 0 && (
        <LegendPanel visibility={visibility} overlayParams={params} isDarkTheme={isDark} />
      )}

      {/*
        出處標示：OSM 為 ODbL 授權、政府開放資料多要求標示來源 —— 這是法律義務，
        刻意寫死在此，`ui=` 參數不接受移除它。
      */}
      <div
        style={{
          position: "absolute", right: 0, bottom: 0, zIndex: 5,
          background: isDark ? "rgba(0,0,0,.62)" : "rgba(255,255,255,.82)",
          color: isDark ? "#c9d1d9" : "#40474e",
          fontSize: 11, padding: "3px 7px", borderTopLeftRadius: 5,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        ©{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener"
          style={{ color: isDark ? "#8ab4f8" : "#0a58ca", textDecoration: "none" }}
        >
          OpenStreetMap
        </a>{" "}
        · Mini Taiwan Pulse
      </div>
    </div>
  );
}
