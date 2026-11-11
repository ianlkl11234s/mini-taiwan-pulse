# City Sound Atlas（城市聲景地圖）

> 狀態（2026-11-11）：MVP-A 開發中，分支 `feat/city-sound-atlas-mvp`，**未 push、未發布**。發布真相見 [handoff.md](./handoff.md)。
> 計畫書正本：使用者提供的《City Sound Atlas — 多來源聲景模擬擴充計畫》（2026-11-11）；執行計畫：GIS `.gis-agent-system/projects/2026-11-11-city-sound-atlas/PLAN.md`。

## 這是什麼

在地圖上放一個「接收點」（一個人站的位置），回答：**這一天的每個時段，這裡可能聽到哪些類別的聲音、相對多強、證據是什麼**。

第一版（MVP-A）四個聲源家族，全部重用 Pulse 既有資料：

| 家族 | 聲源模型 | 資料 |
|---|---|---|
| 飛機 `aviation` | 移動 3D 點（航跡內插＋斜距） | `get_flight_trails` 逐日航跡 |
| 雨 `rain` | 分布式場（最近雨量站代理） | `get_rain_gauge_day` 每站每小時一筆 |
| 雷 `thunder` | 脈衝事件＋聲速延遲 | `get_lightning_day`（氣象署 cwa＋台電 taipower） |
| 垃圾車 `waste_collection` | 表定停點（不沿停點直線發聲） | 垃圾車班表靜態快照 |

另有三個「場景快照」（`public/sound-atlas/scenes/<id>.json`），把特定日子、特定接收點周圍的航跡／落雷／雨量凍結起來，Supabase 過了保留期仍可回放。見 [DATA_QUALITY_REPORT.md](./DATA_QUALITY_REPORT.md)。

## 口徑（一定要照這個講）

- **輸出是「相對潛勢」：無單位、0–1 的類別活躍度，不是分貝（dB）。** 不可寫成音量、噪音值、dB(A)。`modeledDbA` 在通過聲學校準之前一律是 `null`。
- 0 和「不知道」是兩件事：
  - `inactive`（值 0）＝資料健康、而且沒有候選聲源。
  - `unknown`（值 null）＝有候選但無法估（例如航跡缺口、雨量站太遠、高度單位不明）。
  - `unavailable`（值 null）＝那個時段根本沒有資料涵蓋（來源沒載入、今天還沒到的時段）。
  - 某個落雷來源回空集合（`empty`）**不等於沒有雷**；只有至少一個來源 `ok` 時，0 筆才算 inactive。
- 雷聲有延遲：閃光時刻 ≠ 聽到的時刻（距離 ÷ 343 m/s），雷聲持續 8 秒的 envelope。
- 所有參數集中在 `src/sound/model/soundProfiles.ts`，每個都附 `assumption`；改參數要升 `MODEL_VERSION`。理由見 [MODEL_DECISIONS.md](./MODEL_DECISIONS.md)。

## 程式位置

| 內容 | 路徑 |
|---|---|
| 型別 | `src/sound/types.ts` |
| 參數（唯一出處） | `src/sound/model/soundProfiles.ts` |
| 純函式 kernel | `src/sound/engines/{relativePotentialKernel,thunderDelayKernel,geometryDistance,coverageWindow}.ts` |
| 接收者查詢、24h 構成 | `src/sound/engines/receiverQuery.ts`（`queryReceiver`、`dayProfile`） |
| 四個 adapter | `src/sound/sourceAdapters/*.ts` |
| 測試 | `src/sound/__tests__/`（T01/T02/T04–T09/T12/T18） |
| 場景快照產生器 | `scripts/preprocess/build-sound-scenes.py` |
| 快照驗算（跑引擎） | `scripts/preprocess/verify-sound-scenes.ts` |
| UI | W2 進行中（圖層群組、接收點、24h 構成圖） |

## 文件

- [SOURCE_REUSE_AUDIT.md](./SOURCE_REUSE_AUDIT.md) — 既有 loader／RPC／表的現況、保留期、健康度與已知 bug
- [SOURCE_EXPANSION_AUDIT.md](./SOURCE_EXPANSION_AUDIT.md) — 計畫 §4 外部來源查核表與建議優先序
- [MODEL_DECISIONS.md](./MODEL_DECISIONS.md) — kernel、單位、參數假設、放置位置的決定
- [DATA_QUALITY_REPORT.md](./DATA_QUALITY_REPORT.md) — 三個場景快照的涵蓋、品質與引擎實跑結果
- [handoff.md](./handoff.md) — 跨 repo 契約與發布真相
- [changelog.md](./changelog.md)
