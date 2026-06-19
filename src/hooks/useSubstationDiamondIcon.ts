import { useEffect } from "react";
import type { Map as MapboxMap } from "mapbox-gl";

const ICON_ID = "substation-diamond";

function buildIcon() {
  const size = 32;
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; data[i + 3] = 255;
  }
  return { width: size, height: size, data };
}

function addIcon(map: MapboxMap) {
  if (map.hasImage(ICON_ID)) return;
  try {
    map.addImage(ICON_ID, buildIcon(), { sdf: true });
    console.log("[substation-diamond] icon registered ✓");
    // force reload symbol source so tiles 重抓 image
    const src = map.getSource("energy-substations");
    if (src && "setData" in src) {
      const anyData = (src as unknown as { _data?: unknown })._data;
      if (anyData) (src as unknown as { setData: (d: unknown) => void }).setData(anyData);
    }
  } catch (e) {
    console.warn("[substation-diamond] addImage failed", e);
  }
}

/**
 * 註冊變電所菱形 SDF icon。
 *
 * 問題：mapRef.current 是 useRef，set 後不會 trigger React re-render →
 * 純 deps `[mapRef]` 第一次 effect 跑時 mapRef.current 可能 null，後續永遠不重試。
 *
 * 解法：polling map 直到 ready，註冊 image + style.load listener + styleimagemissing
 * 三層保險。osmSubstations layer 即使先 mount，image add 後會 force source reload 補圖。
 */
export function useSubstationDiamondIcon(mapRef: React.RefObject<MapboxMap | null>) {
  useEffect(() => {
    let stopped = false;
    let intervalId: number | null = null;

    const onMissing = (e: { id: string }) => {
      if (e.id !== ICON_ID) return;
      const map = mapRef.current;
      if (map) addIcon(map);
    };

    const tryRegister = (): boolean => {
      const map = mapRef.current;
      if (stopped || !map) return false;
      if (!map.isStyleLoaded()) return false;
      addIcon(map);
      map.on("style.load", () => addIcon(map));
      map.on("styleimagemissing", onMissing);
      return true;
    };

    if (!tryRegister()) {
      intervalId = window.setInterval(() => {
        if (tryRegister()) {
          if (intervalId !== null) window.clearInterval(intervalId);
          intervalId = null;
        }
      }, 100);
    }

    return () => {
      stopped = true;
      if (intervalId !== null) window.clearInterval(intervalId);
      const map = mapRef.current;
      if (map) map.off("styleimagemissing", onMissing);
    };
  }, [mapRef]);
}
