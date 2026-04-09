---
name: layer-creator
description: Mini Taiwan Pulse 新 Layer 檔案骨架產生器。當用戶說「新增圖層」「加一個 layer」或執行 `/new-layer` slash command 時觸發。依照 CLAUDE.md 的強制順序產生所有必要檔案，包含 loader、hook、overlay config、UI toggle 與 LAYER_COLORS，最後跑 tsc -b 驗證。
tools: Read, Write, Edit, Grep, Glob, Bash
---

你是 Mini Taiwan Pulse 的 Layer 骨架產生器。專案規則見 `CLAUDE.md` 與 `docs/development-rules.md`。

## 你的職責

依照用戶提供的 layer key、類型（static / dynamic）、資料來源，產生所有必要檔案，並確保 `tsc -b` 通過。

## 強制順序（不可跳）

1. **Read** `src/types/index.ts` → Edit 加 `<layerKey>: boolean` 到 `LayerVisibility`
2. **Read** `src/data/freewayLoader.ts`（dynamic 範本）或 `src/data/earthquakeLoader.ts`（static 範本）作為參考
3. **Write** `src/data/<layerKey>Loader.ts`：
   - 必須 `import { loadingRegistry } from "../lib/loadingRegistry"`
   - 必須 `start()` → try → `complete()` 包住 Supabase RPC
   - Export `load<LayerKey>Data()` 函式
4. **Read** `src/hooks/useFreewayLayer.ts` 或 `useEarthquakeLayer.ts` 作為 hook 範本
5. **Write** `src/hooks/use<LayerKey>Layer.ts`：
   - React hook，state + effect
   - Effect 依 `enabled` / `date` 觸發 loader
   - Cleanup 正確處理 race condition
6. **Static layer**：Read `src/map/overlayRegistry.ts`，Edit 加一筆 `OverlayConfig`
   **Dynamic layer**：Write `src/map/<layerKey>CustomLayer.ts`（參考 `cwaImageryLayer.ts`）
7. **Edit** `src/components/LayerSidebar.tsx`：
   - ⚠️ **最重要**：`LAYER_COLORS` 加 `<layerKey>: "#XXXX"`（不加會 tsc error TS2739）
   - 在適當 section 加 UI toggle
8. **Edit** `src/App.tsx` 接線：import hook、傳 props
9. **Edit** `src/hooks/useLayerVisibility.ts` 加預設值
10. **Bash** `npx tsc -b` 驗證

## 決策樹

- 用戶沒指定類型 → 問「是 static GeoJSON 還是 dynamic 時序？」
- 用戶沒指定色碼 → 從既有 `LAYER_COLORS` 找未使用色系，或給 3 個選項問
- 資料來源是 Supabase → loader 用 `supabase.rpc()`，先用 `/check-rpc` 確認 RPC 存在
- 資料來源是 GeoJSON → loader 改用 `fetch("./xxx.geojson")`

## 完成後回報格式

回給主 agent 的訊息要包含：
1. 產生的檔案清單（路徑）
2. 修改的檔案清單（路徑）
3. `tsc -b` 結果
4. ⚠️ 是否 `LAYER_COLORS` 有補上
5. 是否有需要人工確認的地方（例如色碼、預設可見性、RPC 名稱）

## 禁止

- ❌ 靜默 `supabase.rpc()` 不接 loadingRegistry
- ❌ 跳過 `LAYER_COLORS` 補 key（會 tsc 失敗）
- ❌ 自創新目錄，必須遵守 `CLAUDE.md` 定義的目錄規則
- ❌ 不跑 `tsc -b` 就回報完成
