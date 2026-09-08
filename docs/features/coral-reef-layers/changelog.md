> 2026-09-08 後續：使用者授權僅本人帳號遠端私人研究。新存取架構與驗收狀態見 [private-access](./private-access.md)；下方本地整合紀錄保留為歷史證據。

# Changelog

2026-09-08 — 新增 coralReefDistribution 本地研究圖層：DEV-only 目錄／URL gate、PMTiles loopback mount、source lifecycle、透明度、圖例與19欄 popup。使用者確認九窗／桌面／手機本地驗收後，授權程式碼 commit 與 PR；移植至 db7dc1c8，未 merge／部署。研究資料與截圖不包含於 PR。詳見 [browser 驗收](./browser-acceptance.md)。

## 2026-09-08 私人圖層登出清理

正式站本人登入已驗證綠島 PMTiles 與 popup。登出發現既有 popup/halo 殘留，補上同 render 選取防護與 visibility 清理；關閉圖層亦清除選取。修正 popup 私人研究標題。修復後 production 驗收另記。
