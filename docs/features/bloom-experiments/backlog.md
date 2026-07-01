# bloom-experiments — backlog

## 短期（下一輪 session 內可做）

### BE-1 線 Mapbox 疊層 zoom-interpolate width + blur
現在 `usePowerLinesGlowTestLayer` 的 line-width / line-blur 是常數。拉遠會太肥。改成 `["interpolate", ["linear"], ["zoom"], 5, 0.3, 12, 1.0]` 讓拉遠自動變細。

### BE-2 抽 `GlowLinesScene` 通用 primitive
目前 line bloom 用既有 `OsmPowerLinesGlowScene`（跟 Points 對稱）。收 `{coords, colorHex, widthNorm}[]` 的話，未來任何 line layer（河道、鐵路、道路事件）都能 30 min bloom 化。

### BE-3 面 rim glow 用 Three.js additive 版
現在 Mapbox 疊層版效果 ~70%。真正 rim glow 走 Three.js：
1. `map.querySourceFeatures` 拉 polygon 資料
2. Polygon → boundary line segments
3. 餵給 line glow scene → additive 邊框發光
4. 適合行政區、災害範圍、農地

## 中期（固化週）

### BE-4 Bloom palette 系統
抽 `src/three/glow/palettes.ts` — 預設 5-6 種 palette（cyber / ember / ocean / aurora / neon），讓 hook 用 `palette: "ember"` 一鍵套。

### BE-5 用戶控制 core boost + falloff
現在 shader 内 `smoothstep(0.18, 0.0, d)` 是硬編。開 `coreRadius` / `midRadius` uniform 讓 slider 控制光暈半徑分布。

### BE-6 加 loading task
Bloom layer 目前拉 SSOT 沒註冊 loading（因為輕）。若之後改重的 RPC 要補 `withLoading`。

## 長期（不確定要不要做）

### BE-7 真 UnrealBloomPass
裝 `postprocessing` npm 套件，用 EffectComposer + UnrealBloomPass 做真正的 post-process bloom。**風險大**（跟 Mapbox 共 gl context 難搞）。當前偽 bloom 已 80% 像，投報比 marginal。

### BE-8 Ship 到正式視覺
若用戶決定 bloom 版取代原生視覺，需要：
- 決定哪個 layer 換掉（可能是「發電廠 主要」+「高壓輸電線」）
- 加 legend / featureInfo popup
- 效能實測（zoom 5 全台 209 廠 + 2305 線 fps）
- 更新 CROSS_REPO handoff（本 feature 純視覺，不動資料契約）
