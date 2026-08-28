import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { installBenchResultBridge } from "./automation";
import { adjacentDates, DayPackLru, ForegroundRequestGate, loadPackWithLru, type CacheMode } from "./cache";
import { findAsset, parseBenchManifest, workloadCoverage } from "./contract";
import { buildTrackFrame, secondsForWindow } from "./frame";
import { BenchRunRecorder, currentDeviceProfile, type BenchRunExport } from "./metrics";
import { BenchTrackScene } from "./scene";
import {
  TRACK_BUCKETS,
  type BenchManifest,
  type FrameBudget,
  type TrackAssetFormat,
  type TrackBucket,
  type TrackPack,
} from "./types";
import "./styles.css";

const BUCKET_LABELS: Record<TrackBucket, string> = {
  cargo: "Cargo", tanker: "Tanker", passenger: "Passenger", fishing: "Fishing", other: "Special / Other",
};
const DEFAULT_BUCKETS = new Set<TrackBucket>(["cargo", "tanker", "passenger"]);
const BUDGET: FrameBudget = { maxHeads: 20_000, maxTrailVertices: 300_000 };

function queryManifest(): string {
  return new URLSearchParams(window.location.search).get("manifest") ?? "/gfw-v4-browser-manifest.json";
}

const sleepFrame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve));

