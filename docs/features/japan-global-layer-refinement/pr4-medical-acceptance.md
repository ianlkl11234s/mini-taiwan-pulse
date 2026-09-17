# PR 4B 日本醫療、長照與醫療圈驗收

日期：2026-09-18

## Git 與資料基底

- Analytics 上游 PR [#94](https://github.com/ianlkl11234s/taipei-gis-analytics/pull/94)
  已用一般 merge commit `bff65414` 合入。
- Pulse draft PR [#266](https://github.com/ianlkl11234s/mini-taiwan-pulse/pull/266)
  保持 draft；新資產發布完成前不得 merge。
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

## Remaining publication gate

尚未執行 S3 upload、immutable readback、mutable `current.json` CAS 更新、
CDN readback、部署或 production browser。發布必須沿用 exact 781-object plan：
immutable assets 全部成功且讀回後，依序 catalog → publication manifest →
`current.json` last。需使用者另行明確授權。
