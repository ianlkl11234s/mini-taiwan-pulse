interface LoadingStep {
  label: string;
  done: boolean;
  count?: number;
}

interface LoadingScreenProps {
  steps: LoadingStep[];
}

export function LoadingScreen({ steps }: LoadingScreenProps) {
  const doneCount = steps.filter((s) => s.done).length;
  const firstPending = steps.findIndex((s) => !s.done);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#0a0a14",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        fontFamily: "monospace",
        color: "#fff",
      }}
    >
      <div style={{ fontSize: 22, letterSpacing: 4, fontWeight: 700 }}>
        Mini Taiwan Pulse
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
        {steps.map((step, i) => {
          const isDone = step.done;
          const isActive = i === firstPending;
          return (
            <div
              key={step.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 13,
                color: isDone
                  ? "rgba(100,170,255,0.8)"
                  : isActive
                    ? "rgba(255,255,255,0.7)"
                    : "rgba(255,255,255,0.2)",
              }}
            >
              <span style={{ width: 18, textAlign: "center" }}>
                {isDone ? "\u2713" : isActive ? (
                  <span className="loading-spin">{"\u27F3"}</span>
                ) : "\u25CB"}
              </span>
              <span style={{ minWidth: 160 }}>{step.label}</span>
              <span style={{ fontSize: 11, opacity: 0.7 }}>
                {isDone && step.count != null
                  ? step.count.toLocaleString()
                  : isActive
                    ? "loading..."
                    : ""}
              </span>
            </div>
          );
        })}
      </div>

      {/* progress bar */}
      <div
        style={{
          width: 200,
          height: 2,
          background: "rgba(255,255,255,0.1)",
          borderRadius: 1,
          overflow: "hidden",
          marginTop: 4,
        }}
      >
        <div
          style={{
            width: `${(doneCount / steps.length) * 100}%`,
            height: "100%",
            background: "rgba(100,170,255,0.8)",
            borderRadius: 1,
            transition: "width 0.4s ease",
          }}
        />
      </div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 1 }}>
        {doneCount}/{steps.length}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        .loading-spin { display: inline-block; animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}
