# 會員專區（member-area）

> **狀態**：shipped（v1：前端 [PR #220](https://github.com/ianlkl11234s/mini-taiwan-pulse/pull/220) 與上游 gis-platform [PR #98](https://github.com/ianlkl11234s/gis-platform/pull/98) 已合併，migration 408 已套用正式 Supabase；真實 Google OAuth／多實體裝置驗收尚未完成）

## 一句話說明

桌機側邊與手機入口的會員面板：圖層共用搜尋、收藏（訪客存本機、登入存雲端）、私人場景與地點（保存地圖如何重開，不保存資料內容），帳號切換時隔離私人資料。

## 主要檔案

- UI：`src/components/member/MemberPanel.tsx`、`MyAnalysisCards.tsx`
- 資料讀寫：`src/data/memberLibraryLoader.ts`
- DB：上游 `gis-platform/migrations/408_member_private_storage.sql`（三張私有表＋RLS），契約見 handoff

## 驗收

隔離 PostgreSQL 17 驗證 RLS／quota／CAS；tsc、Vitest、Vite build、桌機／手機 browser 通過；正式站真實登入未驗收（見 handoff 交付狀態表）。

## 資料夾內文件

- [handoff.md](./handoff.md)：v1 交付狀態、使用流程、依賴圖、上游契約
- [changelog.md](./changelog.md)：2026-09-06 整合紀錄
- [plan.md](./plan.md)：2026-07-03 的 M 系列原始規劃（M-P0／P1，使用 migration 273／274 的舊構想，實際落地為 408，僅供脈絡）

相關：總計畫 `../../archive/2026-10-16/audit/foundation-2026-09-06/README.md`。
