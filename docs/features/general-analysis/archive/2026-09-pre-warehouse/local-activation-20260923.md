> ⚠️ 歷史文件（已被 [PLAN-warehouse-20260926](../../PLAN-warehouse-20260926.md) 取代），只作查證，不作施工依據。

# 本地使用者入口啟用接手點

> 2026-09-23後續已確認：新對話「配對 pulse-research MCP」已在3734成功配對、查人口與護理資料並呈現。下文等待重開是歷史檢查點，不要再重做配對。最新接手見 [handoff-20260923.md](./handoff-20260923.md)。

2026-09-23 使用者要求實際網站、配對與 Skill 對齊。此頁優先於先前用獨立 stdio driver 配對成功的紀錄：driver 成功不代表 Codex 已載入新版 MCP。

## 已完成

- 新版網站 http://127.0.0.1:3734，Gateway http://127.0.0.1:8794，沿既有 research-streamline 隔離 worktrees。
- ~/.codex/config.toml 只修改 pulse-research section：args 指向 research-streamline/mcp/dist/research/index.js；origin=8794，保留 loopback opt-in，指定原專案 env file 與既有 tw-address-geocoder root。依官方 https://developers.openai.com/learn/docs-mcp 設定方式直接修改config；沒有更動其他MCP或權限。
- 原專案 .agents/skills/pulse-gis-analyst 的 SKILL.md、references/map-session.md、references/jev-accelerator.md 同步成隔離版，逐檔bytes核對一致；其他原dirty檔案保留，未在原checkout commit。
- MCP section備份 runtime/pulse-mcp-config-before-activation.toml；Skill備份 runtime/skill-before-activation/。不含env值，勿提交runtime。
- 已解除主驗收driver配對，避免driver占據使用者測試session。

## 尚未完成：原生 Codex MCP 重新載入

真實測試對話「配對 Pulse Research MCP」（01a0cc8d-5283-75c1-baa4-b0d4864844f4）於設定更新後執行下一輪，已讀新版Skill，但仍沒有pulse_run_analysis_plan；3734新ticket透過其native MCP得到PAIRING_REJECTED。表示不能以config已改冒充runtime已改。該對話已依授權解除舊active session。未反覆試票、未改Gateway驗證。

CUA對Codex app的操作被工具明確拒絕，無可用原生MCP reconnect工具；不繞過此限制、不停止Codex程序。請使用者重新開啟Codex以重新載入，再回本任務告知。此為待驗證的恢復步驟，不能保證既有對話快取一定刷新。

## 重新開啟後最小验收

1. 檢查本輪native tools真的包含pulse_run_analysis_plan，metadata為新版optional Jev路由。缺失則先查設定覆蓋/載入，不產生新的網頁票據。
2. 使用3734既有tab，重新建立新ticket（不要重用本次已過期ticket）；用使用者測試對話native pulse_pair_session申請，主agent比對短語再從網站確認。不要用stdio driver代替。
3. native pulse_get_session必須active，接著describe population_statistics、population_statistics:male、population_statistics:female。
4. 用該對話重跑雙北人口占比，優先批次plan，collection+framing→ready→resultPresentation readback。驗證數值52.907739145655256%、51.503066506363304%，且2面features實際顯示。
5. 只有以上通過，才告知使用者此對話已可直接出題。當前狀態是網站/Skill/config就緒、原生MCP配對blocked，不是三者已全通。

不push/merge/deploy，不動遠端DB，不重啟過夜heartbeat。原3732服務未停止，避免影響平行任務；使用者測試固定3734。
