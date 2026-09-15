# Handoff — 日本旅宿、自然保護與世界遺產（下游）

> 上游契約：`/private/tmp/jp-tourism-data-ready-20260910/docs/handoff/jp-tourism-data-ready.md`

## 接線

- Loader：`src/data/jpTourismLoader.ts`
- Hook：`src/hooks/useJpTourismLayers.ts`
- PMTiles packaging：`scripts/preprocess/build-jp-tourism-pmtiles.sh`
- Scoped publisher：`scripts/deploy/publish-jp-tourism-assets.sh`
- General deploy allowlist：`scripts/deploy/upload-deploy-assets.sh`
- Catalog：`src/components/sidebar/layerCatalog.ts`

## Production assets

| Asset | Delivery | 語意 |
|---|---|---|
| `jp_accommodation_canonical_20260910.pmtiles` | PMTiles z3–14 | z3–13 density thinning；z14 完整 25,459 可渲染點；另有 502 null geometry entity 只存在來源契約 |
| `jp_accommodation_jta_20260331.geojson` | lazy GeoJSON | 2,282 rows；40 null geometry |
| `jp_accommodation_local_20260910.geojson` | lazy GeoJSON | 4,410 rows；462 null geometry；coverage 僅三轄區 |
| `jp_accommodation_osm_20260910.pmtiles` | PMTiles z3–14 | z14 完整 20,502 points；ODbL |
| `jp_world_heritage_unesco_current.geojson` | lazy GeoJSON | 27 rows；26 representative points、1 null；不是 property boundary |
| `jp_marine_ebsa_moe_coastal_20150101.pmtiles` | PMTiles z4–12 | 270 historical ecological-reference polygons；非法定保護區 |

## 硬依賴

- `filter_layer_id`：自然公園、A11、鳥獸保護、UNESCO、Ramsar、EBSA 分層；不得重命名或重建分類。
- `geocode_quality`：Ramsar 預設 `NAME_MATCH`，44 個 `ADMIN_OR_OTHER_CENTROID` 只在 degraded filter 顯示。
- `_provenance`、`license_set`、`sources`：canonical popup 的來源血緣與授權。
- `source_*`、`license*`、`usage_status`、`freshness_status`、geometry precision/caveat：popup 不得省略或推測。

## Release gate

1. 只允許 upload script 的逐檔 production allowlist；禁止 `public/world/*` wildcard。
2. HOLD/local-only 資產由 deployContract 雙向 ledger 阻擋。
3. S3 上傳後需驗證 object bytes/checksum、公開 URL `206 Range`、容器 pull、desktop/mobile browser；缺任一項只能稱 code-ready。

## Release evidence（2026-09-11）

- PR #243：squash `59c57c7717b94556a2be4890d6a1bcc8a7ceb80a`。
- S3：6/6 production objects bytes/SHA-256 readback 相符；沒有上傳 local-research/HOLD assets。
- HTTP：6/6 `/world/` URLs 的 `Range: bytes=0-15` 回 `206`；canonical total bytes `15,504,752`。
- Browser：desktop canonical/EBSA/popup 與 Japan catalog 通過；mobile 390×844 通過且無水平 overflow；console 無 warning/error。
- CI：build、Vitest、private coral backend tests 通過；Claude Code Review OAuth infrastructure failure，無 code finding。
