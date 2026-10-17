> ⚠️ 歷史文件（已被 [PLAN-warehouse-20260926](../../PLAN-warehouse-20260926.md) 取代），只作查證，不作施工依據。

# Research-streamline 本機啟動

此 profile 專供隔離 worktree：前端 `127.0.0.1:3734`，Gateway `127.0.0.1:8794`。它不同於 root checkout 的 `research:local:*`（3732／8791），不可混用。

先執行：

```sh
node scripts/research/research-streamline-start.mjs check
```

檢查只列出 `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY` 是否存在，不輸出其值；也會確認 analytics 的 `county_boundary_20260626.geojson`、隔離 `node_modules/vite` 與 `../runtime/vite.config.mts`。後者由 repo 追蹤的 `scripts/research/research-streamline-vite.config.mts` template 渲染，必須完整相符；不相符時 fail，不會覆寫。runtime config 遺失時，先明確建立一次：

```sh
node scripts/research/research-streamline-start.mjs config
```

確認兩個 ports 都未使用後才啟動：

```sh
node scripts/research/research-streamline-start.mjs start
node scripts/research/research-streamline-start.mjs status
```

啟動器固定傳入 `PULSE_RESEARCH_ANALYTICS_ROOT`、8794 gateway origin，及三個 local-only preview flags：`VITE_RESEARCH_POPULATION_PREVIEW=1`、`VITE_RESEARCH_RAW_BOUNDARIES=1`、`VITE_RESEARCH_POINT_PARTITIONS=1`。PID 與 log 放在相鄰 `../runtime/`，不應提交。

若 3734 或 8794 已被占用，或 probe 因權限／逾時無法判定，`start` 會失敗並列出 `in_use` 或 `unknown`；它不會停止、覆寫或重配對任何既有 Vite、Gateway 或 browser session。start 最多等待四秒確認兩個 TCP listener；失敗只終止本命令剛 spawn 的 PID，不觸及既有程序。`status` 只觀察 port 與本 profile state，不以 Gateway 根路由的 404 判定失敗。
