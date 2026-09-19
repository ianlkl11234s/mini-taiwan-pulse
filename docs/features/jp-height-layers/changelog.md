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
