# Allen Coral Atlas 私人圖層

> **Slug**：`allen-coral-atlas`（上游：`taipei-gis-analytics/docs/handoff/allen-coral-atlas.md`）
> **狀態**：shipped（2026-09-15～16 上線，站主限定；僅「非本人帳號 browser 驗收」一項未勾）
> **相關 PR**：#253、#254（歷史珊瑚改公開）；#270、#279、#285、#289、#290（登出撤銷 session、Allen 錯誤分類與稽核輪替）——依 CHANGELOG.md

## 一句話說明

Allen Coral Atlas 台灣與沖繩淺海棲地分類／礁體地形（5 m 名目解析度），私人研究圖層，僅本人登入可讀。

## 圖層

- layer key：`allenCoralAtlas`（`src/data/layerManifest.ts`；預設關閉，三種檢視擇一：珊瑚／藻類、完整棲地、地形）
- 資料：兩份 PMTiles（benthic、geomorphic），私人 S3 `migu-gis-data-collector` 的 `private-research/allen-coral-atlas/<SHA256>/`，經 owner 驗證的 Range 端點讀取，不走公開 CDN。
- 與歷史珊瑚 `coralReefDistribution` 分離，見 [`../coral-reef-layers/`](../coral-reef-layers/README.md)。

## 關鍵檔案

- Hook：`src/hooks/useAllenCoralAtlasLayer.ts`；型別：`src/data/allenCoralAtlasTypes.ts`
- Sidecar：`server/coral-private/coral-private-server.mjs`（測試 `server/coral-private/test/`）
- 上傳：`scripts/deploy/upload-allen-private.mjs`；部署：`nginx.conf`、`scripts/deploy/entrypoint.sh`；登出撤銷：`src/lib/auth.ts`

## 資料契約

[handoff.md](./handoff.md)（欄位、source ID、SHA 核對）。null 一律顯示「未提供」；取得日 2026-09-15 不是觀測日。

## 驗收方式

[browser-acceptance.md](./browser-acceptance.md)（本地，墾丁／沖繩／宮古／八重山，桌面與手機）、[production-release.md](./production-release.md)、[access-release-20260916.md](./access-release-20260916.md)；原始證據為本資料夾各 `*-evidence.json`、`sha-verification.json`、`evidence/`。

## 文件索引

| 文件 | 用途 |
|---|---|
| [handoff.md](./handoff.md) | 本地交付、接線與資料語意 |
| [production-release.md](./production-release.md) | 正式架構（私人 S3、sidecar、nginx、撤銷清單） |
| [access-release-20260916.md](./access-release-20260916.md) | 2026-09-16 存取設定與正式資料發布 |
| [browser-acceptance.md](./browser-acceptance.md) | browser 驗收 |
| [backlog.md](./backlog.md) / [changelog.md](./changelog.md) | 驗收清單／改動紀錄 |
