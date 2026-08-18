# Changelog — 世界通訊圖層

## 2026-08-18 — OSM communication candidates contract

- 新增 `osmCommunicationSites` contract：群眾無線站點獨立群組、OSM 類型分色、opacity、legend、popup、click 與 attribution。
- 正式 GeoJSON 尚未提供；保留靜態 URL 與欄位契約，不建立虛構 fixture。

## 2026-08-18 — ANFR wireless sites overview

- 新增 `anfrWirelessSites`：法國 ANFR 5G NR 3500、Techniquement opérationnel 的 8,000／33,761 概覽抽樣靜態點層。
- 以首位 operator 分色，支援透明度、popup（SUP ID／operators／technology／system／status／record count／source／license）與 GIS click；無 loader/hook。
- 資料為公開站點概覽，不代表精確機房邊界；授權標示 Licence Ouverte 2.0。

## 2026-08-18 — prototype

- 世界 tab 新增獨立「通訊 Communications」主題。
- 將既有海纜與登陸站納入「全球骨幹」。
- 新增 PCH Active IXP 892 點，支援洲區圖例、參與者數泡泡、透明度與 popup。
- Breaking：無；未部署、未新增資料庫 migration。