export function App() {
  const [manifestUrl, setManifestUrl] = useState(queryManifest);
  const [manifest, setManifest] = useState<BenchManifest | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [format, setFormat] = useState<TrackAssetFormat>("json.gz");
  const [cacheMode, setCacheMode] = useState<CacheMode>("cold");
  const [trailWindow, setTrailWindow] = useState<"0.5" | "1" | "3">("0.5");
  const [profile, setProfile] = useState<"desktop" | "mobile">("desktop");
  const [externalProfileNote, setExternalProfileNote] = useState("No CPU/network throttling recorded");
  const [preciseMemoryAttested, setPreciseMemoryAttested] = useState(false);
  const [heapAttestationNote, setHeapAttestationNote] = useState("");
  const [enabled, setEnabled] = useState<Set<TrackBucket>>(() => new Set(DEFAULT_BUCKETS));
  const [status, setStatus] = useState("Load a local POC manifest to begin.");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BenchRunExport | null>(null);
  const [currentEpoch, setCurrentEpoch] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<BenchTrackScene | null>(null);
  const cacheRef = useRef(new DayPackLru(3));
  const requestGateRef = useRef(new ForegroundRequestGate());
  const manifestAbortRef = useRef<AbortController | null>(null);
  const resultRef = useRef<BenchRunExport | null>(null);
  resultRef.current = result;

  const dates = useMemo(() => [...(manifest?.days.keys() ?? [])].sort(), [manifest]);
  const coverage = useMemo(
    () => manifest && selectedDate ? workloadCoverage(manifest, selectedDate, enabled, format) : null,
    [enabled, format, manifest, selectedDate],
  );
  const heapAttestationNoteValue = heapAttestationNote.trim();
  const heapAttestationValid = !preciseMemoryAttested || heapAttestationNoteValue.length > 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scene = new BenchTrackScene(canvas, BUDGET);
    sceneRef.current = scene;
    const resize = () => scene.resize(canvas.clientWidth, canvas.clientHeight, window.devicePixelRatio);
    resize();
    window.addEventListener("resize", resize);
    let raf = 0;
    const render = () => { scene.render(); raf = requestAnimationFrame(render); };
    raf = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => () => {
    manifestAbortRef.current?.abort();
    requestGateRef.current.abort();
  }, []);

  useEffect(() => installBenchResultBridge(window, () => resultRef.current), []);

  const loadManifest = useCallback(async () => {
    manifestAbortRef.current?.abort();
    const controller = new AbortController();
    manifestAbortRef.current = controller;
    setStatus("Loading manifest…");
    setManifest(null);
    requestGateRef.current.abort();
    try {
      const response = await fetch(manifestUrl, { signal: controller.signal, cache: "no-cache" });
      if (!response.ok) throw new Error(`Manifest HTTP ${response.status}`);
      const parsed = parseBenchManifest(await response.json(), new URL(response.url || manifestUrl, window.location.href).toString());
      if (!parsed) throw new Error("Manifest does not match local POC schema v1");
      setManifest(parsed);
      const parsedDates = [...parsed.days.keys()].sort();
      const nextDate = parsedDates[parsedDates.length - 1] ?? "";
      setSelectedDate(nextDate);
      setStatus(`Ready · ${parsed.days.size} UTC day(s) · release ${parsed.releaseId}`);
    } catch (error) {
      if (controller.signal.aborted) return;
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }, [manifestUrl]);

  const setDate = (date: string) => {
    requestGateRef.current.abort();
    setSelectedDate(date);
    setCurrentEpoch(null);
    setResult(null);
  };

  const toggleBucket = (bucket: TrackBucket) => {
    setEnabled((previous) => {
      const next = new Set(previous);
      if (next.has(bucket)) next.delete(bucket);
      else next.add(bucket);
      return next;
    });
  };

  const runBenchmark = useCallback(async () => {
    if (!manifest || !selectedDate || enabled.size === 0 || !coverage) return;
    const controller = requestGateRef.current.next();
    if (cacheMode === "cold") cacheRef.current.clear();
    setRunning(true);
    setResult(null);
    setStatus("Foreground download + decode…");
    const buckets = TRACK_BUCKETS.filter((bucket) => enabled.has(bucket));
    const recorder = new BenchRunRecorder({
      manifestUrl: manifest.manifestUrl,
      selectedDate,
      format,
      cacheMode,
      enabledBuckets: buckets,
      trailHours: Number(trailWindow),
      profile: currentDeviceProfile(profile),
      externalProfileNote,
      workload: coverage,
      heapAttestation: {
        preciseMemoryInfo: preciseMemoryAttested && heapAttestationNoteValue.length > 0,
        note: heapAttestationNoteValue,
      },
    });
    recorder.start();
    try {
      const foreground = await Promise.all(buckets.map(async (bucket) => {
        const entry = findAsset(manifest, selectedDate, bucket, format);
        if (!entry) throw new Error(`Missing ${selectedDate}/${bucket}/${format}`);
        const loaded = await loadPackWithLru(cacheRef.current, manifest, entry, cacheMode, controller.signal);
        if (loaded.pack.pointCount !== entry.points || loaded.pack.segments.length !== entry.segments) {
          throw new Error(`Manifest count mismatch for ${bucket}/${format}`);
        }
        recorder.addAsset(loaded.timing);
        return loaded.pack;
      }));
      recorder.afterLoad();
      setStatus("Adjacent-day prefetch into 3-day LRU…");
      for (const date of adjacentDates(manifest, selectedDate)) {
        await Promise.all(buckets.map(async (bucket) => {
          const entry = findAsset(manifest, date, bucket, format);
          if (!entry) return;
          const loaded = await loadPackWithLru(cacheRef.current, manifest, entry, cacheMode, controller.signal);
          recorder.addAsset(loaded.timing);
        }));
      }
      if (controller.signal.aborted) return;
      // Re-touch the foreground day so the selected product remains MRU after adjacent prefetch.
      for (const bucket of buckets) {
        const entry = findAsset(manifest, selectedDate, bucket, format);
        if (entry) cacheRef.current.get(selectedDate, `${entry.bucket}|${entry.format}|${entry.path}`);
      }
      const range = epochRange(foreground);
      if (!range) throw new Error("No valid foreground track points");
      const duration = Math.min(10_800, range.end - range.start);
      if (duration <= 0) throw new Error("Track time range cannot support scrub");
      setStatus(`Scrubbing ${(duration / 3_600).toFixed(1)} simulated hour(s)…`);
      const sampleFrames = 1_080;
      const scene = sceneRef.current;
      if (!scene) throw new Error("Benchmark scene is unavailable");
      for (let index = 0; index < sampleFrames; index++) {
        if (controller.signal.aborted) return;
        const epoch = Math.round(range.start + duration * (index / (sampleFrames - 1)));
        const frameWorkStart = performance.now();
        const frame = buildTrackFrame(foreground, epoch, secondsForWindow(trailWindow), BUDGET);
        scene.update(frame, manifest.bbox);
        recorder.observeFrame(frame, epoch, performance.now() - frameWorkStart);
        if (index % 30 === 0) setCurrentEpoch(epoch);
        await sleepFrame();
      }
      const exported = recorder.finish(cacheRef.current);
      setResult(exported);
      setCurrentEpoch(range.start + duration);
      setStatus(`Complete · RAF p95 ${exported.raf.p95Ms?.toFixed(2) ?? "n/a"} ms`);
    } catch (error) {
      if (!controller.signal.aborted) setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      if (!controller.signal.aborted) setRunning(false);
    }
  }, [cacheMode, coverage, enabled, externalProfileNote, format, heapAttestationNoteValue, manifest, preciseMemoryAttested, profile, selectedDate, trailWindow]);

  const exportJson = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `gfw-v4-bench-${result.selectedDate}-${result.format.replace(".", "-")}-${result.profile.label}-${result.cacheMode}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="bench-shell">
      <header className="masthead">
        <div><span className="kicker">EAST ASIA / SHADOW POC</span><h1>GFW v4 Day-pack Bench</h1></div>
        <div className="safety">LOCAL ONLY<br /><strong>NO UPLOAD · NO DEPLOY</strong></div>
      </header>

      <section className="instrument-grid">
        <aside className="controls">
          <label className="field wide"><span>Manifest URL</span><div className="inline"><input value={manifestUrl} onChange={(event) => setManifestUrl(event.target.value)} disabled={running} /><button onClick={() => void loadManifest()} disabled={running}>LOAD</button></div></label>
          <div className="field-row">
            <label className="field"><span>UTC day</span><select value={selectedDate} onChange={(event) => setDate(event.target.value)} disabled={running}>{dates.map((date) => <option key={date}>{date}</option>)}</select></label>
            <label className="field"><span>Adapter</span><select value={format} onChange={(event) => setFormat(event.target.value as TrackAssetFormat)} disabled={running}><option value="json.gz">JSON.gz</option><option value="binary">Typed binary</option></select></label>
          </div>
          <fieldset>
            <legend>Attach / download types</legend>
            <div className="preset-row">
              <button className={coverage?.preset === "default" ? "active" : ""} onClick={() => setEnabled(new Set(DEFAULT_BUCKETS))} disabled={running}>DEFAULT</button>
              <button className={coverage?.preset === "all" ? "active danger" : ""} onClick={() => setEnabled(new Set(TRACK_BUCKETS))} disabled={running}>ALL / WORST CASE</button>
            </div>
            <div className="type-grid">{TRACK_BUCKETS.map((bucket) => <button key={bucket} className={enabled.has(bucket) ? "active" : ""} onClick={() => toggleBucket(bucket)} disabled={running} aria-pressed={enabled.has(bucket)}><i />{BUCKET_LABELS[bucket]}</button>)}</div>
            <p className="coverage" data-testid="workload-coverage">{coverage
              ? `${coverage.enabled.points.toLocaleString()} / ${coverage.total.points.toLocaleString()} points (${percent(coverage.pointFraction)}) · ${coverage.enabled.segments.toLocaleString()} / ${coverage.total.segments.toLocaleString()} segments (${percent(coverage.segmentFraction)})`
              : "Load a manifest to calculate workload coverage."}</p>
          </fieldset>
          <div className="field-row triple">
            <label className="field"><span>Trail</span><select value={trailWindow} onChange={(event) => setTrailWindow(event.target.value as "0.5" | "1" | "3")} disabled={running}><option value="0.5">30 min</option><option value="1">1 hour</option><option value="3">3 hours</option></select></label>
            <label className="field"><span>Cache</span><select value={cacheMode} onChange={(event) => setCacheMode(event.target.value as CacheMode)} disabled={running}><option value="cold">Cold / no-store</option><option value="warm">Warm / force-cache</option></select></label>
            <label className="field"><span>Profile</span><select value={profile} onChange={(event) => setProfile(event.target.value as "desktop" | "mobile")} disabled={running}><option value="desktop">Desktop</option><option value="mobile">Mobile</option></select></label>
          </div>
          <label className="field wide"><span>External device / throttle note</span><input value={externalProfileNote} onChange={(event) => setExternalProfileNote(event.target.value)} disabled={running} /></label>
          <fieldset className="heap-attestation">
            <legend>Heap evidence</legend>
            <label className="check"><input type="checkbox" checked={preciseMemoryAttested} onChange={(event) => setPreciseMemoryAttested(event.target.checked)} disabled={running} /><span>I externally attest this browser was launched with <code>--enable-precise-memory-info</code></span></label>
            <label className="field wide"><span>Attestation note / launch evidence</span><input value={heapAttestationNote} onChange={(event) => setHeapAttestationNote(event.target.value)} disabled={running || !preciseMemoryAttested} required={preciseMemoryAttested} aria-invalid={!heapAttestationValid} placeholder="Required: launch command or externally recorded run id" /></label>
          </fieldset>
          <button className="run" onClick={() => void runBenchmark()} disabled={running || !manifest || enabled.size === 0 || !heapAttestationValid}>{running ? "BENCHMARK RUNNING" : "RUN CONTROLLED SCRUB"}</button>
          <p className="status">{status}</p>
          <p className="boundary">Isolated Three.js scene for POC measurement only. It is not wired into the production Mapbox renderer.</p>
        </aside>

        <section className="viewport-panel">
          <div className="viewport-meta"><span>{selectedDate || "NO DAY"}</span><span>{currentEpoch ? new Date(currentEpoch * 1_000).toISOString() : "—"}</span></div>
          <canvas ref={canvasRef} aria-label="GFW v4 isolated track benchmark scene" />
          <div className="reticle" aria-hidden="true" />
        </section>

        <aside className="telemetry">
          <h2>Run telemetry</h2>
          <Metric label="RAF p95" value={result?.raf.p95Ms == null ? "—" : `${result.raf.p95Ms.toFixed(2)} ms`} alarm={(result?.raf.p95Ms ?? 0) > (profile === "mobile" ? 33 : 16.7)} />
          <Metric label="Frame work p95 / max" value={result?.frameWork.p95Ms == null ? "—" : `${result.frameWork.p95Ms.toFixed(2)} / ${result.frameWork.maxMs?.toFixed(2) ?? "—"} ms`} />
          <Metric label="Transfer" value={result ? `${sum(result.assets.map((asset) => asset.transferBytes)).toLocaleString()} B` : "—"} />
          <Metric label="Decode" value={result ? `${sum(result.assets.map((asset) => asset.decodeMs)).toFixed(1)} ms` : "—"} />
          <Metric label="Heap after scrub" value={!result ? "—" : result.heap.afterScrubBytes == null ? `NULL · ${result.heap.quality}` : `${(result.heap.afterScrubBytes / 1_048_576).toFixed(1)} MiB`} alarm={Boolean(result && result.heap.quality === "unavailable")} />
          <Metric label="Run coverage" value={result ? `${percent(result.workload.pointFraction)} points / ${percent(result.workload.segmentFraction)} segments` : "—"} alarm={result?.workload.preset === "default" && result.workload.pointFraction < 1} />
          <Metric label="LRU" value={result ? `${result.cache.days} day / ${result.cache.packs} pack` : "—"} />
          <Metric label="Peak visible members" value={result?.peakFrame?.visibleMembers.toLocaleString() ?? "—"} />
          <Metric label="Peak over budget" value={result?.peakFrame ? `${result.peakFrame.overBudgetHeads} heads / ${result.peakFrame.overBudgetTrailVertices} vertices` : "—"} alarm={Boolean(result?.peakFrame && (result.peakFrame.overBudgetHeads || result.peakFrame.overBudgetTrailVertices))} />
          <Metric label="Long tasks" value={result?.longTasks.length.toLocaleString() ?? "—"} alarm={Boolean(result?.longTasks.length)} />
          <button className="export" onClick={exportJson} disabled={!result}>EXPORT RUN JSON</button>
          <output data-testid="bench-result-json" hidden>
            {result ? JSON.stringify(result) : ""}
          </output>
          <p className="profile-note">Mobile is a declared profile, not proof of real hardware. Export the external throttle/device note with every run.</p>
          {result?.warnings.length ? <ul className="warnings">{result.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : null}
        </aside>
      </section>
    </main>
  );
}

function epochRange(packs: readonly TrackPack[]): { start: number; end: number } | null {
  let start = Infinity;
  let end = -Infinity;
  for (const pack of packs) for (const segment of pack.segments) {
    start = Math.min(start, segment.points[0]!.epoch);
    end = Math.max(end, segment.points[segment.points.length - 1]!.epoch);
  }
  return start === Infinity || end === -Infinity ? null : { start, end };
}

function sum(values: readonly number[]): number { return values.reduce((total, value) => total + value, 0); }

function percent(fraction: number): string { return `${(fraction * 100).toFixed(1)}%`; }

function Metric({ label, value, alarm = false }: { label: string; value: string; alarm?: boolean }) {
  return <div className={`metric ${alarm ? "alarm" : ""}`}><span>{label}</span><strong>{value}</strong></div>;
}
