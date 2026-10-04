# tools/ — 開發／POC 頁面

非主站入口的獨立 HTML 頁面。主站入口（`index.html`、`embed.html`、`card.html`、`lab/index.html`）留在 repo 根目錄，因 nginx 規則與測試依賴其路徑。

| 頁面 | 用途 | 本機網址（`npm run dev`，port 3721） | 進 production build |
|---|---|---|---|
| `design-system.html` | 活的設計系統元件頁（渲染真元件與 token；快照腳本 `npm run design:snapshot` 的來源） | `/tools/design-system.html` | 是（`dist/tools/design-system.html`，無 nginx 專屬規則） |
| `bbox.html` | GFW／AIS 查詢範圍框選工具 | `/tools/bbox.html` | 是（`dist/tools/bbox.html`） |
| `jev-layer-screening.html` | JEV 圖層相關性 POC（dev middleware `serveJevLayerScreeningReceipt`） | `/tools/jev-layer-screening.html` | 是（`dist/tools/jev-layer-screening.html`） |
| `demo-embed.html` | 嵌入（`/embed.html`）示範頁，9 張 iframe 卡 | `/tools/demo-embed.html` | 否 |
| `gfw-v4-bench.html` | GFW v4 day-pack bench | `/tools/gfw-v4-bench.html` | 否 |
| `gfw-v4-phase2-bench.html` | GFW v4 Phase-2 spatial bench | `/tools/gfw-v4-phase2-bench.html` | 否 |
| `spike-three-maplibre.html` | Three.js × MapLibre spike（已結案，結論見 `docs/proposal/embed-dynamic-layers.md`） | `/tools/spike-three-maplibre.html` | 否 |

進 production build 的三頁於 `vite.config.ts` 的 `build.rollupOptions.input` 登記；其餘僅 dev server 可開。
