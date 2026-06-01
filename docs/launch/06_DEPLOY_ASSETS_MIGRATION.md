# Deploy-assets 搬家計畫：扁平 → 鏡像結構 + manifest 總帳

> 目標：把 S3 `deploy-assets/` 從現在的「扁平 + 散落手寫清單」改成「三邊長一樣的鏡像結構 + 一份 manifest 總帳」，
> 讓「加新大檔 = 丟進對應資料夾就好」，根治 GAP-1 類漏接。
> **這是上線後的優化，不卡本次上線**（本次 agriculture 已用乾淨子前綴、pull 已全面 sync）。
> 全程可逆：舊扁平物件先保留不刪，雙軌並行驗證無誤後再清。

---

## 1. 現況 vs 目標

**現況（扁平）**：S3 `deploy-assets/provincial_road.geojson`、`deploy-assets/h3_demographics_res8.json` … 全擠根目錄，
pull 用 `--include` filter 手動分流到 `/data/geo`、`/data/h3`。新增檔要改 upload + pull 兩處清單 → 易漏。

**目標（鏡像）**：三邊資料夾結構完全一致
```
S3 deploy-assets/        /data/              nginx
  geo/        ───────→   geo/        ──────→  /geo/
  h3/         ───────→   h3/         ──────→  /h3/
  fire/       ───────→   fire/       ──────→  /fire/
  bus/        ───────→   bus/        ──────→  /bus/
  agriculture/───────→   agriculture/──────→  /agriculture/   ← 本次已是此結構
  rail/ (tar) ───────→   rail/       ──────→  /rail/
  root json   ───────→   /data/*.json──────→  regex
```
pull 簡化成幾行整夾 sync（無 include 清單）：
```sh
for d in geo h3 fire bus agriculture; do
  aws s3 sync "$S3/$d/" "$DATA_DIR/$d/" --no-progress
done
```

## 2. Manifest 總帳（單一真實來源）

新增 `scripts/deploy/deploy-assets-manifest.json`，記錄每個受管大檔。範例：
```json
{
  "version": "2026-06-01",
  "groups": {
    "geo":   { "data_dir": "/data/geo", "nginx": "/geo/", "fallback_dist": true,
               "files": [ {"name":"provincial_road.geojson","bytes":46000000,"layer":"provincialRoads"} ] },
    "agriculture": { "data_dir": "/data/agriculture", "nginx": "/agriculture/", "fallback_dist": false,
               "files": [ {"name":"ftw_fields_2025.pmtiles","bytes":107138689,"layer":"agriculture"},
                          {"name":"soil_map_national.pmtiles","bytes":28145356,"layer":"agriSoil"} ] }
  }
}
```
用途：(a) 上線前稽核（前端引用 ↔ manifest ↔ 實際 S3 三方比對的 SSOT）；
(b) 容量/費用估算；(c) upload/pull 可改成「讀 manifest 自動跑」，徹底免手寫清單。

## 3. 搬家步驟（雙軌、可逆、不刪舊檔）

> 前置：用唯讀 S3 key 可做稽核；搬移（cp/rm）需 write key，屬「key 動作」先確認。

1. **複製（不搬不刪）**：`aws s3 cp` 把扁平物件複製到對應子前綴
   ```bash
   # 範例：geo 群組（逐檔或用 manifest 迴圈）
   aws s3 cp s3://$B/deploy-assets/provincial_road.geojson s3://$B/deploy-assets/geo/provincial_road.geojson
   # h3 / fire 同理；agriculture 本次已直接上子前綴
   ```
2. **改 pull 腳本**為整夾 sync 版（移除 include 清單）。
3. **本地 docker build 實測**：確認所有層仍正常（雙軌期：新子前綴有檔、舊扁平也還在，pull 只讀新結構）。
4. **部署驗證**一輪（逐層 smoke test + Network 無 404）。
5. **確認無誤後**才清理舊扁平物件（保留一份備份清單；此步是唯一的刪除，需你拍板）。
6. **建立 manifest**並（選做）把 upload/pull 改成讀 manifest 驅動。
7. **docker-compose.yml** 一併改成鏡像掛載（修掉目前本地與線上結構脫節的問題）。

## 4. 完成後的效果
- 加新大檔：丟進 `deploy-assets/<群組>/` → pull 整夾 sync 自動帶、nginx 整夾路由已涵蓋 → **0 改腳本**。
- manifest = 隨時可稽核的總帳，新人接手一看就懂。
- 與 `04_NEW_DATA_SOP.md` 的【D 類】checklist 對齊（届時 D 類第 2~4 步簡化為「上傳到對的資料夾 + 更新 manifest」）。

## 5. 風險與可逆
- 雙軌期 S3 同時有扁平 + 子前綴 = 暫時多佔一份倉儲（幾百 MB，每月幾塊），驗證後清掉即回。
- 任何一步出錯：pull 腳本 `git checkout`；S3 舊扁平物件全程未動，立即可退回舊 pull。
- 清理舊物件是唯一不可逆動作 → 最後一步、需你明確同意、且先存物件清單備份。
