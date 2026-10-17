# 色盤驗證（R7 樣稿 v1）

> 2026-10-03。色盤值與 [`mockup.html`](./mockup.html) 內嵌的 `PALETTES` 是同一份（由產生腳本輸出後注入，不手抄）。
> 驗證器：dataviz skill 的 `validate_palette.js`（OKLCH 亮度帶、彩度下限 0.10、相鄰 CVD ΔE（Machado 2009）≥ 8 目標／6 下限、正常視覺 ΔE ≥ 15、對比 ≥ 3:1；序列用 `--ordinal`：亮度單調、相鄰 ΔL ≥ 0.06、淺端對比 ≥ 2:1、單一色相）。

## 底圖 surface

repo 內沒有記錄底圖陸地色（`MAP_SEAM` 是點描邊色 `#0a0a14`／`#ffffff`，不是陸地）；主站用 `mapbox://styles/mapbox/dark-v11`／`light-v11`（`StyleSelector.tsx`）。依任務指定的陸地範圍，每組都對**兩端**各驗一次：

| 模式 | surface | 說明 |
|---|---|---|
| 暗 | `#1f1f1f`、`#262626` | Mapbox Dark 陸地範圍；`#262626` 對中亮度色較嚴 |
| 淡 | `#f5f5f3`、`#ffffff` | Mapbox Light 陸地範圍；`#f5f5f3` 對對比較嚴 |

## 結果摘要

- **全部必過項目通過**（12 色相、5 組類別、8 組序列、3 組發散 × 暗／淡 × 兩個 surface）。
- 12 色相（固定順序）相鄰最差：暗 CVD ΔE 12.9、正常視覺 23.1；淡 CVD 12.0、正常視覺 22.1（細節見 §1）。
- **前 3 色 all-pairs 通過、前 4 色不通過**：同時開 4 層以上單色點層時，自動錯開只保證「相鄰順位」分得開，不保證任兩層都分得開（dataviz 參考色盤也是同樣上限）。這是提案 §5.4「色相用完」以外要補的一句。
- viridis／magma／cividis 的 `--ordinal`「Single hue」檢查**不適用**（多色相設計），標 N/A；其餘三項通過。

## 調整紀錄

1. **12 色相由 OKLCH 生成再搜尋順序**：12 個色相角各在暗 L 0.58–0.66、淡 L 0.44–0.59 中取值、C 目標 0.17（超出 sRGB 則降 C），以「相鄰 CVD/8、正常/15 取最小」為目標搜尋共用順序，並對偏離目標亮度（暗 0.62、淡 0.55）加罰，避免淡色版出現褐、橄欖色。
2. **青（215°）改天藍（232°）**：淡色版 215° 在 L ≤ 0.59 時 sRGB 最大彩度不到 0.10，第一版 `#008399` 彩度 0.099 被彩度下限擋下；連帶藍 255°→262°、靛 278°→285°。
3. **viridis 淡色版截到 0.72、cividis 淡色版截到 0.72**：原 0.78／0.80 的最亮端（`#70ce57`、`#caba69`）對 `#f5f5f3` 只有 1.8:1。
4. **magma 暗色版從 0.43 起**：原 0.32 的最暗端 `#6a1f7f` 對 `#262626` 只有 1.5:1。
5. **BrBG 彩度 0.11→0.125**：±1 兩色正常視覺 ΔE 14.8，未達 15。
6. **序列色暗／淡方向不同**：暗版「低值暗（貼底圖）→高值亮」、淡版「低值淺→高值深」，兩版都讓低值退到底圖、階數相同（5 階）。這與現行統計層「暗／淡同值」不同，屬提案要決定的事。
7. **熱區衍生色階淡色版改「加深」**：暗版照提案「透明→色相→提亮」；淡版若提亮，高密度端會接近白底而消失，改為「透明→色相→加深」。

## 色盤庫內容

### 單色 12 色相（順序＝自動錯開的分配順序）

