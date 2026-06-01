# Mini Taiwan Pulse — 上線計畫（feat/fire-rescue → master → Zeabur）

> 建立：2026-06-01 過夜 session｜Zeabur service `service-69a3b5f307e6de1869be6e2c`｜plan DEVELOPER｜掛載 volume `/data`
> 目標：把本地 `feat/fire-rescue` 的最新進度安全推上 Zeabur，明早開站所有 layer 與本地一致，且**費用可控 / 無資安風險 / Supabase 穩定**。

---

## 0. 一句話現況

`master`（= Zeabur 穩定版）落後本地 `feat/fire-rescue` **104 commits + 24 個未 commit 檔**。本次是一次大躍進上線，採「先 merge 進 master 再部署 master」策略，全程可逆（已建 backup tag）。

## 1. 已決策（2026-06-01 與你確認）

| 決策 | 選擇 |
|---|---|
| 今晚執行範圍 | **只做可逆準備 + 審查**；push / merge / deploy / 改 key 全留早上 runbook |
| 104 commits 上線方式 | **feat/fire-rescue → master，部署 master**（穩定分支乾淨，可隨時 revert 回舊 master） |
| `/data` volume 重填 | **改 Dockerfile 加 entrypoint 自動 pull**（已準備，runtime S3 key 留早上設） |

## 2. 安全網（已建立，全可逆）

```
backup/pre-launch-master-20260529-172731   → 指向 origin/master（舊穩定版，rollback 用）
backup/pre-launch-feat-20260529-172731     → 指向今晚的 feat/fire-rescue HEAD
git stash@{0}: pre-launch-wip-backup        → 未 commit 工作樹的備份（工作樹未動）
```
**規則：不刪檔、不用 `rm`、key 異動留早上。** 任何一步都能用上述 tag 還原。

## 3. 今晚已完成（可逆準備 + 審查）

- ✅ 建 backup tags + stash WIP（安全網）
- ✅ `npx tsc -b` → **exit 0**（新版型別乾淨）
- ✅ 逐層資料來源稽核 → `01_DATA_SOURCE_AUDIT.md`（129 layer 全分類）
- ✅ 部署鏈靜態資產覆蓋稽核（找出 404 缺口）→ 見 audit 文件 GAP 段
- ✅ Supabase 後端 RPC 授權/timeout/費用稽核 + **連線實測 DB 實況**
- ✅ WIP diff code review（正確性 + commit 衛生）→ 無 blocker
- ✅ Codex 獨立第二意見審查（tmux `pulse_launch:codex-review`，log 在 `/tmp/pulse_launch/codex_review.log`）
- ✅ 產出本計畫 + checklist + runbook + 新資料 SOP + 晨間報告

**今晚未做（留早上你拍板）**：push、merge master、Zeabur 部署、S3 上傳、任何 key 輪換/設定、Supabase 權限收斂。

## 4. 上線 Go / No-Go 三大門檻（詳見 `02_PRELAUNCH_CHECKLIST.md`）

| 門檻 | 現況結論 |
|---|---|
| **Supabase 穩定** | 🟢 大致良好：81 個 public RPC anon 全可呼叫、大 payload RPC 有 timeout、cron 31 job 已錯峰。1 個待修：`get_bus_trails` timeout=0。 |
| **費用可控** | 🟡 待確認：Zeabur credit $0 需確認帳務；anon 可直讀曝光 schema 的靜態表（egress 風險）；agriculture 380MB 是否納入本次。 |
| **資安** | 🟡 1 中度項待硬化：anon 可繞 RPC 直讀 reference/spatial/fire/maritime/rail/safety（realtime 已安全不曝光）。`.env` 未洩漏進 git（已驗證）。 |

## 5. 明早執行順序（摘要，詳見 runbook）

1. 看晨間報告 `05_MORNING_REPORT.md` + 決定 4 個待拍板項（key / agriculture / 安全收斂 / bus 路由）
2. 補 `.gitignore` → 精確 commit WIP 到 feat/fire-rescue
3. 套用部署鏈 GAP 修正（agriculture / bus / Dockerfile entrypoint）— 依你對 agriculture 的決定
4. merge feat/fire-rescue → master
5. 設定 Zeabur runtime env（S3 key 等）+ 部署 master
6. 容器內 pull /data + 逐層 smoke test
7. 驗證三門檻 → 對外開放

## 6. Rollback（任何階段出錯）

```bash
# 還原 master 到舊穩定版
git checkout master && git reset --hard backup/pre-launch-master-20260529-172731
# Zeabur 重新部署該 commit；或 Zeabur 後台 redeploy 上一個成功版本
```
Zeabur 後台亦保留前次成功部署，可一鍵 redeploy 回退。
