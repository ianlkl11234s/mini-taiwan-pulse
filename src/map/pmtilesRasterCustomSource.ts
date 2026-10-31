// PMTiles 點陣（PNG／JPEG）走 Mapbox 原生 custom source（CustomSourceInterface，type: "custom"）。
//
// 為什麼不用 mapbox-pmtiles 的 PmTilesSource：它把 tileSize 寫死 512，並自己呼叫 tile.setTexture；
// 256 px 的點陣圖磚在 globe 投影（z < 6）會畫成一整塊單色大方塊（2026-10-31 英國地形 z5.5 實測，
// 截圖在 PR）。Mapbox 原生 custom source 由 Mapbox 自己排程、上傳貼圖與處理 globe 投影，
// 我們只負責把 PMTiles 裡的圖磚位元組解成 ImageBitmap。Mapbox 3.18 沒有 addProtocol，這是不加 server 的原生路徑。
import type { CustomSourceInterface } from "mapbox-gl";
import { PMTiles } from "pmtiles";

export interface PmtilesRasterSourceOptions {
  id: string;
  url: string;
  minzoom: number;
  maxzoom: number;
  /** 圖磚像素邊長（OS Terrain 50 成品為 256） */
  tileSize?: number;
  attribution?: string;
  contentType?: "image/png" | "image/jpeg" | "image/webp";
}

export function pmtilesRasterCustomSource(o: PmtilesRasterSourceOptions): CustomSourceInterface<ImageBitmap> {
  const archive = new PMTiles(o.url);
  return {
    id: o.id,
    type: "custom",
    dataType: "raster",
    tileSize: o.tileSize ?? 256,
    minzoom: o.minzoom,
    maxzoom: o.maxzoom,
    attribution: o.attribution,
    async loadTile({ z, x, y }, { signal }) {
      try {
        const res = await archive.getZxy(z, x, y, signal);
        // 檔案範圍外（海面、他國）沒有圖磚 → null＝這格不畫（不是 undefined，避免放大父圖磚蓋出方塊）
        if (!res) return null;
        return await createImageBitmap(new Blob([res.data], { type: o.contentType ?? "image/png" }));
      } catch (error) {
        if ((error as { name?: string })?.name === "AbortError") return undefined;
        throw error;
      }
    },
  };
}
