# Handoff — agri-statistics

上游契約：`taipei-gis-analytics/docs/handoff/agri-statistics-frontend.md`。本次使用交付 worktree `/private/tmp/agri-statistics-wiring-20260908`，封裝 SHA 與驗證記錄見 [驗收證據](./evidence/browser-acceptance.json)。

本 repo 的 [交付契約副本](../../handoff/agri-statistics-frontend.md) 與 `src/data/agriStatisticsRecipes.json` 用於 frontend wiring。接手啟動、修改與驗收見 [README](./README.md)，進度見 [backlog](./backlog.md)，Git 交付見 [changelog](./changelog.md)。

2026-09-08 正式 releases 已發布，匿名回讀與正式桌面 24 層驗收通過，證據見 README 與 production acceptance。可攜封裝維持原始 SHA；發布紀錄不重新封裝資料。下游仍保留 unavailable/error，禁止補0或把 preview server 當 production backend。
