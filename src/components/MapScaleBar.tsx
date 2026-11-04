/**
 * 地圖比例尺（design-system spec §5.43，N-1）。
 * - 桌機：右側停靠欄（popup／圖例）最底一列，寬度跟著欄寬（最小 224），右端附數字比例 1:46K。
 * - 手機：左下、bottom sheet 收合高度上方，精簡版（無數字比例）。
 * z < 5 時回傳 null（地球儀投影下比例尺不準），不保留空位。
 */
import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import { useLocale } from "../state/localeStore";
import { useMapCamera } from "../hooks/useMapCamera";
import { SCALE_BAR_MIN_ZOOM, scaleBarModel } from "../map/scaleBarMath";
import "./mapNavControls.css";

interface Props {
  map: MapboxMap | null;
  isDarkTheme: boolean;
  variant: "desktop" | "mobile";
  style?: CSSProperties;
}

/** 桌機長條最長 px */
const DESKTOP_MAX_BAR = 200;
/** 手機長條最長 px */
const MOBILE_MAX_BAR = 100;
/** 桌機：左右 padding 20 ＋ 數字比例（約 30px）與間距 8 ＋ 長條右側單位（間距 14 ＋ "km" 約 16）預留 */
const DESKTOP_RESERVED = 20 + 38 + 30;

export function MapScaleBar({ map, isDarkTheme, variant, style }: Props) {
  const { t } = useLocale();
  const camera = useMapCamera(map);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const visible = !!map && camera.zoom >= SCALE_BAR_MIN_ZOOM;

  // 桌機寬度跟著停靠欄，長條可用長度依實際寬度算
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el || variant !== "desktop") return;
    const update = () => setWidth(el.getBoundingClientRect().width);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [variant, visible]);

  if (!visible) return null;
  const maxBar = variant === "desktop"
    ? Math.max(60, Math.min(DESKTOP_MAX_BAR, (width || 224) - DESKTOP_RESERVED))
    : MOBILE_MAX_BAR;
  const model = scaleBarModel(camera.lat, camera.zoom, maxBar);
  if (!model) return null;
  const barWidth = Math.round(model.px);

  return (
    <div
      ref={rootRef}
      className={`map-scale map-scale--${variant}${isDarkTheme ? "" : " map-scale--light"}`}
      role="img"
      aria-label={`${t("camera.scaleBar")} ${model.fullLabel}${variant === "desktop" ? ` (${model.ratio})` : ""}`}
      style={style}
    >
      <div className="map-scale__row">
        <div className="map-scale__ruler" style={{ width: barWidth }}>
          <div className="map-scale__labels">
            <span className="map-scale__l0">{model.labels[0]}</span>
            {model.showMid && <span className="map-scale__l1">{model.labels[1]}</span>}
            <span className="map-scale__l2">{model.labels[2]}</span>
          </div>
          <div className="map-scale__bar"><i /><i /><i /><i /></div>
        </div>
        <span className="map-scale__unit">{model.unit}</span>
      </div>
      {variant === "desktop" && <span className="map-scale__ratio">{model.ratio}</span>}
    </div>
  );
}
