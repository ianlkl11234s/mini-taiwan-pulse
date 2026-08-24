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

- `gis-platform/migrations/371_aisstream_gfw_independent_contract.sql`：RPC 與 quality/age 欄位 SSOT。
- `data-collectors`：AISStream API key、S3 cold archive 與 collector 狀態由該 repo 管理；S3 不設定 expiration。
- GFW：待 `GFW_ACCESS_TOKEN` 申請完成後，再由 data-collectors 建立每日獨立快照，且保持原始 dataset/license/noncommercial caveat。

## 驗收

```bash
npx tsc -b
npm test -- --runInBand
```

型別驗證不等於 production RPC/browser 驗證；需在 token 與 migration 已部署後，分別開啟兩層確認 viewport、popup、attribution 與 freshness 文案。
