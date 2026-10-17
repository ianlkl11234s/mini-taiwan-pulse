# 網路觀察卡怎麼讀（internetHealth）

> 2026-10-02 唯讀調查。資料取自 `live.internet_health_observations`（近 30 天）、RIPE Atlas 公開 API 抽查一次（20 分鐘窗）。
> 本文的色帶與規則是**建議**，不是定論；樣本期只有 30 天，且目前存的歷史值大多受下述 collector 缺陷影響。

## TL;DR

1. **IPv6 鋸齒是假的，是 collector 造成的，不是網路異常。** 每個 5 分鐘桶最後一次被寫入時，只算到桶內最後約 1.6 分鐘的量測結果（30 分鐘回看窗的切口落在桶中間，而且寫入方式是無條件覆寫）。所以每桶只有 10–21 支探針（roster 有 41 支，目前實際有回報的是 39 支），而且每桶的探針組合跟著 240 秒量測週期輪替，20 分鐘一循環。IPv6 剛好有 4 支探針一直不通，它們有沒有落在某一桶裡，就決定那一桶是 82% 還是 100%。
2. **IPv6 真實水位約 85–90%，而且很平穩**（完整桶 p10/p50/p90 = 0.85／0.87–0.89／0.89–0.91）。不是 100%，原因是固定有 4 支探針的 IPv6 完全不通，屬於結構性的狀況。
3. **卡片上方的即時數字也是殘缺桶**：`internet_health_current` 指向的永遠是還沒收完的那一桶（實測 IPv4 Probe 回報率顯示 12.6%、探針 11 支）。Probe 回報率和可達 ASN 比率的即時值與 24H 線目前都不能拿來判讀。
4. RIS 的 Prefix 可見度、撤回比率**永遠是空值**（roster 沒設 prefix），只有 Origin 變更有數字。

---

## 1. 指標怎麼算

### RIPE Atlas（`data-collectors/collectors/ripe_atlas_internet_health.py`）

量測：RIPE 內建的 ping 量測 **1001（IPv4）／2001（IPv6）**，目標 `k.root-servers.net`，`interval=240s`（已用 `atlas.ripe.net/api/v2/measurements/{id}/` 確認）。探針用版本化 roster `config/ripe_internet_health.yaml`（version 2026-08-31.1）：IPv4 87 支（L15-107）、IPv6 41 支（L109-155），都是臺灣公開探針的快照。

| 指標 | 公式（每個 AF、每個 5 分鐘桶） | sample_count | 程式位置 |
|---|---|---|---|
| Ping 成功率 | 桶內 Σrcvd ÷ Σsent（以封包為單位，不是以探針為單位） | 回報探針數 | L235-239 |
| 中位 RTT | 有收到封包的探針，取各自 `avg` 的中位數 | RTT 樣本數 | L240-244 |
| Probe 回報率 | 桶內有回報的探針數 ÷ roster 探針數（87／41） | 回報探針數 | L230-234 |
| 可達 ASN 比率 | 有收到封包的探針所屬 ASN 數 ÷ roster ASN 數（IPv4 34／IPv6 22） | 成功 ASN 數 | L245-249 |

- 分桶：依照結果的 `timestamp` 對齊 300 秒（L118-121、L191）；observed_at＝桶結束時間（L256）。
- 排程：每 5 分鐘一次（`config.py:312`），回看 `RIPE_ATLAS_LOOKBACK_MINUTES=30`（`config.py:395`；`collect()` L332）。
- 寫入：`ON CONFLICT … DO UPDATE` 無條件覆寫（`storage/supabase_writer.py:2482`）。
- `stale_after_seconds` = max(900, 240×3) = **900 秒**（L251-254、`config.py:397`）；RPC 回傳的 `is_stale` 依這個值判斷。
- 前端 24H＝5 分鐘原值；7D＝30 分鐘桶；30D＝2 小時桶（`src/data/internetHealthLoader.ts:260-264`）。比率類以 sample_count 加權平均（L944-960）。

