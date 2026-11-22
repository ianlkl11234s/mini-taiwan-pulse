// 圖層名稱旁的長期標記（STANDARD.md §2 第 2 條；站主選預覽 a 款時鐘）：
// manifest 有 `longTerm` 的圖層才顯示；未開啟 muted、開啟 accent。
// 滑鼠移上去（手機長按）看「可看長期變化／111–113 年（2022–2024）・每月」。即時圖層不加標記。
import { useRef } from "react";
import { Clock } from "lucide-react";
import { COLORS, LIGHT } from "../../styles/designTokens";
import { useRailTheme } from "../sidebar/railTheme";
import { useChartTooltip } from "../ChartHoverTooltip";
import { useLocale } from "../../state/localeStore";
import { longTermSpecOf } from "../../data/longTermLayers";
import { badgeTipText } from "./longTermText";

const SIZE = 12;
const LONG_PRESS_MS = 450;
const TOUCH_TIP_MS = 2500;

export function LongTermBadge({ layerKey, active = false }: { layerKey?: string; active?: boolean }) {
  const spec = layerKey ? longTermSpecOf(layerKey) : null;
  if (!layerKey || !spec) return null;
  return <Badge layerKey={layerKey} active={active} />;
}

function Badge({ layerKey, active }: { layerKey: string; active: boolean }) {
  const { COLOR_SCHEME } = useRailTheme();
  const { t } = useLocale();
  const tip = useChartTooltip();
  const pressRef = useRef(0);
  const spec = longTermSpecOf(layerKey);
  if (!spec) return null;
  const light = COLOR_SCHEME === "light";
  const color = active ? (light ? LIGHT.accent : COLORS.accent) : (light ? LIGHT.textMuted : COLORS.textMuted);
  const title = t("longTerm.badge.title");
  const text = badgeTipText(layerKey, spec, t);
  const content = { title, rows: [{ value: text }] };
  return (
    <span role="img" aria-label={`${title} ${text}`} data-longterm-badge={layerKey}
      {...tip.bind(content)}
      onTouchStart={(e) => {
        const touch = e.touches[0];
        if (!touch) return;
        const { clientX, clientY } = touch;
        window.clearTimeout(pressRef.current);
        pressRef.current = window.setTimeout(() => {
          tip.show(clientX, clientY, content);
          pressRef.current = window.setTimeout(() => tip.hide(), TOUCH_TIP_MS);
        }, LONG_PRESS_MS);
      }}
      onTouchMove={() => window.clearTimeout(pressRef.current)}
      style={{ flexShrink: 0, alignSelf: "center", display: "inline-flex", alignItems: "center", marginLeft: 2, color }}>
      <Clock size={SIZE} strokeWidth={2} aria-hidden />
      {tip.node}
    </span>
  );
}
