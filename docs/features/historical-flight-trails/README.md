# 歷史航班軌跡（本地實作）

台灣17場／日本78場選單，共用完整解析度靜態renderer。一般工作日及週末資料不足時如實標示，可另選既有案例。

機場選單提供「全部機場」；依國家與日期合併現有靜態資產、按航班去重，缺資料機場仍標示 unavailable。

- [資料契約與執行方式](handoff.md)
- [資料驗證清單](data-inventory.json)
- [驗收與限制](backlog.md)
- [本次變更](changelog.md)

隔離分支：`codex/historical-flight-trails-20260918`；起點`b28e2233`。不包含主目錄其他session未提交修改。未commit、未push、未部署。


2026-09-18更新：現為3D藍白高度航跡，高度倍率可調；依使用者要求直接連接同航班的觀測空白。詳見acceptance.md與changelog.md。
