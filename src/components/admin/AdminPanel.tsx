import { useCallback, useEffect, useState } from "react";
import { X, ShieldCheck, Users, ScrollText, Lock, Database } from "lucide-react";
import {
  listMembers, setMemberTier, listAudit, listGatedLayers, setLayerGate,
  TIERS, type Tier, type LockType, type AdminMember, type AuditRow, type GatedLayerRow,
} from "../../lib/adminApi";
import { loadLayerGates } from "../../lib/layerGates";
import {
  SURFACE, BORDER, RADIUS, FONT_SIZE, SPACING, COLORS, FONT_CJK, ELEVATION,
} from "../../styles/designTokens";

/**
 * 站內 owner-only 治理後台（Phase 2，spec §6）。
 * 四分頁：會員管理 / 稽核記錄 / 圖層鎖定 / 資料新鮮度。
 * 入口在 UserAvatar 下拉，僅 isOwner 渲染 → 這裡不再重複守門。
 */

interface Props {
  open: boolean;
  onClose: () => void;
  /** 目前登入者 uid：自己那列 tier 禁止修改（呼應 DB 端防呆）。 */
  selfId: string | null;
}

type TabKey = "members" | "audit" | "layers" | "freshness";
const TABS: { key: TabKey; label: string; Icon: typeof Users }[] = [
  { key: "members", label: "會員管理", Icon: Users },
  { key: "audit", label: "稽核記錄", Icon: ScrollText },
  { key: "layers", label: "圖層鎖定", Icon: Lock },
  { key: "freshness", label: "資料新鮮度", Icon: Database },
];

const RED = "#ef4444";

