# 2026-07-16 分類篩選 select 選了沒反應：rebuildOnParamChange 收的是 layer suffix 不是參數名

**日期**：2026-07-16
**嚴重度**：medium（功能靜默失效，無報錯無 console warning）
**受影響範圍**：culture 3 層（culturalFacilities / culturalMuseums / artsEvents）的分類/狀態篩選；潛在影響未來所有「filter 函式 + 篩選控制項」的新層
**發現方式**：agent-browser 逐層驗收抓到（UI select 狀態會變、地圖 filter 恆為初值）
**耗時**：發現 → 修復約 20 分鐘（根因定位靠讀 overlayManager）

---

## 現象（Symptom）

sidebar 分類 select / 狀態 button 切換後 UI 正常更新，但地圖點位完全不過濾。`map.getStyle().layers.find(l=>l.id==='culture-facilities-circle').filter` 恆為 `["has","facility_type"]`（初值），永遠不會變成單一類型比對。透明度 / 點位大小 slider 卻都正常。

## 復現步驟

1. overlayRegistry entry 寫 `filter: (p) => ...` 函式 + `rebuildOnParamChange: ["xxxTypeIdx", "xxxOpacity"]`（塞**參數名**）
2. UI 切換該 select → overlayParams 更新 → `updateOverlayTheme` 跑
3. filter 不變、無任何錯誤

## 根因（Root Cause）

`src/map/overlayManager.ts` 的 `updateOverlayTheme()`：

- `rebuildOnParamChange` 的語意是「**參數變化時需要整層 remove/addLayer 重建的 layer suffix 清單**」——L132 `if (!config.rebuildOnParamChange.includes(spec.suffix)) continue;`、L149 `for (const suffix of config.rebuildOnParamChange)` 都是拿它跟 `spec.suffix`（如 `"circle"` / `"fill"`）比對。
- filter 沒有像 paint 的 diff API（檔頭 L18-20 註解明講），只能靠 rebuild 路徑把新 filter 烤進去。
- 塞參數名 → 永遠比不到 suffix → rebuild 路徑永遠不觸發 → filter 靜默凍結在初值。
- **為什麼 slider 都正常**：paint 屬性走 L186+ 的 `applyPaintDiff` fallback，不依賴 rebuild 路徑——所以「參數名寫法」在只有 paint 參數的層完全無感（死配置但無害）。

## 修復

3 個 culture entry 改 `rebuildOnParamChange: ["circle"]`（正確前例：buildingsGba 的 `["fill","extrusion"]`，它是 filter 函式首用者）。snapshot 比對（paint+layout+`__filter` 合成 key）會擋掉沒實際變化的重建，不會過度 rebuild。

## 防再犯

1. **寫 filter 函式的層，rebuildOnParamChange 必須列 suffix**；照抄鄰近 entry 前先看它有沒有 filter 函式——全 registry 絕大多數 entry 塞參數名（aquaculture / erHospital / parks…），那些是**無害死配置**，不是可抄的正確範例
2. 只有 paint 參數的層維持現狀即可（paint diff 更輕）；不要全域改寫
3. 驗收清單：有分類篩選的層，browser 驗收必須實際切一次 select 並確認**地圖點數變化**（UI 狀態變了不代表 filter 套用了）
