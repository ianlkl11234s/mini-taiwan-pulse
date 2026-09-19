> **歷史 backlog（2026-09-14 起）**：保留原 Research Workbench 分階段工作，不作目前地圖探索優先順序或發布狀態。現在的能力、缺口與下一步以 [探索能力計劃](./exploration-capabilities-plan.md) 為準；新增來源應依 [分析能力 onboarding](./analysis-capability-onboarding.md) 驗收。

## 2026-09-14 本輪增量

- [x] M2 語意卡 schema／validator／schools、news、paddy 與負向測試。
- [x] 本地 Research Library 契約、immutable asset、search／describe／promote／stale。
- [x] 真實 schools 150 m assign／aggregate／materialize、固定 receipt、resultId 與主地圖驗收。
- [x] Routing 現況盤點：缺 graph／profile 證據，明確 HOLD。
- [ ] 新 grid 透過登入配對 MCP 的端到端及 mobile 驗收。
- [ ] 合格來源 licence／observed time 與第二個真實 library asset。
- [ ] Network engine／graph version／walking profile／topology／unreachable 證據。
- [ ] School district、real estate 真實可用資料；雲端 library 與跨使用者 ACL。

# Implementation backlog

完整目標以 spec.md 為準；證據以 handoff.md 為準。

- [x] 隔離 worktrees，保留原始並行工作。
- [x] Phase A synthetic result契約、共用驗證器與有界renderer。
- [x] `/lab`點／線／單外環面／表格、loading、opacity、legend、popup、clear。
- [x] 本地MCP驗證與列檔；bounded reads與symlink檢查。
- [x] Phase B配對domain安全核心及tests（非可部署gateway）。
- [ ] 完整v1 geometry（含holes/MultiPolygon）與參考底圖／圖層。
- [x] 真實登入verifier、SQLite durable store、pilot ACL、HTTP配對／relay程式與本地tests。
- [x] MCP session/scene tools、網站StudyController、manual優先與同revision ready。
- [ ] 正式HTTPS部署、pilot IDs、OAuth redirects、header readback與browser配對。
- [x] Codex全域MCP安裝、真Supabase登入、實際Codex CLI配對／操作／同revision ready驗收。
- [ ] 使用者重新載入桌面MCP後的日常操作驗收。
- [ ] 受授權的本地workspace快取／版本／pin／quota／eviction。
- [ ] S3/Supabase/R2共用catalog與receipt-aware acquisition。
- [ ] 估價、預算approval、reservation與受控reader。
- [ ] 私有artifacts、TTL、snapshot restore與ACL繼承。
- [ ] S3-only真實資料分析／方法基準／第二次payload零下載。
- [ ] 同revision inspect/capture、cancel/reconnect與production驗收。
