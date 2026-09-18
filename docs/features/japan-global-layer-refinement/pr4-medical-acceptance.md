# PR 4B 日本醫療、長照與醫療圈驗收

日期：2026-09-18

## Git 與資料基底

- Analytics 上游 PR [#94](https://github.com/ianlkl11234s/taipei-gis-analytics/pull/94)
  已用一般 merge commit `bff65414` 合入。
- Pulse PR [#266](https://github.com/ianlkl11234s/mini-taiwan-pulse/pull/266)
  於 S3 發布與 readback 完成前保持 draft；現已可進入 ready／merge gate。
- 所有程式碼、可續傳 staging 與大型產物都在 repo 內 permanent worktree；
  沒有使用會消失的 `/tmp` 作為成果保存位置。

## All-zoom artifact

新本地 immutable release：
`6f59ead2cd2381d80154b4fa9b5ac7c32acec0d315600a3e5f97282cf93fdafa`。

| Dataset | Source grain | z0 count | Bytes | SHA-256 |
|---|---|---:|---:|---|
| Navii | drawable facility record | 189,800 | 308,486,234 | `365cf61d1a368070fa48e6b91d56c5087ba45073affe39f2d2a24d9710e45f3d` |
| H17 | service registration | 222,194 | 293,111,489 | `98bcee768155819c20f6b93e217e770fb040876c882c23f3649f586479985022` |

兩檔皆通過 `pmtiles verify`、z0--14 source-layer 契約、無
`dropped_by_rate`，且 z0 tile 直接解碼守恆。幾何是既有 reviewed immutable
PMTiles z14 display geometry 的回復值，不是新觀測或重新 geocode。

完整候選 release 保留原版其他 776 個資產，總計 778 個 payload files、
2,172,516,767 bytes。publication plan 精確列出 781 個物件
（778 assets + catalog + publication manifest + current），總計
2,172,833,151 bytes；dry-run 通過。

## Code / test / transport

- focused loader／分類／golden／search：35 passed。
- full suite：209 files passed + 1 skipped；1,601 passed / 8 skipped。
- `npx tsc -b`：PASS。
- production build：PASS；只有既有 large-chunk warning。
- deployment contract：9 passed。
- local payload：778／778 SHA-256 與 bytes PASS。
- localhost HTTP：current/catalog/details/aggregate 200；五個 PMTiles Range 206。

## Browser acceptance

本機 Vite、Japan z4.7：

- Navii 五類可獨立控制，5/5 同時開啟時全國點位仍顯示，類型色可辨識。
- H17 六個使用情境可獨立控制，6/6 同時開啟時全國服務登記仍顯示，分組色可辨識。
- 一次／二次／三次醫療圈可獨立控制，3/3 疊圖可見。
- legend 明示 `2020 歷史版 · STALE`、行政規劃邊界不是設施服務範圍，
  且人口／面積不可按 polygon part 加總。
- browser console error：0。

這是本機 browser 證據，不等於 CDN、deployment 或 production 驗收。

## S3 publication

- 於 `2026-09-18T02:23:43Z` 完成 exact 781-object 發布。
- 780 個 immutable 物件均為 `uploaded_and_verified`；`current.json`
  以舊版 SHA-256 `2116f272...c649` 作 CAS 前置條件，完成
  `updated_and_verified`。
- 逐物件 bytes、SHA-256、Content-Type 與 Cache-Control readback 全部通過。
- S3 `current.json` 已指向
  `6f59ead2cd2381d80154b4fa9b5ac7c32acec0d315600a3e5f97282cf93fdafa`。
- 完整回執證據：`jp-medical-s3-publication-receipt.json`。

## Remaining production gate

正式站 HTTP 目前仍是舊版
`d6f57fb991d7c714950fd6f334151ca9f4e6f27a887d2a0410e75b6b2223535a`，
證明 S3 發布尚不等於容器部署。剩餘 gate 是 PR #266 用一般 merge commit
合併、等待正常部署拉取資產，再進行 production HTTP/CDN Range 與
desktop／mobile browser 驗收。
