# Handoff — 共同登記地址（下游視角）

> **上游 SSOT**：[`taipei-gis-analytics/docs/handoff/common-registration-addresses.md`](../../../../taipei-gis-analytics/docs/handoff/common-registration-addresses.md)
>
> 本檔只記前端硬依賴與發布契約；聚合方法與 QA baseline 以上游 handoff 為準。

## 上游 artifact

| 項目 | 契約 |
|---|---|
| Analytics 路徑 | `data/processed/business_registry/common_registration_addresses/common_registration_addresses_202608_r2.geojson` |
| Pulse staging / URL | `public/business_registry/common_registration_addresses_202608_r2.geojson` / `/business_registry/common_registration_addresses_202608_r2.geojson` |
| S3 key | `deploy-assets/business_registry/common_registration_addresses_202608_r2.geojson`（已 upload 並讀回驗證） |
| 版本 | `202608_r2`（dated filename immutable；不覆寫 r1） |
| 幾何 | WGS84 Point |
| features | 11,121 |
| bytes | 2,688,498 |
| SHA-256 | `bf78dc3cdd7524a038c2b73ea0c72b4511314e552397c65a763821d0e876d6c1` |
| 發布狀態 | S3 uploaded + SHA-256 / size / metadata 讀回驗證完成；deploy / browser smoke pending |
| 更新頻率 | 每月，跟隨 company stock vintage |

## 前端接線位置

- Manifest / source：`src/data/layerManifest.ts`
- 視覺編碼：`src/data/businessRegistryTypes.ts`
- Overlay：`src/map/overlayRegistry.ts`
- UI toggle：`src/components/sidebar/layerCatalog.ts`
- Legend：`src/components/LegendPanel.tsx`
- Popup：`src/components/featureInfo/businessRegistryPanels.tsx`
- Click：`src/map/gisClickRegistry.ts`

## 硬依賴欄位

properties 必須嚴格只有四欄：

| 欄位 | 型別 | 前端用途 |
|---|---|---|
| `address` | string | popup 地址；全檔唯一 |
| `n_companies` | integer，≥5 | 點大小、popup 公司數 |
| `capital_sum` | number | popup 資本額總和 |
| `capital_median` | number | 固定非線性色階、popup 新臺幣金額 |

不依賴內部 building key、縣市、統編、公司名稱、代表人或成員名單。

## 上游改動 → 下游動作

| 上游改動 | 下游動作 |
|---|---|
| 四欄新增、移除、改名或改型別 | 視為 breaking；同步 constants、overlay、popup、static contract 與本 handoff |
| vintage / checksum 改變 | staging 新 dated filename，驗 checksum，再改 manifest + overlay URL |
| feature 數或值域明顯改變 | 重驗 minzoom、log 尺寸 stops 與固定資本額級距 |
| GeoJSON 超過 5MB | 停止沿用 dataClass A，評估 PMTiles |

## 語意約定

圖層僅陳述同一門牌共同登記至少 5 家公司的聚合事實；使用者可用 5–800 家滑桿調整顯示門檻。`capital_sum` / `capital_median` 都是描述性統計，不是評分。UI 名稱固定為「共同登記地址」。

## 已知不對稱

- Analytics 是 canonical artifact；Pulse `public/business_registry/` 只是 gitignored deploy staging。
- 本層不走 Supabase，因此沒有 migration、RPC、loader 或 loadingRegistry。
