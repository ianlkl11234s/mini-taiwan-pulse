# 統計比較復原操作

## 範圍與資料位置

本輪從 `a9d522f4` 後的 forensics replay 重建本地程式與資料。使用下列持久位置：

```text
/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/mini-taiwan-pulse/recovery/data/statistics-audit-live-manifest.json
/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/mini-taiwan-pulse/recovery/data/statistics-comparison-cache
/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/mini-taiwan-pulse/recovery/data/statistics-comparison-data
```

`statistics-comparison-data/cdn/assembly-receipt.json` 是本輪組裝結果的 receipt；其 `LOCAL_ONLY` 狀態表示不具發布或 production 意義。`inventory.json`、`layer-audit.md` 是重建盤點，並非原檔 byte 恢復。

## 本地重跑

在 `recovery/statistics-comparability` 下，以顯式路徑執行：

```sh
python3 -m pytest scripts/statistics -q
VITE_STATISTICS_CDN_BASE=http://127.0.0.1:5373 npx vite-node scripts/statistics/verify_comparison_runtime.ts
npm test
npm run build
```

若需本地 preview，使用復原資料根目錄與 cache；不讀取或記錄 `.env` 值：

```sh
python3 scripts/statistics/serve_comparison_preview.py \
  --root ../data/statistics-comparison-data/cdn \
  --cache ../data/statistics-comparison-cache
```

## 證據邊界

- Python 24 passed、runtime 256/256、組裝 receipt 與 648 routing results 是本輪已寫入 `../forensics`／`../data` 的本地證據。
- frontend、build 與 browser 必須讀本輪 `*-recovery.log` 或 [`evidence/recovery/`](./evidence/recovery/)；早期 `evidence/`、舊 `/private/tmp` 和先前驗收記錄不可替代。
- frontend 為 1,390 passed、4 skipped（28.84s）；build 已通過（只有既有 chunk 警告），browser 已完成代表情境且 dev errors 為空。詳見 [驗收](./acceptance.md)。

## Bundle 備份

`evidence/local-preview-bundle.tar.gz` 包含完整增量合併 manifest 與 244 組比較資產；以 `evidence/recovery/bundle-receipt.json` 核對 SHA。原有 534 個 artifact／geometry 位於 sibling cache，bundle 不重複封裝，保留其原始 CDN content hash 參照。

復原分支：`codex/statistics-comparability-recovery-20260917`。本機 `.env.local` 的 Statistics base 指向 `http://127.0.0.1:5373`，未納入 Git；本地 preview 使用 port 3761。
