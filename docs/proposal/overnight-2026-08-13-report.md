# 過夜批次報告（2026-08-12 夜 → 08-13 晨）

> 對應交接文件：`docs/proposal/next-batch-handoff-2026-08-12.md`（W1~W6）
> owner 開工時調整範圍：**做 W1／W2／W3／W5／W6(a,b,c)／AR-11e；不做 W4 snapshot-to-CDN；ships 下滑不查**
> 執行方式：opus 主控拆解／決策／驗收，工作派 sonnet-opus 子代理，各自獨立 git worktree（base = `origin/master` `382b896`）
> **一律未 push、未開 PR、未 merge、未 apply migration、未刪任何資料** —— 全部等 owner 明早拍板

---

## 0. 一句話總結

六條工作全數推進；**其中兩條是「幽靈待辦」——功能早就上線了，文件狀態欄沒回填**（省下原估 4-5hr＋一輪 push）。
AR-11e 的前提整個翻案（3.2GB 已被既有 cron 磨到 580MB），並撈出一個**資料遺失紅旗**。
另查明 **Zeabur 是 master 自動部署，merge ＝ 直接上線**，明早的 merge 決策要照這個前提做。

---

## 1. 已完成（各自 worktree 分支，皆未 push）

| 分支 | 內容 | commits | 驗收 |
|---|---|---|---|
| `chore/staticassets-ack-bm-closeout` | W1 追認落地＋W6-a BM-1~4 關單＋W6-b MO-17 狀態更正 | `c30e218` `99063b8` `358f293` | tsc 0 error／42 檔 560 綠 |
| `test/hook-registry-per-key` | W3 完整性測試 7 個雙桶 key 盲區 | `a911228` `ac65d21` | tsc 0／**562 綠**（新增 2 測試）＋紅燈演練實測 |
| `feat/popup-backfill` | W2 popup 補強（第一階段 11 個 key） | `4bcf38e` `e025cac` `989cbf6` `ebaeb48` `a19f408` | tsc 0／560 綠／**11/11 瀏覽器實點驗過** |
| `chore/au6-single-lockfile` | AU-6 lockfile 統一 A 案＋PB-06 修正 | `fd399c1` `92493f8` `1816127` `1203172` `501bfcb` | tsc 0／560 綠／**docker build 通過** |
| `feat/alerts-integration` | W5（Phase 1 實證回填；Phase 2 進行中） | `2156a23`＋ | 見 §6 |

### 1a. W1 staticAssets 追認
三處字樣改「已追認（2026-08-12 owner）」：`layerManifest.ts:151` 型別註解、`layer-manifest/backlog.md:244`、`changelog.md:2583/2603`。
另有 9 處「代拍」屬拍板③（section null 擴大）／⑤（popup 陣列）／⑥（source kind 混合），與 staticAssets 無關，**刻意留原狀**。

