# 部署 Runbook（明早逐步執行）

> 每一步都標可逆方式。遇到 🟡 決策點先看 `05_MORNING_REPORT.md`。
> Zeabur 一律用 `npx zeabur@latest`。**不刪檔、不 rm、key 異動先確認。**

---

## STEP 0 — 環境確認（1 分鐘）

```bash
cd "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/mini-taiwan-pulse"
git status -sb
git tag -l "backup/pre-launch-*"          # 確認安全網還在
npx zeabur@latest auth status -i=false     # 確認登入
npx tsc -b                                  # 應 exit 0
```

## STEP 1 — 決策點（看晨間報告後勾選）

- [ ] D1 Key：Zeabur runtime 用哪把 S3 key？是否輪換 Mapbox/其他？（見報告 §key）
- [ ] D2 Agriculture（380MB）是否納入本次上線？（決定要不要做 STEP 3）
- [ ] D3 Supabase 安全收斂（撤 anon 直讀）今天做還是上線後做？
- [ ] D4 `get_bus_trails` timeout 是否今天改？

## STEP 2 — Commit WIP 到 feat/fire-rescue（可逆：`git reset`）

`.gitignore` 已補好（pmtiles/png/cache 已排除）。untracked 已乾淨。

```bash
git add -A
git status            # 再確認沒有 *.pmtiles / *.png / .pingtung_geocode_cache.json
git commit -m "feat(fire+agri+deploy): 等時圈/農企業/road events + entrypoint 自動 pull

- LayerSidebar 邏輯抽到 layerCatalog（單一真實來源）
- 新增 fireIsochrone(PMTiles) / agri 三類公司 / road events 接線
- Dockerfile entrypoint：啟動先 pull S3→/data 再起 nginx
- .gitignore 補 public/fire/*.pmtiles 等

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```
↩︎ 還原：`git reset --soft HEAD~1`（保留變更）或 `git reset --hard backup/pre-launch-feat-20260529-172731`

## STEP 3 — 部署鏈修正（✅ 過夜已套用並驗證，早上只需上傳 + 實測）

以下改動**今晚已套用到工作樹並通過語法驗證**（可逆：`git checkout -- <file>` 或 reset 回 backup tag）：
- ✅ `pull-deploy-assets.sh` 全面改 `aws s3 sync`（重啟不重抓；含 agriculture 整夾、bus/rail 變更才解壓）— 已實測 sync skip 行為
- ✅ `upload-deploy-assets.sh` 加 agriculture → `deploy-assets/agriculture/` 子前綴（清單 = `AGRI_FILES`，要排除哪層就移出清單）
- ✅ `nginx.conf` 加 `location /agriculture/` + `/geo` `/h3` `/bus` 的 `@dist` fallback — 已 `nginx -t` 通過
- ✅ `Dockerfile` ENTRYPOINT + `entrypoint.sh`（啟動 pull→nginx，失敗不 crash）
- ✅ `.gitignore` 補排除 `public/fire/*.pmtiles`、png、cache

**早上要做的只有兩件**：

**3a.（D2 範圍）上傳 agriculture 到 S3**（會產生一次性上傳；sync 後重啟不再花）：
```bash
# 全部 10 層：直接跑（AGRI_FILES 已列全 10）
bash scripts/deploy/upload-deploy-assets.sh
# 若要排除零售/批發 GeoJSON：先把那兩行從 upload 腳本的 AGRI_FILES 移除再跑
```
↩︎ 還原：S3 物件留著無害，不影響舊版。

**3b.（GAP-3 唯讀驗證）確認現有 volume 內容**（決定 fallback 是否關鍵，唯讀）：
```bash
npx zeabur@latest service exec <service> -- sh -c 'ls /data/geo | wc -l; ls /data/h3; ls /data/bus'
```
有 station_points/cctv/res7 → 沿用 volume 本就不會壞，fallback 屬保險；缺 → 幸好已加 fallback。

