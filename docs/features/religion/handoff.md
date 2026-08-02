# Handoff — 宗教 Religion（下游視角）

> **上游 SSOT**：`../../../taipei-gis-analytics/docs/handoff/pulse-batch-20260801.md` §2 C ＋ 檔末「附記 2026-08-02」

## 上游產物 → pulse 路徑

| 上游 dataset | pulse 路徑 | 大小 | git |
|---|---|--:|---|
| religion.temples | `public/religion/temples.pmtiles`（layer 名 `temples`，z5-14） | 12.2 MB | **gitignored → S3** |
| religion.churches | `public/religion/churches.geojson` | 2.7 MB | ✅ |
| religion.ancestral_halls | `public/religion/ancestral_halls.geojson` | 267 KB | ✅ |
| religion.foundations | `public/religion/foundations.geojson` | 94 KB | ✅ |
| religion.other_worship | `public/religion/other_worship.geojson` | 1.3 MB | ✅ |
| religion.top100 | `public/religion/top100.geojson` | 70 KB | ✅ |

- 更新頻率：yearly（上游 lifecycle）
- 座標系統：WGS84
- **不走 Supabase**：`reference.religion_*` 5 表雖已入庫（mig 328/329），前端選靜態檔
  （static-to-cdn 方向，避免靜態資料佔 DB 併發）。DB 那條路留著但無下游依賴。

## 硬依賴欄位（改一定爆）

| 欄位 | 層 | 用途 |
|---|---|---|
| `deity_family` | temples | **9 族分色 + 主祀 filter 的唯一依據**（上游衍生欄，2026-08-02 加） |
| `main_deity` | temples | popup 顯示原始值 |
| `in_moi_registry` | temples / churches / ancestral_halls | 雙態 filter（**boolean**，用 `== true/false` 判，不可靠 truthiness） |
| `facility_type` | ancestral_halls | 3 類分色（值是中文：`宗祠` / `宗祠基金會` / `文資祠堂（未登記）`） |
| `source` | temples / churches / other_worship | `=== "osm_overpass"` 才顯示 ODbL 標示 |
| `name` | 全部 | **可為 null**（temples 443 / churches 46 / other_worship 859）→ 各層有各自的 fallback 文字 |
| `entity_id` | 全部（除 top100） | filter 的 `["has", ...]` 全量判斷用 |
| source-layer 名 `temples` | temples | overlayRegistry `pmtiles.sourceLayer` |

## 上游改動 → 下游要跟改的觸發點

| 上游改動 | 下游動作 |
|---|---|
| `deity_family.py` 規則調整 | 重跑 07_export + 08_build_pmtiles + `--publish`；若族數/key 有變，同步改 `religionTypes.ts` 的 `DEITY_FAMILIES` |
| temples 資料量成長 | PMTiles 走 `-r1` 全保留，體積會等比長；>30MB 要重新評估 |
| `facility_type` 新值 | `ANCESTRAL_HALL_TYPES` 補一行，否則落中性灰 |
| 無座標尾巴 geocode 回填 | 點數變多，前端無需改碼（重新 publish 即可） |
| `reference.religion_*` 加 `deity_family` 欄 | 下游不受影響（沒走 DB） |

## 已知不對稱

1. 上游 handoff §0 原寫「geojson/pmtiles 或 Supabase 二選一」+「main_deity 圖例」——
   實際拍板：**temples 走 PMTiles、用 `deity_family` 不用 `main_deity`**（後者 1,950 種前端 match 不了）。
   上游已於檔末附記更正。
2. 上游 catalog 寫 temples 19,201 筆；PMTiles **點數全保留**（`-r1`），
   若日後有人用 `--drop-densest-as-needed` 重切會靜默掉點（實測 z9 只剩 49 點）。
3. `reference.religion_temples` **沒有** `deity_family` 欄（上游附記已標註為未做項）。
