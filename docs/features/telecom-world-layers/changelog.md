# Changelog — 世界通訊圖層

## 2026-08-18 — RIPE Atlas connected probes overview

- 新增 `ripeAtlasProbes`：量測節點獨立群組、Anchor／一般 Probe 分色、opacity、legend、popup、click 與 `© RIPE NCC` attribution。
- Popup／legend 明示座標 80–400m 模糊化、志願者偏差、research use；商業使用需另取許可；不呈現 IP 或 prefix。
- 納入 3,000／13,534 點 SHA-256 穩定概覽：147 國、239 個 Anchor；完整快照留在 analytics 層。

## 2026-08-18 — Ookla 2026 Q1 performance grid

- 新增 `ooklaMobilePerformance`／`ooklaFixedPerformance`：行動／固定效能格網的 overlay、legend、popup、click、opacity params 與 static field contract。
- 下載速度以 `avg_d_kbps` 色階填色，填色半透明並加描線；popup 顯示 download/upload/latency、tests/devices、聚合 tile 數、期間與 coverage caveat。
- 正式納入 mobile 751 格／fixed 893 格的 z6 全球概覽；分別由 3,186,269／6,312,198 個 z16 tiles 依 tests 加權聚合。
- 明示 Speedtest 使用者樣本、不是 coverage map、CC BY-NC-SA 4.0 非商業／相同方式分享、`© Ookla` 與 Ookla 商標聲明；popup 的 devices 是 z16 tile 加總且未跨 tile 去重。

## 2026-08-18 — OSM communication candidates overview

- 新增 `osmCommunicationSites` contract：群眾無線站點獨立群組、OSM 類型分色、opacity、legend、popup、click 與 attribution。
- 納入 916 個真實候選點，涵蓋 Johannesburg、London、New York、São Paulo、Singapore、Toronto 六個區域；不是全球完整清冊。

## 2026-08-18 — ANFR wireless sites overview

- 新增 `anfrWirelessSites`：法國 ANFR 5G NR 3500、Techniquement opérationnel 的 8,000／33,761 概覽抽樣靜態點層。
- 以首位 operator 分色，支援透明度、popup（SUP ID／operators／technology／system／status／record count／source／license）與 GIS click；無 loader/hook。
- 資料為公開站點概覽，不代表精確機房邊界；授權標示 Licence Ouverte 2.0。

## 2026-08-18 — prototype

- 世界 tab 新增獨立「通訊 Communications」主題。
- 將既有海纜與登陸站納入「全球骨幹」。
- 新增 PCH Active IXP 892 點，支援洲區圖例、參與者數泡泡、透明度與 popup。
- Breaking：無；未部署、未新增資料庫 migration。
