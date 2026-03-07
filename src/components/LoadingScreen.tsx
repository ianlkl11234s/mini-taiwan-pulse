import { useEffect, useRef, useState } from "react";

interface LoadingStep {
  label: string;
  done: boolean;
  count?: number;
}

interface LoadingScreenProps {
  steps: LoadingStep[];
}

/* ── fake data entries ── */
type Cat = "flight" | "ship" | "rail" | "geo" | "weather" | "facility";

const CAT_COLOR: Record<Cat, string> = {
  flight: "#64aaff",
  ship: "#4ecdc4",
  rail: "#f4a261",
  geo: "#b8a9c9",
  weather: "#7bc47f",
  facility: "#e8c547",
};

const FAKE_ENTRIES: { cat: Cat; text: string }[] = [
  { cat: "flight", text: "CI-812 TPE → NRT alt:35,000ft" },
  { cat: "flight", text: "BR-261 TSA → HUN alt:12,500ft" },
  { cat: "flight", text: "RCTP 桃園國際機場 (25.077, 121.232)" },
  { cat: "flight", text: "AE-232 RCSS → RCFN alt:18,000ft" },
  { cat: "flight", text: "JX-801 KHH → HKG alt:32,000ft" },
  { cat: "flight", text: "RCKH 高雄國際機場 (22.577, 120.350)" },
  { cat: "flight", text: "IT-238 TPE → KIX alt:37,000ft" },
  { cat: "flight", text: "RCMQ 臺中清泉崗機場 (24.264, 120.621)" },
  { cat: "ship", text: "MMSI:416005432 EVER GOLDEN 高雄港" },
  { cat: "ship", text: "MMSI:477328900 貨輪 基隆外海 12.3kn" },
  { cat: "ship", text: "MMSI:416001234 漁船 澎湖水道 6.2kn" },
  { cat: "ship", text: "MMSI:352844000 OOCL TAIPEI 臺中港" },
  { cat: "ship", text: "MMSI:416008877 油輪 高雄錨區 0.1kn" },
  { cat: "ship", text: "MMSI:477995500 散裝船 花蓮外海 11.8kn" },
  { cat: "ship", text: "MMSI:416003210 拖船 蘇澳港 3.5kn" },
  { cat: "ship", text: "MMSI:636092783 貨櫃輪 臺北港 8.7kn" },
  { cat: "rail", text: "TRA 1042次 自強號 臺北→花蓮" },
  { cat: "rail", text: "THSR 0613 左營→南港 300km/h" },
  { cat: "rail", text: "KRTC 紅線 R8三多商圈→R24南岡山" },
  { cat: "rail", text: "TRA 272次 普悠瑪 花蓮→樹林" },
  { cat: "rail", text: "THSR 0832 南港→左營 285km/h" },
  { cat: "rail", text: "TRTC 板南線 BL23→BL01 頂埔" },
  { cat: "rail", text: "TRA 4192次 區間車 基隆→七堵" },
  { cat: "rail", text: "THSR 1520 臺中→南港 295km/h" },
  { cat: "rail", text: "KRTC 橘線 O1西子灣→OT1大寮" },
  { cat: "geo", text: "H3 res8 882d958a7fffff pop:3,847" },
  { cat: "geo", text: "活動斷層 車籠埔斷層 長度:92km" },
  { cat: "geo", text: "H3 res8 882d95c1bfffff pop:12,403" },
  { cat: "geo", text: "活動斷層 梅山斷層 長度:24km" },
  { cat: "geo", text: "H3 res8 882d9426ffffff pop:8,291" },
  { cat: "geo", text: "地質敏感區 山腳斷層 北段 38km" },
  { cat: "geo", text: "H3 res8 882d94b0ffffff pop:1,156" },
  { cat: "geo", text: "活動斷層 旗山斷層 長度:32km" },
  { cat: "weather", text: "氣象站 467490 臺北 25.0°C 68%RH" },
  { cat: "weather", text: "溫度場 grid 120.5°E 24.0°N 22.7°C" },
  { cat: "weather", text: "氣象站 467410 臺中 27.3°C 55%RH" },
  { cat: "weather", text: "溫度場 grid 121.0°E 25.0°N 19.8°C" },
  { cat: "weather", text: "氣象站 467440 高雄 29.1°C 72%RH" },
  { cat: "weather", text: "氣象站 467660 成功 23.4°C 81%RH" },
  { cat: "weather", text: "溫度場 grid 120.2°E 23.5°N 24.1°C" },
  { cat: "weather", text: "氣象站 467080 宜蘭 21.6°C 85%RH" },
  { cat: "facility", text: "全家 台北信義店 (25.033, 121.565)" },
  { cat: "facility", text: "臺北市立建國高中 (25.035, 121.528)" },
  { cat: "facility", text: "7-ELEVEN 中山門市 (25.052, 121.520)" },
  { cat: "facility", text: "國立臺灣大學 (25.017, 121.540)" },
  { cat: "facility", text: "高雄巨蛋 (22.669, 120.302)" },
  { cat: "facility", text: "臺中國家歌劇院 (24.162, 120.640)" },
  { cat: "facility", text: "全聯 板橋文化店 (25.014, 121.459)" },
  { cat: "facility", text: "萊爾富 士林天母店 (25.111, 121.524)" },
  { cat: "facility", text: "台北101 (25.033, 121.564)" },
  { cat: "facility", text: "中正紀念堂 (25.035, 121.522)" },
];

/* ── shuffle helper ── */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

/* ── visible line count in terminal ── */
const VISIBLE_LINES = 8;

