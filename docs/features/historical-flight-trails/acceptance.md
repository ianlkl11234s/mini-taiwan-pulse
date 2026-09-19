# 本地驗收 2026-09-18

範圍：隔離 worktree codex/historical-flight-trails-20260918。本地實作，未整合主分支、commit、上傳或部署。

## 資料

98 份 partial 靜態資產、31 個 unavailable 選項；共 106,217,453 bytes。來源 3,775,964 點，保留 3,775,824 點，140 個分段後孤立點無法成線，明確計入品質欄。資產無座標四捨五入、抽稀、平滑或假造觀測點；保留高度。顯示端依使用者要求把同航班缺口直接連線，並只為球面繪圖增加 render-only 頂點，不回寫來源資料。

台灣17場與來源清單中的日本78場均有選項。03/10、03/14台灣僅桃園／高雄有部分軌跡；台灣02/20有16/17場，日本僅保留02/18且78/78場有可繪資產。這是 `airport-points` 日本來源清單的全涵蓋，不等於日本所有登記飛行場，也不表示來源查詢完整。恆春仍缺軌跡。

## 驗證

- Python exporter：9 tests pass。
- 全套 Vitest：159 files pass、1361 tests pass、3 skipped；底圖重載修正後另加1項hook回歸測試通過，涵蓋source留存／消失且不重新抓取。
- TypeScript build 通過；Vite production build 成功，有既有大型chunk warning。
- dist/flight-trails 不存在，示範資料不隨 app build 發布。
- Browser：桃園03/10，56班／53,314點，藍白航跡可見；機場定位正常。
- Browser：恆春03/10、日本03/10明確 unavailable。
- Browser：羽田02/18，1167班／680,162點可見；點擊 JL506 顯示來源、Asia/Tokyo、日期、航班、進離場與452來源／保留點。
- Browser：淺色→深色底圖切換後羽田航跡恢復。修正style diff不觸發style.load時的補掛；styledata/idle僅在圖層缺失時補掛。

## 費用與界線

本次僅離線讀既有檔案，沒有付費抓取或上傳。此圖層 loader 只有manifest與版本化靜態資產GET，無資料庫或FR24 import。單元測試確認快取、in-flight合併與paint/filter不setData；未以network trace證明整個網站無資料庫請求（既有即時功能仍存在）。CDN儲存／流量仍可能有費用，不能承諾零費用。

來源公開展示權、完整日補抓、發布headers/cache/readback、實體手機效能仍待完成。

## Flight Arc globe／細線改造驗收

使用者明確要求Flight Arc 3D及「直接連線」；本段取代上方2D呈現描述。

- Three.js 單批次 `BufferGeometry + LineSegments + ShaderMaterial`；取消幾何粗線、三倍 halo 與端帽。線條強度以 subpixel alpha 控制，依觀測高度0–12,000m呈藍白漸層；本層高度倍率預設3，source不改。
- Mapbox globe callback 傳入 projection matrix、transition 與相機位置；頂點預存 ECEF，shader 做 globe/Mercator 過渡、球緣淡出與背面剔除。globe depth 不作為遮蔽依據。
- 同航班跨觀測空白依序直接連線；原始 `gap_count` 維持。長距離與跨日界線只在繪圖幾何做 great-circle 細分與最近 world unwrap，避免球面穿弦及平面過渡橫跨世界。
- 瀏覽器近景：桃園03/10、z8、pitch60 顯示細線、3D高度與藍白梯度，無逐觀測點亮點。
- 瀏覽器全球：z1.83 正面航跡貼球；旋轉至 `lng=-79.1027, lat=-42.0035` 的背面視角後航跡完全隱藏；z4.5 過渡視角未見穿球或跳線。
- 初次 browser 驗收抓到 shader `color` 重複宣告並已修正；修正後沒有新增 WebGL error。全套162檔／1364 tests pass、3 skipped；`tsc -b` 通過。
- 無連續repaint loop；opacity/線條強度/filter維持geometry，樣式重載復原測試通過。
- 尚無真機效能或部署證據；本次未付費抓取、上傳或部署。

## 全部機場驗收

- 台灣／日本機場選單首項皆為「全部機場」；日期清單按國家去重，並顯示該日有 asset 的機場數。日本清單為78場且只提供 `2026-02-18`。
- 首次開啟預設為全部機場；台灣日期 `2026-02-20`，日本日期 `2026-02-18`，避免落在僅少數機場有資料的 3 月樣本。Browser 重載確認台灣預設為 16/17 機場、898 個去重航班、各 asset 點位合計 561,190，console 無 error／warn。
- loader 限定同國家／同日期的版本化靜態 asset；跨機場重複航班依 `flight_id` 去重並合併 roles，全部無 asset 時維持 unavailable。
- Browser：台灣 2026-03-10 顯示 2/17 機場可用、15 場 unavailable、54,685 點；載入後為 58 班。點擊「查看全部機場」定位至 `23.7, 120.9, z5.5, pitch45`，3D 航跡可見，console 無 error／warn。
- 最終全套 Vitest：162 files pass、1366 tests pass、3 skipped；`tsc -b` 與 `git diff --check` 通過。
- 本次只增加前端靜態檔聚合；沒有資料庫、FR24、上傳或排程路徑。日本78場 `2026-02-18` 的78資產共86,956,197 bytes，合併後3,708個唯一航班／2,212,828個選用軌跡點；仍待實體裝置效能驗收。
- Browser：日本面板顯示78個機場選項且日期只有 `2026-02-18`；全部機場載入完成為78/78、3,708個唯一航班，`138, 37, z4.2, pitch45` 的3D全國視角可見，console 無 error／warn。
- 最終驗證：Python exporter 11 tests、Vitest 162 files／1366 tests pass（3 skipped）、`tsc -b`、資產 bytes/SHA-256 全數通過。
