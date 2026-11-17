// 星期格子（design-system spec §5.46）：popup 裡「一週哪幾天」的規則，一列七格（週日在前）。
import { FONT_SIZE, RADIUS, SURFACE } from "../../styles/designTokens";
import { useFeatureTheme } from "./featureTheme";

export interface WeekdayGridProps {
  /** 七天的代碼，順序即顯示順序（例：sun…sat） */
  order: readonly string[];
  /** 有的那幾天 */
  on: readonly string[];
  /** 每格的短字（日、一…） */
  short: (day: string) => string;
  /** 讀屏用完整名（週一…）；aria-label 串接有的那幾天 */
  long: (day: string) => string;
  /** 有的格底色（分類資料色，§3.16） */
  color: string;
}

export function WeekdayGrid({ order, on, short, long, color }: WeekdayGridProps) {
  const t = useFeatureTheme();
  const set = new Set(on);
  const label = order.filter((d) => set.has(d)).map(long).join("、");
  return (
    <span role="img" aria-label={label} style={{ display: "inline-flex", gap: 2, flexShrink: 0 }}>
      {order.map((d) => {
        const active = set.has(d);
        return (
          <span
            key={d}
            aria-hidden
            style={{
              width: 16, height: 14, borderRadius: RADIUS.sm, fontSize: FONT_SIZE.xs, lineHeight: "14px", textAlign: "center",
              background: active ? color : t.bgSubtle, color: active ? SURFACE.app : t.textDim,
            }}
          >
            {short(d)}
          </span>
        );
      })}
    </span>
  );
}
