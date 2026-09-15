# 日本醫療靜態地圖 handoff

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
