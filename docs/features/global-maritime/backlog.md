# Backlog

- [ ] 取得 `GFW_ACCESS_TOKEN` 後，以每日 job 實際產出 snapshot，驗證 license/noncommercial 權限與 retry。
- [ ] 補 GFW `gaps`、`SAR unmatched` 等獨立資料層；未完成前不能把 GFW presence 解讀成暗船。
- [ ] 針對 AISStream 選取的 MMSI 接 `get_aisstream_vessel_trail`，明確標示取樣間隔與缺訊，不做平滑插值。
- [ ] 在 production RPC / browser 上分別驗證兩層的 viewport bounds、3000 筆上限、空結果與 loading timeout。
