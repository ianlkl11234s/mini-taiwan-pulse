import type { Activity } from "./researchActivity";
import "./researchActivity.css";

export function ResearchActivity({ activity, history = [] }: { activity: Activity | null; history?: readonly Activity[] }) {
  if (!activity) return null;
  const busy = activity.phase === "working" || activity.phase === "presenting";
  return <aside className={`research-activity research-activity--${activity.phase}`} aria-label="Agent 動作紀錄">
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
  </aside>;
}