### RIPE RIS Live（`data-collectors/workers/ripe_ris_live.py`，常駐 WebSocket）

訂閱 roster 的 15 個 origin ASN（yaml L161-180，`prefixes: []`），每 300 秒（L42）flush 一次。

| 指標 | 現況 | 位置 |
|---|---|---|
| Prefix 可見度 | **永遠 NULL**：沒有 RIB 基準，刻意標成 `state_uninitialized`，卡片顯示「RIB 基準建立中」 | L581 |
| 撤回 Prefix 比率 | **永遠 NULL**：分母是設定的 prefix 數，目前為 0 | L582-585 |
| Origin 變更 | 同一 (collector, peer, prefix) 的 origin AS 換人時加 1；stream 有缺口時為 NULL | L540-556、L586 |
| sample_count | 該窗收到的 BGP UPDATE 數（全部，不只追蹤中的） | L616 |

`stale_after_seconds`＝900（`config.py:415`）。30 天內 origin_change 有 8,379／8,599 筆非 NULL；另外 4 個 prefix 類 signal 各 8,599 筆，全部是 NULL。

---

## 2. IPv6 鋸齒：原因與證據

### 2a. 現象（近 3 小時逐筆，Taipei 時間）

```sql
SET statement_timeout=15000;
SELECT to_char(observed_at AT TIME ZONE 'Asia/Taipei','MM-DD HH24:MI') t,
  max(value) FILTER (WHERE signal='ping_success_ratio_ipv6') ps6,
  max(sample_count) FILTER (WHERE signal='ping_success_ratio_ipv6') n6,
  max(value) FILTER (WHERE signal='probe_connectivity_ratio_ipv6') pc6, ...
FROM live.internet_health_observations
WHERE source='ripe_atlas' AND observed_at > now()-interval '3 hours'
GROUP BY observed_at ORDER BY observed_at LIMIT 60;
```

| 桶結束 | ps6 | 探針數 | Probe 回報率 v6 | RTT6 ms | ps4 | 探針數 v4 |
|---|---|---|---|---|---|---|
| 10:00 | 1.000 | 10 | 0.244 | 23.5 | 0.948 | 32 |
| 10:05 | 0.824 | 17 | 0.415 | 5.8 | 0.966 | 40 |
| 10:10 | 0.857 | 21 | 0.512 | 4.1 | 1.000 | 38 |
| 10:15 | 0.939 | 17 | 0.415 | 12.3 | 1.000 | 30 |
| 10:20 | 1.000 | 10 | 0.244 | 28.6 | 1.000 | 32 |
| …（之後每 20 分鐘重複 10/17/21/17） | | | | | | |
| 12:25–12:45（仍在回看窗內） | 0.86–0.92 | **39** | **0.951** | 6–9 | 0.97–1.00 | **83** |

探針數幾乎固定按 **20 分鐘**循環（10→17→20~21→17），ps6 跟著同一個節奏在 0.82 和 1.00 之間跳。RTT 也一起跳，代表每桶是**不同一批探針**。

### 2b. 根因：回看窗切口截斷＋無條件覆寫

```sql
SELECT requested_from, requested_to FROM live.internet_health_source_runs
WHERE source='ripe_atlas' ORDER BY started_at DESC LIMIT 14;
SELECT window_start, collected_at, sample_count FROM live.internet_health_observations
WHERE source='ripe_atlas' AND signal='ping_success_ratio_ipv6'
  AND observed_at > now()-interval '75 minutes' ORDER BY observed_at LIMIT 20;
```

實例：桶 **11:35–11:40** 最後一次寫入發生在 12:08:24，那次 run 的 `requested_from=11:38:24`，所以只抓到 11:38:24–11:40 這 **96 秒／300 秒（32%）**，sample_count 是 **10／39（26%）**。run 大約在每桶第 3.4 分鐘觸發，所以每一桶最後留下的都只有桶尾約 1.6 分鐘的資料。唯一例外是 11:55 那一桶：那次 run 剛好在 11:55:01 開始，最後一次寫入涵蓋整桶，於是有 39 支。