## STEP 4 — 本地 docker build 實測（強烈建議，取代盲推）

`@dist` fallback 與 sync 都建議在本地 docker 跑一次再 push（指令見 STEP 6）。
**實測重點**：`/geo/cctv.geojson`（git 小檔→dist）、`/geo/provincial_road.geojson`（S3 大檔→/data）、`/bus/taipei_bus_routes.json`（S3 大檔）、`/bus/taoyuan_bus_routes.json`（git 小檔）、`/h3/h3_socioeconomic_res7.json`（git）、`/agriculture/ftw_fields_2025.pmtiles`（PMTiles range）全部 200 且不是 index.html。

## STEP 5 — Merge → master（可逆：reset 回 backup tag）

```bash
git checkout master
git merge --no-ff feat/fire-rescue -m "merge: feat/fire-rescue 上線（等時圈/農業/road events/entrypoint）"
npx tsc -b      # master 上再驗一次
```
↩︎ 還原：`git reset --hard backup/pre-launch-master-20260529-172731`

## STEP 6 —（強烈建議）本地 docker build 驗證再 push

```bash
docker build --build-arg VITE_MAPBOX_TOKEN="<token>" -t pulse-local .
# 用 .env 的 S3 key 跑一次，確認 entrypoint pull + nginx 起得來
docker run --rm -p 8088:8080 \
  -e S3_ACCESS_KEY=... -e S3_SECRET_KEY=... -e S3_REGION=ap-southeast-2 -e S3_BUCKET=migu-gis-data-collector \
  pulse-local
# 另開瀏覽器 http://localhost:8088 → All Off → 逐層開，特別測 agriculture / bus 大檔 / fire isochrone
```

## STEP 7 — Push + Zeabur 部署（需你按下）

```bash
git push origin master
```
Zeabur 設定（用 zeabur skill / 後台）：
- Runtime env：`S3_ACCESS_KEY` `S3_SECRET_KEY` `S3_REGION=ap-southeast-2` `S3_BUCKET=migu-gis-data-collector`
  `VITE_SUPABASE_URL` `VITE_SUPABASE_ANON_KEY` `VITE_DATA_SOURCE=supabase`
- Build arg：`VITE_MAPBOX_TOKEN`
- 確認 `/data` volume 掛載 + 容量（納 agriculture 需 >~1GB）
- 觸發部署（master）。entrypoint 會自動 pull → /data。

↩︎ 還原：Zeabur 後台 redeploy 上一個成功版本；或 push 回退 commit。

## STEP 8 — 部署後驗證（逐層 smoke test）

```bash
# 容器內確認 /data 已填
npx zeabur@latest service exec ... -- ls -la /data /data/geo /data/fire /data/agriculture /data/bus
```
- [ ] 開站，All Off → 逐分區開層，對照本地：MOVING / STATION / ROUTE / WATER / FIRE / AGRICULTURE / WASTE …
- [ ] DevTools Network 看有無 404（特別 agriculture/*、bus 大檔、fire pmtiles）
- [ ] 看 Supabase Dashboard：無爆 connection、CPU 平穩
- [ ] 三門檻 checklist（`02`）全綠 → 對外開放

## STEP 9 — 上線後硬化 + 優化（依 D3/D4）

- `get_bus_trails` 改 timeout（gis-platform migration，附 GRANT 不變）
- 收斂 anon 對 reference/spatial/fire/maritime/rail/safety 的 table 直讀（撤授權或縮 exposed schemas），撤後再 smoke test 一輪
- 補 098/100/101/102 migration 檔的 GRANT 段（消文件債）
- 評估 Cloudflare / Supabase rate-limit 擋濫用
- **deploy-assets 搬家：扁平 → 鏡像結構 + manifest 總帳** → 照 `06_DEPLOY_ASSETS_MIGRATION.md`
  （雙軌、可逆、最後才清舊物件且需你拍板；完成後加新大檔 0 改腳本）