| # | 色相 | 暗 點色 | 暗 熱區高端 | 淡 點色 | 淡 熱區高端 |
|---|---|---|---|---|---|
| 1 | 青綠 teal | `#009c89` | `#c1f1e6` | `#009280` | `#005247` |
| 2 | 橘 orange | `#ce6400` | `#ffddc9` | `#b45600` | `#622b00` |
| 3 | 藍 blue | `#4a81eb` | `#d7e5ff` | `#396ed6` | `#07338b` |
| 4 | 粉紅 pink | `#d4517e` | `#ffd9e2` | `#b53364` | `#660030` |
| 5 | 天藍 sky | `#0092c5` | `#c7ebff` | `#007fac` | `#00435d` |
| 6 | 琥珀 amber | `#b07b00` | `#fae1ba` | `#9a6a00` | `#533700` |
| 7 | 洋紅 magenta | `#c457a9` | `#ffd7f2` | `#b04496` | `#6b0658` |
| 8 | 萊姆 lime | `#779300` | `#dcecba` | `#688000` | `#364400` |
| 9 | 紫 violet | `#9e66d7` | `#ebddff` | `#8c54c3` | `#501b7c` |
| 10 | 綠 green | `#1ca045` | `#c2f3c8` | `#008d36` | `#004b19` |
| 11 | 靛 indigo | `#7e72e7` | `#e1e1ff` | `#6e60d2` | `#3a2788` |
| 12 | 紅 red | `#d9544b` | `#ffdbd6` | `#c44039` | `#780007` |

熱區 stops（地圖與圖例 LG-8 共用）：0 透明 → 0.3 色相 α0.45 → 0.6 色相 α0.9 → 1 熱區高端。

### 序列（5 階，低→高）

| 色盤 | 暗 | 淡 |
|---|---|---|
| 藍（Blues） | `#325d9c` `#447bcd` `#5b9bf9` `#92beff` `#cae0ff` | `#85ade8` `#5d8ed8` `#3470c7` `#1953a5` `#0d3a79` |
| 綠（Greens） | `#286e3c` `#369150` `#4db469` `#81d293` `#b1f0bd` | `#81bb8d` `#55a167` `#1c8742` `#00692d` `#004b1e` |
| 橘（Oranges） | `#8c490d` `#b96111` `#e27d29` `#fba568` `#ffd4b8` | `#da9a6f` `#c6773d` `#ac5700` `#854200` `#602e00` |
| 紫（Purples） | `#674e90` `#8868bd` `#aa84e7` `#c8aafe` `#e3d6ff` | `#b39edc` `#997dc9` `#7f5bb6` `#634095` `#472c6d` |
| 紅（Reds） | `#953d3a` `#c4524d` `#f06c66` `#ff9d96` `#ffd1cd` | `#e4918a` `#d16b64` `#bd423f` `#9a2527` `#711518` |
| viridis（viridis） | `#39598c` `#25868d` `#30b17d` `#8bd44c` `#fde725` | `#440154` `#433d83` `#2f6e8e` `#209a8a` `#53c26b` |
| magma（magma） | `#972e7f` `#d04b6f` `#f57b62` `#feba82` `#fcfdbf` | `#1a0f41` `#5a187c` `#992e7e` `#d8516b` `#fb8761` |
| cividis（cividis） | `#4e576d` `#777775` `#a29a76` `#d1c066` `#ffea46` | `#00204d` `#27416d` `#5d626f` `#868478` `#b4a871` |

### 發散（5 階：負2 負1 中 正1 正2）

| 色盤 | 暗 | 淡 |
|---|---|---|
| 紫↔橘（PuOr） | `#c4a3ff` `#7c61a9` `#34342f` `#a06022` `#f8a052` | `#654199` `#af94e0` `#e7e6e2` `#d89359` `#824700` |
| 紅↔藍（RdBu） | `#ff958d` `#ad524d` `#34342f` `#3275b4` `#7cbdff` | `#9a2929` `#e6857e` `#e7e6e2` `#67aaed` `#005a9d` |
| 褐↔藍綠（BrBG） | `#eaa857` `#966626` `#34342f` `#008479` `#39d1c2` | `#7b4c00` `#cd995c` `#e7e6e2` `#4eb9ad` `#00665e` |

