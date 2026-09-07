# 多圖層重複工作整理：2026-09-07

本批延續 codex/infrastructure-foundation-20260907；起點 ca3c0bd。使用者明確將 2h/8h 長跑及故障演練延後，本批不把它們列為阻塞，也不宣稱完成。原工作區其他任務的 dirty 檔案未修改。

## 已定位問題

1. App 的 map move callback 每次更新 cameraInfo React state，讓 App 與所有 LayerHosts 跟著重跑。cameraInfo 只用於一般／Capture 座標顯示，不是圖層必要狀態。把更新通知隔離在 CameraHud，保留同樣即時值、精度與字串；其他 session tracking / zoomend 等事件仍保留。
2. GFW custom layer 把 opacity 包含在 geometry cache key。每次透明度變動會重做投影、matrix 與軌跡 buffer；scene 本來就用材質處理透明度，因此移除此依賴。主題仍需重算顏色，縮放仍需重算尺寸，資料與視角變更仍更新。
3. 房地產點 layer 在 async buffer 載入後可能對已 dispose 的 scene 建資料；失敗的共用 Promise 永久留下也妨礙下次掛載重試。idle 重試 listener 需完整移除，避免關閉後重掛。

沒有變更資料來源、geometry、可見資料密度、遠景顯示標準或權限政策。此批也沒有調低動畫更新率。

## 驗證與證據

GFW：原版程式套上新測試會失敗：初始建置加 100 次 opacity 變更，共 101 次 geometry update；修正後同樣操作只有初始 1 次，仍 render 101 次。傳統 frame 與 spatial frame 兩條路徑都驗證。這是 mock scene 呼叫計數，不是 FPS 或 GPU 實測。真 Three.js scene 測試另外確認 material opacity 改變後，點數、matrix、軌跡位置、draw range 及來源 per-point/per-segment alpha 保持不變。

- npx tsc -b：通過。
- npm test：148 個測試檔通過，1287 passed / 3 skipped。包含 buffer 延遲回應、inflight 共用、失敗重試與 idle cleanup。
- 真 React.StrictMode harness：120 move events，父元件 +0、heavy sibling +0、HUD probe +238 renders；卸載/重掛 HUD 後重跑仍 PASS。StrictMode 的重複 render 不代表 238 個不同資料更新。這是合成元件隔離驗證，不是整個 App 的 profiler 結果。
- 本地實際 Mapbox 地圖：一般模式縮放由 z12.5 → z11.6，Capture 模式再縮放至 z12.5，座標皆跟著更新。
- git diff --check：通過。
- npm run build：通過；仍有既有大型 chunk 警告，本批未處理首屏拆包。

重跑 React 驗收：啟動 Vite，開啟 camera-react-acceptance.html，按 Run 120 moves，再按 Unmount/remount HUD 後重跑。原始 browser 讀回見 browser-results.json。

## 未驗收／下一批

全站實機 frame time、真實多圖層固定場景 benchmark、衛星 propagation、後端權限穿透驗證、10–20 人受控容量測試仍待做。長跑與故障演練依使用者要求延後。此批只交付上述已定位重複工作的有界修正，不代表整體基礎整理完成。未 push、merge、deploy 或套用 migration。

## 原子化提交

- d45fd52：camera HUD 狀態隔離與值/訂閱測試。
- 088a0a0：GFW opacity-only 不重建幾何及兩條 frame 路徑回歸測試。
- 34f37e5：房地產點位 async / idle lifecycle 修正及測試。

本批沒有資料遷移；需要撤回時可逐項 revert 對應 commit。正式整合前仍須以當時主線重驗，尤其平行工作的 App/Embed 修改。
