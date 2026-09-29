/**
 * §11 開站畫面：真 LoadingScreen。
 *
 * LoadingScreen 是 position:fixed，版面又用 vh／vw（bootGeometry）。所以把它放進一個
 * 「剛好 100vw × 100vh」的內框（transform 讓 fixed 以內框為準），再整體縮放塞進 16:10 的外框（cover、置中）。
 * 這樣 vh／vw 算出來的位置與實際開站畫面一致。
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { COLORS, FONT_SIZE, LIGHT } from "../../styles/designTokens";
import { LoadingScreen } from "../../components/LoadingScreen";
import { BOOT_LAYOUT, BOOT_TIMING, type BootPhase } from "../../components/boot/bootSequence";
import { Kv, Pair, Section, Spec, Sub, objRows, type SectionDef } from "../kit";

/** 外框寬度跟著欄寬，比例固定 16:10 */
const FRAME_RATIO = 16 / 10;

function BootFrame({ isDark, phase, replay }: { isDark: boolean; phase: Exclude<BootPhase, "gone">; replay: number }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ fw: 480, vw: window.innerWidth, vh: window.innerHeight });
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const measure = () => setSize({ fw: el.clientWidth, vw: window.innerWidth, vh: window.innerHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); };
  }, []);
  const fh = size.fw / FRAME_RATIO;
  const k = Math.max(size.fw / size.vw, fh / size.vh);
  return (
    <div ref={frameRef} className="ds-frame" style={{ width: "100%", aspectRatio: "16 / 10" }}>
      <div
        style={{
          position: "absolute", left: "50%", top: "50%", width: "100vw", height: "100vh",
          transform: `translate(-50%, -50%) scale(${k})`, transformOrigin: "50% 50%", contain: "layout paint",
        }}
      >
        <LoadingScreen key={replay} phase={phase} isDarkTheme={isDark} />
      </div>
    </div>
  );
}

/** 重播：loading 停 2.4 秒再切 done（實際 App 由地圖就緒決定何時切）；開頁時也跑一次。 */
function useReplayPhase(replay: number): Exclude<BootPhase, "gone"> {
  const [phase, setPhase] = useState<Exclude<BootPhase, "gone">>("loading");
  useLayoutEffect(() => {
    setPhase("loading");
    const timer = window.setTimeout(() => setPhase("done"), 2400);
    return () => window.clearTimeout(timer);
  }, [replay]);
  return phase;
}

export const BOOT_SECTION: SectionDef = { id: "boot", no: "11", title: "開站畫面" };
export function BootSection() {
  const [replay, setReplay] = useState(0);
  const livePhase = useReplayPhase(replay);
  return (
    <Section def={BOOT_SECTION}>
      <Spec section="§5.33" impl={["src/components/LoadingScreen.tsx", "src/components/boot/{bootSequence.ts,bootScreen.css,taiwanOutline.ts}"]} />
      <p className="ds-note">真 <code>LoadingScreen</code>，以目前視窗大小（<span className="ds-mono">100vw × 100vh</span>）排版後等比縮放放進 16:10 框（cover 置中，視窗比例不是 16:10 時邊緣會裁掉一點）；台灣大小＝實際開站畫面等比縮小。<code>data-boot</code> 彈入動畫屬 App，不在此重現。</p>
      <div className="ds-row" style={{ alignItems: "center" }}>
        <button type="button" className="ds-btn" onClick={() => setReplay((n) => n + 1)}>重播（載入中 → 完成）</button>
        <span style={{ fontSize: FONT_SIZE.sm, color: COLORS.textDim }}>已重播 <span className="ds-mono">{replay}</span> 次，目前 <span className="ds-mono">{livePhase}</span></span>
      </div>
      <Sub title="重播" kind="real" />
      <Pair bg="page" render={(isDark) => <BootFrame isDark={isDark} phase={livePhase} replay={replay} />} />
      <Sub title="loading（等待，城市脈動）" kind="real" />
      <Pair bg="page" render={(isDark) => <BootFrame isDark={isDark} phase="loading" replay={0} />} />
      <Sub title="done（✓ 完成，停留後淡出）" kind="real" />
      <Pair bg="page" render={(isDark) => <BootFrame isDark={isDark} phase="done" replay={0} />} />
      <div className="ds-pair">
        <Sub title="BOOT_LAYOUT" kind="real"><Kv rows={objRows("BOOT_LAYOUT", BOOT_LAYOUT)} /></Sub>
        <Sub title="BOOT_TIMING" kind="real"><Kv rows={objRows("BOOT_TIMING", BOOT_TIMING)} /></Sub>
      </div>
      <p className="ds-note">淡色底：<span className="ds-mono">--light-surface-solid</span>＝<span className="ds-mono">{LIGHT.surfaceSolid}</span>；暗色底：<span className="ds-mono">SURFACE.app</span>。</p>
    </Section>
  );
}
