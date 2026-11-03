/**
 * 地圖導航控制（design-system spec §5.43，N-1）：指北針、縮放 +／−、定位。
 * - 桌機：右下控制柱（位置由 App 給 style），由上而下 指北針 → 縮放組 → 定位。
 * - 手機：時間軸列下方，只有指北針＋定位，視覺 30、觸控熱區 44。
 * 定位只在使用者按下時讀一次 navigator.geolocation，不追蹤、不存、不上傳。
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import mapboxgl, { type Map as MapboxMap } from "mapbox-gl";
import { LocateFixed, Minus, Plus } from "lucide-react";
import { useLocale } from "../state/localeStore";
import { useMapCamera } from "../hooks/useMapCamera";
import { accuracyRadiusPx } from "../map/scaleBarMath";
import { showTransientNotice } from "./TransientNotice";
import "./mapNavControls.css";

interface Props {
  map: MapboxMap | null;
  isDarkTheme: boolean;
  variant: "desktop" | "mobile";
  style?: CSSProperties;
}

const LOCATE_ZOOM = 15;
/** 浮點誤差容忍：easeTo 結束後 bearing／zoom 可能停在 1e-10 之類的值 */
const EPS = 1e-3;

export function MapNavControls({ map, isDarkTheme, variant, style }: Props) {
  const { t } = useLocale();
  const camera = useMapCamera(map);
  const locate = useLocate(map);
  const tilted = camera.pitch > EPS;
  const rotated = Math.abs(camera.bearing) > EPS;

  const onCompass = () => {
    if (!map) return;
    if (rotated) map.easeTo({ bearing: 0 });
    else if (tilted) map.easeTo({ pitch: 0 });
  };
  const zoomBy = (delta: number) => {
    if (!map) return;
    const target = Math.min(camera.maxZoom, Math.max(camera.minZoom, map.getZoom() + delta));
    map.easeTo({ zoom: target });
  };

  const compassLabel = !rotated && tilted ? t("camera.resetPitch") : t("camera.resetNorth");
  const locateLabel = locate.locating ? t("camera.locating") : t("camera.locate");

  return (
    <div
      className={`map-nav map-nav--${variant}${isDarkTheme ? "" : " map-nav--light"}`}
      role="group"
      aria-label={t("camera.navigation")}
      style={style}
    >
      <button type="button" className="map-nav__btn map-nav__solo" title={compassLabel} aria-label={compassLabel} onClick={onCompass}>
        <svg
          width={20}
          height={20}
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="map-nav__needle"
          // 同 Mapbox visualizePitch：先依 pitch 壓扁，再反向轉 bearing；不加 transition（跨 ±180° 會整圈轉）
          style={{ transform: `rotateX(${camera.pitch}deg) rotateZ(${-camera.bearing}deg)` }}
        >
          <path d="M12 2.5 L17.5 12 L6.5 12Z" className="map-nav__needle-n" />
          <path d="M6.5 12 L17.5 12 L12 21.5Z" className="map-nav__needle-s" />
        </svg>
      </button>

      {variant === "desktop" && (
        <div className="map-nav__group">
          <button
            type="button"
            className="map-nav__btn"
            title={t("camera.zoomIn")}
            aria-label={t("camera.zoomIn")}
            disabled={camera.zoom >= camera.maxZoom - EPS}
            onClick={() => zoomBy(1)}
          >
            <Plus size={13} />
          </button>
          <button
            type="button"
            className="map-nav__btn"
            title={t("camera.zoomOut")}
            aria-label={t("camera.zoomOut")}
            disabled={camera.zoom <= camera.minZoom + EPS}
            onClick={() => zoomBy(-1)}
          >
            <Minus size={13} />
          </button>
        </div>
      )}

      <button
        type="button"
        className={`map-nav__btn map-nav__solo${locate.locating ? " map-nav__btn--active" : ""}`}
        title={locateLabel}
        aria-label={locateLabel}
        aria-busy={locate.locating}
        onClick={() => locate.run({
          denied: t("camera.locateDenied"),
          failed: t("camera.locateFailed"),
          unsupported: t("camera.locateUnsupported"),
        })}
      >
        <LocateFixed size={13} />
      </button>
    </div>
  );
}

interface LocateMessages {
  denied: string;
  failed: string;
  unsupported: string;
}

/** 一次性定位：flyTo z15，畫藍點＋精度圈（DOM Marker，切底圖 style.load 不會被清掉） */
function useLocate(map: MapboxMap | null) {
  const [locating, setLocating] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  const clear = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
  }, []);
  useEffect(() => clear, [clear, map]);

  const run = useCallback((messages: LocateMessages) => {
    if (!map || locating) return;
    if (!("geolocation" in navigator)) {
      showTransientNotice(messages.unsupported);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { longitude: lng, latitude: lat, accuracy } = pos.coords;
        clear();
        const el = document.createElement("div");
        el.className = "map-nav-locate";
        const ring = document.createElement("div");
        ring.className = "map-nav-locate__ring";
        const dot = document.createElement("div");
        dot.className = "map-nav-locate__dot";
        el.append(ring, dot);
        const resize = () => {
          const r = accuracyRadiusPx(accuracy, lat, map.getZoom());
          ring.style.width = ring.style.height = `${Math.max(0, r * 2)}px`;
        };
        resize();
        map.on("zoom", resize);
        const marker = new mapboxgl.Marker({ element: el, pitchAlignment: "map", rotationAlignment: "map" })
          .setLngLat([lng, lat])
          .addTo(map);
        cleanupRef.current = () => {
          map.off("zoom", resize);
          marker.remove();
        };
        map.flyTo({ center: [lng, lat], zoom: LOCATE_ZOOM });
      },
      (err) => {
        setLocating(false);
        showTransientNotice(err.code === err.PERMISSION_DENIED ? messages.denied : messages.failed);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }, [map, locating, clear]);

  return { locating, run };
}
