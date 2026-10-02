# Changelog — environment-layers

## 2026-10-02 — 第二波 9 層＋兩個小修

- 小修：自來水不合格二元圖例拿掉「淺 → 深」通用說明；RPI 測站疊在水質測站之上（registry 順序＋跟著水質測站重建）。
- 靜態 5 層：海域水質、RPI 河段試作（OSM ODbL attribution）、PM2.5 手動站、戴奧辛、焚化廠。
- 即時 4 層：核安會環境輻射、放流水、CEMS、紫外線；`environmentLiveLoaders.ts`（withLoading＋狀態 store）、`useEnvironmentLiveLayer.ts`、`environmentHosts.tsx`；popup 點開以 `p_cno` 拉全部測項。
- 圖例改用 legendKit（`src/components/legend/environmentLegends.tsx`），即時層顯示資料時間、已畫／無座標筆數或錯誤。
- MCP：manifest datasetId 正規化、overrides 標 live_only、重產 layer-status。
- 瀏覽器（agent-browser headless＋SwiftShader WebGL，1440×900、390×844；cmux surface 在背景 workspace 時 `visibilityState=hidden`，Mapbox 不跑 load，改用 agent-browser）：9 層渲染＋popup＋legend；RPI 河段 select 切近 12 月平均、透明度 0.3 生效；8 個點層透明度生效；All Off 全關；UV RPC 模擬失敗時地圖清空＋圖例錯誤訊息；高雄南區 0.592 照實顯示；390 寬無橫向溢出；乾淨重載開 11 層 console 0 error／0 warning。截圖：scratchpad `pulse-qa/w2-*.png`。
