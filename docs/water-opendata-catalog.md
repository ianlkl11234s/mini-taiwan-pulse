# 水資源開放資料盤點 — 水庫與堰壩（共 27 筆）

> 資料來源：[opendata.wra.gov.tw「水庫與堰壩」分類](https://opendata.wra.gov.tw/datasets?topic_name=%E6%B0%B4%E5%BA%AB%E8%88%87%E5%A0%B0%E5%A3%A9&page=1)
> 爬取日：2026-04-21（用 agent-browser 抓完整 3 頁）
> API 根路徑：`https://opendata.wra.gov.tw/api/v2/{UUID}?format=JSON`

## 優先級說明
- **P0** — 已接入或立即採用（澄清湖 bug 修正相關）
- **P1** — 近期要串進資料管線（集水區 polygon、每日營運等）
- **P2** — 有需要再補（地方性水情、敏感區）
- **P3** — 非必要或功能重疊

---

## 已接入（P0）

| # | dataset | 名稱 | 格式 | 更新頻率 | 用途 | 現況 |
|---|---|---|---|---|---|---|
| 1 | [25776](https://data.gov.tw/dataset/25776) | 水庫堰壩位置圖 | **SHP**（gic.wra.gov.tw）+ JSON/CSV/XML metadata | 不定期（2020-05 版） | **權威座標 98 筆** | ✅ 已匯入 `reference.reservoir_geometry`（migration 048）|
| 2 | [32726](https://data.gov.tw/dataset/32726) | 水庫基本資料 | JSON/CSV/XML | 每 1 年 | 壩高/設計容量/有效容量/鄉鎮 | ✅ collector 每次啟動同步到 `public.water_reservoirs` |
| 3 | [45501](https://data.gov.tw/dataset/45501) | 水庫水情資料 | JSON/CSV/XML | **每 1 小時** | 水位/蓄水百分比/進出流量/降雨 | ✅ `realtime.reservoir_status`（68 庫）+ RPC 047 |

---

## 立即要做（P1）

| # | dataset | 名稱 | 格式 | 更新頻率 | 用途 | 動作 |
|---|---|---|---|---|---|---|
| 4 | [129474](https://data.gov.tw/dataset/129474) | **水庫集水區** | ⚠️ 需進頁查格式 | 不定期 | **全台水庫集水區 polygon**（承接水的上游範圍） | 📥 下載 → `reference.reservoir_watershed`，前端疊層 |
| 5 | [13795](https://data.gov.tw/dataset/13795) | 水庫蓄水範圍 | KML 清冊 + JSON/CSV 文字版 | 不定期 | 水庫蓄水面 polygon（對照現有 `water_reservoirs.geojson`） | 若 polygon 更準就替換 |
| 6 | [32727](https://data.gov.tw/dataset/32727) | 水庫淤積量 | JSON/CSV/XML | 年 | 目前總容量、最近庫容測量時間 | 補 `reference.reservoir_geometry.current_capacity` |
| 7 | [41568](https://data.gov.tw/dataset/41568) | 水庫每日營運狀況 | JSON/CSV/XML | **每 1 日（09:30）** | 歷史時序：存水量/進出水量/降雨/水位 | 📥 新 collector，寫 `realtime.reservoir_daily_ops` |
| 8 | [139336](https://data.gov.tw/dataset/139336) | 水庫代碼 | JSON/CSV/XML | 不定期 | Join key（代碼 ↔ 名稱 ↔ 鄉鎮 ↔ 河川） | 📥 seed 到 `reference.reservoir_codes` |
| 9 | [32728](https://data.gov.tw/dataset/32728) | 水庫營運（年度） | JSON/CSV/XML | 年 | 各標的用水量（農業/生活/工業）、發電水量 | 補 Panel 歷史圖 |

---

## 需要再補（P2）

### 個別水庫 CCTV / 即時水情（4 筆，內容重疊於 45501 但精度更高）
| # | dataset | 名稱 | 覆蓋 |
|---|---|---|---|
| 10 | [32733](https://data.gov.tw/dataset/32733) | 曾文水庫即時水情資訊 | 單一水庫，每小時 |
| 11 | [32734](https://data.gov.tw/dataset/32734) | 阿公店水庫即時水情資訊 | 單一水庫 |
| 12 | [32735](https://data.gov.tw/dataset/32735) | 牡丹水庫即時水情資訊 | 單一水庫 |
| 13 | [95806](https://data.gov.tw/dataset/95806) | 鯉魚潭水庫每日水情資訊 | 單一水庫（苗栗）|

👉 **建議跳過**：`45501` 已含全庫每小時資料；只有要秀「單庫更細」才值得接。

### 集水區敏感區 + 個別範圍圖（6 筆）
| # | dataset | 名稱 | 用途 |
|---|---|---|---|
| 14 | [129475](https://data.gov.tw/dataset/129475) | 水庫集水區敏感區範圍：邊界向內 0.5 km | 環境管制視覺化 |
| 15 | [129476](https://data.gov.tw/dataset/129476) | 水庫集水區敏感區範圍：邊界向外 0.5 km | 同上 |
| 16 | [58345](https://data.gov.tw/dataset/58345) | 鯉魚潭水庫集水區範圍圖 | 個別，已含於 #4 |
| 17 | [58346](https://data.gov.tw/dataset/58346) | 石岡壩集水區範圍圖 | 同上 |
| 18 | [58347](https://data.gov.tw/dataset/58347) | 阿公店水庫集水區範圍圖 | 同上 |
| 19 | [58348](https://data.gov.tw/dataset/58348) | 牡丹水庫集水區範圍圖 | 同上 |

👉 **建議**：個別範圍圖（16~19）跳過，直接用 #4「水庫集水區」整包。敏感區（14~15）未來做管制圖層時再補。

### 其他水情 / 管理類（4 筆）
| # | dataset | 名稱 | 用途 |
|---|---|---|---|
| 20 | [36695](https://data.gov.tw/dataset/36695) | 枯旱預警 | 分區水情燈號（正常/提醒/減壓/減量/分區）|
| 21 | [58343](https://data.gov.tw/dataset/58343) | 中區水資源分署轄管水庫堰壩洩洪訊息 | 洩洪通告（事件性） |
| 22 | [45495](https://data.gov.tw/dataset/45495) | 水庫警告設施設置圖 | AED/救生圈位置（觀光安全） |
| 23 | [58340](https://data.gov.tw/dataset/58340) | 用水計畫摘要表 | 開發案用水管制（偏行政） |

### 濁度 / 水質（3 筆，偏工程監測）
| # | dataset | 名稱 |
|---|---|---|
| 24 | [58688](https://data.gov.tw/dataset/58688) | 石門水庫濁度資料 |
| 25 | [58690](https://data.gov.tw/dataset/58690) | 寶山第二水庫濁度資料 |
| 26 | (保護區) [?](https://data.gov.tw/) | 自來水水質水量保護區圖 |

### 農田水利 / 其他（1 筆）
| # | dataset | 名稱 |
|---|---|---|
| 27 | 自來水水質水量保護區圖 | 非水庫，偏自來水事業 |

---

## P1 建議實作順序

1. **下載 `129474 水庫集水區`**（全台 polygon，一次到位）
   - 預期格式：KML / SHP（水利空間資訊服務平台）
   - 目標：`reference.reservoir_watershed(compare_id, name, geom polygon)`
   - Migration 049

2. **seed `139336 水庫代碼`**（join key 權威版）
   - 靜態表 `reference.reservoir_codes`
   - 讓 realtime 表都能 join 出縣市/河川

3. **接入 `41568 水庫每日營運`**（歷史時序）
   - 新 collector，每日 09:30 拉
   - `realtime.reservoir_daily_ops`
   - 前端 FeatureInfoPanel 歷史曲線可從此拉

4. **補 `32727 水庫淤積量`**（current_capacity 更新）
   - 年度批次腳本
   - 讓蓄水百分比分母用**目前有效容量**而非**設計有效容量**，更準

---

## P2 資料鏈完整性（預覽）

做完 P1 後可組出：

```
集水區 polygon (P1 #4)
   ↓ 承接降雨
水庫壩體 point (已有 P0 #1)
   ↓ 蓄水範圍 polygon (P1 #5 或現有)
   ↓ 即時水位/容量 (已有 P0 #3)
   ↓ 歷史營運 (P1 #7)
下游河川 line (已有 rivers geojson)
```

FeatureInfoPanel 點水庫 → 自動高亮集水區、蓄水面、下游河川 → 時序曲線。

---

## 驗證後的 API UUID 清單

| dataset | UUID | 驗證 |
|---|---|---|
| 25776 | `4cd3054e-2f5c-44d6-94d9-24e5882a9d47` | ✅ 回 SHP metadata |
| 32726 | `708a43b0-24dc-40b7-9ed2-fca6a291e7ae` | ✅ 實測通 |
| 32727 | _待查_ | 點頁取 |
| 32728 | _待查_ | 點頁取 |
| 41568 | `51023e88-4c76-4dbc-bbb9-470da690d539` | ✅ 實測通 |
| 45501 | `2be9044c-6e44-4856-aad5-dd108c2e6679` | ✅ 實測通（collector 接中）|
| 13795 | `dab16b75-a504-4dd6-a999-b325104389b4` | ✅ KML 清冊 |
| 129474 | _待查_ | 點頁取 |
| 139336 | `f65a2148-9c7a-4e16-acaf-48917a5124e2` | ✅ 實測通 |
