# 日本醫療靜態地圖 handoff

## 2026-09-18 — 正式切換與清理完成

程式 PR [#297](https://github.com/ianlkl11234s/mini-taiwan-pulse/pull/297) 已以一般 merge commit `6954dc0db78eee9f797037981cff27ae2b2bed4a` 合併，Zeabur deployment `6aacd5eb0f50de6ff52c31a3` 於 06:15:19 UTC 為 RUNNING。功能 commits：`58284464`、`3083313f`；中間保留一般主線 merge。

目前 S3／volume／公開 current 一致為 `c6070ed3bba06bb1eb974638be8a6ae3db2af2439b20ae1e871218fdd649b653`。保留完整 rollback release `6f59ead2cd2381d80154b4fa9b5ac7c32acec0d315600a3e5f97282cf93fdafa`。更舊的 `d6f57fb991d7c714950fd6f334151ca9f4e6f27a887d2a0410e75b6b2223535a` 已依精確清單從 S3 和 volume 清除；上游 raw／processed 不變。

- 新版 payload：7 檔、621,621,437 bytes；Navii 189,800 點、H17 222,194 服務登記守恆。
- S3 日本醫療 prefix：1,561 → 790 objects；3,813,223,744 → 2,794,462,039 bytes，淨減 1,018,761,705 bytes。包含新增精簡 release 與保留完整 rollback，不能宣稱 S3 總量下降 71.4%。
- Volume 實測占用：5,992,996,864 → 2,175,127,552 bytes，約釋放 3.82 GB；包含重複 staging、較舊 release 清理及七檔 hardlink 重用。receipt 寫入本身有少量 block 差異；不是未來新 volume 的下載容量預算。
- 完整 S3 GET 驗 SHA／bytes／headers 通過；大型 PMTiles 本機串流逾時後改由 Zeabur 完整下載至暫存、驗證、刪暫存。公開五個 PMTiles Range 206、兩份 aggregate SHA 與一年 immutable cache 通過，兩份 points 為 CDN HIT。
- 正式 browser：醫院「宮内庁病院」無網站／時段；長照「コミュケア訪問介護ステーション」無指定四列；来源與日期保留。All Off 後僅開長照驗收。詳見 `release/20260918-browser-acceptance.json`。

證據：`release/20260918-s3-compact-receipt.json`、`release/20260918-production-http.json`、`release/20260918-s3-cleanup.json`、`release/20260918-volume-cleanup.json`。完整回復版仍包含時段資料；本次沒有承諾或設置自動到期刪除。

回復資料時：由保留 release 的 catalog／manifest 建立指向 `6f59...` 的 current（不得覆寫 immutable 檔），以當下 S3 current ETag 做條件更新，再執行現行 installer；新版前端相容該完整 payload。若同時回退前端至仍會載入 hours 的版本，務必先回復完整資料 pointer。以下保留各階段歷史紀錄，與上方最新狀態衝突時以上方為準。

## 2026-09-18 — 使用者授權清理、commit、PR 與一般 merge

已逐檔驗 SHA／bytes 並清除重複 staging，釋放 2,172,833,151 bytes；receipt 在 `release/20260918-staging-cleanup.json`。原 current 與兩個已安裝 releases 均保留。

既有 processed source 不在本 checkout，本次改用 `scripts/preprocess/compact_jp_medical_release.py --source-root /data/jp-medical --output-root /data/jp-medical-compact-20260918`，從已驗證的現行 PMTiles 原封重用 7 檔，來源 grain、幾何及全縮放 counts 保留。準備好的版本為 `c6070ed3bba06bb1eb974638be8a6ae3db2af2439b20ae1e871218fdd649b653`，payload 621,621,437 bytes，尚未切正式 current。PMTiles 既有 website／detail_bucket 屬性仍在本次重用檔內，但前端不使用；只有未來從 processed source 完整重建才會移除屬性。

精確清單：`release/20260918-compact-publication-plan.json`（10 entries）；準備證據：`release/20260918-compact-preparation.json`。舊的根目錄 plan／receipt 為歷史紀錄，不用於此次精簡發布。已完成 `tsc -b`、整合最新主線後 1,644 frontend tests（8 skipped）、14 publication tests、4 compact tests。實際切換與清理結果另記 release receipt。

## 2026-09-18 — 精簡醫療 popup 與發布資料（本地，未部署）

- 分支 `codex/jp-medical-popup-trim-20260918`，基底 `ce311261`。獨立 worktree 位於主 checkout 的 `.worktrees/jp-medical-popup-trim-20260918`。
- Navii popup 移除網站、完整診療時段區塊及 hours fetch；H17 popup 移除機構 ID、來源 ID、資料粒度、幾何狀態（含共址明細中的機構 ID）。來源、日期、原始服務類型與共址服務仍保留，內部識別欄位與幾何追溯不刪。
- 新 builder 不再讀取／發布 hours shards 或 schemas，也不將 `website`、`detail_bucket` 寫入新的 Navii PMTiles。上游來源封存與既有 immutable releases 未修改。
- 新版為 7 payload assets + catalog + manifest + current，共 10 entries。publisher／installer 同時相容舊 778 assets／781 entries；保留精確清單、SHA／bytes、immutable 衝突拒絕、current 最後切換。
- 2026-09-18 live catalog（版本 `6f59ead2cd2381d80154b4fa9b5ac7c32acec0d315600a3e5f97282cf93fdafa`）量測：778 assets 共 2,172,516,767 bytes；其中 768 hours shards + 3 schemas 共 1,550,895,330 bytes（71.387%），保留原 PMTiles 時餘 621,621,437 bytes。catalog／manifest 本身不計入此比較；重新出 tiles 移除欄位的額外收益尚未量測。
- 實際雲端儲存仍未下降。正式資料未重建、未上傳／切 current、未刪 S3／volume／staging／歷史 release。這是單一發布版本的可減量，不是整個 bucket 或帳單減少 71.4%。原本時段為點選後載入，移除不代表地圖初載流量減少 71.4%。
- 驗證：TypeScript `tsc -b` 通過；medical loader 7 tests 通過；React static render 確認兩種 popup 移除指定文字且保留來源／日期／共址服務。builder 以五類 Navii、H17、A38 小型 fixture 驗證 7 assets／10 entries（mock tiler，沒有執行正式 PMTiles 重建）。發布／安裝離線契約 14 tests 通過；真實 builder 的 plan writer 搭配 compact fixture 產生 10 entries 並通過 publisher 驗證。未做正式網站 browser 驗收。

後續執行順序：先部署相容的新前端及 installer，再由已保存的 processed source 用 builder 產製精簡 release，產生新的 exact publication plan，驗 SHA／bytes、全縮放點數與 localhost Range，發布 immutable assets 後最後切 current。保留可回復舊版，再按明確清單清理不再引用的舊 release／staging；不要從目前 immutable release 直接抽刪 hours。下方是歷史第一批紀錄，既有 plan／receipt 尚未由本次修改取代。

## 上游與版本

上游 SSOT：`/private/tmp/jp-medical-ready-20260913/analytics/docs/handoff/jp-medical-static-plan.md` 與 `jp-medical.md`；資料仍在該獨立 worktree，未合回原 checkout。來源 current / index 為實際版本依據，不硬編碼旧整合 bundle hash。

前端獨立分支 `feat/jp-medical-static-local`，worktree `/private/tmp/pulse-jp-medical-20260913`，基底 `617f1dcb117e72738dde85f0cf0ab19281661432`。

## 第一批契約

- 入口為 `/jp-medical/current.json` → 版本化 catalog。只准 Navii 五類、H17 當期、A38 三層及其必要詳情／聚合。禁止從舊 bundle 全量掛載。
- 廣域聚合分母是完整的可繪製來源資料，分類與 H17 service type 可篩選；來源總列、缺座標和隔離數另列。不能以瓦片抽稀後點數推回來源總數。
- 城市尺度按 HTTP Range 讀 PMTiles；點选才讀必要詳情／hours bucket。Navii source_id / record_kind / snapshot 是來源鍵；時段一對多，以原始 ID 篩選。
- H17 服務登記允許同機構／同址多列；35 類 222,194 登記與 416 非空間、5 重複隔離分開記載。
- A38 為 2020 歷史 display geometry，簡化與 coarse zoom 小面省略限制常駐標示。polygon parts 不等於醫療圈數，附著人口／面積不得按 part 加總。三次沒有可捏造的全國統一 code。
- missing／null／error／zero／STALE 各自保留。無座標不可補 0,0。原始／private／代表人欄位不在公開清單。

## 正式發布流程（2026-09-15 授權）

精確清單為 `payload-publication-plan.json`：781 個物件、1,640,390,952 bytes。透過 `scripts/deploy/publish-jp-medical-assets.py` 發布至既有 S3 `deploy-assets/jp-medical/`，不用整夾 sync。先驗全部本地 SHA/bytes，再上傳及完整 GET 回讀；immutable 不覆寫異值，current 用條件更新且最後寫入。

Zeabur 沿既有 master 自動部署。Docker entrypoint 的既有 pull 流程最後執行 `install-jp-medical-assets.py`；下載 manifest allowlist，驗完整 SHA/bytes，全部成功後原子切換 `/data/jp-medical/current.json`，失敗保留舊 pointer，舊 release 不刪除。nginx 從 `/data` 提供同網域 `/jp-medical/`，PMTiles Range、JSON/GeoJSON MIME、immutable 一年、current 60 秒，missing 回 404 不走 SPA。

本批不新增 Supabase RPC、R2、collector 或排程。production 證據、Git commit／PR、S3 receipt 與限制統一見 [release.md](./release.md)。catalog 的 `LOCAL_READY_NOT_DEPLOYED` 是產製時的固定狀態；不修改 immutable 產物來冒充發布證据，實際發布狀態以 release receipt／正式驗收為準。
