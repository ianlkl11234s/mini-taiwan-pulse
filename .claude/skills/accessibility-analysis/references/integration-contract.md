# PMTiles 與 layer 整合契約

先以目前的 `src/data/layerManifest.ts`、`src/data/layerParamsSpec.ts`、`docs/development-rules.md` 和相關測試判定本層需要的註冊與 UI。這些檔案是現況契約；不要複製舊有「固定 N 處」接線清單。

## 交付前對齊

1. **資料**：來源、選取規則、method、as-of、units、coverage/no-data states 與 geometry 已可回溯。
2. **Tile**：實際檔案可讀、`sourceLayer` 正確、paint／popup 所需 property 經 tile 讀回存在；PMTiles 不保證保留未指定的原始屬性。
3. **Manifest/spec**：layer 的資料類型、legend、popup、params 與例外原因由目前 manifest/spec 表達，並通過其對應測試。
4. **Asset/runtime**：在需要發佈的環境，驗證 path、HTTP range／tile readback 和 source registration；本地產物或 unit test 不能替代這些證據。
5. **Browser**：只有 UI 接線後才驗證受影響互動、legend、popup、空資料與窄版。把 browser、runtime、資產與 deployment 結果分開記錄。

若缺 property、tile、source registration 或 asset，回報其狀態與缺口；不要用空畫面、0、預設樣式或 synthetic geometry 讓它看似可用。
