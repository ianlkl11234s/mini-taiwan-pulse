# Allen Coral Atlas 私人圖層本地交付

## 範圍與來源

- 上游：`taipei-gis-analytics` commit `dd444fff`，`docs/handoff/allen-coral-atlas.md`。
- 契約：上游 `data/processed/marine/allen_coral_atlas/{frontend_contract.json,_manifest.json,qa_summary.json,acceptance.json}`。
- 本機 geometry 直接由上述目錄讀取；沒有重新下載、複製進 public、提交或上傳。
- SHA：`sha-verification.json` 記錄 manifest 自身 SHA 及 manifest 所列 12 個檔案 SHA／bytes，全部符合。這是本次對交付檔的核對，不是重跑上游 pipeline。
- 上游 `readiness=local_data_ready` 不代表 Pulse browser 已驗收；本次結果另見 browser-acceptance.md。

## 接線與語意

單一 `allenCoralAtlas` 圖層，預設關閉；開啟時預設「珊瑚／藻類棲地」。三種檢視擇一掛載，完整棲地不會蓋住 Coral/Algae 檢視。UNEP-WCMC 既有圖層保持獨立。

| 產品 | source ID | source-layer | PMTiles |
|---|---|---|---|
| benthic | allen-coral-atlas-benthic | allen_coral_atlas_benthic | allen_coral_atlas_benthic.pmtiles |
| geomorphic | allen-coral-atlas-geomorphic | allen_coral_atlas_geomorphic | allen_coral_atlas_geomorphic.pmtiles |

兩者 z0–14，`promoteId=feature_id`；overzoom 不增加解析度。region 僅 `taiwan`／`okinawa`；「全部」是不加 region filter。feature_id 只在本 snapshot 內穩定。

硬依賴欄位：`class_name, region, window_ids, source_area_sqkm, source_version, source_year, nominal_resolution_m, geometry_role, feature_id`。MVT null 可編碼為缺欄，popup 一律顯示「未提供」，不得轉成零。來源年份／版本未提供。取得日 2026-09-15 不是觀測日。

`source_area_sqkm` 是「來源完整要素面積」，完整相交 polygon 未依行政界裁切，不能用來宣稱行政區珊瑚總面積。Coral/Algae 是合併分類，不代表活珊瑚覆蓋率、健康或物種。金門、馬祖無製圖要素不代表沒有珊瑚。沖繩是指定研究窗，非行政區全覆蓋。名目 5m 不是定位精度。

## 私有邊界

- Allen 使用獨立精確資產白名單與 `/api/private-research/allen-coral-atlas` 路由；不借用 UNEP S3 資產白名單。
- 資料請求每次驗 owner 身分，Range 最大 8 MiB，206／Content-Range，private no-store。
- 401／403 移除 map source 和 fill；登出清除私人選取與來源。
- URL share 排除私人圖層；不註冊公開離線快取，沒有 public／CDN fallback。
- 只完成本地工作；本地驗收後使用者已授權 commit，不部署、不 push。

## 本地啟動

Worktree：`/private/tmp/pulse-allen-coral-atlas`，branch `codex/allen-coral-atlas-private`，base `617f1dcb`。原工作區 dirty files 未搬移或回退。

依賴与 `.env`／`.env.local` 沿用原工作區 symlink；沒有在文件記錄金鑰。frontend：

```sh
npm run dev -- --host 127.0.0.1 --port 3735 --strictPort
```

只啟動 Allen sidecar（不啟動舊 UNEP sidecar）：

```sh
ALLEN_CORAL_ATLAS_AUDIT_PATH=/private/tmp/pulse-allen-private-runtime/allen-coral-atlas-access-audit.jsonl node --env-file=.env --env-file=.env.local --input-type=module -e 'import { startAllenCoralAtlasServer } from "./server/coral-private/coral-private-server.mjs"; startAllenCoralAtlasServer();'
```

私人 session denylist 與 metadata audit 位於 worktree 外 `/private/tmp/pulse-allen-private-runtime/`，檔案0600。若設定 `ALLEN_CORAL_ATLAS_AUDIT_PATH`，audit JSONL 會在 append 前輪替：預設每檔 1 MiB，保留 5 份舊檔（`<path>.1` 至 `<path>.5`）；可用 `ALLEN_CORAL_ATLAS_AUDIT_MAX_BYTES`（最小 65536）與 `ALLEN_CORAL_ATLAS_AUDIT_RETAINED_FILES`（1–100）調整。輪替或寫入失敗會使該請求 fail closed，不會略過 audit 繼續傳送私有資料。每次 process 開始建立已驗證快照，來源檔若更新須重啟並更新契約，不能靜默混版。服務重啟會保留現有 denylist；作業系統清除 tmp 會清除該本地紀錄，因此這個本地驗收實作不是 production revocation store。

UI：登入本人 →「世界 World」→「環境」→「Allen Coral Atlas（私人研究）」。目前驗收頁停在登出狀態；重新正常登入即可使用。

本地本人 browser 已完成；唯一未完成的指定身份驗收為真實非本人帳號 browser，因未提供第二個帳號。其403邏輯已有自動測試，不將其標為真人通過。
