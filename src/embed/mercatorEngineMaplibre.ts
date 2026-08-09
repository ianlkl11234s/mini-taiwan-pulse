/**
 * `/embed` 的 Mercator 引擎注入（EM-16）——**side-effect only**。
 *
 * 注入 maplibre 的 `MercatorCoordinate`。§9-4 spike 實測兩家數值 bit-identical，
 * 所以 `src/three/*Scene.ts` 一行不用改就能在 MapLibre 上算出正確位置。
 *
 * 這裡**刻意**是 static import（maplibre-gl 本來就在 embed 基礎 bundle 裡），
 * 但 `utils/coordinates` 已無 mapbox-gl 相依，故不會把 mapbox-gl 拖進來。
 * 必須是 `src/embed/main.tsx` 的第一個 import，理由同主站版。
 */
import maplibregl from "maplibre-gl";
import { setMercatorEngine } from "../utils/coordinates";

setMercatorEngine(maplibregl.MercatorCoordinate);
