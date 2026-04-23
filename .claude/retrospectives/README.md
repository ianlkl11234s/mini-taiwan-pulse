# Session Retrospectives

> 每次大型 session 結束後，Claude 會產生一份回顧，歸納做得好與需要改進的地方。
> 這裡不是 bug postmortem（那個在 `.claude/pitfalls/`），而是**整體工作方式**的檢討。

## 為什麼存在這個機制

LLM session 之間沒有 persistent memory。如果沒有機制主動把「本次踩過的坑」寫回檔案，下次 session 還會重犯。

這個資料夾的檔案**是給 Claude 下一次 session 讀的**，不是給人看的。主要讀者是 AI 自己，人類瀏覽是 side effect。

## 三層結構（短期 / 中期 / 長期記憶）

```
┌────────────────────────────────────────────────────────────┐
│ 短期：一次 session 的細節                                    │
│ .claude/retrospectives/YYYY-MM-DD-topic.md                  │
│ └── 涵蓋本次所有細節，為產生長期記憶的原料                    │
│                                                              │
│ 中期：單一 bug 的深度分析                                    │
│ .claude/pitfalls/YYYY-MM-DD-topic.md                         │
│ └── 從 retro 的 P0 / 明確 bug 抽出，Claude 遇到類似症狀時查  │
│                                                              │
│ 長期：永久 checklist 規則                                    │
│ .claude/lessons.md                                          │
│ └── 每條規則對應一次實戰教訓，Claude 每 session 開頭讀      │
└────────────────────────────────────────────────────────────┘
```

## 何時產生 retrospective

Claude 應該在以下時機主動產生：

1. **大功能段落完成**（例：某個 Phase 1a/1b/1c 的 feature 完整 commit）
2. **使用者明確要求**（「幫我產生 session retro」）
3. **踩到需要超過 10 分鐘 debug 的坑**（即使功能還沒完）
4. **本次 session 產生了 3+ 個 commit**

## 產生步驟

1. 複製 `_template.md` → `YYYY-MM-DD-<topic-slug>.md`
2. 填入四個必答問題（做了什麼、做得好、要改進、行動項）
3. 要改進的部分按 **P0 / P1 / P2** 分級（見下）
4. **P0 項目必須升級**到 `.claude/lessons.md` 或 `.claude/pitfalls/`
5. 更新 `INDEX.md` 最上方加一行 pointer
6. 建議跟進一個 commit：`docs(retro): <topic>`

## 優先級規則

| 等級 | 定義 | 去向 |
|---|---|---|
| **P0** | 每次違反會浪費 >30 min / 踩第 2 次 | 升級到 `.claude/lessons.md` |
| **P1** | 每次違反會浪費 5-30 min / 會讓 PR 要改 | 留在 retro 累積 |
| **P2** | 小最佳化、程式碼品質、readability | 留在 retro 累積 |

**升級條件**：
- 同一個 P1 出現在 **2 份不同 retro** → 升級到 P0
- 某個 P0 連續 3 份 retro 都沒再犯 → 視為內化，標記 resolved 但保留

## Claude 讀取規則

- **session 開頭**（user prompt 涉及 development）：讀 `.claude/lessons.md`，應用所有 P0 規則
- **遇到似曾相識的 bug**：搜 `.claude/pitfalls/` 對照症狀
- **完成大段落前**：檢視 `retrospectives/INDEX.md` 最近 3 份，避免重複犯錯

## 迭代機制

這個機制本身也要迭代。

- 每 10 份 retrospective 做一次 meta-review：`.claude/lessons.md` 是不是太長、規則有沒有互相矛盾、哪些可以合併
- 發現機制本身的問題寫在 meta-review 檔 `.claude/retrospectives/META-YYYY-MM.md`

## 與 `.claude/pitfalls/` 的分工

| 內容 | 去 retrospectives | 去 pitfalls |
|---|---|---|
| 整個 session 的工作節奏 | ✓ | |
| 單一 bug 的 reproduce 步驟 | | ✓ |
| 做得好的地方 | ✓ | |
| 某類問題的 debug checklist | | ✓ |
| 下次可能踩的坑預測 | ✓ | |
| 程式碼範例、修復 diff | | ✓ |

如果 retro 裡某個 P0 涉及具體 bug，抽出來寫成 pitfalls entry，retro 用 link 指過去。