### 類別（12 色相順序的前綴）

| 色組 | 色數 | 備註 |
|---|---|---|
| Pulse 12 色 | 12 | 只保證相鄰；地圖上同時超過 3 類時要靠圖例／popup 輔助 |
| Pulse 8 色 | 8 | 只保證相鄰；地圖上同時超過 3 類時要靠圖例／popup 輔助 |
| Pulse 6 色 | 6 | 只保證相鄰；地圖上同時超過 3 類時要靠圖例／popup 輔助 |
| Pulse 3 色 | 3 | all-pairs 也通過（適合地圖） |
| Pulse 2 色 | 2 | all-pairs 也通過（適合地圖） |

# 驗證明細

（暗色欄位對 `#1f1f1f`／`#262626`、淡色欄位對 `#f5f5f3`／`#ffffff` 各跑一次官方 CLI。N/A＝該項不適用。）

## 1. 單色 12 色相（當成一組類別色，固定順序＝自動錯開的分配順序）

| 色盤 | 模式 | surface | 各項檢查 | 結果 |
|---|---|---|---|---|
| 12 色相（adjacent） | dark | `#1f1f1f` | Lightness band: **PASS**<br>Chroma floor: **PASS**<br>CVD separation: **PASS**<br>Normal-vision floor: **PASS**<br>Contrast vs surface: **PASS** | ✅ |
| 12 色相（adjacent） | dark | `#262626` | Lightness band: **PASS**<br>Chroma floor: **PASS**<br>CVD separation: **PASS**<br>Normal-vision floor: **PASS**<br>Contrast vs surface: **PASS** | ✅ |
| 12 色相（adjacent） | light | `#f5f5f3` | Lightness band: **PASS**<br>Chroma floor: **PASS**<br>CVD separation: **PASS**<br>Normal-vision floor: **PASS**<br>Contrast vs surface: **PASS** | ✅ |
| 12 色相（adjacent） | light | `#ffffff` | Lightness band: **PASS**<br>Chroma floor: **PASS**<br>CVD separation: **PASS**<br>Normal-vision floor: **PASS**<br>Contrast vs surface: **PASS** | ✅ |

前綴 all-pairs（地圖上同時出現的情境）：

| 色盤 | 模式 | surface | 各項檢查 | 結果 |
|---|---|---|---|---|
| 前 3 色（all-pairs） | dark | `#1f1f1f` | Lightness band: **PASS**<br>Chroma floor: **PASS**<br>CVD separation: **PASS**<br>Normal-vision floor: **PASS**<br>Contrast vs surface: **PASS** | ✅ |
| 前 3 色（all-pairs） | dark | `#262626` | Lightness band: **PASS**<br>Chroma floor: **PASS**<br>CVD separation: **PASS**<br>Normal-vision floor: **PASS**<br>Contrast vs surface: **PASS** | ✅ |
| 前 3 色（all-pairs） | light | `#f5f5f3` | Lightness band: **PASS**<br>Chroma floor: **PASS**<br>CVD separation: **PASS**<br>Normal-vision floor: **PASS**<br>Contrast vs surface: **PASS** | ✅ |
| 前 3 色（all-pairs） | light | `#ffffff` | Lightness band: **PASS**<br>Chroma floor: **PASS**<br>CVD separation: **PASS**<br>Normal-vision floor: **PASS**<br>Contrast vs surface: **PASS** | ✅ |
| 前 4 色（all-pairs） | dark | `#1f1f1f` | Lightness band: **PASS**<br>Chroma floor: **PASS**<br>CVD separation: **FAIL**<br>Normal-vision floor: **FAIL**<br>Contrast vs surface: **PASS** | —（上限參考） |
| 前 4 色（all-pairs） | dark | `#262626` | Lightness band: **PASS**<br>Chroma floor: **PASS**<br>CVD separation: **FAIL**<br>Normal-vision floor: **FAIL**<br>Contrast vs surface: **PASS** | —（上限參考） |
| 前 4 色（all-pairs） | light | `#f5f5f3` | Lightness band: **PASS**<br>Chroma floor: **PASS**<br>CVD separation: **FAIL**<br>Normal-vision floor: **FAIL**<br>Contrast vs surface: **PASS** | —（上限參考） |
| 前 4 色（all-pairs） | light | `#ffffff` | Lightness band: **PASS**<br>Chroma floor: **PASS**<br>CVD separation: **FAIL**<br>Normal-vision floor: **FAIL**<br>Contrast vs surface: **PASS** | —（上限參考） |

