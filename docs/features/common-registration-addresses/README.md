# 共同登記地址 Common Registration Addresses

> **Slug**：`common-registration-addresses`
> **狀態**：staging（本機接線完成，尚未 upload / deploy）
> **Owner**：mini-taiwan-pulse
> **上線日期**：待部署
> **相關 PR**：待建立

## 一句話說明

顯示全台同一門牌登記至少 5 家公司的地址；點大小表示公司數，顏色表示資本額中位數。

## 圖層

| 名稱（layer key） | 類型 | 資料源 | 狀態 |
|---|---|---|---|
| `commonRegistrationAddresses` | Point | 版本化 GeoJSON（S3 volume） | 🟡 staging |

## 關鍵檔案

- Manifest：`src/data/layerManifest.ts`
- 視覺編碼 SSOT：`src/data/businessRegistryTypes.ts`
- Overlay：`src/map/overlayRegistry.ts`
- Catalog：`src/components/sidebar/layerCatalog.ts`
- Legend：`src/components/LegendPanel.tsx`
- Popup：`src/components/featureInfo/businessRegistryPanels.tsx`
- Deploy contract：`scripts/deploy/{upload,pull}-deploy-assets.sh`、`nginx.conf`

本層是靜態 GeoJSON，不需要 loader、hook、App 接線或 Supabase。

## 資料契約摘要

看 [handoff.md](./handoff.md)。上游 SSOT：
`taipei-gis-analytics/docs/handoff/common-registration-addresses.md`。

## 相關 backlog

看 [backlog.md](./backlog.md)。

## 歷次改動

看 [changelog.md](./changelog.md)。

## 相關文件

- [上游 handoff](../../../../taipei-gis-analytics/docs/handoff/common-registration-addresses.md)
- [開發規則](../../development-rules.md)