export function AdminPanel({ open, onClose, selfId }: Props) {
  const [tab, setTab] = useState<TabKey>("members");
  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 10001,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: SURFACE.solid, color: COLORS.textDefault, borderRadius: RADIUS.xl,
          border: `1px solid ${BORDER.panel}`, boxShadow: ELEVATION.lg,
          width: "min(920px, 94vw)", maxHeight: "88vh", display: "flex", flexDirection: "column",
          fontFamily: FONT_CJK, overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: `${SPACING.lg}px ${SPACING.xl}px`, borderBottom: `1px solid ${BORDER.soft}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: SPACING.sm, fontSize: FONT_SIZE.xl, fontWeight: 600, color: COLORS.textStrong }}>
            <ShieldCheck size={18} /> 資料治理後台
          </div>
          <button onClick={onClose} aria-label="關閉"
            style={{ background: "transparent", border: "none", color: COLORS.textMuted, cursor: "pointer" }}>
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: SPACING.xs, padding: `${SPACING.md}px ${SPACING.xl}px 0`, borderBottom: `1px solid ${BORDER.soft}` }}>
          {TABS.map(({ key, label, Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              style={{
                display: "inline-flex", alignItems: "center", gap: SPACING.xs,
                padding: `${SPACING.sm}px ${SPACING.md}px`, background: "transparent", cursor: "pointer",
                border: "none", borderBottom: `2px solid ${tab === key ? COLORS.accent : "transparent"}`,
                color: tab === key ? COLORS.textStrong : COLORS.textMuted,
                fontSize: FONT_SIZE.md, fontFamily: FONT_CJK, fontWeight: tab === key ? 600 : 400,
              }}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: SPACING.xl, overflow: "auto", flex: 1 }}>
          {tab === "members" && <MembersTab selfId={selfId} />}
          {tab === "audit" && <AuditTab />}
          {tab === "layers" && <LayersTab />}
          {tab === "freshness" && <FreshnessTab />}
        </div>
      </div>
    </div>
  );
}

// ── 共用小工具 ──

function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): { data: T | null; loading: boolean; error: string | null; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [epoch, setEpoch] = useState(0);
  const reload = useCallback(() => setEpoch((e) => e + 1), []);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fn()
      .then((d) => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch((err) => { if (!cancelled) { setError(err instanceof Error ? err.message : String(err)); setLoading(false); } });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, epoch]);
  return { data, loading, error, reload };
}

function Status({ loading, error }: { loading: boolean; error: string | null }) {
  if (loading) return <div style={{ color: COLORS.textMuted, fontSize: FONT_SIZE.md, padding: SPACING.lg }}>載入中…</div>;
  if (error) return <div style={{ color: RED, fontSize: FONT_SIZE.md, padding: SPACING.lg }}>載入失敗：{error}</div>;
  return null;
}

const th: React.CSSProperties = { textAlign: "left", padding: `${SPACING.xs}px ${SPACING.md}px`, color: COLORS.textMuted, fontSize: FONT_SIZE.sm, fontWeight: 600, borderBottom: `1px solid ${BORDER.panel}`, whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: `${SPACING.sm}px ${SPACING.md}px`, fontSize: FONT_SIZE.md, borderBottom: `1px solid ${BORDER.soft}`, verticalAlign: "middle" };
const selectStyle: React.CSSProperties = { background: SURFACE.strong, color: COLORS.textDefault, border: `1px solid ${BORDER.mid}`, borderRadius: RADIUS.md, padding: `${SPACING.xxs}px ${SPACING.sm}px`, fontSize: FONT_SIZE.sm, fontFamily: FONT_CJK };
const fmt = (s: string | null) => (s ? s.replace("T", " ").slice(0, 16) : "—");

// ── Tab 1：會員管理 ──

function MembersTab({ selfId }: { selfId: string | null }) {
  const { data, loading, error, reload } = useAsync(listMembers, []);
  const [busy, setBusy] = useState<string | null>(null);

  const onChange = async (m: AdminMember, tier: Tier) => {
    setBusy(m.id);
    try {
      await setMemberTier(m.id, tier);
      reload();
    } catch (err) {
      alert(`修改失敗：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(null);
    }
  };

  if (loading || error) return <Status loading={loading} error={error} />;
  const members = data ?? [];
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          <th style={th}>Email</th><th style={th}>名稱</th><th style={th}>分級 Tier</th>
          <th style={th}>註冊</th><th style={th}>最後登入</th>
        </tr>
      </thead>
      <tbody>
        {members.map((m) => {
          const isSelf = m.id === selfId;
          return (
            <tr key={m.id}>
              <td style={td}>{m.email ?? "—"}{isSelf && <span style={{ color: COLORS.accent, marginLeft: 6, fontSize: FONT_SIZE.sm }}>（你）</span>}</td>
              <td style={td}>{m.display_name ?? "—"}</td>
              <td style={td}>
                <select value={m.tier} disabled={isSelf || busy === m.id} style={{ ...selectStyle, opacity: isSelf ? 0.5 : 1 }}
                  onChange={(e) => void onChange(m, e.target.value as Tier)}>
                  {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </td>
              <td style={{ ...td, color: COLORS.textMuted }}>{fmt(m.created_at)}</td>
              <td style={{ ...td, color: COLORS.textMuted }}>{fmt(m.last_sign_in_at)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ── Tab 2：稽核記錄 ──

function AuditTab() {
  const [onlyDenied, setOnlyDenied] = useState(false);
  const { data, loading, error } = useAsync<AuditRow[]>(() => listAudit(200, onlyDenied), [onlyDenied]);

  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginBottom: SPACING.md, lineHeight: 1.6 }}>
        匿名掃描於 API gateway 攔截（函式未執行），不列入此表；完整記錄見 Supabase 平台 logs。
        本表為已登入且函式有跑到的存取（owner 正常使用 + 登入者越權嘗試）。
      </div>
      <label style={{ display: "inline-flex", alignItems: "center", gap: SPACING.xs, fontSize: FONT_SIZE.md, marginBottom: SPACING.md, cursor: "pointer" }}>
        <input type="checkbox" checked={onlyDenied} onChange={(e) => setOnlyDenied(e.target.checked)} /> 只看被拒
      </label>
      {(loading || error) ? <Status loading={loading} error={error} /> : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>時間</th><th style={th}>Email</th><th style={th}>Tier</th>
              <th style={th}>RPC</th><th style={th}>需求</th><th style={th}>結果</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((r) => (
              <tr key={r.id} style={{ background: r.granted ? undefined : `${RED}14` }}>
                <td style={{ ...td, color: COLORS.textMuted, whiteSpace: "nowrap" }}>{fmt(r.occurred_at)}</td>
                <td style={td}>{r.email ?? "—"}</td>
                <td style={td}>{r.user_tier ?? "—"}</td>
                <td style={{ ...td, fontFamily: "monospace", fontSize: FONT_SIZE.sm }}>{r.rpc_name}</td>
                <td style={td}>{r.required_tier ?? "—"}</td>
                <td style={{ ...td, color: r.granted ? "#22c55e" : RED, fontWeight: 600 }}>{r.granted ? "允許" : "拒絕"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Tab 3：圖層鎖定 ──

function LayersTab() {
  const { data, loading, error, reload } = useAsync(listGatedLayers, []);
  const [busy, setBusy] = useState<string | null>(null);

  const apply = async (row: GatedLayerRow, tier: Tier, enabled: boolean, lockType?: LockType) => {
    setBusy(row.layer_key);
    try {
      await setLayerGate(row.layer_key, tier, enabled, lockType);
      await loadLayerGates(); // 讓地圖鎖頭即時更新
      reload();
    } catch (err) {
      alert(`修改失敗：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(null);
    }
  };

  if (loading || error) return <Status loading={loading} error={error} />;
  const rows = data ?? [];
  const byCat = new Map<string, GatedLayerRow[]>();
  for (const r of rows) {
    if (!byCat.has(r.category)) byCat.set(r.category, []);
    byCat.get(r.category)!.push(r);
  }

  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginBottom: SPACING.md, lineHeight: 1.6 }}>
        鎖型 <b>full（乾淨鎖）</b>= DB 真鎖機密（改此欄<b>不會</b>動 DB grant，需另跑 migration REVOKE/GRANT）；
        <b>ui（UI 鎖）</b>= 資料公開、僅前端引導未登入者登入。改 lock_type 只影響前端鎖頭行為，不碰後端真鎖狀態。
      </div>
      {[...byCat.entries()].map(([cat, list]) => (
        <div key={cat} style={{ marginBottom: SPACING.xl }}>
          <div style={{ fontSize: FONT_SIZE.md, fontWeight: 600, color: COLORS.textStrong, marginBottom: SPACING.sm }}>{cat}</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr><th style={th}>圖層</th><th style={th}>required_tier</th><th style={th}>鎖型</th><th style={th}>啟用</th><th style={th}>新鮮度</th></tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.layer_key}>
                  <td style={td}>
                    {r.label}
                    <span style={{ color: COLORS.textFaint, fontSize: FONT_SIZE.sm, marginLeft: 6, fontFamily: "monospace" }}>{r.layer_key}</span>
                  </td>
                  <td style={td}>
                    <select value={r.required_tier} disabled={busy === r.layer_key} style={selectStyle}
                      onChange={(e) => void apply(r, e.target.value as Tier, r.enabled)}>
                      {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </td>
                  <td style={td}>
                    <select value={r.lock_type} disabled={busy === r.layer_key} style={selectStyle}
                      onChange={(e) => void apply(r, r.required_tier as Tier, r.enabled, e.target.value as LockType)}>
                      <option value="full">full 乾淨鎖</option>
                      <option value="ui">ui UI 鎖</option>
                    </select>
                  </td>
                  <td style={td}>
                    <input type="checkbox" checked={r.enabled} disabled={busy === r.layer_key}
                      onChange={(e) => void apply(r, r.required_tier as Tier, e.target.checked)} />
                  </td>
                  <td style={td}>
                    {r.is_stale
                      ? <span style={{ color: RED, display: "inline-flex", alignItems: "center", gap: 4 }}><Dot color={RED} />過期</span>
                      : r.source_date ? <span style={{ color: COLORS.textMuted }}>{r.source_date}</span> : <span style={{ color: COLORS.textFaint }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

// ── Tab 4：資料新鮮度（唯讀）──

function FreshnessTab() {
  const { data, loading, error } = useAsync(listGatedLayers, []);
  if (loading || error) return <Status loading={loading} error={error} />;
  // 以 dataset（category）為單位去重，避免同 category 多 layer 重複列
  const seen = new Set<string>();
  const rows = (data ?? []).filter((r) => {
    const k = r.category;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          <th style={th}>資料集</th><th style={th}>基準日</th><th style={th}>下次更新</th>
          <th style={th}>頻率</th><th style={th}>筆數</th><th style={th}>狀態</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.category}>
            <td style={td}>{r.category}</td>
            <td style={{ ...td, color: COLORS.textMuted }}>{r.source_date ?? "—"}</td>
            <td style={{ ...td, color: r.is_stale ? RED : COLORS.textMuted }}>{r.next_refresh ?? "—"}</td>
            <td style={{ ...td, color: COLORS.textMuted }}>{r.refresh_cadence ?? "—"}</td>
            <td style={{ ...td, color: COLORS.textMuted }}>{r.row_count?.toLocaleString() ?? "—"}</td>
            <td style={td}>
              {r.is_stale
                ? <span style={{ color: RED, display: "inline-flex", alignItems: "center", gap: 4 }}><Dot color={RED} />過期</span>
                : <span style={{ color: "#22c55e" }}>最新</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Dot({ color }: { color: string }) {
  return <span style={{ width: 8, height: 8, borderRadius: RADIUS.full, background: color, display: "inline-block" }} />;
}
