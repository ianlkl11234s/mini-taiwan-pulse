/**
 * 主站的 Mercator 引擎注入（EM-16）——**side-effect only**。
 *
 * 必須是 `src/main.tsx` 的第一個 import：ES 模組求值順序是「依 import 順序深度優先」，
 * 所以這一行保證早於 `App` → `MapView` → `new mapboxgl.Map(...)` 的整條 import graph
 * 與任何 Three 場景的第一次 `toMercator()`。
 *
 * 為什麼不直接寫在 main.tsx body：body 的執行時機晚於**所有** static import 的求值，
 * 若日後有人在某個模組的 top-level 呼叫 toMercator 就會炸。獨立模組沒有這個時序風險。
 */
import mapboxgl from "mapbox-gl";
import { setMercatorEngine } from "./coordinates";

setMercatorEngine(mapboxgl.MercatorCoordinate);