## 2. 類別色組（12 色相前綴）

| 色盤 | 模式 | surface | 各項檢查 | 結果 |
|---|---|---|---|---|
| Pulse 12 色 | dark | `#1f1f1f` | Lightness band: **PASS**<br>Chroma floor: **PASS**<br>CVD separation: **PASS**<br>Normal-vision floor: **PASS**<br>Contrast vs surface: **PASS** | ✅ |
| Pulse 12 色 | dark | `#262626` | Lightness band: **PASS**<br>Chroma floor: **PASS**<br>CVD separation: **PASS**<br>Normal-vision floor: **PASS**<br>Contrast vs surface: **PASS** | ✅ |
| Pulse 12 色 | light | `#f5f5f3` | Lightness band: **PASS**<br>Chroma floor: **PASS**<br>CVD separation: **PASS**<br>Normal-vision floor: **PASS**<br>Contrast vs surface: **PASS** | ✅ |
| Pulse 12 色 | light | `#ffffff` | Lightness band: **PASS**<br>Chroma floor: **PASS**<br>CVD separation: **PASS**<br>Normal-vision floor: **PASS**<br>Contrast vs surface: **PASS** | ✅ |
| Pulse 8 色 | dark | `#1f1f1f` | Lightness band: **PASS**<br>Chroma floor: **PASS**<br>CVD separation: **PASS**<br>Normal-vision floor: **PASS**<br>Contrast vs surface: **PASS** | ✅ |
| Pulse 8 色 | dark | `#262626` | Lightness band: **PASS**<br>Chroma floor: **PASS**<br>CVD separation: **PASS**<br>Normal-vision floor: **PASS**<br>Contrast vs surface: **PASS** | ✅ |
| Pulse 8 色 | light | `#f5f5f3` | Lightness band: **PASS**<br>Chroma floor: **PASS**<br>CVD separation: **PASS**<br>Normal-vision floor: **PASS**<br>Contrast vs surface: **PASS** | ✅ |
| Pulse 8 色 | light | `#ffffff` | Lightness band: **PASS**<br>Chroma floor: **PASS**<br>CVD separation: **PASS**<br>Normal-vision floor: **PASS**<br>Contrast vs surface: **PASS** | ✅ |
| Pulse 6 色 | dark | `#1f1f1f` | Lightness band: **PASS**<br>Chroma floor: **PASS**<br>CVD separation: **PASS**<br>Normal-vision floor: **PASS**<br>Contrast vs surface: **PASS** | ✅ |
| Pulse 6 色 | dark | `#262626` | Lightness band: **PASS**<br>Chroma floor: **PASS**<br>CVD separation: **PASS**<br>Normal-vision floor: **PASS**<br>Contrast vs surface: **PASS** | ✅ |
| Pulse 6 色 | light | `#f5f5f3` | Lightness band: **PASS**<br>Chroma floor: **PASS**<br>CVD separation: **PASS**<br>Normal-vision floor: **PASS**<br>Contrast vs surface: **PASS** | ✅ |
| Pulse 6 色 | light | `#ffffff` | Lightness band: **PASS**<br>Chroma floor: **PASS**<br>CVD separation: **PASS**<br>Normal-vision floor: **PASS**<br>Contrast vs surface: **PASS** | ✅ |
| Pulse 3 色 | dark | `#1f1f1f` | Lightness band: **PASS**<br>Chroma floor: **PASS**<br>CVD separation: **PASS**<br>Normal-vision floor: **PASS**<br>Contrast vs surface: **PASS** | ✅ |
| Pulse 3 色 | dark | `#262626` | Lightness band: **PASS**<br>Chroma floor: **PASS**<br>CVD separation: **PASS**<br>Normal-vision floor: **PASS**<br>Contrast vs surface: **PASS** | ✅ |
| Pulse 3 色 | light | `#f5f5f3` | Lightness band: **PASS**<br>Chroma floor: **PASS**<br>CVD separation: **PASS**<br>Normal-vision floor: **PASS**<br>Contrast vs surface: **PASS** | ✅ |
| Pulse 3 色 | light | `#ffffff` | Lightness band: **PASS**<br>Chroma floor: **PASS**<br>CVD separation: **PASS**<br>Normal-vision floor: **PASS**<br>Contrast vs surface: **PASS** | ✅ |
| Pulse 2 色 | dark | `#1f1f1f` | Lightness band: **PASS**<br>Chroma floor: **PASS**<br>CVD separation: **PASS**<br>Normal-vision floor: **PASS**<br>Contrast vs surface: **PASS** | ✅ |
| Pulse 2 色 | dark | `#262626` | Lightness band: **PASS**<br>Chroma floor: **PASS**<br>CVD separation: **PASS**<br>Normal-vision floor: **PASS**<br>Contrast vs surface: **PASS** | ✅ |
| Pulse 2 色 | light | `#f5f5f3` | Lightness band: **PASS**<br>Chroma floor: **PASS**<br>CVD separation: **PASS**<br>Normal-vision floor: **PASS**<br>Contrast vs surface: **PASS** | ✅ |
| Pulse 2 色 | light | `#ffffff` | Lightness band: **PASS**<br>Chroma floor: **PASS**<br>CVD separation: **PASS**<br>Normal-vision floor: **PASS**<br>Contrast vs surface: **PASS** | ✅ |

