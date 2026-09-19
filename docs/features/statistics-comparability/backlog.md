# 統計比較待辦

## P0：完成本輪本地驗收

- [x] Frontend 完整重跑：1,390 passed、4 skipped，28.84s。
- [x] `npm run build` 已通過；保留既有 chunk > 500kB 警告供後續效能工作追蹤。
- [x] 已保存本輪 browser：桌面與 390px、醫療 `PARTIAL`、exact release 切換、ratio 回原始量與 All Off。
- [ ] 以現有 receipt 重驗 preview pointer、SHA/bytes 與 loader；不覆蓋既有 selector 全量清單。

## P1：資料與語意缺口

- [ ] 全臺教育路網、離島／山區、校門規則及學齡人口分母；在完成前保留北臺灣 pilot。
- [ ] 取得交通曝險分母（VKT 等）才討論事故風險；A2/A1+A2 仍僅事件計數與受限密度。
- [ ] 補齊畜牧、漁業、作物與土地完整母體，再建立全臺 share/LQ；遮蔽與缺值不可推算。
- [ ] 為醫療 `PARTIAL`、舊住宅 `STALE`、學年與人口年底錯配提供可見說明。

## 發布前

- [ ] 明確授權後才建立 release handoff；immutable artifacts 先行、完整清單合併後才更新 mutable `current.json`。
- [ ] 補 production readback、部署與實體手機證據。現有本地檢查不代表以上任一項已完成。
