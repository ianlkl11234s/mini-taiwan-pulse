import { useEffect, useMemo, useState } from "react";
import { GATED_LAYERS } from "../../components/sidebar/layerCatalog";
import { LAYER_SEARCH_INDEX } from "../../lib/layerSearch";
import {
  fingerprintSearchIndex,
  parseJevRunReceipt,
  receiptLayersForCandidates,
  type JevRunReceipt,
  type ScreeningLayer,
} from "./engine";

const RECEIPT_ENDPOINT = "/api/research/v1/jev/layer-screening/latest";
const RUN_ENDPOINT = "/api/research/v1/jev/layer-screening/run";
const PLAYBACK_DURATION_MS = 15_000;
type DisplayLayer = ScreeningLayer & { candidate: { key: string } };

const formatProbability = (value: number | null) => value === null ? "—" : value.toFixed(2);
const formatPercent = (value: number | null) => value === null ? "—" : `${Math.round(value * 100)}`;

export function LayerScreeningApp() {
  const [receipt, setReceipt] = useState<JevRunReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [played, setPlayed] = useState(0);
  const [replaying, setReplaying] = useState(false);
  const [querying, setQuerying] = useState(false);
  const [demoQuery, setDemoQuery] = useState("");
  const [currentIndexFingerprint, setCurrentIndexFingerprint] = useState<string | null>(null);

  const candidates = useMemo(
    () => LAYER_SEARCH_INDEX.filter((item) => !GATED_LAYERS.has(item.key)),
    [],
  );
  const layers = useMemo(
    () => receipt ? receiptLayersForCandidates(receipt, candidates) : [],
    [receipt, candidates],
  );
  const displayed = layers.slice(0, played);
  const related = displayed.filter((layer) => layer.decision.relevant === true);
  const excluded = displayed.filter((layer) => layer.decision.relevant === false);
  const unknown = displayed.filter((layer) => layer.decision.relevant === null);
  const current = layers[Math.min(played, Math.max(0, layers.length - 1))] ?? null;
  const progress = layers.length ? Math.round((played / layers.length) * 100) : 0;
  const isComplete = Boolean(layers.length && played === layers.length && !replaying);
  const indexDrift = Boolean(
    receipt && currentIndexFingerprint && receipt.indexFingerprint !== currentIndexFingerprint,
  );

  const loadReceipt = () => {
    setError(null);
    void fetch(RECEIPT_ENDPOINT)
      .then(async (response) => {
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        const parsed = parseJevRunReceipt(await response.json());
        if (!parsed) throw new Error("receipt 格式不符");
        setReceipt(parsed);
        setDemoQuery(parsed.query);
        setPlayed(0);
        setReplaying(true);
      })
      .catch((reason: unknown) => {
        setError(`尚未取得真實 receipt：${reason instanceof Error ? reason.message : "fetch failed"}`);
      });
  };

  useEffect(() => {
    void fingerprintSearchIndex(LAYER_SEARCH_INDEX).then(setCurrentIndexFingerprint);
    loadReceipt();
  }, []);

  useEffect(() => {
    if (!replaying || !layers.length) return;
    const startedAt = performance.now();
    let timerId = 0;

    const advance = () => {
      const elapsed = performance.now() - startedAt;
      const next = Math.min(layers.length, Math.floor((elapsed / PLAYBACK_DURATION_MS) * layers.length));
      setPlayed((value) => value === next ? value : next);
      if (next >= layers.length) {
        setReplaying(false);
        return;
      }
      timerId = window.setTimeout(advance, 16);
    };

    advance();
    return () => window.clearTimeout(timerId);
  }, [layers.length, replaying]);

  const runQuery = async () => {
    const query = demoQuery.trim();
    if (!query || querying || replaying) return;
    setError(null);
    setQuerying(true);
    setReceipt(null);
    setPlayed(0);
    try {
      const response = await fetch(RUN_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const code = body && typeof body === "object" && "error" in body ? String(body.error) : `${response.status} ${response.statusText}`;
        throw new Error(code);
      }
      const parsed = parseJevRunReceipt(body);
      if (!parsed) throw new Error("receipt 格式不符");
      setReceipt(parsed);
      setDemoQuery(parsed.query);
      setReplaying(true);
    } catch (reason) {
      setError(`即時查詢失敗：${reason instanceof Error ? reason.message : "request failed"}`);
    } finally {
      setQuerying(false);
    }
  };

  const relevantCards = [...related].reverse();
  const excludedChips = [...excluded].reverse();
  const streamItems = [...displayed].reverse();
  const shortlist = [...related]
    .sort((left, right) => (right.decision.probability ?? 0) - (left.decision.probability ?? 0))
    .slice(0, 4);
  const completedBatches = receipt?.batches.filter((batch) => batch.status === "completed").length ?? 0;
  const decisionsPerSecond = receipt && receipt.wallDurationMs > 0
    ? receipt.candidateCount / (receipt.wallDurationMs / 1000)
    : null;
  const statusLabel = querying
    ? "查詢中 QUERYING"
    : isComplete
      ? "完成 DONE"
      : replaying
        ? "掃描中 SCANNING"
        : "等待 WAITING";

  return (
    <main className="jev-app">
      <header className="jev-header">
        <div className="jev-title-lockup">
          <LogoMark />
          <div>
            <p>MINI TAIWAN PULSE · JEV LAYER SCREENING</p>
            <div><h1>圖層相關性分類器</h1><span>LAYER RELEVANCE SCREENER</span></div>
          </div>
        </div>
        <div className="jev-statuses">
          <span>{receipt?.provider ?? "PROVIDER"} · {receipt?.model ?? "WAITING"}</span>
          {indexDrift && <span className="is-drift">INDEX DRIFT · {receipt?.candidateCount}/{candidates.length}</span>}
          <span className={isComplete ? "is-done" : querying || replaying ? "is-running" : ""}><i />{statusLabel}</span>
        </div>
      </header>

      {error && (
        <section className="jev-error">
          <span>{error}</span><button onClick={loadReceipt}>載入最近結果</button>
        </section>
      )}

      <section className="jev-metrics">
        <Metric label="已分類 CLASSIFIED" value={`${played} / ${layers.length || "—"}`} progress={progress} />
        <Metric label="相關 RELEVANT" value={`${related.length}`} tone="green" note={`機率 ≥ ${receipt?.relevanceThreshold ?? "—"}`} />
        <Metric label="不相關 DISCARDED" value={`${excluded.length}`} tone="red" note="已排除 filtered out" />
        <Metric
          label="真實耗時 ELAPSED"
          value={isComplete && receipt ? `${(receipt.wallDurationMs / 1000).toFixed(2)} s` : "—"}
          note={isComplete && decisionsPerSecond ? `${decisionsPerSecond.toFixed(1)} 層/秒` : "等待完成"}
        />
        <Metric label="判定門檻 THRESHOLD" value={receipt ? receipt.relevanceThreshold.toFixed(2) : "—"} tone="amber" note={`${unknown.length} unknown · ${completedBatches}/${receipt?.batches.length ?? "—"} batches`} />
      </section>

      <section className="jev-workspace">
        <div className="jev-triage">
          <div className="jev-panel-title">
            <div><i /><span>圖層判定 LAYER TRIAGE</span></div>
            <small>從中央發牌 · 相關往上 · 不相關往下</small>
          </div>

          <ResultZone kind="relevant" count={related.length} results={relevantCards} />

          <Dealer current={current} played={played} total={layers.length} progress={progress} complete={isComplete} />

          <ResultZone kind="excluded" count={excluded.length} results={excludedChips} />
        </div>

        <aside className="jev-sidebar">
          <form className="jev-query-panel" onSubmit={(event) => { event.preventDefault(); void runQuery(); }}>
            <label htmlFor="jev-query">問題 QUERY</label>
            <div className="jev-query-row">
              <input
                id="jev-query"
                value={demoQuery}
                placeholder="輸入想查詢的問題"
                onChange={(event) => setDemoQuery(event.target.value)}
              />
              <button type="submit" disabled={querying || replaying || !demoQuery.trim()}>{querying ? "查詢中" : replaying ? "播放中" : "查詢"}</button>
            </div>
            <div className="jev-run-meta">
              <span>RUN {receipt?.runId.slice(0, 8) ?? "—"}</span>
              <span>RECEIPT V1</span>
              <span>{receipt?.candidateCount ?? "—"} LAYERS</span>
            </div>
            <div className="jev-query-foot">
              <span>Jev probability · receipt decision</span>
              <span>{completedBatches}/{receipt?.batches.length ?? "—"} batches</span>
            </div>
          </form>

          <section className="jev-stream-panel">
            <div className="jev-sidebar-title"><span>逐層相關度 PER-LAYER RELEVANCE</span><small>{querying ? "Jev 查詢中" : replaying ? "即時 live" : receipt ? "完成" : "等待"}</small></div>
            <div className="jev-stream">
              {streamItems.map((layer) => <StreamRow key={layer.key} layer={layer} />)}
              {!streamItems.length && <EmptyState />}
            </div>
          </section>

          <section className="jev-shortlist-panel">
            <div className="jev-sidebar-title"><span>入選圖層 SHORTLIST</span>{isComplete && <small className="is-done">本題完成 DONE</small>}</div>
            <div className="jev-shortlist">
              {shortlist.map((layer, index) => (
                <div key={layer.key}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{layer.label}</strong>
                  <ScoreBar value={layer.decision.probability} />
                  <b>{formatPercent(layer.decision.probability)}</b>
                </div>
              ))}
              {!shortlist.length && <EmptyState />}
            </div>
            <div className="jev-shortlist-foot">
              <strong>{related.length} 個相關圖層</strong>
              <span>{Math.max(0, related.length - shortlist.length)} more</span>
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}

function LogoMark() {
  return (
    <svg className="jev-logo" viewBox="0 0 34 34" aria-hidden="true">
      <rect x="1" y="1" width="32" height="32" rx="8" />
      <path d="M7 24 L13 13 L19 19 L26 9" />
      <circle cx="26" cy="9" r="2.6" />
    </svg>
  );
}

function Metric({
  label,
  value,
  note,
  tone,
  progress,
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "green" | "red" | "amber";
  progress?: number;
}) {
  return (
    <article className={tone ? `jev-metric tone-${tone}` : "jev-metric"}>
      <span>{label}</span>
      <strong>{value}</strong>
      {progress === undefined ? <small>{note}</small> : <div className="jev-metric-progress"><i style={{ width: `${progress}%` }} /></div>}
    </article>
  );
}

function ResultZone({
  kind,
  count,
  results,
}: {
  kind: "relevant" | "excluded";
  count: number;
  results: readonly DisplayLayer[];
}) {
  const relevant = kind === "relevant";
  return (
    <section className={`jev-result-zone is-${kind}`}>
      <div className="jev-zone-title">
        <div><i /><span>{relevant ? "相關 RELEVANT" : "不相關 DISCARDED"}</span></div>
        <small>{count} 個圖層</small>
      </div>
      <div className={relevant ? "jev-relevant-grid" : "jev-excluded-grid"}>
        {results.map((layer) => relevant
          ? <RelevantCard key={layer.key} layer={layer} />
          : <ExcludedChip key={layer.key} layer={layer} />)}
        {!results.length && <EmptyState />}
      </div>
    </section>
  );
}

function RelevantCard({ layer }: { layer: DisplayLayer }) {
  return (
    <article className="jev-relevant-card">
      <div><strong>{layer.label}</strong><b>{formatPercent(layer.decision.probability)}</b></div>
      <small>{layer.key}</small>
      <ScoreBar value={layer.decision.probability} />
    </article>
  );
}

function ExcludedChip({ layer }: { layer: DisplayLayer }) {
  return (
    <article className="jev-excluded-chip">
      <span>{layer.label}</span><b>{formatPercent(layer.decision.probability)}</b>
    </article>
  );
}

function Dealer({
  current,
  played,
  total,
  progress,
  complete,
}: {
  current: DisplayLayer | null;
  played: number;
  total: number;
  progress: number;
  complete: boolean;
}) {
  return (
    <section className="jev-dealer">
      <div className="jev-dealer-index">
        <span>判定中 EVALUATING</span>
        <strong>#{Math.min(played + 1, total)} / {total || "—"}</strong>
      </div>
      <div className={`jev-current-card ${complete ? "is-complete" : ""}`} key={complete ? "complete" : current?.key}>
        <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
        {!complete && <i className="scan" />}
        <div><span>{complete ? "完成" : current?.theme ?? "等待"}</span><strong>{complete ? "分類完成" : current?.label ?? "讀取圖層"}</strong></div>
        <small>{complete ? `ALL ${total} LAYERS CLASSIFIED` : current?.key ?? "AWAITING RECEIPT"}</small>
      </div>
      <div className="jev-sweep">
        <div><span>掃描進度 SWEEP</span><strong>{progress}%</strong></div>
        <div className="jev-sweep-track"><i style={{ width: `${progress}%` }} /></div>
        <small>{complete ? "已完成真實 receipt replay" : `relevance ${formatProbability(current?.decision.probability ?? null)}`}</small>
      </div>
    </section>
  );
}

function StreamRow({ layer }: { layer: DisplayLayer }) {
  const relevant = layer.decision.relevant === true;
  return (
    <article className={relevant ? "is-relevant" : "is-excluded"}>
      <span>{layer.theme ?? "其他"}</span>
      <strong>{layer.label}</strong>
      <ScoreBar value={layer.decision.probability} />
      <b>{formatPercent(layer.decision.probability)}</b>
    </article>
  );
}

function ScoreBar({ value }: { value: number | null }) {
  return <div className="jev-score-bar"><i style={{ width: `${(value ?? 0) * 100}%` }} /></div>;
}

function EmptyState() {
  return <p className="jev-empty">等待真實判定結果</p>;
}