### 1b. W6-a BM-1~4 關單
各附 manifest 行號證據：BM-1 `osmExpressway`(:7669)／BM-2 `hillshade`(:3905，觸點 #20 已修部署缺口)／BM-3 `slopeVector`(:3929)／BM-4 `aspectVector`(:3954)。
**順帶查出 BM-3/BM-4 實作改走向量路線**（非原案烤 PNG），已在證據句註明。BM-5（deck.gl COG）維持 open。

### 1c. W3 測試盲區
`DUAL_MOUNT_KEYS`（7 個雙桶 key 的**固定清單**，非即時算交集——才能在其中一邊被刪時仍守得住）＋ per-key `REQUIRED_MOUNTS` 對表，另加 ratchet 斷言防未來新雙桶 key 沒登記。
**紅燈演練實測**：拿掉 `h3Population` 的 registry entry → 兩條斷言雙紅（原本是綠）；拿掉單桶 `rainGauge` → 舊聯集斷言照樣紅，不退化。
已知限制（`ac65d21` 註記）：per-key 對表守的是「宣告層級」，若 App.tsx 實際 hook call 被刪但 ledger 沒跟著改，本測試仍看不出來——static ledger 的天生限制。

### 1d. W2 popup 第一階段（11 key）
水資源 8 層（`groundwaterWells` `iotWraRiver` `iotWraStructure` `waterBasins` `waterRivers` `waterLevees` `waterCanals` `waterProtectionZones`）＋ `osmExpressway`（複用 `OsmRoadDrivePanel`）＋ `wasteStopsStatic` ＋ `stationsTHSR`（複用 `RailStationPanel`）。
黃金快照 +67/−0 全在 `gisLayers`，恰為 11 列。`waterCanals` 的縮寫欄位有回上游 pipeline 白名單查證（o=管理處／n=渠道名／t=引灌需求三分類／src=來源）。

> ⚠️ **過程揭露**：水資源那批因 `legend: null / popup: null` 錨點不唯一，改用 python 腳本批次替換，**PostToolUse 守門 hook 沒看到那批改動**；事後全套 vitest（manifest 契約＋ledger 雙向）綠可覆蓋同一範圍。第二階段已要求避免同樣盲點。

### 1e. AU-6 lockfile（owner 拍板 A 案）
- 刪 `pnpm-lock.yaml`（2702 行）、`package.json` 補 `"packageManager": "npm@11.4.2"`
- 文件對齊**改 21 處／刻意不改 43 處**，判準＝「改未來會被執行的指令，不改過去事件的紀錄」。最 load-bearing 的一改是 `PRINCIPLES.md` 原本教人跑 `pnpm install --lockfile-only`——照做會把 pnpm-lock **生回來**
- 一致性檢查：27/27 套件的 package.json range 與 npm lock 相符，**未跑** `--package-lock-only`，版本刻意不動（`mapbox-gl` 維持 3.18.1）
- 防漂移守門：`ci.yml` 在 `npm ci` 前加純 shell step，偵測到 `pnpm-lock.yaml` 即 `exit 1`（零新 action 依賴，已實測 fire/pass 兩態）
- **`docker build --no-cache` exit 0**：`npm ci` → `added 299 packages` → `vite v6.4.1 built in 11.29s`

---

## 2. 🔴 重大發現一：兩個幽靈待辦

| 項目 | 文件說 | 事實 |
|---|---|---|
| **MO-17** 台股 30 日 sparkline | 「done（未 commit）…**未 push** 待用戶拍板」 | **2026-08-02 隨 PR #103（`1128466`）已上線**；gis-platform `d852752`(migration 325) 也已在 `origin/main`。master 的 `PressureRing.tsx:193-198` 有 30D Sparkline（尺寸還從 150×24 被調大到 360×48，代表上線後仍有迭代） |
| **W5 警訊整合 Phase 1** | impl 文件 §9 checklist 全 ⏳ | **2026-06-17 隨 PR #20（`01ceb11`）12 顆 task 全數落地**；migration 211 早已 apply（anon key 打三支 RPC 全 200、當下 74 筆 active） |

**共同病根**：功能上線了，但文件的狀態欄沒回填。MO-17 更因 PR squash 換了 commit hash，`git branch --contains` 查原 commit 顯示「未併入」，造成誤判。

**建議的制度性修法**（明早可順手決定）：`/wrap-up` 加一步「PR merge 後回填 BACKLOG 狀態欄與 impl 文件 checklist」，或在 PR template 加一條 checkbox。否則下一份交接文件會再踩一次。

---

## 3. 🔴 重大發現二：AR-11e 前提翻案（含資料遺失紅旗）

**BACKLOG 的「3.2GB」是過時數字。**`cron.job` jobid **75**（`cleanup-cwa-imagery-frames`）自 **2026-07-07** 起每日跑 14 天保留，36 次全 succeeded，早把它磨到 **3,800 列 / 580MB**（全表 629MB）。
→ **AR-11e 的「補自動清理排程」這半其實已經完成了**，剩下的是舊 RPC 下架。

- **目標**：`live.cwa_imagery_frames.image_bytes`（bytea，**NOT NULL** → 只能設 `''::bytea` 不能 NULL）。schema 是 `live` 不是 `realtime`（migration 312 已搬）
- ⚠️ `aqi_imagery_frames` / `precipitation_raster_frames` **沒有 R2 副本，絕對不能碰**
- **R2 對照**：不是抽樣——**全量 3,798 筆逐筆 HTTP HEAD，3,798/3,798 = 200，零缺檔**

### 🚩 紅旗：2 筆孤兒列
2026-07-09 有 **2 筆 `image_key IS NULL` 的列，R2 上不存在，DB 是世上唯一一份**（collector best-effort 上傳失敗所致）。
目前靠 cron 的 `image_key IS NOT NULL` 條件苟活 → **不會被誤刪，今晚安全**，但**任何清理動作前必須先跑 `backfill_imagery_r2.py` 補上**。

另有 64 筆 size 分歧（CWA 對同 `observed_at` 重繪，R2 是較新官方版，兩邊都是有效 800×800 圖）→ benign，但意味 **R2 不是逐位元組備份**。

### 還在讀 DB 影像的
- production：**零讀取**
- **本機 dev 沒設 `VITE_IMAGERY_CDN_BASE` → 仍走 `get_cwa_imagery_frames_batch` 讀 bytea**
- 3 支 legacy RPC 尚存，DB 內部零引用

### 調查者立場（條件式放行）
- ✅ **RPC 下架可走**，但嚴守順序：孤兒 backfill → pulse 移 fallback＋死碼並補 `.env` → 線上驗收 → 才 DROP
- ❌ **不放行單獨的一次性 bytea 清空** —— collector 仍雙寫，兩週就長回原狀，是白工
- ⏸ **Option A / B 需 owner 拍板**（見 §5）

方案書全文（含逐字可執行 SQL、R2 對照表、回復方案）：`scratchpad/ar11e-cleanup-plan.md`

---

## 4. 🔴 重大發現三：Zeabur ＝ merge 即上線

實查（Zeabur CLI）：service `mini-taiwan-pulse`（project `mini-tw-pulse`）綁 GitHub `refs/heads/master`，deployment metadata `"planType": "docker"`。

- **走 Dockerfile，不走 zbpack**：build log `COPY package.json package-lock.json` → `RUN npm ci`（`added 299 packages`）→ `npm run build`（`vite v6.4.1`）。全 log grep `pnpm|yarn|corepack` **零命中**
- repo 無 `zbpack.json`/`zeabur.json`，service env 無任何 `ZBPACK_*` → 唯一能把 build 導離 Dockerfile 的機制**不存在**
- S3 只放 runtime 資料（`pull-deploy-assets.sh` 啟動時拉進 `/data`），**不參與 build**
- ⚠️ **沒有 staging 中繼——PR merge 的那一刻就是部署**

**對 AU-6 的結論：安全**。`pnpm-lock.yaml` 從不進 build 路徑；`package-lock.json` 在分支上與 master 逐位元組相同，`npm ci` 輸入等同現行 production。`packageManager` 欄位在 Dockerfile 路徑被忽略（無 corepack），反事實走 zbpack 時反而會判成 npm，是保險。
唯一未驗：**此分支本身還沒在 Zeabur build 過**。merge 後看首次 build log 仍是 `npm ci` + `added 299 packages` 即可轉綠。

（順手修掉 `PLAYBOOKS.md` PB-06 提到的 `zeabur.json` —— 該檔從不存在，已改為上述實證。8/12 那次 FAILED deployment 是 GitHub 網路逾時，與 lockfile 無關。）

---

## 5. 明早要 owner 拍板的事

1. **AR-11e 走 A 還是 B**
   - **A（調查者建議）**：維持 14 天 DB 副本當災備，只收尾 RPC 下架。理由：580MB 佔 37GB 的 1.6%，純省空間 ROI 低
   - **B**：collector 停寫 bytea ＋ 拉長 metadata 保留，前端歷史深度從 14 天 → 21,587 張。**B 的真正賣點是產品加值，不是省空間**
   - **無論 A 或 B，第一步都是先跑孤兒 backfill**（那 2 筆是世上唯一一份）
2. **W2 的 EDGE 6 筆**逐項決定：房地產 Grid×3（hover 無觸控替代，補 click 是 S）／`temperatureWave`（3D raycast 換重複讀數，M-L）／`waterFloodExtreme`（payload ＝圖例已標的分級）／`powerPoles`（欄位薄但族群不一致是真的）
3. **push / merge 決策**（見 §7 建議順序）—— 記得 merge 即上線
4. **要不要補一條制度性防呆**擋幽靈待辦再發生（§2 末）

---

## 6. 進行中／未完成

- **W5 Phase 2**（owner 拍板要做）：地圖警報點 B2 pulse／警報進壓力指數／RWD／歷史檢索。另含 owner 拍板的「safety 群組**按群組分開設規則**」（海洋污染類 `expires` 常在 2-9 個月後，導致 active 語意過寬、列表長期卡數十筆）
- **W2 第二階段**：29 筆 CANDIDATE 剩餘 18 個 key（raster 值探針 `urbanHeat`/`canopyHeight` 放最後）＋ 上游資料品質問題彙整
- **W5 覆核撈到的資料問題**：地震列的 `county` 回的是震央描述而非縣市（判定中：前端修 or 動 RPC）
- **W2 第一階段撈到的上游資料問題**（basins `area_km2` 實為 m²／levees `length_m` 與 catalog 矛盾／`water_rivers` 線層 3 欄全空／宜蘭 9,918 條 canals 的 n/t 恆空／`irrigation_canal.md` frontmatter 漂移）→ 正彙整成文件，**建議之後路由回 taipei-gis-analytics**

---

## 7. 建議的 merge 順序與 post-merge 檢查

風險由低到高，每步 merge 後確認再進下一步（**每次 merge 都會觸發 Zeabur 部署**）：

| # | 分支 | 為何這個順序 | merge 後要看什麼 |
|---|---|---|---|
| 1 | `test/hook-registry-per-key` | 純測試，零 runtime 影響 | CI 綠即可 |
| 2 | `chore/staticassets-ack-bm-closeout` | 純文件／memory | 無 runtime 影響 |
| 3 | `chore/au6-single-lockfile` | 動 build 輸入，但已 docker build 驗過 | 🔑 **首次 Zeabur build log 是否仍 `npm ci` + `added 299 packages`** |
| 4 | `feat/popup-backfill` | 動 manifest／golden 快照，範圍大但已逐 key 實點驗過 | 上線後隨機點 2-3 個新接的圖層看面板 |
| 5 | `feat/alerts-integration` | 動最多（新 UI＋可能新圖層） | 地圖警報點 pulse 有沒有出現 |

---

## 8. 工作區狀態（給平行 session 的保證）

- **主樹全程未動**：`git status` 空、仍在 `feat/vessel-watch`（vessel-watch session 的 2 顆 commit 原封不動）
- 所有工作在 `.claude/worktrees/{w1-docs,w2-popup,w3-regtest,w5-alerts,w6c-lockfile}`，五個 worktree 零殘留 symlink
- 唯讀取用過主樹的 `.env`（W5 做 production RPC 探測、W2 做瀏覽器驗收），只讀不改
- `public/police_justice` 是 6/29 就存在的 gitignored symlink，非本批產物

---

*本報告由 opus 主控彙整；各 track 的完整回報與方案書見 session scratchpad。*
