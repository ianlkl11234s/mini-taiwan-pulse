# PR 3 日本旅宿 production 驗收

日期：2026-09-18

## Git 與發布範圍

- Analytics 上游 PR [#93](https://github.com/ianlkl11234s/taipei-gis-analytics/pull/93)
  已用一般 merge commit `51db5e14` 合入。
- Pulse 前端 PR [#265](https://github.com/ianlkl11234s/mini-taiwan-pulse/pull/265)
  已用一般 merge commit `7e011185` 合入。
- 本次只新增四個 immutable `deploy-assets/world/` 物件；既有四個日本觀光／自然
  資產只做 checksum／bytes 比對，沒有覆寫。
- 產物與本驗收文件都保存在 repo 內 permanent worktree；不以 `/tmp` 或
  `/private/tmp` 保存成果。

## Immutable artifacts 與 S3 readback

| Asset | 語意 | Bytes | SHA-256 |
|---|---|---:|---|
| `jp_accommodation_canonical_allzoom_20260910.pmtiles` | 去重旅宿 entity 點；z0--14 不抽樣 | 94,708,813 | `a5156bf0a0d376655df313d10fce03858f119fc7f6ae7035755bf3e1b729ab4a` |
| `jp_accommodation_osm_allzoom_20260910.pmtiles` | OSM community coverage 點；z0--14 不抽樣 | 47,535,462 | `ed0fca57217fe6b85ea4bc21f06e32dc68764675ec681f6a6136fe369961db89` |
| `jp_accommodation_density_450m_20260910.pmtiles` | canonical entity count，450 m 網格 | 9,372,281 | `d28b071583bc3a8e8be1b99aab3c1210efb79ffc97f84d56b30d3b2690c695d6` |
| `jp_accommodation_density_1500m_20260910.pmtiles` | canonical entity count，1,500 m 網格 | 9,943,141 | `46a7037d808146e5a86032630071c031c2ab34d66feeea4548bbbd09421872a3` |

- 四檔本地皆通過 `pmtiles verify`。
- canonical z0 feature count = 25,459；OSM z0 feature count = 20,502。
- 450 m 與 1,500 m 網格各自 `sum(n_records)=25,459`；網格是密度顯示，
  不取代或冒充原始點。
- 上傳使用 create-only／immutable gate；四個 S3 body 全量下載 readback 後，
  SHA-256 與 bytes 均與上表一致。
- S3 metadata：`Content-Type: application/vnd.pmtiles`、
  `Cache-Control: public,max-age=31536000,immutable`。

## Deployment 與 production HTTP

- Zeabur project `69a3b5eb07e6de1869be6e28`、service
  `69a3b5f307e6de1869be6e2c`。
- deployment `6aacade80f50de6ff52c27e5` 於
  `2026-09-18T03:20:36Z` 開始，`2026-09-18T03:25:07Z` 完成，狀態
  `RUNNING`；部署 commit 為已合併的 `9b8c1afc`。
- runtime log 於 `2026-09-18T03:26:12Z` 進入
  `sync world -> /data/world/`；等待 background sync 完成後才驗收 URL。
- 正式網域四個 `/world/*.pmtiles` 均回 `206 Partial Content`，要求
  `bytes=0-16383` 時 `Content-Length=16384`；`Content-Range` 的總 bytes
  分別為 94,708,813、47,535,462、9,372,281、9,943,141，與 artifact
  完全一致。
- production nginx 回 `Content-Type: application/octet-stream`、
  `Cache-Control: max-age=86400` 與 `public`；S3 immutable metadata 如上，
  兩層 header 分開記錄，不互相冒充。

## Production browser acceptance

正式站 `https://mini-taiwan-pulse.itsmigu.com/`：

- 點「日本」只移動視角，旅宿為 `0/5`，沒有自動開啟總覽。
- Canonical：z4.7 全日本原始點完整可見，旅宿分類色可辨識。
- OSM coverage：z4.7 全日本原始點完整可見；東京 z9 的 hotel、guest
  house、hostel、apartment、motel、resort、unknown 分類色可辨識。
- OSM popup 抽查「八重洲ターミナルホテル」：顯示來源 OpenStreetMap、
  `source_as_of=20260910`、ODbL 1.0、`native_point`、
  `community_mapped_not_complete`、分類 `hotel` 與來源網址。
- OSM legend 明示社群 coverage 不是完整或官方名冊。
- Density：z4.7 全日本與東京 z9 都有網格；高密度核心與低密度區可辨識。
- 390 x 844 viewport：OSM z4.7 全日本點位、分類色與 mobile controls 可見。
- browser console warning／error：0。

## 結論

PR 3 的 code、immutable artifacts、S3 body readback、deployment、production
HTTP Range、desktop 與 390 px mobile browser 均已分層驗收完成。旅宿 release
不再有待上傳或待部署 gate。
