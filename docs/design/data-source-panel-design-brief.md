# 資料來源說明 UI — 設計 Brief

**目標**：讓使用者知道每個 layer 的資料從哪來、多久更新、誰提供、授權為何。

**現況**：Step 4 已上線一個「全站總覽」浮動按鈕（右下 ℹ），這只是 MVP。
希望設計師規劃 **3 個層次入口**的完整體驗。

---

## 三個入口（建議都做）

### A. 全站總覽（Overview） — 主要 side-panel
- **觸發**：右下 ℹ 按鈕（現有）或頂部工具列新增「資料來源」項
- **內容**：227 層 by 20 主題分類、可搜尋、狀態徽章
- **使用者**：想理解「這站有什麼資料」的探索者、記者、研究者

### B. Layer 延伸（In-context per layer）— 建議加
- **觸發**：Sidebar 每一 layer row 右側 tiny ℹ icon（hover 才顯示）
- **內容**：迷你 popover，2 行說明 + 「查看完整」連結
- **使用者**：正在用該 layer 的一般使用者，想確認資料來源與新鮮度

### C. Feature popup 底部連結
- **觸發**：點 map feature 打開 FeatureInfoPanel 時
- **內容**：底部小字「資料來源：{provider} · {lifecycle} · 詳情 →」
- **使用者**：看細節時順手確認可信度

---

## 資料樣本

見同目錄 [`data-source-panel-samples.json`](./data-source-panel-samples.json)（真實從 production Supabase 撈的 7 種 case）。

## 資料形狀（每個 layer 拿得到的欄位）

```json
{
  "dataset_id": "agri_retail_companies",
  "title": "公司登記－農產品零售業（F201010）（dataset 45618）",
  "summary": "依《公司法》登記之農產品零售業者，量大",
  "provider_agency": "經濟部商業發展署",
  "source_url": null,                            // 常為 null，設計要能 handle
  "license": "政府資料開放授權條款-第1版",
  "lifecycle": "每 1 月",                        // realtime/daily/weekly/monthly/yearly/static
  "update_frequency": "每 1 月",                 // 人類可讀，可能 null
  "last_updated": "2026-05-25",
  "used_by_pulse_layers": ["agriRetail"],        // 陣列
  "catalog_md_path": "docs/data-catalog/agriculture/agri_retail_companies.md"
}
```

## 邊緣情況（設計必處理）

1. **長標題**：`title` 可能長達 50 字含括號版本號
2. **中英夾雜**：`provider_agency` 有機關全名 + English name（如「衛生福利部醫事司（AED 急救資訊網）」）
3. **`source_url` 為 null**：多數 dataset 沒填 → 顯示「詳見 catalog」
4. **1 dataset → 多 layer**：`celestrak_satellites` 對應 16 個 layer（全球衛星）
5. **`lifecycle` 中英混雜**：「realtime」「daily」「每 1 月」「靜態」都有
6. **派生分析（pulse_only）**：medIsochrone/gasCoverageAll — 無 catalog record，需顯示派生鏈：
   - `derivationType`（isochrone / coverage / inverse / aggregate / ratio / intersect / custom）
   - `derivedFromLayers`（點回這些 layer 展開）
   - `processing`（一句話說明）
   - 最終上游 dataset（透過 `resolveUpstreamDatasets` 遞迴解出）

## 建議狀態徽章

| Status | 徽章 | 意義 |
|---|---|---|
| verified | 🟢 已橋接 | 有明確 catalog 對應 |
| pulse_only | 🟣 派生分析 | 前端計算，有 lineage |
| catalog_missing | 🟡 待補資料 | 只此站有，未上 catalog |

## 全站規模（設計負載參考）

- 271 datasets / 23 themes / 127 個政府機關
- 143 dataset 已對應到 pulse layer
- 前 5 主題：water_resources 42 / energy 39 / transportation 34 / environment 25 / police_justice 20

## Lifecycle 分布（設計圖示用）

看 `data-source-panel-samples.json` → `lifecycle_分布`。主流是 yearly / monthly / realtime / static。

---

## 現有 MVP 螢幕截圖參考

- `src/components/DataSourceBrowser.tsx` — 全站總覽（入口 A 骨架）
- `src/components/DataSourceModal.tsx` — 單層詳細（入口 B/C 骨架）

設計不必受 MVP 拘束，這些只是為了證明資料通路 ok。
