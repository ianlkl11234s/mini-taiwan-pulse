# Changelog — 治安統計 Crime Statistics

> 逐 PR 變更紀錄。最新在上。

---

## 2026-10-17 — 首批（PR 待開，併入 develop；尚未部署正式站）

- Statistics「犯罪與治安」新增 36 層：8 案類＋電信詐欺 × 鄉鎮／縣市 × 件數／每十萬人
- 預設期別取最新全年；部分期別標示；圖例四類固定說明與口徑斷點
- Breaking：移除 `crimeAreaMonthly`（被本批取代；golden 移除 1 個 key，新增 36 個）
