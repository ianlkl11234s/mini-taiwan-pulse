# 2026-09-18

建立永久前端／上游 worktree，新增 PLATEAU 新宿建物高度與 CHMv2 東京樹冠本地試點。接上日本主題、opacity、2D/3D、來源圖例與點擊讀值；保留高度缺值／屋頂孔洞／影像時間不確定性。

管線與載入契約、供應路徑、測試及本地 browser 驗收見 handoff/acceptance。未發布、未提交，無 PR/merge hash。


## 多尺度與卸載保護

- 加入真實離線 10km/1km/250m 建物高度摘要、統計popup與partial coverage說明。
- 主站依視野、縮放和toggle管理JP PMTiles source，遠近切換不並存建物摘要與詳細；離區移除source。
- 加入安裝大小/checksum gate；樹冠coverage外點查不取磚。
- 本地驗收，不代表已擴至全日本或已發布。

## 2026-09-18 日本跨區第一批

五個局部ROI動態catalog、SHA-addressed原子本地安裝、單一多城市overview、近距4個建物+2個canopy cap、viewport卸載、probe cache2與取消、每城來源join／精簡建物popup／partial圖例。詳見 national-expansion.md、acceptance.md。永久worktree，本地未發布。

# 2026-09-20

## 日本高度小批 runtime assets 發布完成

- analytics PR #100、前端 PR #320 均 ordinary merge；前端 merge commit `a15db13726fc4743472286662bdf8ef81ef13c50` 的 CI 與 Zeabur CD 成功。完整測試 1,718 passed／8 skipped、TypeScript 與 build 通過。
- runtime S3 已寫入 38 個 immutable PMTiles（23,181,378 bytes）與最後切換的 catalog（28,655 bytes），合計 39 objects／23,210,033 bytes；全部 full-GET SHA/bytes/content-type/cache readback 通過。
- 此批仍只有 5 個舊 ROI + 11 個標準 mesh，不是完整城市或日本全國。建物全國與樹冠全國擴展維持暫停，checkpoint 留在 backlog。
- 正式 catalog 200 JSON／SHA match／短快取；immutable PMTiles 抽樣 Range 206／PMTiles header／一年 immutable cache。production browser 驗證名古屋 z15 單棟 popup、z10 摘要 grid popup 及東京樹冠 18m 取值，頁面沒有 error log。
