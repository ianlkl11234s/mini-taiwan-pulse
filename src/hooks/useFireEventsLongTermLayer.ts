import { useEffect, useRef } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import {
  ensureLayer as ensureFireLayer,
  setData as setFireData,
  setVisible as setFireVisible,
  updateOpacity as updateFireOpacity,
} from "./useFireEventsLayer";
import { useMapReadyTick } from "./useMapReadyTick";
import { useHeatmapStyleSignature } from "../state/layerPalette";
import { useFireEventSeries } from "../data/fireEventSeries";
import { useLongTermSelection } from "../state/longTermBarStore";
import { longTermUsesHeatmap } from "../lib/longTermTime";

const HEAT_KEYS = ["fireEvents"] as const;

/**
 * 火災歷史由長期時間條驅動（即時模式；STANDARD.md §1 事件點）。
 * 沿用 useFireEventsLayer 的 source／layer id 與樣式，popup、圖例、類別篩選照舊。
 * 選取未滿 6 個月畫點（全縮放）；6 個月以上改回「低縮放熱區、z≥10 點」。
 * 歷史模式時 FireEventsHost 改掛 useFireEventsLayer，兩者不會同時掛著。
 */
export function useFireEventsLongTermLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  isDarkTheme: boolean,
  opacity = 1,
  catMask?: number,
) {
  const mapTick = useMapReadyTick(mapRef, visible);
  const heatStyle = useHeatmapStyleSignature(HEAT_KEYS);
  const series = useFireEventSeries(visible);
  const [a, b] = useLongTermSelection("fireEvents");
  const styleRef = useRef({ isDarkTheme, opacity, catMask });
  styleRef.current = { isDarkTheme, opacity, catMask };

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    // sparse＝只畫點（不畫熱區）
    const sparse = !longTermUsesHeatmap("month", b - a + 1);
    const apply = () => {
      try {
        ensureFireLayer(map, styleRef.current.isDarkTheme);
        updateFireOpacity(map, styleRef.current.isDarkTheme, styleRef.current.opacity, styleRef.current.catMask);
      } catch {
        return;
      }
      if (!visible) {
        setFireVisible(map, false, sparse);
        return;
      }
      // 年檔分批讀到就先畫已讀到的期別
      setFireData(map, series.byPeriod.slice(a, b + 1).flat());
      setFireVisible(map, true, sparse);
    };
    apply();
    // 換底圖會清掉自訂 source/layer：用已載入資料重建
    map.on("style.load", apply);
    return () => { map.off("style.load", apply); };
  }, [mapRef, visible, series, a, b, mapTick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !visible) return;
    try { updateFireOpacity(map, isDarkTheme, opacity, catMask); } catch { /* style 尚未就緒 */ }
  }, [mapRef, visible, isDarkTheme, opacity, catMask, mapTick, heatStyle]);
}
