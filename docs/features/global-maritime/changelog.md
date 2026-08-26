# Changelog

## 2026-08-26 — GFW full-fidelity v3 shadow (not deployed)

- 完成 v3 full-fidelity collector/frontend contract、strict count/detail/frame validation、PMTiles
  grid cross-fade、truthful short frame trail、lazy full-member popup、date notices、legend/semantic caveats。
- migration 376 與 audit migration 377 已套用 production。
- 已生成 2026-08-15..21 UTC shadow assets：1,426,359 points、226,830 features、
  64,051 vessels、168,936 segments、57,894 singleton nodes、1,105,448 grid cells、SAR 0，約 995 MB。
- production S3/Supabase full audit 已完成：schema3/full_fidelity shadow root release
  2026-08-21 root bytes/hash 一致；run e00 succeeded/is_current schema3 shadow，3,311 assets/counters
  一致；S3 HEAD 3,311/3,311，missing/head_errors/bytes/SHA mismatches 全 0、timed_out=false。
- push、deploy 與 browser 驗收仍未完成。Canonical S3 v2
  release 2026-08-20 未切換，仍是 rollback path。
- 不將 grid footprint、hourly center、或 segment 內插位置描述為原始 AIS 精確位置、
  官方格界或實際航道。

## 2026-08-24

- 新增 AISStream 船舶 layer：viewport bounds + 30 分鐘 current RPC、cyan circle、popup/legend。
- 新增 GFW vessel presence layer：每日／延遲 current RPC、amber circle、獨立 popup/legend。
- 新增 `全球海事 Global Maritime` 世界 tab 主題；兩層預設關閉。
- 明確記錄 GFW token 尚未取得，且目前不宣稱暗船或 SAR unmatched。

## 2026-08-25

- 新增 local-only `gfwHourlyGrid` 主站圖層：跟隨全域時間軸，以 UTC 小時載入固定 GFW HIGH 格網。
- 圓大小與 count label 表示同格船數；popup 顯示該格完整船舶清單，明示格網中心不是原始 AIS 精確座標。
- 完整 7 日 exporter 輸出 168 hour partitions；artifact gitignored 並由 production build 移除。
- GFW SAR unmatched live schema probe 已通過；新增獨立 `gfwDarkVessels` toggle，依 exact UTC hour 載入，明示 HIGH grid center 與「非違法／非確認關 AIS」，不與 presence 混合。
- 新增 local-only `gfwHourlyTracks` 主站圖層：schema v2 `observed_times` 守門、全域時間軸、0.5/1/2/3h 短拖尾、Ships 六類分色、line/endpoint popup、最新完整 UTC 日通知與近似語意圖例。
- GFW 航跡前端改讀 release manifest 與單 UTC 日 partition；支援 daily cache、失敗重試、跨日 stale-response 防護與超出範圍清空，移除七日單檔 runtime 依賴。
- 航跡維持純 Mapbox GeoJSON POC，不跨 exporter segment、不與 AISStream current 跨延遲 gap 連線；PMTiles 延至效能階段。
- 航跡改為 100ms timeline tick 更新，同 segment 相鄰 hourly observations 以時間比例線性內插船頭與拖尾邊界；不使用 Catmull-Rom、不跨 gap/speed split、不在 segment 外外插。
- runtime popup properties 新增 `selected_time` 與 `interpolated`，內插位置仍明示為動畫估計，不當作 GFW 觀測。
- Production 改用同域 `/global-maritime/gfw-hourly/manifest.json` unified v2；env 僅作可選 CDN override。Tracks 每次只載一 UTC day，grid/dark 只載 exact UTC hour。
- 部署管線補 GFW prefix S3 pull 與 6h refresh，release assets 先落地再原子切 root manifest；nginx root 60s/SWR300，release 7d immutable。
