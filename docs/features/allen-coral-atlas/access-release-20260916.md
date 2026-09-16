# 2026-09-16 存取設定與正式資料發布

## 本輪授權

- 使用者明確指定 Allen 只限本人；既有 UNEP-WCMC「珊瑚礁歷史分布」開放使用。
- 使用者明確授權兩份 Allen PMTiles 上傳至 `migu-gis-data-collector`（ap-southeast-2）`private-research/allen-coral-atlas/<SHA256>/`，維持私有加密及本人API驗權。

## Allen 私人資料

- 兩份 immutable objects 已上傳，AES256、private/no-store；bucket Object Ownership=BucketOwnerEnforced，無ACL header，不修改 bucket policy。
- 完整 GET 回讀 size/SHA 與契約相符，兩份匿名 S3 HEAD 均403。見 `private-publication-evidence.json`。
- 現有正式版以正常 Google OAuth 本人登入後可解鎖；墾丁已實際載入 Coral/Algae 與 popup：`aca-benthic-7385e332b0bde380f55325e9`，來源完整要素面積0.164 km²，year/version未提供。
- 不把使用者原截圖的鎖定原因猜成帳號錯誤；可確認的是先前正式圖資未上傳，本輪新登入可通過權限探測並載入。
- 每個 Range request仍owner驗證；401/403清圖；登出先revoke。metadata-only audit記錄endpoint/status/Range/Content-Range於容器`/tmp`，沒有Bearer、session ID或response body；容器換版即清除。

## 公開 UNEP-WCMC

- 前端移除本人gate與「私人研究」標題，沿用公開PMTiles source transport。
- 固定 `/api/private-research/coral` 路徑為相容路由；匿名HEAD／有界Range可讀，仍驗SHA metadata、ETag與Range回應，no-store。
- 不改S3 bucket public policy，不提供其他任意object proxy；Allen路徑與驗權完全獨立。
- 保留原始来源、UNEP-WCMC General Data License、版本2021及「非健康／活珊瑚覆蓋率」語意。開放地圖存取不等於授予其他用途的再散布授權。
- 本地實際匿名 `bytes=0-127` 回206／`bytes 0-127/133400197`，128 bytes；未登入browser顯示珊瑚圖形，Allen維持鎖定。

## 驗證

- 本地全套Vitest：170 files passed、1 skipped；1404 tests passed、4 skipped。
- Backend 19/19 pass，含公開legacy、私人Allen、來源完整性及撤銷測試。
- Production公開legacy與部署後Allen Range、登出清除尚待下列正式驗收追加；真實非本人帳號仍未提供，403已有自動測試。
