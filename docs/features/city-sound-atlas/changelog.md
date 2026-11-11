# changelog — City Sound Atlas

格式：日期｜改動｜模型版本｜資料版本。根目錄 `CHANGELOG.md` 的 Unreleased 條目由主 agent 統一加。

## 2026-11-11（未發布，分支 `feat/city-sound-atlas-mvp`）

- **引擎與 adapter（MVP-A）**：`src/sound/` 純函式引擎、四個 adapter（飛機、雨、雷、垃圾車）、`soundProfiles.ts` 參數集中、測試 T01/T02/T04–T09/T12/T18。模型 `sound-atlas-mvp-a-0.1.0`。
- **修正**：今天未到的時段不算 0（coverage 截斷）、`unknownReason` 欄位、垃圾車星期白名單、落雷跨源連結改時間視窗比對。
- **場景快照**：`scripts/preprocess/build-sound-scenes.py` 產出 `public/sound-atlas/scenes/{taipei-1109,taichung-heping-1108,taipei-typhoon-1024}.json`（契約 `pulse-sound-scene-v1`，另含 `aviation.health`、`rain.health`、`event_id_str`）；lock 登記 3 筆（未上傳 S3）；Worker `DATA_THEN_DIST` 加 `sound-atlas`。
  - 資料版本：航跡 11/8、11/9 取自 `get_flight_trails`，10/24 取自 S3 `trails/flights/2026-10-24.json.gz`；落雷 11/8、11/9 取自 `get_lightning_day`，10/24 取自 S3 archive（10-24＋10-25 兩包）；雨量三天皆取自 `get_rain_gauge_day`；產生時間 2026-11-11。
- **驗算**：`scripts/preprocess/verify-sound-scenes.ts`（vite-node）用引擎實跑三場景，結果寫在 DATA_QUALITY_REPORT §5。
- **文件**：README、SOURCE_REUSE_AUDIT、SOURCE_EXPANSION_AUDIT、MODEL_DECISIONS、DATA_QUALITY_REPORT、handoff、本檔。
