import { useEffect } from "react";
import type { Map as MapboxMap } from "mapbox-gl";

/**
 * 註冊變電所菱形 SDF icon image。
 * 32×32 全白 RGBA → SDF 視為整圖在 shape 內 → 渲染成純色方塊
 * → 配合 layer 內 icon-rotate=45 變菱形，icon-color 染色
 *
 * 跟 useOsmPowerLinesGlowLayer 同 pattern：style.load 後 image 會被清空，要重 add
 */
export function useSubstationDiamondIcon(mapRef: React.RefObject<MapboxMap | null>) {
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const addIcon = () => {
      if (map.hasImage("substation-diamond")) return;
      const size = 32;
      const data = new Uint8Array(size * size * 4);
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; data[i + 3] = 255;
      }
      try {
        map.addImage(
          "substation-diamond",
          { width: size, height: size, data },
          { sdf: true },
        );
        console.log("[substation-diamond] icon registered ✓");
      } catch (e) {
        console.warn("[substation-diamond] addImage failed", e);
      }
    };

    if (map.isStyleLoaded()) addIcon();
    map.on("style.load", addIcon);
    return () => { map.off("style.load", addIcon); };
  }, [mapRef]);
}
