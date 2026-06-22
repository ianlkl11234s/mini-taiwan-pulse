# 跑卡了怎麼辦 — Troubleshooting

> 這 session（2026-06-22）卡死 8 小時 + 反覆 40 分鐘 retry 學到的痛點全部寫進來。
> 跑可達分析前 / 跑卡時 / 卡完後 — 三個時點各一份 checklist。

---

## ⏱ 跑前先做：健康檢查（30 秒）

**為什麼**：之前我多次直接跑 batch，跑 40 min 才發現 mirror 早就 down，反覆浪費時間。

```bash
# 1. mirror 健康度
for mirror in \
  "https://overpass-api.de/api/interpreter" \
  "https://overpass.kumi.systems/api/interpreter" \
  "https://overpass.openstreetmap.fr/api/interpreter" \
; do
  echo "=== $mirror ==="
  curl -sS --max-time 5 -X POST "$mirror" --data-urlencode \
    "data=[out:json];node(25.03,121.5,25.04,121.51);out 1;" 2>&1 | head -c 100
  echo
done
# 回 {"version":0.6,...} = OK / 回 <html> 或 timeout = down

# 2. 磁碟空間
df -h ~
# 確認 free ≥ 50 GB（osmnx cache + ndjson 中間檔需 ~5-10 GB）

# 3. RAM（如果走 pyrosm 路線）
sysctl hw.memsize hw.physmem 2>&1 | head -2
# 跑 pyrosm 全台 driving 需 ≥ 60 GB RAM（含 swap），否則必須 osmium 預過濾
```

**至少要有一個 mirror 回 200**，否則直接跳到「換策略」段。

---

## 🔍 配置對齊：重跑前 grep 確認（30 秒）

**為什麼**：這 session 我為了試 B 版（+unclassified）改了 `CUSTOM_FILTER`，後續要 retry A 版時忘記改回 motorway-tertiary，**以為跑 A 實際跑 B 又卡，浪費 ~1 小時**。

```bash
# 對齊「上次成功跑」的關鍵 config
grep -n "CUSTOM_FILTER\|TW_MAIN_BBOX\|max_query_area_size\|OVERPASS_URL\|overpass_url" \
  scripts/road_isochrone/taiwan_nearest_distance.py

# 比對 git log 最後成功跑的那 commit
git show <last-success-commit> -- scripts/road_isochrone/taiwan_nearest_distance.py | grep CUSTOM_FILTER
```

**3 個常見偏差**：
1. `CUSTOM_FILTER` filter 範圍變了（多 `unclassified` / 少 `tertiary`）
2. `TW_MAIN_BBOX` 改變（影響 subdivide 切法 → cache key 變）
3. `OVERPASS_URL` 設值帶 `/interpreter`（osmnx 自動拼會變 `/interpreter/interpreter` 雙拼）— **必須是 base URL**：
   ```python
   # ❌ 錯
   ox.settings.overpass_url = "https://overpass.kumi.systems/api/interpreter"
   # ✅ 對
   ox.settings.overpass_url = "https://overpass.kumi.systems/api"
   ```

---

## 🚨 真卡了：診斷流程（5 分鐘）

**為什麼**：我曾經把 CPU=0% 的 process 等 8 小時，以為「應該很快」。實際上是 socket 卡 read 沒回應。

### Step 1 — 用 `ps` 看狀態

```bash
pgrep -f taiwan_nearest_distance | xargs -I{} ps -o etime=,pcpu=,pmem= -p {}
```

判讀：
- `etime` > 10 min 且 `pcpu` < 1%：**很可能卡網路 / socket 等候**
- `pcpu` > 50% 持續：CPU bound，等等
- `pmem` 突然飆高（> 50%）：**RAM 爆，會觸發 swap thrash**

### Step 2 — `sample <PID>` 看 stack trace

```bash
PID=<your-pid>
sample $PID 2 2>&1 | head -40
# 看 Call graph 最底層 frame 是什麼
```