## 3. 序列（5 階，`--ordinal`）

| 色盤 | 模式 | surface | 各項檢查 | 結果 |
|---|---|---|---|---|
| 藍（Blues） | dark | `#1f1f1f` | Lightness monotone: **PASS**<br>Adjacent ΔL: **PASS**<br>Light-end contrast: **PASS**<br>Single hue: **PASS** | ✅ |
| 藍（Blues） | dark | `#262626` | Lightness monotone: **PASS**<br>Adjacent ΔL: **PASS**<br>Light-end contrast: **PASS**<br>Single hue: **PASS** | ✅ |
| 藍（Blues） | light | `#f5f5f3` | Lightness monotone: **PASS**<br>Adjacent ΔL: **PASS**<br>Light-end contrast: **PASS**<br>Single hue: **PASS** | ✅ |
| 藍（Blues） | light | `#ffffff` | Lightness monotone: **PASS**<br>Adjacent ΔL: **PASS**<br>Light-end contrast: **PASS**<br>Single hue: **PASS** | ✅ |
| 綠（Greens） | dark | `#1f1f1f` | Lightness monotone: **PASS**<br>Adjacent ΔL: **PASS**<br>Light-end contrast: **PASS**<br>Single hue: **PASS** | ✅ |
| 綠（Greens） | dark | `#262626` | Lightness monotone: **PASS**<br>Adjacent ΔL: **PASS**<br>Light-end contrast: **PASS**<br>Single hue: **PASS** | ✅ |
| 綠（Greens） | light | `#f5f5f3` | Lightness monotone: **PASS**<br>Adjacent ΔL: **PASS**<br>Light-end contrast: **PASS**<br>Single hue: **PASS** | ✅ |
| 綠（Greens） | light | `#ffffff` | Lightness monotone: **PASS**<br>Adjacent ΔL: **PASS**<br>Light-end contrast: **PASS**<br>Single hue: **PASS** | ✅ |
| 橘（Oranges） | dark | `#1f1f1f` | Lightness monotone: **PASS**<br>Adjacent ΔL: **PASS**<br>Light-end contrast: **PASS**<br>Single hue: **PASS** | ✅ |
| 橘（Oranges） | dark | `#262626` | Lightness monotone: **PASS**<br>Adjacent ΔL: **PASS**<br>Light-end contrast: **PASS**<br>Single hue: **PASS** | ✅ |
| 橘（Oranges） | light | `#f5f5f3` | Lightness monotone: **PASS**<br>Adjacent ΔL: **PASS**<br>Light-end contrast: **PASS**<br>Single hue: **PASS** | ✅ |
| 橘（Oranges） | light | `#ffffff` | Lightness monotone: **PASS**<br>Adjacent ΔL: **PASS**<br>Light-end contrast: **PASS**<br>Single hue: **PASS** | ✅ |
| 紫（Purples） | dark | `#1f1f1f` | Lightness monotone: **PASS**<br>Adjacent ΔL: **PASS**<br>Light-end contrast: **PASS**<br>Single hue: **PASS** | ✅ |
| 紫（Purples） | dark | `#262626` | Lightness monotone: **PASS**<br>Adjacent ΔL: **PASS**<br>Light-end contrast: **PASS**<br>Single hue: **PASS** | ✅ |
| 紫（Purples） | light | `#f5f5f3` | Lightness monotone: **PASS**<br>Adjacent ΔL: **PASS**<br>Light-end contrast: **PASS**<br>Single hue: **PASS** | ✅ |
| 紫（Purples） | light | `#ffffff` | Lightness monotone: **PASS**<br>Adjacent ΔL: **PASS**<br>Light-end contrast: **PASS**<br>Single hue: **PASS** | ✅ |
| 紅（Reds） | dark | `#1f1f1f` | Lightness monotone: **PASS**<br>Adjacent ΔL: **PASS**<br>Light-end contrast: **PASS**<br>Single hue: **PASS** | ✅ |
| 紅（Reds） | dark | `#262626` | Lightness monotone: **PASS**<br>Adjacent ΔL: **PASS**<br>Light-end contrast: **PASS**<br>Single hue: **PASS** | ✅ |
| 紅（Reds） | light | `#f5f5f3` | Lightness monotone: **PASS**<br>Adjacent ΔL: **PASS**<br>Light-end contrast: **PASS**<br>Single hue: **PASS** | ✅ |
| 紅（Reds） | light | `#ffffff` | Lightness monotone: **PASS**<br>Adjacent ΔL: **PASS**<br>Light-end contrast: **PASS**<br>Single hue: **PASS** | ✅ |
| viridis（viridis） | dark | `#1f1f1f` | Lightness monotone: **PASS**<br>Adjacent ΔL: **PASS**<br>Light-end contrast: **PASS**<br>Single hue: **N/A** | ✅ |
| viridis（viridis） | dark | `#262626` | Lightness monotone: **PASS**<br>Adjacent ΔL: **PASS**<br>Light-end contrast: **PASS**<br>Single hue: **N/A** | ✅ |
| viridis（viridis） | light | `#f5f5f3` | Lightness monotone: **PASS**<br>Adjacent ΔL: **PASS**<br>Light-end contrast: **PASS**<br>Single hue: **N/A** | ✅ |
| viridis（viridis） | light | `#ffffff` | Lightness monotone: **PASS**<br>Adjacent ΔL: **PASS**<br>Light-end contrast: **PASS**<br>Single hue: **N/A** | ✅ |
| magma（magma） | dark | `#1f1f1f` | Lightness monotone: **PASS**<br>Adjacent ΔL: **PASS**<br>Light-end contrast: **PASS**<br>Single hue: **N/A** | ✅ |
| magma（magma） | dark | `#262626` | Lightness monotone: **PASS**<br>Adjacent ΔL: **PASS**<br>Light-end contrast: **PASS**<br>Single hue: **N/A** | ✅ |
| magma（magma） | light | `#f5f5f3` | Lightness monotone: **PASS**<br>Adjacent ΔL: **PASS**<br>Light-end contrast: **PASS**<br>Single hue: **N/A** | ✅ |
| magma（magma） | light | `#ffffff` | Lightness monotone: **PASS**<br>Adjacent ΔL: **PASS**<br>Light-end contrast: **PASS**<br>Single hue: **N/A** | ✅ |
| cividis（cividis） | dark | `#1f1f1f` | Lightness monotone: **PASS**<br>Adjacent ΔL: **PASS**<br>Light-end contrast: **PASS**<br>Single hue: **N/A** | ✅ |
| cividis（cividis） | dark | `#262626` | Lightness monotone: **PASS**<br>Adjacent ΔL: **PASS**<br>Light-end contrast: **PASS**<br>Single hue: **N/A** | ✅ |
| cividis（cividis） | light | `#f5f5f3` | Lightness monotone: **PASS**<br>Adjacent ΔL: **PASS**<br>Light-end contrast: **PASS**<br>Single hue: **N/A** | ✅ |
| cividis（cividis） | light | `#ffffff` | Lightness monotone: **PASS**<br>Adjacent ΔL: **PASS**<br>Light-end contrast: **PASS**<br>Single hue: **N/A** | ✅ |

