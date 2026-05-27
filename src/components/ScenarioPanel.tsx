import type { Scenario, Inject } from "../types/scenario";

interface Props {
  scenario: Scenario;
  currentTime: number; // unix
  isDarkTheme?: boolean;
}

const TYPE_LABEL: Record<Inject["type"], string> = {
  fire: "火場",
  dispatch: "出動",
  banner: "播報",
  camera: "鏡頭",
};

const TYPE_COLOR: Record<Inject["type"], string> = {
  fire: "#ff4d00",
  dispatch: "#ff3b30",
  banner: "#ffb000",
  camera: "#64aaff",
};

function fmtRel(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `+${m}:${String(s).padStart(2, "0")}`;
}

export function ScenarioPanel({ scenario, currentTime, isDarkTheme = true }: Props) {
  const dark = isDarkTheme;
  const elapsed = currentTime - scenario.startUnix;
  const sorted = [...scenario.injects].sort((a, b) => a.at - b.at);
  const lastTriggeredAt = sorted.reduce(
    (acc, i) => (i.at <= elapsed ? i.at : acc),
    -Infinity,
  );

  return (
    <div
      style={{
        width: 300,
        maxHeight: "70vh",
        overflowY: "auto",
        background: dark ? "rgba(10,12,20,0.82)" : "rgba(255,255,255,0.9)",
        backdropFilter: "blur(10px)",
        border: `1px solid ${dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)"}`,
        borderRadius: 10,
        padding: "14px 16px",
        fontFamily: "monospace",
        pointerEvents: "auto",
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 700, color: dark ? "#fff" : "#222", letterSpacing: 1 }}>
        {scenario.name}
      </div>
      <div style={{ fontSize: 11, color: dark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.5)", marginTop: 4, lineHeight: 1.5 }}>
        {scenario.description}
      </div>

      <div style={{ height: 1, background: dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)", margin: "12px 0" }} />

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {sorted.map((inj) => {
          const triggered = inj.at <= elapsed;
          const isCurrent = inj.at === lastTriggeredAt;
          return (
            <div
              key={inj.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "5px 8px",
                borderRadius: 6,
                background: isCurrent
                  ? (dark ? "rgba(255,176,0,0.16)" : "rgba(255,176,0,0.2)")
                  : "transparent",
                opacity: triggered ? 1 : 0.45,
                transition: "opacity 0.3s, background 0.3s",
              }}
            >
              <span style={{ fontSize: 11, color: dark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.45)", minWidth: 44 }}>
                {fmtRel(inj.at)}
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: TYPE_COLOR[inj.type],
                  border: `1px solid ${TYPE_COLOR[inj.type]}66`,
                  borderRadius: 4,
                  padding: "1px 6px",
                  minWidth: 36,
                  textAlign: "center",
                }}
              >
                {TYPE_LABEL[inj.type]}
              </span>
              <span style={{ fontSize: 12, color: dark ? "rgba(255,255,255,0.85)" : "#333", flex: 1 }}>
                {inj.label ?? (inj.type === "banner" ? inj.text : inj.id)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
