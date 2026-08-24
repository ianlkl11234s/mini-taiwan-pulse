# Global Maritime 全球海事

## 目的

世界 tab 的兩個獨立船舶來源：

- `aisstreamVessels`：AISStream 最近 30 分鐘船位，視 viewport 查詢；適合觀察目前可見的 AIS 回報。
- `gfwVesselPresence`：Global Fishing Watch 每日／延遲 vessel presence，與 AISStream 分開呈現；不是即時 AIS，也不是暗船清單。

兩層預設關閉，避免訪客一進站即發 RPC。透明度、圖例、popup、點選與 loading 均分開；前端只讀 `gis-platform` migration 371 的 public RPC，不直接讀 live table。

## RPC contract

| layer | RPC | freshness | query |
|---|---|---|---|
| AISStream | `public.get_aisstream_vessels_current` | 30 分鐘內（contract cap） | viewport bounds，limit 3000 |
| GFW | `public.get_gfw_vessel_presence_current` | 最多 7 日（daily snapshot） | viewport bounds，limit 3000 |

來源、`provider`、品質欄位與 attribution 保留在 GeoJSON properties；不得把兩源 union 成一個「總船數」。

## 可信度與限制

- AISStream 的點代表可收到的 AIS 訊息，不代表海上所有船；目的地是船方自報。
- GFW 的 presence 是每日／延遲產品；GFW token 尚未取得時 loader 會安全回空資料，不能在 UI 宣稱 live 驗證。
- GFW 可以協助找「AIS 看不到但有其他來源 presence」的候選，但目前 contract 不包含 SAR unmatched、dark vessel 清單或融合判定；本 layer 不做暗船結論。
- 本期先接 current circle。AISStream trail 需要逐船呼叫 trail RPC 與額外的選取／採樣策略，尚未接入，避免把點連成不具資料支持的連續航跡。

## 上游 handoff

- `gis-platform/migrations/371_aisstream_gfw_independent_contract.sql`：已完整套用至 production，是 RPC 與 quality/age 欄位 SSOT。
- AISStream：production 已有 9 個相關 tables、5 個 RPCs、cron 與 retention；feed healthy，S3 cold archive 已以 read-only 證據驗證。
- GFW：production tables/RPC 已存在，但 `GFW_ACCESS_TOKEN` 尚未就緒，token gate 下 collector runs 為 0，尚無可驗證 snapshot。後續快照仍需保持原始 dataset/license/noncommercial caveat。

## 驗收

```bash
npx tsc -b
npm test -- --runInBand
```

上述 production 證據是 backend read-only 驗證，不等於 PostgREST 公開 RPC 回應或 browser 真實點位驗證。AISStream 仍需透過 PostgREST/browser 確認 viewport、popup、attribution 與 freshness；GFW 則須先解除 token gate 並產生 snapshot，才能進行同等驗收。
