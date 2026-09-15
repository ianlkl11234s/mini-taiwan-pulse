import type { Activity } from "./researchActivity";
import "./researchActivity.css";

export interface ResearchActivityPlace {
  id: string;
  label: string;
  detail?: string;
  onSelect: () => void;
}

export interface ResearchActivityProps {
  activity: Activity | null;
  following: boolean;
  onFollowingChange: (following: boolean) => void;
  places?: readonly ResearchActivityPlace[];
}

export function ResearchActivity({ activity, following, onFollowingChange, places = [] }: ResearchActivityProps) {
  if (!activity) return null;
  const busy = activity.phase === "working" || activity.phase === "presenting";
  const completed = activity.phase === "complete" || activity.phase === "ready";
  return <aside className={`research-activity research-activity--${activity.phase}`} aria-live="polite" aria-busy={busy || undefined}>
    <div className="research-activity__header">
      <span className="research-activity__dot" aria-hidden="true" />
      <div>
        <p className="research-activity__title">{activity.title}</p>
        {activity.detail ? <p className="research-activity__detail">{activity.detail}</p> : null}
      </div>
    </div>
    <label className="research-activity__follow">
      <input type="checkbox" checked={following} onChange={event => onFollowingChange(event.target.checked)} />
      跟隨 Agent
    </label>
    {completed && places.length ? <div className="research-activity__places" aria-label="可查看的地方">
      {places.map(place => <button type="button" className="research-activity__place" key={place.id} onClick={place.onSelect}>
        <span>{place.label}</span>{place.detail ? <small>{place.detail}</small> : null}
      </button>)}
    </div> : null}
  </aside>;
}
