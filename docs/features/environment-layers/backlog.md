# Progress — environment-layers

- [x] 9 層接線（types／manifest／params／catalog／tiers／overlay／legend／popup／click／hosts）與四鐵則。
- [x] tsc、build、tests（含 layer golden 只增新 key）、designSystemGuard。
- [x] 瀏覽器驗收（headless SwiftShader；見 changelog）。
- [ ] commit 時正式 `git add` 5 個 `public/environment/*.geojson`（目前 intent-to-add）。
- [ ] Zeabur collector 啟用後再看一次即時 4 層（目前只有 2026-10-02 一次寫入；輻射 is_stale 會在 30 分鐘後全灰，屬正確行為）。
- [ ] analytics 補 4 個即時 dataset 的 catalog .md 後，manifest upstream 從 `catalog_missing` 改 `verified`。
- [ ] 環境統計 adapter 登錄 `researchDatasets.ts`（比照 social，讓 pulse_describe_layer_statistics 可用）：需逐 recipe 補 descriptor／coverage 欄位，本輪未做。
- [ ] RPI 河段只標 `tidal=yes`（4 段）虛線；`partial_unverified`（28 段）待上游驗證後再決定是否另標。
- [ ] 核安會輻射 ≥0.2 μSv/h 紅框是「高於一般背景」提示，非官方警戒分級；若要對齊核安會分級，需上游提供門檻。
- [ ] cmux 背景 surface 無法跑 Mapbox（visibilityState hidden）；需要 cmux 驗收時要把 surface 切到前景。
