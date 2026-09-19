# 地圖探索接手點 — 2026-09-17

## 範圍與工作位置

使用者要求記錄目前進度；本文件保存收尾前快照；後續使用者已授權 commit、PR 與一般 merge，最新結果見 release-handoff-20260917.md。
實際工作根目錄：`/Users/migu/.codex/worktrees/c92d/research-recovery/`，不要誤用外層舊 checkout。

| repo | branch | 已確認 HEAD | 工作樹 |
|---|---|---|---|
| mini-taiwan-pulse | codex/map-exploration | e69c54eb | 文件、故事 Skill、world 資料未提交 |
| mini-pulse-gis-mcp | codex/map-exploration | 464083d | clean |
| gis-platform | codex/map-exploration | 94eb0b9 | clean |

目前分支未顯示 tracking upstream；本輪沒有 push、merge、部署或資料上傳。歷史 intended base 未重查，不自行推定 main/master。

## 已完成的探索基底

- MCP 提供配對、地圖 context、圖層搜尋與說明、圖層開關、鏡頭與 bounds、位置查詢、圖層細項控制、離線地址查詢、時間 context 與設定等 19 個工具（先前 build/stdio 驗證紀錄；本輪未重跑工具列舉）。
- 控制細項由現有規格提供 context；時間控制沿用既有 timeline。離線地址查詢不等於全台地址服務。
- 圖層探索優先，來源與限制可說明，不以缺少進階分析 reader 阻擋開啟已有圖層。
- pulse-map-story 已建立 repo Skill，個人 skill 指向 repo；先查圖層與來源、選差異軸、寫完整章節、再導覽。預設逐章，30 秒自動模式取決於執行環境支援；不是背景播放器。Skill 與 map-exploration.md 尚未提交。

## 最近修正與驗證

`e69c54eb`：viewportFit、IconRailSidebar、TimelineControls 與回歸測試，共 4 檔。
- map context 不再因 VIEWPORT_OCCLUDED 整包失敗；回傳 fitAvailable/fitError，鏡頭、時間、圖層仍可觀察。
- 不再掃描任意 absolute/fixed 元素；使用明確面板 selector/登記。
- 邊界預留重疊時，嘗試面板下方等可用矩形；真的不可取景才拒絕鏡頭操作。
- 尚未完成所有面板配置的 browser 視覺驗收，錯誤 UI 的全面分類亦未完成。

驗證：`npx vitest run src/research/__tests__` 104 passed、2 skipped；最後型別修正後 viewport 4 passed、`npx tsc -b` 通過。不能當成配對 E2E 或 browser 證明。

| build | contract/wire | stage | upload | readback | pull | deploy | HTTP | browser |
|---|---|---|---|---|---|---|---|---|
| not run（僅 tsc done，未跑完整 Vite build） | done（程式與單元測試） | N/A | not run | N/A | N/A | not run | not run（本修正） | not run（本修正） |

## 未解問題：必須保留

1. **最新回報：測試網站又沒有圖資。** 使用者隨即要求先收尾，尚未診斷或恢復，不得標記已修。先前警察點位曾本地恢復，不代表這次或全部圖層正常。
2. **連線不穩未修。** 詳見 [connection-audit-20260917.md](connection-audit-20260917.md)：固定 30 分鐘 session TTL 不續租；兩條 2 秒輪詢與共用 IP 120/min；每次 browser request 遠端 Auth；32 次 query/command 累積上限；錯誤訊息混合且可能殘留；reload 配對恢復不足。
3. 稽核當時 Vite3732、Gateway8791 存活，最新 browser 有心跳但 SQLite 無有效 session；這是當時快照，不是目前即時狀態。17 個 MCP 程序不等於 17 個有效連線，不可整批殺除。
4. 本次只修取景，不可聲稱 TTL、輪詢、Auth、32 次限制或資料缺失已修。

## 本機架構與重啟注意

Codex → stdio Node MCP (`mini-pulse-gis-mcp/dist/research/index.js`) → HTTP8791 Gateway。
Browser3732 → Vite `/api/research/v1` proxy → Gateway → `runtime/map-exploration.sqlite`。
Browser 身分驗證依賴遠端 Supabase Auth；圖層資料載入另走 RPC/CDN/local public。
網站使用 `npm run dev:exploration`（指定 Gateway8791），一般 dev 預設曾誤指8790。先查現有 listener/cwd 再決定是否重啟，不任意中斷其他任務。MCP build 後既有程序不會自動載入新 code。

## 下一階段：單一圖層基礎統計（提案，未實作）

使用者希望回答：各縣市/鄉鎮市區有多少學校、圖層有幾種類別、各類別筆數、哪些行政區最多。方向是從探索基底逐步疊加，不一次重做進階交叉分析。

建議兩個底層能力，名稱先暫定，實作前查既有工具避免重複：
1. `pulse_describe_layer_statistics`：提供實際可統計欄位、資料粒度、行政區欄位或空間歸屬能力、類別值、來源/日期、載入完整性。
2. `pulse_summarize_layer`：同一圖層 count、groupBy（類別/縣市/鄉鎮）、行政區篩選、排序、分頁與 topN（明確同名次處理）。結果可用現有地圖工具定位與展示。

先用學校走完整流程，再擴充其他 reader。全台/行政區統計不能直接計算目前 viewport 渲染點或向量瓦片；使用完整原始資料或可驗證 aggregate。
- 有可靠行政區代碼先依代碼分組；沒有才使用版本明確的行政區 boundary 做點位歸屬。保留未匹配/邊界例外。
- 說明計數單位：校址/校區/學校機構不可混稱；沒有 institution ID 時不推定去重。
- 類別缺值列 unknown，載入錯誤不得轉成 0；不完整資料可回部分統計與 coverage，但不可當全台排名。
- 回傳 source、time、unit、scope/filter、total/returned/truncated、unknown/unmatched、coverage/limitations。只有筆數比較，不推論教育品質或因果。
- 暫不加入跨圖層關聯、密度、可達性、複雜指標或自動地理因果解釋。

## 下次第一步與驗收

1. 在上述 recovery repo 執行 `git status --short`，確認3732實際程序 cwd，取得使用者正在看的 layer key/URL；依 layer-onboarding 追 loader → 實際資產/RPC → HTTP content-type/內容 → browser 顯示，修復圖資缺失。不要把 Vite SPA HTML 200 當 GeoJSON 成功。
2. 接著處理 connection audit 的狀態分類、退避/輪詢、續租/安全恢復、長 session 限制；保持 auth 與去重保護。
3. 基礎統計先盤點學校完整資料與既有 query/readers，定義小契約後新增上述能力。未獲授權不得發布/上傳。
4. 統計驗收：全台總數=各行政區加總+未匹配；各類別加總含缺值；同名鄉鎮使用代碼/縣市辨識；排序與分頁稳定；錯誤/部分資料不回假 0；自然問句從搜尋→確認粒度→統計→地圖定位完整驗收。

保留未提交檔：map-exploration.md、.agents/skills/pulse-map-story/、connection-audit 文件，以及所有 public/world 未追蹤 GeoJSON；不要 broad stage、clean、reset 或代替其他任務提交。