- 截斷：`requested_from = now − 30min`（L332），落在某一桶中間；L191 照樣把這段殘缺結果算成一整桶。
- 覆寫：writer 無條件 `DO UPDATE`，後來殘缺的值蓋掉先前完整的值。
- 20 分鐘週期：量測 interval 240 秒，桶 300 秒，最小公倍數是 1,200 秒。各探針在 240 秒內的相位固定（API 抽查：相位分散在 0–240 秒），所以「桶尾 96 秒」框到哪一批探針，每 20 分鐘重複一次。
- 為什麼 IPv6 跳得比 IPv4 兇：API 抽查 measurement 2001 最近 20 分鐘，39 支回報探針裡有 **4 支 IPv6 完全不通**（rcvd=0；probe ID 可從 roster 或 API 抽查取得，這裡不列出，以配合本功能 internal_only 的立場），另有 1 支偶爾掉包。完整桶的成功率因此約 0.89。殘缺桶只有 10 支探針，碰巧不含這 4 支時就是 100%，含 3–4 支時就掉到 82%。IPv4 幾乎所有探針都通，換哪一批差別都很小，所以線看起來平。

**結論：鋸齒是量測管線造成的假象，不是臺灣 IPv6 品質在震盪。** 實際 IPv6 成功率大約穩定在 85–90%。

### 2c. 同一缺陷的其他影響

- **24H Probe 回報率／可達 ASN 比率的線全部偏低**（殘缺桶的中位數約 0.4–0.5，完整桶約 0.95），看起來像「一半探針斷線」，其實是假的。
- **卡片即時值**：`internet_health_current` 由 trigger 指向最新 observed_at 那一列（`gis-platform/migrations/379_internet_health_core.sql:241-292`，guard L182-231 只阻擋時間往回走）。最新一列永遠是還沒收完的桶。實測（12:46:49 寫入，桶 12:45–12:50）：Probe 回報率 IPv4 **0.126**（11 支）、IPv6 0.244、可達 ASN IPv4 0.147。
- 7D／30D 用 sample_count 加權：**Ping 成功率和 RTT** 大致被修正（30 分鐘桶涵蓋一整個 20 分鐘探針循環，各探針都會被算到）；但 **Probe 回報率和可達 ASN 修不回來**，因為把 0.24–0.51 的值加權平均，結果還是約 0.45，所以 7D／30D 的這兩條線同樣不能信。

### 2d. 建議修法（只是建議，屬於 data-collectors，要上游先動）

1. collector 只輸出 `window_start ≥ requested_from` 而且 `window_end ≤ started` 的桶（丟掉頭尾殘桶），或者把 `requested_from` 往下對齊到 300 秒邊界。
2. 或者在 writer 端加 `WHERE EXCLUDED.sample_count >= internet_health_observations.sample_count`，不讓較少的樣本覆蓋較多的樣本。
3. 前端在上游修好之前可以先做（不用動 DB）：RPC 已經提供 `sample_count` 和 `metadata.expected_probe_count`，`sample_count < 0.8 × expected_probe_count` 的點就畫成灰色或跳過；即時值改用「最近一個完整桶」。
4. 歷史資料已被覆寫，無法從 DB 復原；要重建只能用 RIPE Atlas API 回補（公開量測，可以重抓）。

---

## 3. 正常範圍（建議色帶）

完整桶用兩種方式界定，兩者結果一致：
- A：`probe_connectivity_ratio ≥ 0.8`（30 天 IPv4 2,489 桶、IPv6 2,643 桶；7 天 557／570 桶）。註：這個界定對 Probe 回報率本身有循環論證，所以 Probe 回報率改看 B。
- B：依時間判斷，最後一次寫入的回看窗完整涵蓋整桶（`collected_at − 30min ≤ window_start` 且 `collected_at ≥ window_end`），樣本少（30 天 105／156 桶、7 天 19／17 桶）。

