# DX Overhaul 2026-07-01/02 — Workflow / Docs / Memory 全面升級

> **狀態**：✅ 完工並運作中（用戶已於 2026-07-01/02 用新 pattern 上線 bloom-experiments feature）
> **範圍**：mini-taiwan-pulse × taipei-gis-analytics 兩 repo
> **Session commits**：mini `f45eddf` `b65aa8e` `6df1b8c` / analytics `87da753` `c510618`

---

## 動機（用戶原始痛點）

1. **圖層與資料處理**：從 taipei-gis-analytics 拿到原始資料轉 layer 時常漏點 / 漏 UX 設定（點大小 / 透明度 / popup / 圖例）
2. **紀錄文件不順**：STATUS.md 流水帳、沒有 per-feature 追蹤、沒有跨 repo handoff SSOT
3. **Git workflow 沒文件化**：branch 命名 / PR 流程 / hotfix 判斷散在腦裡

## 決策（4 個關鍵選擇）

| 議題 | 決定 | 為什麼 |
|---|---|---|
| Handoff / ADR SSOT | **taipei-gis-analytics 為主** | 資料源頭，90% 架構決策從這開始；下游反向引用 |
| Branch 策略 | **GitHub Flow**（master + feature） | 單人開發，延續既有作法，最輕 |
| ADR 格式 | **MADR 客製版**（加影響範圍 / 資料契約變更 / 回滾成本 / Related ADRs / 追蹤 PR） | 標準 + 專案獨特欄位 |
| 首個 feature 範例 | **real-estate** | 剛上線最新，跨 repo 流程新鮮 |

## 產出總覽

### 跨 repo 契約基礎建設（`taipei-gis-analytics`）

- `docs/handoff/` — 資料契約 SSOT（README + _TEMPLATE + 6 feature：real-estate / agriculture / fire-rescue / bus / news / imagery）
- `docs/adr/` — 決策紀錄（README + _TEMPLATE + ADR-0001「SSOT 為什麼在這裡」的元決策）
- `.gitignore` 白名單這兩個目錄

### 下游 feature 文件（`mini-taiwan-pulse/docs/features/`）

- `README.md` + `_TEMPLATE/` × 4 檔骨架
- 6 feature × 4 檔 = 24 檔（real-estate / agriculture / fire-rescue / bus / news / imagery）
- **每 feature 4 檔職責**：
  - `README.md` — 一句話 + 圖層清單 + 關鍵檔案 + 反向引用
  - `backlog.md` — 該 feature 的待辦（全站 BACKLOG.md 的子集，編號一致）
  - `changelog.md` — 逐 PR 變更（date + PR# + squash hash）
  - `handoff.md` — 上游 SSOT 反向引用 + 硬依賴欄位 + 觸發點

### 開發工作流

- **CLAUDE.md 加 §Git Workflow**：GitHub Flow / branch 命名 / commit prefix / PR 模板 / hotfix 判斷 / **上游先動下游後動** 的跨 repo 同步順序
- **CLAUDE.md §5 導引到 layer-onboarding skill**
- **`.claude/skills/layer-onboarding/`**：7 步 SOP + UX baseline 表 + 四鐵則自檢 + 跨 repo 對齊
- **`.claude/commands/new-layer.md` 改寫**：Step 0 建 feature 資料夾 + Step 3 導 skill
- **`.claude/commands/handoff.md` 新增**：`/handoff <slug>` read-only 跨 4 repo commit 對照 + 契約狀態檢查
- **`.claude/agents/layer-creator.md`**：回報加提示接 skill，跟 command 對齊
- **`.github/pull_request_template.md`**：6 段 PR 模板 + 跨 repo checklist
- **`.claude/pitfalls/_TEMPLATE.md`**：Postmortem 模板（症狀/復現/根因/教訓/Meta）
- **`.claude/pitfalls/2026-07-01-layer-integration-common-misses.md`**：4 大類 15 條常漏項

### 記憶系統重整（28 → 7）

**PRINCIPLES.md**（頂端加 P0 段：任何 layer 工作先跑 skill → SessionStart toc 自動 inject 到每個 session）
- 補「複合索引 (id, collected_at) 必須」細節
- 補「pg_cron target_day 一律 Asia/Taipei」完整警告 + 教訓

**INCIDENTS.md** 補 3 事件
- 2026-04-09 gis-platform 整台 DB 掛掉（Pro plan spend cap 陷阱）
- 2026-06-12 Prod 首載 race（isStyleLoaded guard 陷阱）
- 2026-06-10 tippecanoe polygon 坑 + 8 commits 效能體檢

**PLAYBOOKS.md PB-06** 擴充為 6a~6f：
- 純程式部署 / 5 檔強制同步 checklist / glob pattern / 首次部署 / 更新流程 / 5 易錯

