# 新增 Layer / 資料的分類準則（SSOT）

> 每次要加一個新 layer 或新資料，**先走這張決策樹決定它屬於哪一類**，再照那一類的 checklist 接線。
> 這張準則的存在，是為了根治 2026-06 上線前發現的 GAP-1（農業整組漏接 → 404）：
> 根因就是「沒有統一分類 + 部署鏈靠散落手寫清單」。搭配 `CLAUDE.md` §5（新增 Layer 強制順序）與 §5a（UX 四鐵則）。

---

## 一、四葉決策樹（先分類）

```
① 資料會變嗎？（即時 / 時序 / 每天更新）
   ├─ 會變 ───────────────────────→ 【A 動態·Supabase】
   └─ 不會變（靜態）→ ②

② 需要「伺服器端查詢 / 篩選 / 被多個服務共用」嗎？
   （要按條件查、要 join、要分頁、其他系統也要讀）
   ├─ 需要 ───────────────────────→ 【B 靜態·Supabase】
   └─ 不需要（整層就是一坨幾何，前端直接畫）→ ③

③ 檔案多大？
   ├─ < ~2MB ─────────────────────→ 【C 靜態小檔·git】
   └─ ≥ ~2MB ─────────────────────→ 【D 靜態大檔·S3→volume】
        └─ 幾何很大（>10MB 的 polygon/line/海量 point）→ 優先做成 PMTiles
```

| 類 | 一句話 | 存哪 | 怎麼到瀏覽器 | 例子 |
|---|---|---|---|---|
| **A 動態·Supabase** | 會變的資料 | DB（realtime/spatial schema） | `public.get_*` RPC，runtime 拉 | 公車位置、水位、雷達回波 |
| **B 靜態·Supabase** | 不變但要被查 | DB（spatial/reference schema） | RPC 或 `.from()`（走曝光 schema） | 地震事件、H3 年度統計 |
| **C 靜態小檔·git** | 不變、小、整層畫 | git `public/` | build 進 dist，nginx 直接 serve | 機場、燈塔、海纜 |
| **D 靜態大檔·S3→volume** | 不變、大、整層畫 | S3 `deploy-assets/` | sync 進 `/data`，nginx 反代 | 省道、淹水潛勢、農田 PMTiles |

> 經驗門檻：**~2MB**。沒有絕對值——小檔丟 git 的方便 > 一點點肥；大檔超過門檻，git/image 會被拖累，這時 S3 管線才划算。

---

## 二、各類的 checklist（接線步驟）

### 【A 動態·Supabase】
後端（gis-platform migration）：
1. 寫 RPC `public.get_xxx(...)`，**務必** `GRANT EXECUTE ... TO anon, authenticated;`（漏了 = layer 空白，2026-04-07 教訓）
2. 大 payload / 長查詢加 `SET statement_timeout TO '30s'~'60s'`（避開 anon 預設 3s）
3. 預估 rows > 15k → 套 pre-aggregate / hourly DISTINCT ON / JSONB grouped（避開 PostgREST 20k 截斷）
4. **不要**為了前端而開 anon 對原始表的 table SELECT；一律走 RPC

前端：
5. loader 包 `loadingRegistry` start/complete；動態層走 `timeStore` 訂閱（禁 currentTime 進 deps）
6. 驗證：`/check-rpc <name>` 跑 EXPLAIN；DB 實測 `SELECT has_function_privilege('anon','public.get_xxx(...)','EXECUTE');`

### 【B 靜態·Supabase】
- 何時選這類而不是檔案：資料要被**條件查詢/篩選/分頁/跨服務共用**時。
- 後端：放對應 schema（spatial/reference），開 RPC wrapper（同 A 的 GRANT/timeout 規則）。
  若真的要讓前端 `.from()` 直讀，該 schema 必須在 Supabase「Exposed schemas」內 + anon 有 table SELECT；
  **這是攻擊面，能用 RPC 就用 RPC**（見 §四 資安紅線）。
- 前端：loader 包 loadingRegistry。

### 【C 靜態小檔·git】（< ~2MB）
1. 放 `public/geo/`（或對應子目錄），**不要**加進 `.gitignore`
2. 確認 nginx 已有該 URL 前綴 location（`/geo/` 已涵蓋且有 dist fallback；全新前綴才要加）
3. loader 用相對路徑 `./geo/xxx.geojson`

### 【D 靜態大檔·S3→volume】（≥ ~2MB）★最容易漏，五處到齊
1. **`.gitignore`** 加排除（大檔別進 git）
2. **`scripts/deploy/upload-deploy-assets.sh`** 加上傳（同類大量檔 → 用 `deploy-assets/<群組>/` 子前綴）
3. **`scripts/deploy/pull-deploy-assets.sh`** 加 sync（落到正確 `/data/<子目錄>`）
4. **`nginx.conf`** 加/確認 `location /<子目錄>/`（混 git 小檔的前綴要 `try_files $uri @dist`）
5. **`docker-compose.yml`** 加 volume 掛載（本地一致）

> ⭐ **搬到鏡像結構後**（見 `06_DEPLOY_ASSETS_MIGRATION.md`）：加新大檔只要「丟進對應 S3 資料夾」，
> pull 整夾 sync、nginx 整夾路由都已涵蓋 → **第 2~4 步幾乎不用改**，GAP-1 類漏接永久消失。

---

## 三、上線前 30 秒總驗（任何新資料都跑）
```bash
npx tsc -b                                   # 型別
# 靜態檔覆蓋：列出前端引用，逐一確認 git 或 S3 三清單覆蓋
grep -rnoE "\./(geo|fire|agriculture|h3|rail|bus)/[a-zA-Z0-9_./-]+\.(geojson|pmtiles|json)" src/ | sort -u
# 動態：anon EXECUTE 實測 + EXPLAIN
```

## 四、安全 / 費用紅線（每次都想一下）
- 新 RPC 別讓 anon 無 LIMIT 拖大表；imagery/trails 類務必 timeout（`get_bus_trails` 曾 timeout=0）。
- 新增曝光 schema / table SELECT 前先問：anon 真的需要直讀嗎？預設只走 public RPC。
- 大檔上 S3 = 倉儲（每月幾塊）+ 訪客流量。**PMTiles 只傳視野內瓦片（省）；大 GeoJSON 整包下載（貴）** → 海量幾何優先 PMTiles。
- sync 機制下，volume 已有的檔重啟不重抓（見 pull 腳本）。