| 指標 | 30d p10／p50／p90（A） | 7d p10／p50／p90（A） | B 30d p10／p50／p90 | **建議正常色帶** | 建議警戒 |
|---|---|---|---|---|---|
| Ping 成功率 IPv4 | 0.980／0.991／1.000 | 0.980／0.993／1.000 | 0.981／0.991／1.000 | **97–100%** | < 95%（30d p01 = 0.968） |
| Ping 成功率 IPv6 | 0.837／0.871／0.898 | 0.848／0.874／0.889 | 0.845／0.886／0.915 | **83–92%** | < 80%（30d p01 = 0.81） |
| 中位 RTT IPv4 | 4.29／4.45／4.85 ms | 4.37／4.54／4.93 | 4.20／4.44／4.75 | **4–5.5 ms** | > 8 ms（基準約 2 倍） |
| 中位 RTT IPv6 | 4.44／5.53／11.4 ms | 4.58／5.51／8.26 | 4.60／5.73／15.9 | **4–12 ms**（尾巴長） | > 20 ms |
| Probe 回報率 IPv4 | — | — | 0.943／0.954／0.977 | **90–100%** | < 85% |
| Probe 回報率 IPv6 | — | — | 0.939／0.951／0.976 | **90–100%** | < 85% |
| 可達 ASN IPv4 | 0.882／0.971／1.000 | 0.824／0.912／0.941 | 0.941／0.971／1.000 | **85–100%** | < 80% |
| 可達 ASN IPv6 | 0.727／0.773／0.818 | 0.727／0.818／0.818 | 0.773／0.818／0.818 | **70–85%** | < 65% |

依據與但書：
- IPv6 成功率「正常」本來就不到 100%。roster 裡 4 支探針的 IPv6 長期不通，roster 更新後基準會變，所以色帶要跟 roster 版本綁在一起。
- 分母是 2026-08-31 的 roster 快照。探針自然下線會讓 Probe 回報率和可達 ASN 慢慢往下走，這不代表網路異常。
- 30 天樣本，又沒有重大事件，p01 不等於真正的事故門檻；警戒值是保守的估計。
- 在上游修好之前，**24H 原值大部分落在殘缺桶**，套用這些色帶會每 20 分鐘誤報一次。必須先篩掉殘缺桶。

## 4. 建議的異常判斷規則（草案）

1. **前置條件：只看完整桶**（`sample_count ≥ 0.8 × expected_probe_count`）。殘缺桶畫灰色，不列入判斷。
2. **單點不算**：要連續 **≥ 3 個完整桶（15 分鐘）** 跌出色帶，才標「留意」。
3. **雙指標**：Ping 成功率跌出色帶，而且 Probe 回報率或可達 ASN 也同時跌出，才標「疑似異常」。只有 RTT 升高，標「延遲偏高」。
4. **IPv4、IPv6 同時掉**才可能是廣域事件；只掉一邊多半是單一協定或少數網路的問題。
5. **單一目標的限制**：1001／2001 只 ping K-root 一個目標。只有這兩條掉，也可能是 K-root anycast 節點或往該節點的路徑出問題，需要第二來源（見 §5）背書才能說「臺灣網路異常」。
6. 實例：**09-09 01:00（Taipei）** IPv4 完整桶（83 支探針）跌到 **0.588**，01:05 回到 0.882，之後恢復；同時段 IPv6 0.875 正常。IODA BGP（135,723 個 prefix）、主動探測（約 3.15 萬個 /24）、Merit 望遠鏡、Cloudflare 流量全部持平。依照上面的規則，這只是單點、單協定、沒有第二來源支持，**不算事故**，比較像 K-root 或路徑的短暫狀況。

## 5. 可交叉比對的其他來源（DB 已有）

