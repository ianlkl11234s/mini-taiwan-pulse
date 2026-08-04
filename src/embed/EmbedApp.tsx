/**
 * `/embed` — 給文章嵌入用的極簡地圖（EM-06）
 *
 * 與主站的關係：**共用資料與圖層邏輯，不共用地圖引擎與 UI**。
 * - 共用：`overlayRegistry`（199 個圖層定義）、`overlayManager`（source/layer/paint）、`LegendPanel`
 * - 不共用：地圖引擎（這裡是 MapLibre，主站是 mapbox-gl）、`App.tsx` 的 3000 行狀態機
 *
 * 刻意不做的事：
 * - 不呼叫 `useTransportParams`（3028 行）—— 參數全部由網址帶入，未指定者落到各 paint 的
 *   `?? fallback` 預設值
 * - 不掛 Three.js / 各 layerFactory —— 嵌入版只要 2D overlay
 * - 沒有圖層開關 UI —— 顯示什麼由網址決定，讀者不該能改
 */
import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { parseUrlState } from "../lib/urlState";
import { EMBED_ALLOWED, buildEmbedVisibility, configsFor } from "./embedWhitelist";
import { registerPmtilesProtocolOnce, maplibrePmtilesSource } from "./maplibreAdapters";
import { buildBasemapStyle } from "./basemapStyle";
import {
  addAllOverlays, hydrateOverlayIfNeeded, updateAllOverlayThemes,
} from "../map/overlayManager";
import { LegendPanel } from "../components/LegendPanel";

const SITE = "https://mini-taiwan-pulse.itsmigu.com/";
/** 預設視角：全台 */
const FALLBACK_CAMERA = { center: [120.9, 23.7] as [number, number], zoom: 6.9, pitch: 0, bearing: 0 };

export function EmbedApp() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);

  // 網址只在 mount 時解析一次（嵌入頁沒有會改變它的互動）
  const urlRef = useRef(parseUrlState(window.location.search, { allowedLayers: EMBED_ALLOWED }));
  const url = urlRef.current;
  const isDark = url.theme !== "light";
  const layerKeys = url.layers ?? [];
  const visibility = useRef(buildEmbedVisibility(layerKeys)).current;
  const params = url.params ?? {};

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

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

    const onStyleLoad = () => {
      // 只註冊「這次真的要顯示」的圖層 —— 不必為 150 個白名單圖層都建 source
      const configs = configsFor(layerKeys);
      addAllOverlays(map, configs, isDark, visibility, params, {
        pmtilesSource: maplibrePmtilesSource,
      });
      for (const config of configs) {
        void hydrateOverlayIfNeeded(map, config);   // 靜態 GeoJSON 才會真的 fetch
      }
      updateAllOverlayThemes(map, configs, isDark, params);
      setReady(true);
    };

    if (map.isStyleLoaded()) onStyleLoad();
    else map.once("style.load", onStyleLoad);

    map.on("error", (e) => console.error("[embed]", e?.error ?? e));

    return () => {
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
