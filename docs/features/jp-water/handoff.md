# Handoff — 日本水資源

## Immutable artifact contract

Root pointer：`public/world/jp_water/release.json`，前端 URL 為 `/world/jp_water/release.json`。
每個 release 的 asset 只能置於 `public/world/jp_water/releases/<release>/<layer>.geojson` 或 `.pmtiles`；不可 wildcard 掃描目錄。`release.json` 必須是：

```json
{
  "contract_version": 1,
  "release": "YYYYMMDD-or-immutable-id",
  "assets": [{
    "key": "jpWaterLakes", "format": "geojson", "path": "releases/<release>/jpWaterLakes.geojson",
    "bytes": 1, "sha256": "64 lower-case hex", "year": "2005",
    "source_url": "https://…", "license": "source-specific license", "coverage": "Japan",
    "geometry_role": "polygon", "status": "published"
  }]
}
```

PMTiles asset 另必填 `source_layer`。每個 asset 的 `geometry_role` 必須與 `src/data/jpWaterTypes.ts` 固定契約相同；缺 `year/source_url/license/coverage`、`bytes/SHA-256`、release 路徑，或 `HOLD/local_only`，loader 一律拒絕，不得當作空圖層成功。

`status: "published"` 僅表示該 immutable artifact 被目前 release allowlist 選中；單獨存在時不是 S3 upload、checksum readback、container pull、HTTP Range、deployment 或 browser production 證據，這些須各自記錄。

### License gate

國土數値情報舊利用約款（[agreement_02 §1](https://nlftp.mlit.go.jp/ksj/other/agreement_02.html)）排除非商業的複製物再配布。因此 W01、W05、P21、P22 的衍生 vector 不得進 `/world/jp_water/release.json` 或 public allowlist，即使本次產品預期非商用也不能推定可公開再散布。型別保留其契約，loader 也會拒絕它們；若要本機研究預覽，須走明確的 `local_only` 路徑，不能把它標為 `published`。W09、經核實條款的高松、橫濱與環境省水質站才是 public candidate，仍須逐 release 驗證 license。

## Properties required for popup / provenance

每個 feature 至少保留 `name`、`source_year`、`source_url`、`license`、`entity_role`；asset metadata另含`coverage`、`geometry_role`。有值才帶：`operator`、`facility_category`、`capacity`、`capacity_unit`、`water_system`、`station_id`、`observation_kind`。未知使用 `null`，不可填 `0` 或推測。P21 的泵場與管理中心不可標成淨水場；P22 必須保留處理廠/泵場分類。quality station 是 2024 站表（12,274 raw、9,831 distinct、2,443 source duplicates），不能顯示成濃度；其 public candidate 條款需引用環境省 PDL1.0。橫濱站表未註 data time，URL 2024-07-05 不是觀測月份；2026-03 必須只寫在獨立觀測 artifact metadata。

## Current gates

- 半田CRS已由官方XML及同包WKT確認EPSG:6675；24104為管渠記號背景21,223點（不是24,104筆），排除。9個實體層已本地整理，雨/污重複幾何用途標unknown/shared；尚未接線。
- 横浜 55 水位站與 2026-03 472,507 筆觀測為不同 grain；站點與觀測序列不可互相替代。
- 所有 KSJ 歷史範圍需在 release 中明示年份、coverage、license 與 historical 狀態。

## 2026-09-18 本地瀏覽器證據

Chrome + Vite 3742：四層實際渲染及點擊popup通過，樣本為琵琶湖2005、水質站Ｎｏ．１９（2024，台帳非測值）、橫濱トーヨー橋（台帳年份未註）、高松旧御殿水源地（水道資料館）。湖泊分享網址重載保留layer並渲染；79 tests含URL round-trip。非production證據。

## 2026-09-18 production evidence

- Zeabur deployment `6aace0570f50de6ff52c3469` completed at `2026-09-18T07:01:08.039Z`, status `RUNNING`, from master commit `5fdde19d0af1e73492f9acdb6b52c867ac4a3a96`: [receipt](./evidence/production-deployment.json).
- Production root and all four assets returned HTTP 200 with expected SHA-256, byte size, and feature count: [readback](./evidence/production-readback.json). This verifies the published payload rather than only the release allowlist.
- Native Chrome via CUA verified the Japan entry point「水資源 1/4」、four toggles, and「水資源靜態資料」catalog group; it also rendered actual geometries and verified click popup, source attribution, license, processing disclosure, and URL selection for 琵琶湖、上野、トーヨー橋、旧御殿水源地: [browser receipt](./evidence/production-browser.json). Physical mobile-device evidence remains absent.
