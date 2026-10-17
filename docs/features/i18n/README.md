# 多語系（en／ja）

> **Slug**：`i18n`
> **狀態**：active（P0–P5 已合進 develop，剩 P4-C 與 P5 遺留；v2.9.0〔2026-10-17〕已發布多語系完成的部分）
> **起點**：2026-10-12 PR #576（P0 試點）；其後 PR 見 CHANGELOG.md v2.9.0 與 ROADMAP「進度紀錄」

## 一句話說明

介面與部分資料內容提供繁中／英文／日文：寫死的中文改成 `t("key")`，只在畫到畫面時翻譯，圖層 key 與資料識別字不動；查不到翻譯退回中文。

## Runtime 路徑

- 翻譯與機制：`src/i18n/`（`locales/{zh-TW,en,ja}/*.json`、`layerText.ts`、`paramText.ts`、`dataText.ts`；用法見 `src/i18n/README.md`）
- 腳本：`scripts/i18n/`（`hardcoded-zh.ts` 量測剩餘寫死中文、`gen-keys.ts`、`gen-place-names.ts`、`export-layer-names.ts`、`export-param-texts.ts`）
- 防倒退：`src/i18n/__tests__/hardcodedZhScan.ts` 與基準檔

## 驗收方式

`npx tsc -b`、`npx vitest run src/i18n`（含 parity 與防倒退）、瀏覽器帶 `?lang=en`／`?lang=ja` 抽樣，並確認不帶參數時中文畫面不變。流程細節見 ROADMAP §2。

## 文件索引

| 文件 | 用途 |
|---|---|
| [ROADMAP.md](./ROADMAP.md) | 接手入口：進度表、每次開工／收工步驟、各階段做法與進度紀錄 |
| [PLAN.md](./PLAN.md) | 第一波規劃的五個問題與試點紀錄 |
| [translation-coverage.md](./translation-coverage.md) | 圖層／主題名稱翻譯覆蓋率與用語表 |

## 備註

翻譯為 Claude 產出並自行雙語各校兩輪；中文原文有疑義才需人工判斷。未完成項以 ROADMAP 為準（例：P4-C Agent 依配對網頁語言回答，需先改 MCP）。