| source | signal | 頻率（7 天中位間隔） | 最新資料（Taipei，10-02 查詢時） | 7 天 p10／p50／p90 | 公開狀態 | 前端 |
|---|---|---|---|---|---|---|
| `ioda` | `bgp`（可見 prefix 數） | 5 分鐘 | 12:45 | 135,722／135,728／135,729 | **internal_only**（`metadata.internet_health_sources.public_rpc_enabled=false`） | RPC 不輸出；loader `isPublicEvidence` 也排除（`internetHealthLoader.ts:694-699`） |
| `ioda` | `ping_slash24`（回應的 /24 數） | 10 分鐘 | 12:40 | 31,085／31,598／31,792 | 同上 | 同上 |
| `ioda` | `merit_nt`（望遠鏡） | 5 分鐘 | 12:45 | 79／93／106 | 同上 | 同上 |
| `ioda` | `gtr_web_search`、`gtr_norm_blended` | 30 分鐘 | 12:30／11:30 | — | 同上 | 同上 |
| `ioda` | `ping_slash24_latency`、`ping_slash24_loss`、`gtr_sarima_web_search` | 10／30 分鐘 | — | **30 天全部 NULL** | — | — |
| `cloudflare_radar` | `netflows_serie_0`（相對流量，0–1） | 15 分鐘 | **11:15（落後約 1.5 小時）** | 0.8／0.9／1.0 | approved | loader 有讀進 `summary.sources`，**但這張卡沒有畫**（卡片只渲染 `measurements`，`TelecomStatusCard.tsx:392-394`） |
| `internet_health_detector_v1` | composite | — | 30 天無資料 | — | approved | — |

`stale_after_seconds`：Cloudflare 2700、IODA 3600（gtr 系列 5400）、RIPE 900。

能不能當第二意見：
- **IODA bgp／ping_slash24 最適合**：和 RIPE 屬於不同機構（Georgia Tech），覆蓋全國 /24，5–10 分鐘更新，而且數值非常穩（p10–p90 的變化 < 1–2%），掉 5% 以上就很顯眼。但目前是 internal_only，要公開到卡片上得先處理授權／公開審查。
- **Cloudflare 流量**是公開可用的，可以當「使用者端有沒有流量」的旁證；缺點是落後約 1.5 小時、15 分鐘粒度，日夜週期也大（要和同時段比，不能和絕對值比）。
- RIS（同屬 RIPE NCC）不算獨立來源。

## 6. 外部參考（官方頁面）

已用 HTTP 確認可以連到（2026-10-02）。標「SPA」的是單頁應用，200 不保證路徑內容正確：

- RIPE Atlas 文件：https://atlas.ripe.net/docs/ ；入門：https://atlas.ripe.net/docs/getting-started/
- RIPE Atlas REST API 手冊：https://atlas.ripe.net/docs/apis/rest-api-manual/
- 本卡使用的量測頁：https://atlas.ripe.net/measurements/1001/ 、https://atlas.ripe.net/measurements/2001/
- RIPE RIS 文件：https://ris.ripe.net/docs/ ；RIS Live：https://ris-live.ripe.net/
- RIPEstat（查 ASN／prefix 路由歷史）：https://stat.ripe.net/
- IODA 首頁：https://ioda.inetintel.cc.gatech.edu/ ；臺灣頁：https://ioda.inetintel.cc.gatech.edu/country/TW （SPA）；說明：https://ioda.inetintel.cc.gatech.edu/resources （SPA）
- Cloudflare Radar 開發文件：https://developers.cloudflare.com/radar/ ；術語：https://developers.cloudflare.com/radar/glossary/
- Cloudflare Radar 臺灣頁 https://radar.cloudflare.com/tw 和 Outage Center https://radar.cloudflare.com/outage-center ：curl 回 403（疑似擋機器人），**未驗證內容**。

## 7. 卡片「怎麼看」建議文案

1. 「IPv6 正常約 85–90%，不是 100%：臺灣有幾支探針本身沒有 IPv6。」
2. 「24 小時線每 20 分鐘的鋸齒是量測分桶造成的，不代表網路在震盪；請看灰帶以外的點。」（上游修好後拿掉這句）
3. 「單點下跌不算異常；連續 15 分鐘以上，而且 IPv4／IPv6 或成功率／回報率一起掉，才值得注意。」
4. 「本卡只 ping 一個目標（K-root），屬於 RIPE 單一來源；判斷臺灣是否斷網要對照 IODA 或 Cloudflare Radar。」
