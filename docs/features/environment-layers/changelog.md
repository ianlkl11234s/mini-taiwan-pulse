# Changelog — environment-layers

## 2026-10-03 — RPI 河段改全台版（取代淡水河試作）

- 新 key `riverRpiSegments`「河川污染指數河段（推估）」取代 `riverRpiSegmentsTamsui`；資料改為 analytics `water_resources/river_rpi_segments`（PR #135，301 段、54 流域）；`public/environment/river_rpi_segments_tamsui_trial.geojson` 移除。
- popup 新增：改派河名（環境部登記為 X，依位置對應至 Y）、流域、流向（推斷／未驗證）、待複核白話、河名對應方式與距離、下游無測站說明；不再顯示 caveats 原文與內部代碼。`to_node=unknown` 顯示「下游終點未定」（原本會誤寫「下一站」）。圖例加「無樣本（不代表乾淨）」灰線（近 12 月平均有 14 段無樣本）。
- MCP 倉庫：`ds_water_resources_river_rpi_segments`（301 列，precision_class=official）增量入庫，版本 `20261003T031158Z`（上傳 4、server-side copy 354，只增不減；試作表保留）；layer-status 重產（19 counties，L2 spatial）。
- 瀏覽器（agent-browser headless＋SwiftShader，1440×900／390×844）：全台河段渲染、昌農橋→牛稠溪 popup 顯示改派與「河道代碼與流域不一致，待複核」、六龜大橋→荖濃溪 popup、最新一次／近 12 月平均切換與圖例同步、All Off（含 ODbL attribution 一併移除）、console 0 error、390 寬無橫向溢出。截圖：`/private/tmp/claude-501/rpi-river-segments-qa/`。

## 2026-10-02 — 第二波 9 層＋兩個小修

- 小修：自來水不合格二元圖例拿掉「淺 → 深」通用說明；RPI 測站疊在水質測站之上（registry 順序＋跟著水質測站重建）。
- 靜態 5 層：海域水質、RPI 河段試作（OSM ODbL attribution）、PM2.5 手動站、戴奧辛、焚化廠。
- 即時 4 層：核安會環境輻射、放流水、CEMS、紫外線；`environmentLiveLoaders.ts`（withLoading＋狀態 store）、`useEnvironmentLiveLayer.ts`、`environmentHosts.tsx`；popup 點開以 `p_cno` 拉全部測項。
- 圖例改用 legendKit（`src/components/legend/environmentLegends.tsx`），即時層顯示資料時間、已畫／無座標筆數或錯誤。
- MCP：manifest datasetId 正規化、overrides 標 live_only、重產 layer-status。
- 瀏覽器（agent-browser headless＋SwiftShader WebGL，1440×900、390×844；cmux surface 在背景 workspace 時 `visibilityState=hidden`，Mapbox 不跑 load，改用 agent-browser）：9 層渲染＋popup＋legend；RPI 河段 select 切近 12 月平均、透明度 0.3 生效；8 個點層透明度生效；All Off 全關；UV RPC 模擬失敗時地圖清空＋圖例錯誤訊息；高雄南區 0.592 照實顯示；390 寬無橫向溢出；乾淨重載開 11 層 console 0 error／0 warning。截圖：scratchpad `pulse-qa/w2-*.png`。
