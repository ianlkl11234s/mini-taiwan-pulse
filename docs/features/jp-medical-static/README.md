# 日本醫療靜態地圖

本批在獨立 worktree `/private/tmp/pulse-jp-medical-20260913` 實作，基底 `617f1dcb117e72738dde85f0cf0ab19281661432`。原 checkout 的未提交修改不在本批。

範圍：Navii 醫院／診所／牙科／助產所／藥局、H17 長照服務登記、A38 一次／二次／三次醫療圈。主站「日本 Japan → 醫療」使用既有圖層側欄；詳情按需讀取。

資料來源在 `/private/tmp/jp-medical-ready-20260913/analytics`，尚未合回上游原 checkout。本批只沿用已取得資料。最新授權計劃：[jp-medical-static-plan.md](/private/tmp/jp-medical-ready-20260913/analytics/docs/handoff/jp-medical-static-plan.md)。完整來源契約：[jp-medical.md](/private/tmp/jp-medical-ready-20260913/analytics/docs/handoff/jp-medical.md)。

年度病床／外來報告、區域統計、疫情、持續 collector、自動排程均不在本批。申報床數不是即時空床；公告時段不是現在可接診；長照服務登記不是唯一機構數。

執行與證據見 [handoff.md](./handoff.md)、[acceptance.md](./acceptance.md)、[backlog.md](./backlog.md)。2026-09-15 已授權接上既有 S3／Zeabur 發布流程；最新分層證據見 [release.md](./release.md)，原 acceptance 保留為本地驗收紀錄。

本地預覽：`npm run dev -- --host 127.0.0.1 --port 3737`，網址 http://127.0.0.1:3737/?v=1&lng=137&lat=37&z=4.5&layers=jpMedicalFacilities&style=dark 。發布整合 worktree 使用 port 3738。手機從底部「圖層與搜尋」的「醫療」分類操作。

資料發布清單：[payload-publication-plan.json](./payload-publication-plan.json)，781 個精確路徑／SHA／bytes／目的 key／cache policy，共 1,640,390,952 bytes。本機 public/jp-medical 是忽略的產出資料，重建方式見 payload-contract.md；不能只複製 Git 差異就認為 payload 也已交付。
