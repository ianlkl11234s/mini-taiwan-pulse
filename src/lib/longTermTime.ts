// 長期時間條的全站共用常數（規範：docs/features/longterm-time/STANDARD.md §1–§2）。
// 各圖層不自訂這些值；欄位形狀在 src/data/layerLongTerm.ts。

/** 事件點／大量事件：選取期間達這麼多個月（`>=`）就自動改成熱區（STANDARD.md §1、§4 第 3 題）。 */
export const LONG_TERM_HEATMAP_MIN_MONTHS = 6;

/** 播放速度選項（逐期跳、不漸變；播到最後一期停住）。 */
export const LONG_TERM_PLAY_SPEEDS = [0.5, 1, 2, 4] as const;
export type LongTermPlaySpeed = (typeof LONG_TERM_PLAY_SPEEDS)[number];

/** 預設速度。 */
export const LONG_TERM_DEFAULT_SPEED: LongTermPlaySpeed = 1;

/** 1× 時每一期停留的毫秒數；實際間隔＝本值 ÷ 速度。 */
export const LONG_TERM_MS_PER_PERIOD_AT_1X = 1000;
