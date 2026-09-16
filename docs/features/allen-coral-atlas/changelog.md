# Changelog

## 2026-09-15 — 本地私人 Allen 接線

- 新增 Allen 獨立來源、單一入口三種檢視與台灣／沖繩 region filter。
- 依上游 dd444fff 核對 12 個交付檔 SHA／bytes；保留 null、面積與研究窗語意。
- 新增精確白名單本機 Range 路由、owner auth、session 撤銷與 no-store；不發布圖資。
- 新增主題、legend、popup、loading、權限撤銷清除、URL 排除與聚焦測試。
- 測試與 browser 狀態見 browser-acceptance.md；本地驗收後依使用者授權提交程式與文件，沒有 push 或部署。

## 2026-09-15 — Production 接線

使用者授權 PR、merge 與 production。新增私人 S3 SHA 快照、正式 nginx 白名單、持久 revoke 與 production 登出；狀態與缺口見 production-release.md。

## 2026-09-16 — 正式資料補齊與存取區分

- 使用者明確授權 Allen 两份 PMTiles 私人 S3 上傳；完整回讀 SHA/bytes 相符，匿名403，正式本人 browser 已顯示墾丁圖形與 popup。
- 依使用者指定，UNEP-WCMC 歷史珊瑚改為匿名地圖與分享 URL 可用；Allen本人gate維持。
- 實際證據與限制見 `access-release-20260916.md`。
