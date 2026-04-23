# .claude/memory/

Mini Taiwan Pulse 專案記憶系統。Session 開頭讀這裡，結束時透過 `/wrap-up` 更新。

## 檔案總覽

| 檔案 | 用途 | 更新時機 |
|---|---|---|
| [STATUS.md](STATUS.md) | 當前進度、下一步 | 每次 session 結束 |
| [BACKLOG.md](BACKLOG.md) | 待辦清單（P0/P1/P2/P3） | 新 idea / 完成項目 |
| [DATA_SCOPE.md](DATA_SCOPE.md) | 資料盤點（Supabase / 靜態 GeoJSON / S3） | 新資料上線後 |
| [PRINCIPLES.md](PRINCIPLES.md) | 不用再溝通的預設 | 新共識產生時 |
| [PLAYBOOKS.md](PLAYBOOKS.md) | 固定流程 SOP | 重複流程定型時 |
| [GLOSSARY.md](GLOSSARY.md) | 術語與代碼對照 | 遇到新術語時 |
| [INCIDENTS.md](INCIDENTS.md) | 踩坑 + 教訓（append-only） | 遇到問題並解決後 |
| [REFLECTIONS.md](REFLECTIONS.md) | Session 反省（append-only） | 每次 `/wrap-up` |

## Session 開頭 SOP（給未來的 Claude）

1. 讀 `STATUS.md` → 知道現況、上次結束點
2. 掃 `BACKLOG.md` → 知道待辦優先級
3. 查 `PRINCIPLES.md` → 避免重開溝通已定案的事
4. 必要時查 `DATA_SCOPE` / `PLAYBOOKS` / `GLOSSARY`
5. **不變規則**在專案根 [../../CLAUDE.md](../../CLAUDE.md)

## Session 結束 SOP

使用者喊 `/wrap-up` 時觸發同名 skill，詳見 `.claude/skills/wrap-up/SKILL.md`：

1. Gather：讀本 session 對話 + git log + 現有 memory
2. Analyze：分類事件到對應檔
3. Draft：產 diff 給用戶 review
4. Confirm：等用戶 OK
5. Atomic Commit：每檔獨立 commit，prefix `memory:`

## 記憶腐化檢查

- `INCIDENTS` / `REFLECTIONS` 只 append，不刪除
- `STATUS` 每次重寫，只保留當下狀態
- `PRINCIPLES` 衝突時：新原則覆蓋舊，舊的搬去 `INCIDENTS` 記錄演進
- `/wrap-up` 跑完第 10 次後，回頭掃 `DATA_SCOPE` 是否過期

## 分層

| 層級 | 位置 | 性質 |
|---|---|---|
| 全域 | `~/.claude/projects/.../memory/` | 跨專案 + 用戶偏好 |
| 規則 | `mini-taiwan-pulse/CLAUDE.md` | 不變規則（程式風格、流程） |
| **狀態** | `mini-taiwan-pulse/.claude/memory/` | **變動狀態 + 反省 + backlog** |
| 長文 | `mini-taiwan-pulse/.claude/pitfalls/` | 事件的 long-form archive |

詳見可移植框架說明：[../FRAMEWORK.md](../FRAMEWORK.md)