判讀：
- 卡在 `socket.recv` / `_overpass_request` → **網路等候**（mirror 不回）
- 卡在 `multi_source_dijkstra` → CPU bound 等等
- 卡在 `to_graph` / `compose_all` → 可能 RAM 即將爆
- 卡在 `_create_graph` → osmnx 在拼接 subquery，等

### Step 3 — 看 log 增量

```bash
# 看 cache 增量
ls -lt cache/*.json | head -5
# 跑開始後有新檔 = 有進度 / 沒新檔 = 卡在第一個 subquery
```

### Step 4 — 決定 wait or kill

| 卡點 | 等多久 |
|---|---|
| 網路等候 < 5 min | 等 |
| 網路等候 > 10 min 無增量 | **kill** |
| CPU bound osmnx 抓全台 | 最多 15 min |
| CPU bound networkx dijkstra | < 1 min（dijkstra 對 75K nodes 應該秒回）|
| RAM 飆到 > 50% | **立刻 kill** 避免 swap thrash |

**通用上限**：**超過 30 分鐘無 cache 增量 / log 進度 → kill**，不要被動「再等 5 分鐘」。

---

## 🔄 換策略：mirror 救援

如果重試 mirror 還是不通，按優先順序切：

```
1. 等 cooldown 2-3 小時，亞洲晚上 21:00 後再試 overpass-api.de
   （這 session 經驗：~12-24h 自然解除）
2. 切其他 mirror — 設 OVERPASS_URL（注意 §3 base URL 格式）
3. 走本機 PBF + osmium 預過濾（osmium-tool brew install）
4. 用 osrm-taiwan zeabur service（雲端不吃本機）
5. PostGIS pgr_drivingDistance（長期正解）
```

完整實作見 `mirror-fallback.md`。

---

## 📝 預防：Pipeline 寫法守則

**為什麼**：osmnx 內建 subdivide 序列跑 32 subquery 完全靜默，25 min 無 output 不知道是慢還是卡。

### 必加 progress log（避免 silent stall）

```python
# osmnx 抓圖前
print(f"[1/5] osmnx 抓路網 bbox={BBOX} filter='{CUSTOM_FILTER}'...", flush=True)
t0 = time.time()
G = ox.graph_from_bbox(...)
print(f"     [done] {G.number_of_nodes()} nodes / {time.time()-t0:.0f}s", flush=True)

# 每完成一 step 印一次
print(f"[3/5] dijkstra bucket={bucket}...", flush=True)
```

### 不要依賴 cache 加速

```python
ox.settings.use_cache = True   # 可以開，但不要假設「同 query cache hit 秒讀」
# cache key = query body hash + osmnx subdivide 切法 + settings
# 切法微差 / mirror URL 改 → cache miss → 又重抓
```

### 加 timeout 強迫 fail fast

```python
ox.settings.requests_timeout = 600   # 10 min 上限，避免無限等
```

### 用 `flush=True` 確保即時 print

```python
print(msg, flush=True)
# 或 sys.stdout.flush() — 否則 background batch 看 tee 可能看不到即時 log
```

---

## 🩺 本 session 卡點實錄（給未來自己看）

| 時點 | 卡點 | 根因 | 解 |
|---|---|---|---|
| 6/21 22:33 | osmnx +unclassified 卡 8h | Overpass kumi mirror subquery 卡 | kill, 換 mirror |
| 6/22 早 | pyrosm 全台 driving 卡 40 min | 50 GB RAM 吃爆磁碟 5 GB free | kill, 走 osmium 預過濾路線 |
| 6/22 12:15 | osm.fr mirror 403 | whitelist only | 跳過此 mirror |
| 6/22 13:00 | kumi 跑 23 min 0 進度 | 第一個 subquery 卡 | kill, retry overpass-api.de |
| 6/22 14:00 | overpass-api.de 406 | IP cooldown 24h+ | 等 cooldown 解除 |
| 6/22 14:50 | overpass-api.de 200 | cooldown 解除（~15h）| **跑成功**（10 min）|

教訓：**沒有「mirror 永遠不會通」這回事，但也沒有「mirror 永遠通」這回事**。pipeline 設計時必須假設 mirror 隨時可能 down，並有 fallback 路徑跟診斷工具。
