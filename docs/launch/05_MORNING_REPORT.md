# 晨間報告（先讀這份）

> 過夜 session 完成的可逆準備 + 審查總結。**沒有任何 push / merge / 部署 / key 異動。**
> 你只要做 §3 的 4 個決策，再照 `03_DEPLOY_RUNBOOK.md` 一步步走即可。

---

## 1. 早安，現況一句話

本地 `feat/fire-rescue` 領先穩定版 master **104 commits + 一批未 commit 的消防/農業/road events 工作**。
今晚我把它**審查完、準備好、文件化**，全程可逆（backup tag 在）。新版 `tsc -b` 綠燈、code review 無 blocker。
**還沒上線** —— 因為有 4 件事要你拍板（特別是你交代「留早上說」的 key），以及一個成本決策（agriculture 380MB）。

## 2. 今晚做了什麼（都可逆）

| 動作 | 可逆方式 |
|---|---|
| 建 backup tags（master + feat）+ stash WIP | tag/stash 還在，隨時 reset |
| `tsc -b` → exit 0 | — |
| 逐層稽核 129 layer、部署鏈、Supabase（含**連線實測 DB**） | 唯讀 |
| WIP code review（無 blocker）+ Codex 獨立第二意見 | 唯讀，log 在 `/tmp/pulse_launch/codex_review.log` |
| **部署鏈改動（inert，不部署不生效，已驗證）**：entrypoint.sh + Dockerfile ENTRYPOINT、pull 全面改 `aws s3 sync`、upload 加 agriculture 子前綴、nginx 加 `/agriculture/` + `/geo /h3 /bus` dist fallback、.gitignore 補排除 | `git checkout -- <file>` 或 reset 回 `backup/pre-launch-feat-*` |
| 驗證：`sh -n`/`bash -n` 腳本語法、`nginx -t` 通過、`aws s3 sync` skip 行為實測 | — |
| 寫了 `docs/launch/` 7 份文件（含 06 搬家計畫） | 純新增 |

> 這些改動只在「重新 build image 並部署」時才生效；今晚沒部署、沒上傳、沒改 key，**線上完全沒變**。

## 3. ⚠️ 需要你拍板的 4 件事

### D1 — Key（你指定留早上）
- `.env` 含 live secrets（Mapbox / S3 access+secret / Gemini / FR24 / Supabase service_role / DB URL）。
  **已驗證未洩漏進 git**（`.gitignore` 有擋，git 史乾淨）。
- **上線必須在 Zeabur 設的**：build arg `VITE_MAPBOX_TOKEN`；runtime `S3_ACCESS_KEY/S3_SECRET_KEY/S3_REGION/S3_BUCKET`、`VITE_SUPABASE_URL/ANON_KEY`、`VITE_DATA_SOURCE=supabase`。
- **我的建議（待你決定）**：
  1. runtime 的 S3 key 換成**最小權限唯讀 key**（只 `s3:GetObject`+`s3:ListBucket`，限 `deploy-assets/*`），不要用本地那把可寫的 upload key。← Codex 也建議
  2. Mapbox token 設 **URL/domain 白名單**（防被盜刷量）。
  3. 是否輪換現有 key（FR24/Gemini 沒進 bundle，風險低；可不急）。
- **要不要我現在幫你把 Zeabur env 設好？哪幾把 key、用哪個值？** ← 等你回覆

### D2 — Agriculture：管線已接好 ✅，早上只需「上傳 + 確認範圍」
- 你決定要上 → 我已把 agriculture 部署管線**全部接好**（upload 子前綴 / pull sync 整夾 / nginx `/agriculture/`），語法都驗過。
- 實際內容是 **270MB / 10 層**（不是 380MB）：最大是農田 102M + 作物 74M（PMTiles，訪客只傳視野瓦片=省）；零售 20M + 蔬果批發 13M 是 GeoJSON（整包下載=每訪客較貴）。土壤只佔 58M。
- **早上只剩**：跑 `bash scripts/deploy/upload-deploy-assets.sh` 上傳（一次性；sync 後重啟不重抓）。
- **待你最後確認範圍**：全部 10 層、還是拿掉「零售/批發」那兩個 GeoJSON（移出 upload 腳本的 `AGRI_FILES` 兩行即可）。預設全上。

### D3 — Supabase 安全收斂何時做？
- anon 可繞 RPC 直讀 `reference/spatial/fire/maritime/rail/safety` 的表（realtime 已安全不曝光）。前端其實只用 RPC（唯一 `.from()` 是 earthquake_events/public）。
- **選項**：上線前撤（撤完要逐層 smoke test 確認沒打到別的）、或上線後再硬化。
- **建議**：上線後做（先確保功能一致），列為 STEP 9；同時評估加 rate-limit / Cloudflare。

### D4 — `get_bus_trails` timeout —— ✅ 已解決，零動作
- live DB 實測 **timeout 已是 60s**（migration 033 早就覆蓋舊版 030 的 0，且已上線）。稽核 agent 看到 0 是誤報。
- 實測查詢時間：單城 22ms、全城（worst case）35ms → 1700 倍餘裕，不可能撞 60s。
- **結論**：不用改。

## 4. 三大門檻現況（詳見 `02_PRELAUNCH_CHECKLIST.md`）

- **Supabase 穩定** 🟢：81 RPC anon 全可呼叫、大 payload 有 timeout、cron 錯峰。唯 D4 待改。
- **費用** 🟡：Zeabur credit $0 需確認帳務；agriculture 成本看 D2；anon egress 看 D3。
- **資安** 🟡：.env 未洩漏 ✅；唯 D3 待收斂。

## 5. 接下來照 runbook 走

`03_DEPLOY_RUNBOOK.md`：STEP 2 commit → (D2?) STEP 3 → STEP 4 nginx fallback → STEP 5 merge master → STEP 6 本地 docker 實測 → STEP 7 push+Zeabur env+部署 → STEP 8 逐層 smoke test → STEP 9 硬化。
**任何一步出錯**：`git reset --hard backup/pre-launch-master-20260529-172731` + Zeabur redeploy 舊版。

## 6. tmux / 產物位置
- tmux session `pulse_launch`：window `build`（tsc log）、`codex-review`（Codex 完整報告）。`tmux attach -t pulse_launch` 可看。
- log：`/tmp/pulse_launch/tsc.log`、`/tmp/pulse_launch/codex_review.log`
- 既有 `gis_work` / `restai` session 未動。

## 7. 我沒把握 / 需你確認的點（誠實說）
- **舊 volume 內容**：我沒在線上跑 `ls /data`（避免動 prod）。`/geo` `/h3` `/bus` 的 git 小檔是否已在 volume，決定 GAP-3 急迫度 → runbook STEP 4 有唯讀驗證指令，建議部署前先跑。
- **Zeabur 帳務細節**：credit $0 的實際計費/volume 容量上限我看不到，需你在後台確認。
- **agriculture 上游驗收狀態**：我依 memory 推測「未驗收」，正確與否你最清楚。
