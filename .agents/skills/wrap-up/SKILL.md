---
name: wrap-up
description: Session 結束後收尾 + 更新 .Codex/memory/ 的 skill。當使用者說 /wrap-up、「收工」、「收尾」、「session 結束」、「做完了」、「commit memory」、「整理記憶」時觸發。讀本 session 脈絡 + git log + 現有 memory → 對應更新 9 個 memory 檔 → 產出 diff 給用戶 review → 每檔 atomic commit（prefix memory:）→ 不自動 push。
user_invocable: true
---

# /wrap-up — Session 收尾 SOP

## 目的

Session 結束時自動：
1. 分析本次做了什麼、學到什麼、失誤什麼
2. 將 session insights 寫回 `.Codex/memory/` 9 個檔
3. 每檔獨立 atomic commit，git log 可追記憶演進
4. 不 push，保留用戶最後 review 機會

## 執行流程（5 階段）

### Stage 1: Gather

**平行執行**（三個同時發 Bash / Read）：

1. Read `.Codex/memory/` 全部 9 檔，掌握現狀
2. `git log --oneline origin/master..HEAD`（本地未 push 的 commit）+ `git log -20 --oneline`（最近 20 次）
3. `git status`（本 session 未 commit 變動）

**然後**回顧本 session 對話：
- 用戶要求了什麼？
- 做了哪些動作？（讀哪些檔、改哪些檔、跑哪些指令）
- 哪裡順利、哪裡卡住、哪些指令失敗過？
- 用戶有糾正過你嗎？（次數 / 原因）

### Stage 2: Analyze

將本 session 事件分類到對應 memory 檔：

| 事件類型 | 寫到哪 |
|---|---|
| 做完某功能 / 抓完某資料 | STATUS + DATA_SCOPE |
| 產生新待辦 idea | BACKLOG（新增 P1/P2/P3） |
| 關閉舊待辦 | BACKLOG（劃掉 + 搬到「已完成」區） |
| 新決策 / 新預設 | PRINCIPLES |
| 重複性流程定型（做過 ≥2 次） | PLAYBOOKS |
| 遇到新術語 / 新代碼 | GLOSSARY |
| 遇到 bug / 意外並修好 | INCIDENTS（append；長篇放 `.Codex/pitfalls/`） |
| 反省「下次怎麼改」 | REFLECTIONS（append） |

**寫回規則**：
- `INCIDENTS` / `REFLECTIONS` **只 append**，不改舊條目
- `PRINCIPLES` 衝突時：新原則覆蓋舊，舊的搬到 `INCIDENTS` 記錄演進
- `STATUS` 每次**重寫**（只保留當下狀態）
- `DATA_SCOPE` 數字改動時，**先 Grep / `wc -l` 驗證**不單信對話摘要

### Stage 3: Draft — 保持精簡 ⚠️

**只產出總表**（每檔一行摘要），**不 dump 完整 diff / markdown 草稿**。

```
| 檔案 | 變動 | 一句話摘要（≤ 20 字） |
|---|---|---|
| STATUS.md | rewrite | 18 commits / SessionStart hook 上線 |
| INCIDENTS.md | +1 | macOS 無 jq → python3 |
| PRINCIPLES.md | +1 條 | shell 不依賴 jq |
| REFLECTIONS.md | +1 篇 | 首次 /wrap-up 反省 |
```

**禁止**：
- ❌ 貼出完整 markdown 改寫內容
- ❌ 列出每個 old_string / new_string
- ❌ 條列每條 append 的全文

若某檔變動特別複雜，可**多加 1~2 行 bullet** 註明主要改動，但仍不 dump 全文。

### Stage 4: Confirm

簡短問一句：

> 全採用 / 看某檔細節 / skip 某檔？

- **全採用** → 進 Stage 5
- **看 X 檔** → 這時才展開該檔的實際 Edit/Write 草稿
- **skip X** → 不 commit 該檔

**不要**自己 dump 細節等用戶挑。等用戶明確要求才展開。

### Stage 5: Atomic Commit

每個檔案一個 commit，訊息格式：

```
memory: <動詞> <檔名> (<1 句摘要>)

<必要時：更詳細的原因 / 對應的 session 事件>

Co-Authored-By: Codex Opus 4.7 (1M context) <noreply@anthropic.com>
```

**範例**：
```
memory: update STATUS (完成倫敦 10 座補抓)
memory: append INCIDENTS (EGLL 誤判 + bash/sh + UK 漏加)
memory: close BACKLOG B003 + add B006 (pull 腳本動態解析 region)
memory: reflect REFLECTIONS (今晚 3 條 next-time rules)
```

commit 順序建議：**STATUS 最後**（其他檔都 commit 完再更新 STATUS，避免 STATUS 引用到還沒 commit 的變動）。

完成後：
- `git status` 確認 tree clean
- **提醒用戶**：「要 push 嗎？`git push origin master`」
- **不要自己 push**

## 注意事項

- **Read first**：Edit 前一定先 Read 目標檔，避免 old_string 不精確
- **驗證數字**：DATA_SCOPE / STATUS 的航班數、region size，用 `wc -l` / Grep 確認，不單信對話摘要
- **Pre-commit hook 失敗**：fix 後**再開新 commit**，不要 amend
- **不修 AGENTS.md**：那是規則層，`/wrap-up` 不動（除非用戶明確要求）
- **不跨 session 臆測**：只根據「本 session 對話 + git log + 現有 memory」三者交叉驗證
- **若本 session 沒什麼好記**（純閒聊 / 讀檔不動作）：跟用戶確認「看起來沒需要 wrap-up，要強制留紀錄嗎？」

## Skill 自身的反省

這個 skill 也會被反省。若某次 `/wrap-up` 漏抓重要事件、或 commit 訊息風格不理想，應：
1. 在本次 REFLECTIONS 記下
2. 回頭修改本 SKILL.md（加新規則）
3. 下次 `/wrap-up` 時按新規則執行

**Skill 自我優化 = 記憶系統持續進化的核心**。