**DATA_SCOPE.md** 補：
- 7 個現役 collector 清單 + S3 前綴
- S3 bucket 結構
- 前端載入策略 4 層
- 飛機資料雙軌歷史脈絡

**`.claude/memory/README.md`** 補雙 memory 分工判斷樹（7 條路由）

**`.claude/memory/load-session.sh`** SessionStart hook 加：
- `docs/features/` 索引 auto-inject
- 上游 SSOT 路徑指引
- ⚠️ P0 提示

**全域 memory 大改組**：28 → 7 檔
- 6 feedback（4 已被 PRINCIPLES 涵蓋 + 2 補完缺項）→ `_archive/`
- 8 feature status → `docs/features/<slug>/`（+ archive）
- 6 infra memory → 框架檔（+ archive）
- 剩 7 檔：2 個人偏好 / 3 WIP status ref / 2 關聯 repo 說明
- MEMORY.md 全新分層索引 + 20 檔歸檔對照表

## 對抗式驗證機制

Wave 2 用 2 個 Explore agent 平行跑對抗式驗證，**默認立場：不涵蓋** — 只有找到明確對應段落才判「已涵蓋」。

- 驗證 12 個 memory vs PRINCIPLES/CLAUDE/docs 的實際涵蓋度
- 發現 4 個 NEEDS_MERGE 缺項 → 全數補完
- 沒有無憑據刪除；所有原檔備份 `_archive/` 帶 canonical 出處 header

## Auto-trigger 機制（4 重）

每個新 session 啟動 → skill 會被觸發：

1. **PRINCIPLES.md 頂端 P0 段** → SessionStart toc 自動 inject 標題
2. **CLAUDE.md §5** 明確導引
3. **`load-session.sh`** inject 專屬提示 + docs/features/ 索引
4. **Skill description** 含 8 個觸發關鍵字（自然語言自動 fire）

## 已被驗證運作（2026-07-01/02）

- ✅ 用戶自主用新 pattern：`docs/features/bloom-experiments/` 上線 4 個 bloom layer（commit `5873362` `13f6323` `1a85c2f`）
- ✅ PRINCIPLES.md 頂端 P0 段用戶手動再擴充 shell 腳本規範（jq 依賴檢查）
- ✅ SessionStart hook 加載測試通過（含新增段落 + docs/features/ 6 目錄可見）

## 決策軌跡（3 波）

| Wave | 動作 | 產出 |
|---|---|---|
| **Wave 1**（2026-07-01 前段） | 建 handoff/ADR/features 骨架 + Git Workflow + skill | mini `f45eddf` (15 檔) + analytics `87da753` (7 檔) |
| **Wave 2**（2026-07-01 中段） | 全域 memory 大改組 + 對抗式驗證 | mini `b65aa8e` (24 檔) |
| **Wave 3**（2026-07-01 尾段） | PR 模板 + postmortem + /handoff + agent sync + 3 backlog | mini `6df1b8c` (8 檔) + analytics `c510618` (5 檔) |

## 剩餘 TBD（不阻塞使用）

- `docs/features/bus/`：memory 78 天前 → 上游 handoff 標 needs-verification
- `docs/features/imagery/`：hook/loader 檔名 memory 未點名 → 上游 handoff 標 needs-verification
- `docs/features/real-estate/`：CustomLayer 分支放棄 hover 的取捨 ADR 未寫
- ADR-0002 起還沒寫（等下個實質決策）

## 關鍵教訓（給未來自己 / 其他 session）

1. **對抗式驗證比信任 memory 描述更可靠** — Wave 2 揭露 2 條 critical 缺項（複合索引 / pg_cron TZ）之前只在 memory 本身有，主 PRINCIPLES 沒有
2. **雙 memory 系統分工要明訂** — 全域 vs 專案的職責過去混雜，改組後才有清楚路由
3. **auto-trigger 靠多重備援** — 只靠 skill description 觸發不夠可靠，SessionStart hook + PRINCIPLES + CLAUDE + load-session.sh 4 重並存
4. **改動不 delete 只 archive**（垃圾桶 + `_archive/`） — 用戶明訂政策，實務上救得回
5. **feature 資料夾模式立刻被採用（bloom-experiments）** — 骨架設計合理，用戶無縫接軌

## 相關文件

- `CLAUDE.md` §Git Workflow / §5 / §5a / §6
- `.claude/memory/README.md`（雙 memory 分工）
- `.claude/memory/PRINCIPLES.md` §P0 開發流程強制觸發
- `.claude/skills/layer-onboarding/SKILL.md`
- `.claude/pitfalls/2026-07-01-layer-integration-common-misses.md`
- `../taipei-gis-analytics/docs/adr/0001-handoff-adr-ssot.md`
- `docs/features/README.md`（feature 目錄用途）
