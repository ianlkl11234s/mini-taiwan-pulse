> **已封存 2026-11-09**（原路徑 `docs/features/global-events/backlog.md`）：讀過後仍有效的未完成項目已搬進 [`.claude/memory/BACKLOG.md`](../../../../../.claude/memory/BACKLOG.md)（各主題群，附回本檔連結；已完成／過時／查不到證據的列在「已關閉（2026-11-09 封存清單清理）」段（使用者 2026-11-09 確認；併入者記在目標列））。本檔保留原文，不再更新。

# 本次範圍

- [x] 最近七天總覽與跟隨時間軸
- [x] 全部情勢／正式事件顯示選項、AI初判標示
- [x] 未定位候選事件列表（含正式 unknown 事件）
- [x] 同位置不同事件避讓／群組展開
- [x] 同事件多國關聯弧線toggle與選取強調
- [x] tsc-b、focused/full tests、RPC readback
- [x] Production browser／部署驗收（PR #205／#206；def3dc6 RUNNING，真實資料與時間軸驗收）
- [x] 同位置避讓改為 native screen-space offset，所有 geometry 固定；tsc／完整 tests
- [x] 固定錨點 hotfix 本地 browser：平移／旋轉／縮放、並排點選、opacity／off、console
- [x] 固定錨點 hotfix PR #207／正式部署 RUNNING（78c90aa）
- [ ] 固定錨點／popup瘦身正式視覺驗收（由使用者執行，不由agent自驗）
- [x] Popup 瘦身與18px標題；資料、位置與其他圖層不變
- [x] Popup 瘦身 CI／正式部署（PR #208／5230181 RUNNING）
- [x] 全球情勢列表與統計移到INTEL獨立分頁；sidebar保留controls
- [x] 圖層off不顯示舊統計，明確按鈕啟用同一圖層；不新增資料pipeline
- [ ] INTEL全球情勢分頁 CI／正式部署（視覺由使用者確認）

後續：重要性判準持續校準；本次不引入新的分數體系。