## 4. 發散（兩臂各自 `--ordinal`；中點刻意貼近底圖不驗）

| 色盤 | 模式 | surface | 各項檢查 | 結果 |
|---|---|---|---|---|
| PuOr 負臂 | dark | `#1f1f1f` | Lightness monotone: **PASS**<br>Adjacent ΔL: **PASS**<br>Light-end contrast: **PASS**<br>Single hue: **PASS** | ✅ |
| PuOr 負臂 | dark | `#262626` | Lightness monotone: **PASS**<br>Adjacent ΔL: **PASS**<br>Light-end contrast: **PASS**<br>Single hue: **PASS** | ✅ |
| PuOr 正臂 | dark | `#1f1f1f` | Lightness monotone: **PASS**<br>Adjacent ΔL: **PASS**<br>Light-end contrast: **PASS**<br>Single hue: **PASS** | ✅ |
| PuOr 正臂 | dark | `#262626` | Lightness monotone: **PASS**<br>Adjacent ΔL: **PASS**<br>Light-end contrast: **PASS**<br>Single hue: **PASS** | ✅ |
| PuOr 負臂 | light | `#f5f5f3` | Lightness monotone: **PASS**<br>Adjacent ΔL: **PASS**<br>Light-end contrast: **PASS**<br>Single hue: **PASS** | ✅ |
| PuOr 負臂 | light | `#ffffff` | Lightness monotone: **PASS**<br>Adjacent ΔL: **PASS**<br>Light-end contrast: **PASS**<br>Single hue: **PASS** | ✅ |
| PuOr 正臂 | light | `#f5f5f3` | Lightness monotone: **PASS**<br>Adjacent ΔL: **PASS**<br>Light-end contrast: **PASS**<br>Single hue: **PASS** | ✅ |
| PuOr 正臂 | light | `#ffffff` | Lightness monotone: **PASS**<br>Adjacent ΔL: **PASS**<br>Light-end contrast: **PASS**<br>Single hue: **PASS** | ✅ |
| RdBu 負臂 | dark | `#1f1f1f` | Lightness monotone: **PASS**<br>Adjacent ΔL: **PASS**<br>Light-end contrast: **PASS**<br>Single hue: **PASS** | ✅ |
| RdBu 負臂 | dark | `#262626` | Lightness monotone: **PASS**<br>Adjacent ΔL: **PASS**<br>Light-end contrast: **PASS**<br>Single hue: **PASS** | ✅ |
| RdBu 正臂 | dark | `#1f1f1f` | Lightness monotone: **PASS**<br>Adjacent ΔL: **PASS**<br>Light-end contrast: **PASS**<br>Single hue: **PASS** | ✅ |
| RdBu 正臂 | dark | `#262626` | Lightness monotone: **PASS**<br>Adjacent ΔL: **PASS**<br>Light-end contrast: **PASS**<br>Single hue: **PASS** | ✅ |
| RdBu 負臂 | light | `#f5f5f3` | Lightness monotone: **PASS**<br>Adjacent ΔL: **PASS**<br>Light-end contrast: **PASS**<br>Single hue: **PASS** | ✅ |
| RdBu 負臂 | light | `#ffffff` | Lightness monotone: **PASS**<br>Adjacent ΔL: **PASS**<br>Light-end contrast: **PASS**<br>Single hue: **PASS** | ✅ |
| RdBu 正臂 | light | `#f5f5f3` | Lightness monotone: **PASS**<br>Adjacent ΔL: **PASS**<br>Light-end contrast: **PASS**<br>Single hue: **PASS** | ✅ |
| RdBu 正臂 | light | `#ffffff` | Lightness monotone: **PASS**<br>Adjacent ΔL: **PASS**<br>Light-end contrast: **PASS**<br>Single hue: **PASS** | ✅ |
| BrBG 負臂 | dark | `#1f1f1f` | Lightness monotone: **PASS**<br>Adjacent ΔL: **PASS**<br>Light-end contrast: **PASS**<br>Single hue: **PASS** | ✅ |
| BrBG 負臂 | dark | `#262626` | Lightness monotone: **PASS**<br>Adjacent ΔL: **PASS**<br>Light-end contrast: **PASS**<br>Single hue: **PASS** | ✅ |
| BrBG 正臂 | dark | `#1f1f1f` | Lightness monotone: **PASS**<br>Adjacent ΔL: **PASS**<br>Light-end contrast: **PASS**<br>Single hue: **PASS** | ✅ |
| BrBG 正臂 | dark | `#262626` | Lightness monotone: **PASS**<br>Adjacent ΔL: **PASS**<br>Light-end contrast: **PASS**<br>Single hue: **PASS** | ✅ |
| BrBG 負臂 | light | `#f5f5f3` | Lightness monotone: **PASS**<br>Adjacent ΔL: **PASS**<br>Light-end contrast: **PASS**<br>Single hue: **PASS** | ✅ |
| BrBG 負臂 | light | `#ffffff` | Lightness monotone: **PASS**<br>Adjacent ΔL: **PASS**<br>Light-end contrast: **PASS**<br>Single hue: **PASS** | ✅ |
| BrBG 正臂 | light | `#f5f5f3` | Lightness monotone: **PASS**<br>Adjacent ΔL: **PASS**<br>Light-end contrast: **PASS**<br>Single hue: **PASS** | ✅ |
| BrBG 正臂 | light | `#ffffff` | Lightness monotone: **PASS**<br>Adjacent ΔL: **PASS**<br>Light-end contrast: **PASS**<br>Single hue: **PASS** | ✅ |

兩臂 ±1 色正常視覺 ΔE（≥ 15 才分得出正負）：

| 色盤 | 模式 | ΔE | 結果 |
|---|---|---|---|
| PuOr | dark | ±1 ΔE 19.4 | ✅ |
| PuOr | light | ±1 ΔE 19.3 | ✅ |
| RdBu | dark | ±1 ΔE 22.2 | ✅ |
| RdBu | light | ±1 ΔE 22.2 | ✅ |
| BrBG | dark | ±1 ΔE 16.6 | ✅ |
| BrBG | light | ±1 ΔE 16.9 | ✅ |
