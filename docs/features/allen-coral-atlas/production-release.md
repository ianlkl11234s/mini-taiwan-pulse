# Allen 私人 production release

使用者於本地驗收後授權 PR、安全 merge 及 production 可用。資料上傳另等待精確私人 S3 目的地確認；本文件不將程式合併等同正式環境驗收。

## 固定架構

- Frontend: `https://mini-taiwan-pulse.itsmigu.com`，GitHub `master` 自動部署。
- Zeabur service: `69a3b5f307e6de1869be6e2c`；project `69a3b5eb07e6de1869be6e28`。
- `ALLEN_CORAL_ATLAS_STORAGE=s3` 使用固定私人 bucket `migu-gis-data-collector`、region `ap-southeast-2`。
- 每個精確資產 key：`private-research/allen-coral-atlas/<contract SHA256>/<filename>`。不使用 deploy-assets、public 或公開 CDN。
- `scripts/deploy/upload-allen-private.mjs` 先檢查公開 bucket policy 僅限既有 flight-arc 前綴，再依 Object Ownership 使用 private ACL（BucketOwnerEnforced 不送 ACL header）、AES256、If-None-Match 上傳，完整回讀核對 SHA/bytes 並驗匿名403。
- Sidecar 首次完整驗 SHA 後只供 immutable 記憶體快照；每個請求獨立驗 Supabase owner 及撤銷清單。兩檔常駐約147MB，初始化峰值更高。
- nginx 僅代理 benthic、geomorphic、revoke 路徑，不快取。持久撤銷清單 `/data/.private-allen/revoked-sessions.jsonl`，目錄0700／檔案0600；nginx 明確禁止該路徑。
- 登出 production 同樣先完成 revoke 才捨棄 token。服務錯誤時保留登入並提示重試。
- 現行為單一 sidecar instance；若擴成多副本，需先改用共享且每次讀取一致的撤銷儲存。

## Preflight

- 已實查 production `/data` 掛載存在。
- 既有 `S3_ACCESS_KEY`、`S3_SECRET_KEY`、`VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY` 存在；未輸出值。
- 合入最新 master，保留日本與社會統計平行變更；registry 540 layers。
- 整合後 Vitest：166 files passed、1 skipped；1390 tests passed、4 skipped。
- 私人 backend：20/20 pass，含 S3 checksum/size/failure/integrity 測試。
- nginx configuration syntax test 通過。
- production build 通過（既有 chunk size 警告）。

## 回復方式

合併後以 revert PR 還原本次功能並等自動部署。S3 SHA-addressed 私人資產可保留，沒有公開讀取政策；不需覆寫或刪除其他圖資。撤銷清單不得回復舊版本或清空，避免失效 session 再取得資料。

## 待驗證

私人 S3 上傳／readback、PR CI、安全 merge、production revision、本人 browser/206、匿名401、登出撤銷、公開路徑封鎖。真實非本人帳號仍未提供，403分支已有自動測試。

- 已實查 bucket Object Ownership 為 BucketOwnerEnforced，upload 已適配 ACL-disabled 模式。
