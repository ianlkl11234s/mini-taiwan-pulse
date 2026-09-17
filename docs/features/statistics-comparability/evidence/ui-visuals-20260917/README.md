# 統計視覺規則驗收

本輪追加 PR #258；合併暫停。資料契約與 CDN 不變。

## 驗收範圍

- 299 個 source recipes、12 個教育固定入口，以及獨立犯罪統計入口的 icon／主題色。
- 同一來源的原始數、人均值與面積平均保持同主題；地圖和 legend 共用 runtime recipe 的色階。
- 所有分級門檻原封保留；新增淺深說明，教育增減以棕／紫區分 0 兩側。
- 灰色 missing、斜線 suppressed、PARTIAL／STALE 與零值政策沿用原有實作。

## 方法依據

- https://colorbrewer2.org/learnmore/schemes_full.html
- https://matplotlib.org/stable/users/explain/colors/colormaps.html

主題色只作為分類提示，不能單憑顏色比較不同單位／指標；圖例的門檻數字仍是比較基準。

## 主題視覺

| 主題 | icon 示例 | 順序色系 |
|---|---|---|
| 教育 | 學校、教學板、學士帽 | 紫 Purples |
| 醫療長照 | 醫院、病床、聽診器、照護 | 藍綠 BuGn |
| 住宅 | 房屋 | 橙 Oranges |
| 交通 | 公車、自行車、車輛、飛機、船、捷運、事故警示 | 藍 Blues |
| 農業／畜牧 | 麥穗／牛 | 黃綠 YlGn／黃棕 YlOrBr |
| 漁業／林業 | 魚／樹木 | 紫藍 PuBu／綠 Greens |
| 環境／公用事業 | 回收、垃圾、噪音／電力、水 | 藍紫 BuPu／綠藍 GnBu |

## 結果

- 全站 Vitest：1463 passed、4 skipped；TypeScript 與 production build 通過。
- 視覺規則 33 tests：299 source + 12 views 無 generic fallback；manifest icon/accent 一致；原始與衍生指標同主題。
- 色覺測試 4 tests：一般／protan／deutan／tritan severity 100 模擬，所有 source recipe 相鄰順序階或增減兩側階的 CIELAB L* 差均大於 5，保留分級門檻及色數契約。測試的是不透明色票，實際底圖與透明度仍影響視覺結果。
- 模擬矩陣依據 Machado et al. 2009，由 colorspacious 原始碼附表核對：https://github.com/njsmith/colorspacious/blob/master/colorspacious/cvd.py 。此測試不能代替實際色覺障礙使用者研究。
- 真實 browser、正式 CDN：醫療 159/368 PARTIAL（medical-desktop.png）；教育增減率 22/22、正負圖例門檻一致（education-diverging.txt/png）；手機住宅比例 368/368 STALE（housing-mobile.txt/png）。
- 手機尺寸：要求390×844 viewport，當前 browser 縮放下實測 innerWidth=scrollWidth=433 CSS px，無水平溢出；已恢復 viewport。非實體手機驗收。
- 桌面 All Off 後單獨開啟醫療成功；手機統計全關後無 checked switch、數值圖例移除。
- 預覽開發過程曾遇到 HMR 在新模組尚未寫完時報錯，並發現舊本地資料來源設定失效；重新啟動預覽明確使用正式 CDN 後完成上述驗收。

## 資料來源總覽追加驗收

- `source-derived.txt`：無障礙公車占比可搜尋，公式與分子／分母、交通部統計處（SEGIS）、2025 期間及開放授權可見。
- `source-education.txt`：國小學生固定入口明示預設指標，已發布來源機關為教育部統計處，期間2025-08-01至2026-07-31。
- `source-housing.txt`：住宅同名比例搜尋結果區分縣市與鄉鎮；鄉鎮卡分子／分母名稱亦為鄉鎮市區。
- `source-housing-mobile.png`：實測viewport CSS width=scrollWidth=433，來源卡 clientWidth=scrollWidth=388；無水平溢出。讀取來源卡期間 URL 僅保留原來的 jpAccommodationCanonical，沒有啟用統計地圖。
- 全測1467 passed／4 skipped。來源透過既有 loader 讀取，沿用 hash 與 exact selector；可能同時載入該指標資料和共用 geometry cache，不是另外對原始來源網站抓取全量資料。
