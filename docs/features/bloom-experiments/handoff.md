# bloom-experiments — handoff

## 跨 repo 契約

**無**。本 feature 純視覺實驗，**不動任何**上游 pipeline / RPC / migration。

## 資料源盤點（都是**現有**的）

| 來源 | 給誰用 |
|---|---|
| `public.rpc_fac_primary`（SSOT L1，`gis-platform` migration 已 apply） | `powerPlantGlow` |
| `public.get_osm_substations` | `substationEhvGlow`（filter class = EHV / EHV_SWITCH） |
| `public.get_osm_power_lines` | `powerLinesGlow` |
| `public/coverage/aviation_airspace.pmtiles` | `aviationRestrictedGlow` |

## 上游有變動時要動嗎

- **L1 / OsmSubstation / OsmPowerLine schema 改欄位** → 需要跟：改 `plantsToGlow` / `toGlow` 對映
- **aviation_airspace layer 欄位改** → 需要跟：改 `COLOR_EXPR` 的 `["get", "layer"]` match 表
- **加新燃料 / 新變電所 class** → `fuelColorOf` / `SUBSTATION_CLASS_COLORS` 補行

## 對外契約

- 用戶側：4 個新 layer toggle key（`powerPlantGlow` / `substationEhvGlow` / `powerLinesGlow` / `aviationRestrictedGlow`），可獨立開關與其他能源 layer 並存
- Upstream registry：全部標 `status: pulse_only`（純前端視覺實驗，無跨 repo 契約）

## 若之後 ship 到正式視覺（BE-8）需做

1. 決定要**取代**哪個原生 layer（可能是「發電廠 主要 Primary」+「高壓輸電線 Power Lines」）
2. 補 legend + featureInfo panel（現在純視覺無 popup）
3. 效能實測（zoom 5 全台 209 廠 + 2305 線 fps 要達 55+）
4. **若換掉正式 layer**，才需要通知 `taipei-gis-analytics/docs/handoff/energy.md`（現階段不用）
