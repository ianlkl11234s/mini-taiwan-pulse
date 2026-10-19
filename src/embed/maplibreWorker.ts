/**
 * MapLibre v6 的 worker 網址（side-effect 模組，建立任何 maplibregl.Map 之前 import）。
 *
 * v6 改成 ESM-only，worker 是獨立的 `maplibre-gl-worker.mjs`。在 bundler 裡 MapLibre
 * 無法從 `import.meta.url` 找到它，必須自己 `setWorkerUrl()`。用 Vite 的 `?worker&url`
 * 讓 worker 走 worker 打包流程、產出自帶 shared chunk 的單檔；只用 `?url` 會原樣複製檔案、
 * 少了 sibling `maplibre-gl-shared.mjs`，正式 build 的向量圖磚會全部載不出來。
 * 出處：MapLibre v6 docs/index.md「Installation → Vite」。
 */
import { setWorkerUrl } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

setWorkerUrl(workerUrl);
