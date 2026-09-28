import { useEffect, useState } from "react";
import { isActivityBusy, type Activity } from "./researchActivity";
import "./researchActivity.css";

/** 光暈熄滅前的等待：步驟之間短暫不忙碌時不熄，避免閃一下（design-system §5.31）。 */
export const GLOW_LINGER_MS = 1500;

/** busy 立刻變 true；變 false 後延遲 lingerMs 才跟著變 false。 */
export function useLingeringFlag(flag: boolean, lingerMs: number): boolean {
  const [shown, setShown] = useState(flag);
  useEffect(() => {
    if (flag) {
      setShown(true);
      return;
    }
    const timer = setTimeout(() => setShown(false), lingerMs);
    return () => clearTimeout(timer);
  }, [flag, lingerMs]);
  return flag || shown;
}

export function ResearchActivity({ activity, history = [] }: { activity: Activity | null; history?: readonly Activity[] }) {
  const busy = isActivityBusy(activity);
  const glowOn = useLingeringFlag(busy, GLOW_LINGER_MS);
  if (!activity) return null;
  return <>
    <div className={`research-activity__viewport-glow${glowOn ? " research-activity__viewport-glow--on" : ""}`} aria-hidden="true" />
    <aside className={`research-activity research-activity--${activity.phase}`} aria-label="Agent 動作紀錄">
      <div className="research-activity__header" role="status" aria-live="polite" aria-atomic="true" aria-busy={busy || undefined}>
        <span className="research-activity__dot" aria-hidden="true" />
        <div>
          <span className="research-activity__eyebrow">最新動作</span>
          <p className="research-activity__title">{activity.title}</p>
          {activity.detail && <p className="research-activity__detail">{activity.detail}</p>}
        </div>
      </div>
      {history.length > 0 && <ol className="research-activity__history" aria-label="先前動作">
        {history.map((entry, index) => <li key={`${index}:${entry.title}`}>
          <p>{entry.title}</p>
          {entry.detail && <small>{entry.detail}</small>}
        </li>)}
      </ol>}
    </aside>
  </>;
}
