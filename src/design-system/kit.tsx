/**
 * 參考頁共用小元件：章節外框、暗／淡並排、規格出處列、數值表。
 * 這裡只有頁面骨架；被展示的元件一律從各自的實作檔 import。
 */
import type { CSSProperties, ReactNode } from "react";

export const SPEC_UI = "docs/design-system/spec.md";
export const SPEC_MAP = "docs/design-system/map-layers.md";

/** 地圖底色替身（不是 Mapbox 真底圖，只為了讓暗／淡元件落在接近的底上） */
export const MOCK_MAP_BG = { dark: "#1b1c20", light: "#eef0ec" } as const;
export const mockMapBg = (isDark: boolean) => MOCK_MAP_BG[isDark ? "dark" : "light"];

export interface SectionDef {
  id: string;
  no: string;
  title: string;
}

export function Section({ def, children }: { def: SectionDef; children: ReactNode }) {
  return (
    <section className="ds-section" id={def.id}>
      <header>
        <h2><span className="ds-mono">{def.no}</span>{def.title}</h2>
      </header>
      {children}
    </section>
  );
}

export type Fidelity = "real" | "replica" | "doc";
const FIDELITY_LABEL: Record<Fidelity, string> = { real: "真元件", replica: "結構仿製，樣式為真", doc: "文件值" };

export function Tag({ kind, children }: { kind: Fidelity; children?: ReactNode }) {
  return <span className={`ds-tag ds-tag--${kind}`}>{children ?? FIDELITY_LABEL[kind]}</span>;
}

/** 「規格 §x.y ／ 實作 path」 */
export function Spec({ doc = SPEC_UI, section, impl }: { doc?: string; section: string; impl: string | readonly string[] }) {
  const paths = typeof impl === "string" ? [impl] : impl;
  return (
    <p className="ds-spec">
      規格 <code>{doc}</code> {section}　／　實作 {paths.map((p, i) => <span key={p}>{i > 0 ? "、" : ""}<code>{p}</code></span>)}
    </p>
  );
}

export function Sub({ title, kind, tagText, children }: { title: string; kind?: Fidelity; tagText?: string; children?: ReactNode }) {
  return (
    <div>
      <h3 className="ds-sub">{title}{kind && <Tag kind={kind}>{tagText}</Tag>}</h3>
      {children}
    </div>
  );
}

/** 暗／淡並排；render 收到 isDark。light 容器可選擇是否加全域 token 重映射。 */
export function Pair({
  render, bg = "map", lightRemap = false, stack = false, style,
}: {
  render: (isDark: boolean) => ReactNode;
  bg?: "map" | "page";
  lightRemap?: boolean;
  /** 元件太寬（例：展開時間軸 590px）時改成上下排 */
  stack?: boolean;
  style?: CSSProperties;
}) {
  const pane = (isDark: boolean) => {
    const background = bg === "map" ? mockMapBg(isDark) : isDark ? "var(--surface-app)" : "var(--light-surface-solid)";
    const cls = ["ds-pane", isDark ? "ds-pane--dark" : "ds-pane--light", !isDark && lightRemap ? "ds-light-remap" : ""].filter(Boolean).join(" ");
    return (
      <div className={cls} style={{ background, colorScheme: isDark ? "dark" : "light", ...style }}>
        <span className="ds-pane__label">{isDark ? "暗色" : "淡色"}</span>
        {render(isDark)}
      </div>
    );
  };
  return <div className="ds-pair" style={stack ? { gridTemplateColumns: "minmax(0, 1fr)" } : undefined}>{pane(true)}{pane(false)}</div>;
}

export type KvValue = string | number | boolean | readonly unknown[] | Record<string, unknown> | null | undefined;

export function fmt(v: KvValue): string {
  if (v == null) return "—";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}

const CJK_RE = /[\u3400-\u9fff\uff00-\uffef\u3000-\u303f]/;

/** 參考值表：左欄 token／屬性名，右欄值（純數值／代碼用等寬；含中文的說明維持 FONT_CJK，§4.1）。 */
export function Kv({ rows }: { rows: readonly (readonly [string, KvValue])[] }) {
  return (
    <table className="ds-kv">
      <tbody>
        {rows.map(([k, v]) => {
          const text = fmt(v);
          return (
            <tr key={k}>
              <th>{k}</th>
              <td className={CJK_RE.test(text) ? undefined : "ds-mono"}>{text}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** 整個 token 物件 → 表格列（新增 key 自動出現） */
export function objRows(prefix: string, obj: Record<string, unknown>): [string, KvValue][] {
  return Object.entries(obj).map(([k, v]) => [`${prefix}.${k}`, v as KvValue]);
}

export const kebab = (k: string) => k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** 讀 :root 的 CSS 變數（tokens.css） */
export function readCssVar(name: string): string {
  if (typeof document === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** 與 designSystemGuard.test.ts 同一個比較法（去空白、小寫；數字補 px 再比） */
export function sameValue(ts: string | number, css: string): boolean {
  const norm = (v: string) => v.replace(/\s+/g, "").toLowerCase();
  if (typeof ts === "number") return norm(css) === String(ts) || norm(css) === `${ts}px`;
  return norm(css) === norm(ts);
}