export function LoadingScreen({ steps }: LoadingScreenProps) {
  const allDone = steps.every((s) => s.done);
  const startRef = useRef(Date.now());
  const [progress, setProgress] = useState(0);
  const [lines, setLines] = useState<{ id: number; cat: Cat; text: string }[]>([]);
  const lineIdRef = useRef(0);
  const shuffledRef = useRef(shuffle(FAKE_ENTRIES));
  const idxRef = useRef(0);
  const [doneBounce, setDoneBounce] = useState<Set<string>>(new Set());
  const prevDoneRef = useRef<Set<string>>(new Set());
  const [fading, setFading] = useState(false);

  /* detect newly-done steps for bounce */
  useEffect(() => {
    const nowDone = new Set(steps.filter((s) => s.done).map((s) => s.label));
    const newOnes = [...nowDone].filter((l) => !prevDoneRef.current.has(l));
    if (newOnes.length > 0) {
      setDoneBounce((prev) => {
        const next = new Set(prev);
        newOnes.forEach((l) => next.add(l));
        return next;
      });
      /* remove bounce class after animation */
      setTimeout(() => {
        setDoneBounce((prev) => {
          const next = new Set(prev);
          newOnes.forEach((l) => next.delete(l));
          return next;
        });
      }, 500);
    }
    prevDoneRef.current = nowDone;
  }, [steps]);

  /* allDone → jump to 100% then fade out */
  useEffect(() => {
    if (allDone) {
      setProgress(1);
      // 短暫停留後 fade out
      const t = setTimeout(() => setFading(true), 200);
      return () => clearTimeout(t);
    }
  }, [allDone]);

  /* fake progress bar animation */
  useEffect(() => {
    if (allDone) return;
    const id = setInterval(() => {
      const elapsed = (Date.now() - startRef.current) / 55000;
      const fake = Math.min(0.95, 1 - Math.pow(1 - Math.min(elapsed, 1), 3));
      setProgress(fake);
    }, 100);
    return () => clearInterval(id);
  }, [allDone]);

  /* ticker: add a new line every 80-120ms */
  useEffect(() => {
    if (allDone) return;
    const tick = () => {
      const entry = shuffledRef.current[idxRef.current % shuffledRef.current.length]!;
      idxRef.current++;
      /* reshuffle when we've gone through all */
      if (idxRef.current % shuffledRef.current.length === 0) {
        shuffledRef.current = shuffle(FAKE_ENTRIES);
      }
      const id = lineIdRef.current++;
      setLines((prev) => [...prev.slice(-(VISIBLE_LINES - 1)), { id, cat: entry.cat, text: entry.text }]);
    };
    const schedule = () => {
      const delay = 80 + Math.random() * 40;
      return setTimeout(() => {
        tick();
        timerRef = schedule();
      }, delay);
    };
    tick(); // first line immediately
    let timerRef = schedule();
    return () => clearTimeout(timerRef);
  }, [allDone]);

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
        gap: 16,
        fontFamily: "monospace",
        color: "#fff",
        zIndex: 9999,
        opacity: fading ? 0 : 1,
        transition: "opacity 0.4s ease",
      }}
    >
      {/* title */}
      <div style={{ fontSize: 22, letterSpacing: 4, fontWeight: 700, marginBottom: 4 }}>
        Mini Taiwan Pulse
      </div>

      {/* step indicators */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {steps.map((step, i) => {
          const isDone = step.done;
          const isActive = i === firstPending;
          const bouncing = doneBounce.has(step.label);
          return (
            <div
              key={step.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 13,
                color: isDone
                  ? CAT_COLOR.flight
                  : isActive
                    ? "rgba(255,255,255,0.7)"
                    : "rgba(255,255,255,0.2)",
                transition: "color 0.3s",
              }}
            >
              <span
                style={{
                  width: 18,
                  textAlign: "center",
                  display: "inline-block",
                  transform: bouncing ? "scale(1.4)" : "scale(1)",
                  transition: "transform 0.3s cubic-bezier(0.34,1.56,0.64,1)",
                }}
              >
                {isDone ? "✓" : isActive ? (
                  <span className="loading-spin">⟳</span>
                ) : "○"}
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
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, marginTop: 4 }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: 0.5 }}>
          {allDone ? "載入完成" : "載入中... 約需 1 分鐘"}
        </div>
        <div
          style={{
            width: 280,
            height: 4,
            background: "rgba(255,255,255,0.08)",
            borderRadius: 2,
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              width: `${progress * 100}%`,
              height: "100%",
              background: "linear-gradient(90deg, #64aaff, #4ecdc4)",
              borderRadius: 2,
              transition: allDone ? "width 0.4s ease" : "width 0.15s linear",
              boxShadow: "0 0 12px rgba(100,170,255,0.5), 0 0 4px rgba(100,170,255,0.8)",
            }}
          />
        </div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>
          {Math.round(progress * 100)}%
        </div>
      </div>

      {/* data stream terminal */}
      <div
        style={{
          width: 380,
          height: VISIBLE_LINES * 20 + 16,
          marginTop: 8,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 6,
          padding: "8px 12px",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
        }}
      >
        {lines.map((line, i) => {
          const isLast = i === lines.length - 1;
          return (
            <div
              key={line.id}
              style={{
                fontSize: 11,
                lineHeight: "20px",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                color: CAT_COLOR[line.cat],
                opacity: isLast ? 1 : 0.3 + (i / lines.length) * 0.5,
                transition: "opacity 0.2s",
              }}
            >
              <span style={{ opacity: 0.5 }}>✓ </span>
              {line.text}
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        .loading-spin { display: inline-block; animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}
