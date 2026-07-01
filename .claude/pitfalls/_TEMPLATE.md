# <YYYY-MM-DD> <一句話症狀>

**日期**：YYYY-MM-DD
**嚴重度**：low / medium / high / critical
**受影響範圍**：<哪些 feature / 使用者 / 生產環境或本機>
**發現方式**：<自己踩到 / 用戶回報 / CI 抓到 / 監控觸發>
**耗時**：發現 → 修復 <X 小時 / 分鐘>

---

## 現象（Symptom）

<用戶或觀察者看到什麼；截圖 / log 摘要 / query 結果>

## 復現步驟

1.
2.
3.

## 根因（Root Cause）

<真的解釋為什麼；不是 quick guess>

## 修法

- Commit / PR：`<hash or #N>`
- 動到哪些檔案：
- 是否需要 migration / infra 改動：

## 教訓（Learning）

- 這個坑通用嗎？→ 若通用 → **考慮進 `PRINCIPLES.md`**
- 事件性 / 一次性？→ **附上索引，短版進 `INCIDENTS.md`**
- 需要工具擋下嗎？→ 加測試 / lint / CI check / skill 更新

## 相關

- Skill：<若對應 skill 需要更新>
- Related pitfall：<earlier or later similar events>
- Related PR / issue：
- Related ADR：

## Meta（可選）

**做對的地方**：<下次可以更快找到根因的路徑>
**做錯的地方**：<如何避免下次踩同一個坑>
