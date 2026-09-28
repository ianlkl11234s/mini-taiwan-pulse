/**
 * 圖層調整控制項的共用渲染（UI 統一 Phase I）。
 *
 * `LayerSidebar`（手機）與 `IconRailSidebar`（桌機）展開區共用同一套：
 * 控制區左線、V2 滑桿（標籤／數值一行、全寬滑桿一行）、分段、原生選單、
 * 迷你開關、多選清單、眼睛隱藏鈕。樣式全在 `layerParamControls.css`。
 */
import type { CSSProperties, ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import type { ParamControl, SliderConfig, ToggleConfig } from "../../state/layerParamsControls";
import "./layerParamControls.css";

/** 主題 class：暗色用 tokens.css 預設值，淡色改指 --light-*（與其他子系統同一套做法） */
export function layerControlThemeClass(isDarkTheme: boolean): string {
  return isDarkTheme ? "lpc-theme" : "lpc-theme lpc-theme--light";
}

/** 控制區容器：圖層名稱下方、左側 1px 直線 */
export function LayerControlArea({ isDarkTheme, style, children }: { isDarkTheme: boolean; style?: CSSProperties; children: ReactNode }) {
  return <div className={`${layerControlThemeClass(isDarkTheme)} lpc-area`} style={style}>{children}</div>;
}

/** 標籤在上、控件在下全寬的一列（手寫控制項也用這個） */
export function ControlRow({ label, value, children }: { label: ReactNode; value?: ReactNode; children: ReactNode }) {
  return (
    <div className="lpc-row">
      <span className="lpc-k">{label}</span>
      {value != null && <span className="lpc-v">{value}</span>}
      <div className="lpc-c">{children}</div>
    </div>
  );
}

/** 分段按鈕（≤3 選項） */
export function ControlSegmented({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: readonly { label: string; value: string; disabled?: boolean }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="lpc-seg" role="group" aria-label={label}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={value === opt.value}
          disabled={opt.disabled}
          onClick={() => { if (!opt.disabled) onChange(opt.value); }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function SliderControl({ ctrl }: { ctrl: SliderConfig }) {
  const span = ctrl.max - ctrl.min;
  const pct = span > 0 ? Math.min(100, Math.max(0, ((ctrl.value - ctrl.min) / span) * 100)) : 0;
  return (
    <label className="lpc-row">
      <span className="lpc-k" title={ctrl.name}>{ctrl.name}</span>
      <span className="lpc-v">{ctrl.valueText}</span>
      <input
        className="lpc-c lpc-range"
        type="range"
        min={ctrl.min}
        max={ctrl.max}
        step={ctrl.step}
        value={ctrl.value}
        onChange={(e) => ctrl.onChange(Number(e.target.value))}
        style={{ "--p": `${pct}%` } as CSSProperties}
      />
    </label>
  );
}

function ToggleControl({ ctrl }: { ctrl: ToggleConfig }) {
  return (
    <button type="button" role="switch" aria-checked={ctrl.value} className="lpc-toggle" onClick={() => ctrl.onChange(!ctrl.value)}>
      <span className="lpc-sw" aria-hidden="true" />
      <span title={ctrl.label}>{ctrl.label}</span>
    </button>
  );
}

function renderControl(ctrl: ParamControl, key: string): ReactNode {
  if (ctrl.type === "multiSelect") {
    const selected = new Set(ctrl.value);
    return (
      <details key={key} className="lpc-ms" onClick={(event) => event.stopPropagation()}>
        <summary>
          <ChevronRight className="lpc-chev" size={10} strokeWidth={2} aria-hidden="true" />
          <span>{ctrl.label}</span>
          <span className="lpc-count">{selected.size}/{ctrl.options.length}</span>
          <span className="lpc-ms-act">
            <button type="button" className="lpc-link" onClick={(e) => { e.preventDefault(); ctrl.onSelectAll(); }}>全選</button>
            <button type="button" className="lpc-link" onClick={(e) => { e.preventDefault(); ctrl.onSelectNone(); }}>全關</button>
          </span>
        </summary>
        <div className="lpc-chk">
          {ctrl.options.map((option) => (
            <label key={option.value} data-disabled={option.disabled ? "true" : undefined} title={option.label}>
              <input
                type="checkbox"
                checked={selected.has(option.value)}
                disabled={option.disabled}
                onChange={() => {
                  const next = new Set(selected);
                  if (next.has(option.value)) next.delete(option.value); else next.add(option.value);
                  ctrl.onChange([...next]);
                }}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </details>
    );
  }

  if (ctrl.type === "select") {
    return (
      <ControlRow key={key} label={ctrl.label}>
        {ctrl.options.length > 3 ? (
          <select className="lpc-select" aria-label={ctrl.label} value={ctrl.value} onChange={(e) => ctrl.onChange(e.target.value)}>
            {ctrl.options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>{opt.label}</option>
            ))}
          </select>
        ) : (
          <ControlSegmented label={ctrl.label} value={ctrl.value} options={ctrl.options} onChange={ctrl.onChange} />
        )}
      </ControlRow>
    );
  }

  if (ctrl.type === "toggle") return <ToggleControl key={key} ctrl={ctrl} />;
  return <SliderControl key={key} ctrl={ctrl} />;
}

/**
 * 規格驅動的控制項清單。key 用位置（slider label 隨值變、select 的 labelByValue 也會變，
 * 拿 label 當 key 會在拖曳時整顆重掛）。連續 ≥3 個開關排成兩欄。
 */
export function ParamControlList({ controls }: { controls: readonly ParamControl[] }) {
  const out: ReactNode[] = [];
  for (let i = 0; i < controls.length;) {
    const ctrl = controls[i]!;
    if (ctrl.type === "toggle") {
      let j = i;
      while (j < controls.length && controls[j]!.type === "toggle") j += 1;
      const run = controls.slice(i, j) as ToggleConfig[];
      if (run.length >= 3) {
        out.push(
          <div key={`toggles-${i}`} className="lpc-toggle-grid">
            {run.map((t, k) => <ToggleControl key={`t-${i + k}`} ctrl={t} />)}
          </div>,
        );
      } else {
        run.forEach((t, k) => out.push(<ToggleControl key={`t-${i + k}`} ctrl={t} />));
      }
      i = j;
      continue;
    }
    out.push(renderControl(ctrl, `${ctrl.type ?? "slider"}-${i}`));
    i += 1;
  }
  return <>{out}</>;
}
