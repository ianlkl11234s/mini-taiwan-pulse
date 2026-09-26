# AI Agent 圖層查詢：2026-09-26 收尾接手點

## 目前做到哪裡

本次範圍只有 Mini Taiwan Pulse 的隔離 worktree `research-streamline/mini`，branch `codex/research-streamline-20260922`；analytics 原表唯讀、MCP/Gateway 程式未改，原 checkout／配對未清理。沒有 Supabase/S3 寫入、push、PR、merge、部署或重啟已暫停的過夜排程。來源家族歷史進度看[入口](./README.md)、[可打勾清單](./completion-checklist-20260925.md)與[逐家族收據](./source-family-priority-rollout-20260925.md)，不重讀整個歷史 transcript。

2026-09-26 audit：778 manifest keys、256 datasets、248 可查映射（起點 78，增加 170）、529 無 descriptor、1 有 descriptor 但關閉查詢，合計 530 未映射。這是 registry 計數，不是 248 層全都現場可查或空間驗收通過。臺灣 GIS 381 層已登記 188、未映射 193；其餘三主組以[逐層 queue](./completion-queue-20260925.csv)為準。多個 Point、Polygon、縣市統計來源有正常 MCP→Gateway→browser 收據；P4 手動兩個 Point 家族同圖已通，但自動挑選所有附近來源、多幾何路由仍待做。

最後已接線片 `50bb0536` 是警察等時圈 3 層：本機 reader、來源 oracle、focused tests、`tsc -b` 與 Vite 程式 bundle 過；正常配對／browser 待驗，完整 public 資產 build 曾因 ENOSPC 失敗。`d76dd405` 固化[系統能力與驗收分層](./agent-query-system-checkpoint-20260926.md)。`046a1fc4` 只保存 eAIP 空域**未啟用草稿**及 builder：81 個歷史空域面、RCR7 單一幾何修補；`npx tsc -b` 和 builder 重跑通過，尚無 focused test、授權／同版展示核准、runtime route、MCP／browser；不計入 248。

## 產物保留與可重建性

- `../runtime/` 原始本機產物未刪除；本次盤點約 10,439 個檔案，含 `owner-only/` 約 183 MiB。這些受來源權限保護的資料不進 Git，也沒有上傳雲端。程式與文件的 commit **不是**資料檔備份。
- 本機另留 `../runtime/checkpoints/20260926-runtime-all.tar.gz`（約 152 MiB，SHA-256 `d527f0ed9161307e60b566186b8fc2f309a20181cca952adcb91e5bfe320028d`，10,563 個 tar entries，含目錄）；另有 `20260926-owner-only.tar.gz`（約 77 MiB，SHA-256 `9be1b23e176d94f77182357c1449b3ccc43409f94ad7914889c5d38af99ac54b`）。兩份皆在本機同一磁碟，作為誤改／誤刪保護，**不是異地備份**；不要公開或提交這些 owner-only 檔。
- 空域 sidecar 原位及 `../runtime/checkpoints/20260926-airspace/` 各有同一 134,531-byte 檔，SHA-256 `b32288f6d8a7bb31313b3b6ad853e27f1e2323b1ef65a814f50de6350d405fb7`；`python3 scripts/research/build-airspace-owner-only.py` 可從 analytics 固定原表重新產生。其餘家族的 source/產物 SHA 與重建方式在逐家族收據；不要把單一快照當成全來源永久可恢復保證。

## 下次先做什麼

1. 查 `git status`、branch、`../runtime/`／checkpoint SHA、3734／8794 origin 與 pairing；本次收尾時兩服務皆未 LISTEN，不能宣稱現在的 MCP live 查詢成功。保護原 checkout 與既有配對，不重跑已通過案例。
2. 若續做空域：先讀 `046a1fc4` 與 airspace catalog，核 eAIP AIRAC 01-26 使用權與既有 PMTiles 同版；做兩地／篩選變體的獨立來源 oracle、focused tests；再接 owner-only route 與 registry、跑 `tsc -b`／build、audit，最後正常 MCP→Gateway→browser ready/readback，**另作原子 commit**。歷史空域不能供當前飛行合法性或安全判斷。若權利未核，維持 HOLD，改做下個合格家族。
3. 既有 530 層按[清單](./completion-checklist-20260925.md)與[queue](./completion-queue-20260925.csv)由臺灣 GIS→縣市統計→全球→日本逐家族回補；先判真共用原表，再看 source/version/license/time/missing/geometry。每片 exact-path commit；需要的新資料層改用[新圖層查詢關卡](./new-layer-queryability-gate.md)，Q0–Q3 實查才稱 Agent 可查。

| release unit | build | contract/wire | stage | upload | readback | pull | deploy | HTTP | browser |
|---|---|---|---|---|---|---|---|---|---|
| 已接線查詢家族 | 部分 done：各收據；第83批完整 build failed ENOSPC | 部分 done：248 映射、個別 HOLD | N/A | not run | N/A | N/A | not run | blocked：3734/8794 離線 | blocked：本次無 live browser |
| eAIP 未啟用草稿 | done：`tsc -b`；focused test not run | blocked：未接線且權利／展示同版未核 | N/A | not run | N/A | N/A | not run | not run | not run |

此矩陣描述**本次收尾時**的狀態；先前通過的各地圖案例仍依原收據有效，服務恢復與否須現場重查。沒有 upstream tracking branch；目前 commits 只在此本地分支。授權邊界仍為本地可逆施工與原子 commit，不自動 push、PR、merge、部署或使用付費資料源。
