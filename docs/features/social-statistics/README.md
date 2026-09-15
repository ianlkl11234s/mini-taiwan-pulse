# 教育、醫療長照、住宅 Statistics 接線與正式發布

本輪範圍為教育11層 → 醫療長照16層 → 住宅18層，共45 enabled recipes、416 exact selectors。28延伸候選不在範圍。

## 工作區與本地重現

- Worktree：`/private/tmp/pulse-social-statistics-frontend-20260915`
- Branch：`codex/social-statistics-frontend-20260915`
- Base：`617f1dcb117e72738dde85f0cf0ab19281661432`
- 原 checkout 的平行 dirty work 未帶入或修改。node_modules 與既有 ignored env 以 symlink 重用；不複製或列出 secret。

資料 server：

```sh
python3 -m http.server 3757 --bind 127.0.0.1 --directory /private/tmp/statistics-social-ready-20260914/output/social-statistics/cdn/v1
```

前端：

```sh
VITE_SOCIAL_STATISTICS_PREVIEW=true npm run dev -- --host 127.0.0.1 --port 3758
```

只對45配方中的精確dataset啟用同源 `/__social-statistics-cdn` DEV proxy；既有 Statistics 繼續使用原 `VITE_STATISTICS_CDN_BASE` 或預設CDN。可用 `SOCIAL_STATISTICS_PREVIEW_PORT` 調整資料server port。本地路由由 `import.meta.env.DEV` 擋住，不進production runtime。不得把增量current覆蓋全量snapshot。

## 契約與檢查

精確配方保存在 `src/data/socialStatisticsRecipes.json`，內容來自交付SSOT。沿用既有store/loader/geometry cache/map/legend/popup，不另建資料API。

```sh
SOCIAL_STATISTICS_DATA_ROOT=/private/tmp/statistics-social-ready-20260914 npx vitest run src/data/__tests__/socialStatisticsDelivery.test.ts
npm test
npm run build
```

保留數值0、null與原始缺值符號、資料期別、單位、固定legend、STALE與PARTIAL。醫院未列鄉鎮不是0；照服為登錄數，非去重人數；住宅109年普查「無人經常居住」不能改稱空屋率。1140318參考邊界不等於歷史原生界線。

驗收結果與 browser 證據見 [handoff](./handoff.md)。已依後續授權完成正式發布，詳見 [發布驗收](./production-release.md)。
