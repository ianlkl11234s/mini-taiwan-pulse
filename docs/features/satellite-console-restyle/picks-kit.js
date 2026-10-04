/* ═══════════════════════════════════════════════════════════════════════════
 * picks-kit.js — 衛星情報面板 P2–P5 比較頁共用工具（window.PK）
 *
 * 頁面：p2-p5-picks.html 依序載入 picks-kit.js → picks-p2.js … picks-p5.js。
 * 各段 agent 只寫自己的 picks-pN.js，**不要改本檔與 HTML**；缺什麼回報給主 agent。
 *
 * ── 代號字母分配（全頁唯一；kit 啟動時檢查，違規會 console.error＋頁面紅字）──
 *   P1（已用，禁止再用）：E H B T S F
 *   P2 群組列          ：N G K M L
 *   P3 台灣衛星隊＋覆蓋統計：C V W X Y
 *   P4 變軌警報／彈窗／百科卡／popup：A R D Q U O Z J
 *   P5 淡色版          ：I SC HT SV（兩字母開頭，例 SC1）
 *   題目 k ＝ 字母（例 "C"、"SC"）；選項 c ＝ k＋數字（例 "C1"、"SC2"）。
 *
 * ── 註冊一段 ──
 *   PK.registerPhase({
 *     id: "P3", title: "台灣衛星隊＋覆蓋統計",
 *     intro: "html（本段範圍、示意說明）",
 *     rules: ["html", …],            // 選填：不需要選、照規則做的事
 *     overview: { cur: (p)=>html, rec: (p)=>html },   // 選填：現況 vs 建議組合
 *     questions: [{
 *       k: "C", t: "題目標題", note: "html 說明",
 *       cur: (p)=>html,              // 現況；kit 用 P.dark 呼叫一次（curLight: true 時暗淡並排）
 *       opts: [{ c: "C1", d: "選項說明", spec: "依據", rec: true,
 *                shared: "要改哪個共用元件（有就顯示 ⚠）", f: (p)=>html }],
 *     }],
 *   });
 *   f(p) 會各用 P.dark、P.light 呼叫一次並排。回傳完整 stage（用 PK.shell／PK.p1Panel 包）。
 *   phase 檔頂層例外、render 例外都只影響該段。
 *
 * ── 色票與工具 ──
 *   PK.P.dark / PK.P.light       palette（值抄自 designTokens／intelTheme／railTheme／LayerToggleSwitch）
 *     欄位：isDark panel border soft mid strong def muted dim faint accent link live warn err warnBorder
 *           ctrlBorder shadow stub rail{TEXT DIM INACT BORDER HOVER ton toff kon koff sub line}
 *   PK.SAT                       SATELLITE_COLORS 全 16 色（key 同 SatelliteCategory）
 *   PK.GROUPS                    15 群示意資料 { key, cn:boolean, label(HEAD 原字串), tier, color, cnt, man, on }
 *   PK.alpha(hex,a) PK.mix(a,b,t) PK.chipText(hex,p)（淡色資料 hue 當字色要過它）
 *   PK.esc(s) PK.num(n)（數字包等寬）
 *   PK.icon.x(c) PK.icon.sat(c) PK.icon.chev(c, open)
 *
 * ── 示意元件（全部回傳 html 字串）──
 *   PK.shell(p, inner, {history})       面板外框（含底圖 stage）
 *   PK.curShell(inner)                  現況外框（暗）
 *   PK.stub(p, text)                    灰色佔位
 *   PK.badge(p, color, text, "outline"|"tint"|"pill", {textColor})   §5.21 徽章
 *   PK.subLabel(p, zh, trailing?)       SubGroupLabel（L2 群組標題）
 *   PK.macroLabel(p, zh)                MacroGroupLabel（9.5px）
 *   PK.sectionTitle(p, zh)              P1 T1 已實作的區段標題（＝subLabel）
 *   PK.nameLine(p, {zh, alt, qualifier})  ListRow 名稱（LayerNameLine）
 *   PK.row(p, {label, meta, cnt, unit="顆", c, on, open, expandable=true, icon})  共用 ListRow
 *   PK.curGroupMeta(p, {tier, man})     HEAD 現況群組列的 tier 框＋⚡ 徽章
 *   PK.curGroupRow(p, g)                HEAD 現況群組列（g 取自 PK.GROUPS）
 *   PK.rowSwitch(p, on) PK.miniSwitch(p, on) PK.toggleRow(p, on)
 *   PK.p1Header(p, {history, maneuvers=3})   P1 實作後標頭（PanelHeader＋狀態列）
 *   PK.p1Footer(p, {expired, stale})         P1 實作後 footer（顯示全部軌道＋兩來源＋抓取於）
 *   PK.p1Panel(p, inner, {history, header=true, footer=true})  shell(p1Header + inner + p1Footer)
 *   PK.pair(fn)                         暗淡並排（kit 渲染選項時自動用；自訂版面也可呼叫）
 * ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  const PK = (window.PK = window.PK || {});

  // ── 代號分配 ──
  const ALLOC = { P2: ["N", "G", "K", "M", "L"], P3: ["C", "V", "W", "X", "Y"], P4: ["A", "R", "D", "Q", "U", "O", "Z", "J"], P5: ["I", "SC", "HT", "SV"] };
  const P1_USED = ["E", "H", "B", "T", "S", "F"];
  const ORDER = ["P2", "P3", "P4", "P5"];
  PK.ALLOC = ALLOC;

  // ── 色票（抄自 p1-picks；淡色＝LIGHT／LIGHT_INTEL／railTheme.LIGHT_PALETTE） ──
  PK.CJK = '"PingFang TC","Microsoft JhengHei","Noto Sans CJK TC",system-ui,sans-serif';
  PK.P = {
    dark: { isDark: true, panel: "rgba(10,10,20,0.88)", border: "rgba(255,255,255,0.10)", soft: "rgba(255,255,255,0.06)", mid: "rgba(255,255,255,0.14)",
      strong: "#f3f4f6", def: "#d8dce3", muted: "#9ca3af", dim: "#6b7280", faint: "#4b5560",
      accent: "#64aaff", link: "#7fb2ff", live: "#22c55e", warn: "#ff9800", err: "#ef4444", warnBorder: "rgba(255,152,0,0.45)",
      ctrlBorder: "rgba(255,255,255,0.12)", shadow: "0 12px 40px rgba(0,0,0,0.45)", stub: "rgba(255,255,255,0.04)",
      rail: { TEXT: "#fff", DIM: "#6B7280", INACT: "#9CA3AF", BORDER: "#2A2D32", HOVER: "rgba(255,255,255,0.03)", ton: "#ffffff", toff: "#4b5563", kon: "#111827", koff: "#ffffff", sub: "#9CA3AF", line: "rgba(255,255,255,0.14)" } },
    light: { isDark: false, panel: "rgba(255,255,255,0.95)", border: "rgba(0,0,0,0.10)", soft: "rgba(0,0,0,0.06)", mid: "rgba(0,0,0,0.16)",
      strong: "#111827", def: "#1f2937", muted: "#4b5563", dim: "#6b7280", faint: "#6b7280",
      accent: "#0b6fd6", link: "#0284c7", live: "#15803d", warn: "#c2410c", err: "#b42318", warnBorder: "rgba(194,65,12,0.45)",
      ctrlBorder: "rgba(0,0,0,0.14)", shadow: "0 12px 40px rgba(0,0,0,0.18)", stub: "rgba(0,0,0,0.04)",
      rail: { TEXT: "#111827", DIM: "#9CA3AF", INACT: "#6B7280", BORDER: "rgba(0,0,0,0.10)", HOVER: "rgba(0,0,0,0.04)", ton: "#1f2937", toff: "#d1d5db", kon: "#ffffff", koff: "#ffffff", sub: "#4B5563", line: "rgba(0,0,0,0.12)" } },
  };
  // SATELLITE_COLORS（src/data/satelliteTypes.ts；資料色 §3.16，暗淡不變）
  PK.SAT = {
    china_yaogan: "#ef5350", china_jilin: "#ff7043", china_gaofen: "#ec407a", china_tjs: "#ba68c8", china_beidou: "#5e7ce2", china_shiyan: "#9e9e9e",
    taiwan: "#4fc3f7", usa: "#93c5fd", japan: "#fb7185", russia: "#a8a29e", india: "#f59e0b", korea: "#2dd4bf",
    france: "#3b82f6", germany: "#fde047", italy: "#34d399", israel: "#c4b5fd",
  };
  // 15 群（CN_GROUPS_META／INTL_GROUPS_META 順序與 HEAD 原字串；顆數、變軌數為示意，各段共用）
  const G = (key, cn, label, tier, cnt, man, on) => ({ key, cn, label, tier, color: PK.SAT[key], cnt, man, on });
  PK.GROUPS = [
    G("china_yaogan", true, "Yaogan 遙感", "S", 128, 2, true),
    G("china_jilin", true, "Jilin-1 吉林", "S", 117, 0, true),
    G("china_gaofen", true, "Gaofen 高分", "S", 46, 1, true),
    G("china_tjs", true, "TJS / TJSW GEO 情報", "A", 31, 0, true),
    G("china_beidou", true, "Beidou 北斗", "B", 56, 0, false),
    G("china_shiyan", true, "Shiyan 實踐 / 其他", "C", 42, 0, false),
    G("usa", false, "🇺🇸 USA", "S", 52, 0, false),
    G("japan", false, "🇯🇵 Japan IGS", "S", 9, 0, false),
    G("russia", false, "🇷🇺 Russia", "S", 24, 1, false),
    G("korea", false, "🇰🇷 Korea KOMPSAT", "A", 6, 0, false),
    G("france", false, "🇫🇷 France CSO/PLEIADES", "A", 5, 0, false),
    G("germany", false, "🇩🇪 Germany SAR-Lupe", "A", 7, 0, false),
    G("italy", false, "🇮🇹 Italy COSMO-SkyMed", "A", 6, 0, false),
    G("israel", false, "🇮🇱 Israel Ofeq", "A", 4, 0, false),
    G("india", false, "🇮🇳 India CARTOSAT/RISAT", "B", 14, 0, false),
  ];

  // ── 色彩／字串工具 ──
  PK.alpha = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
  PK.mix = (a, b, t) => { const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
    const c = (s) => Math.round(((x >> s) & 255) + ((((y >> s) & 255) - ((x >> s) & 255)) * t));
    return "#" + ((c(16) << 16) | (c(8) << 8) | c(0)).toString(16).padStart(6, "0"); };
  // chipText：淡色把資料 hue 往 LIGHT.textStrong 混 55%（intelTheme CHIP_TEXT_MIX）
  PK.chipText = (hex, p) => (p.isDark ? hex : PK.mix(hex, "#111827", 0.55));
  PK.esc = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  PK.num = (n) => `<span class="mono">${n}</span>`;

  // ── icon（lucide 路徑） ──
  PK.icon = {
    x: (c) => `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>`,
    sat: (c) => `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M13 7 9 3 5 7l4 4"/><path d="m17 11 4 4-4 4-4-4"/><path d="m8 12 4 4 6-6-4-4Z"/><path d="m16 8 3-3"/><path d="M9 21a6 6 0 0 0-6-6"/></svg>`,
    chev: (c, open) => `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" style="flex-shrink:0${open ? ";transform:rotate(90deg)" : ""}"><path d="m9 18 6-6-6-6"/></svg>`,
  };

  // ── 外殼 ──
  PK.shell = (p, inner, o = {}) => {
    const bd = o.history ? p.warnBorder : p.border;
    return `<div class="stage ${p.isDark ? "dk" : "lt"}"><div class="pn" style="background:${p.panel};border:1px solid ${bd};box-shadow:${p.shadow};color:${p.def}">${inner}</div></div>`;
  };
  PK.curShell = (inner) => PK.shell(PK.P.dark, inner);
  PK.stub = (p, t) => `<div class="stub" style="background:${p.stub};color:${p.dim};border:1px dashed ${p.mid}">${t}</div>`;

  // §5.21 徽章：outline＝chipOutline（radius 3、2px 5px、10px）；tint＝chipTint（3px 5px、無框）；pill＝IntelHeader LIVE pill
  // 狀態色（p.live/err/warn）已是主題安全值；資料 hue 當字色時傳 {textColor: PK.chipText(hex, p)}
  PK.badge = (p, color, text, style = "outline", o = {}) => {
    const tc = o.textColor || color;
    if (style === "tint") return `<span class="nw" style="display:inline-flex;align-items:center;gap:4px;padding:3px 5px;border-radius:3px;background:${PK.alpha(color, 0.14)};color:${tc};font-size:10px;line-height:1.2">${text}</span>`;
    if (style === "pill") return `<span class="nw" style="display:inline-flex;align-items:center;gap:4px;padding:2px 6px;border-radius:9999px;border:1px solid ${PK.alpha(color, 0.45)};color:${tc};font-size:9px;font-weight:600;line-height:1.2"><span style="width:6px;height:6px;border-radius:50%;background:${color};box-shadow:0 0 6px ${color}"></span>${text}</span>`;
    return `<span class="nw" style="display:inline-flex;align-items:center;gap:4px;padding:2px 5px;border-radius:3px;border:1px solid ${PK.alpha(color, 0.5)};color:${tc};font-size:10px;line-height:1.2">${text}</span>`;
  };

  // ── 標題 ──
  PK.subLabel = (p, text, trailing) => `<div style="display:flex;align-items:center;gap:8px;color:${p.rail.sub};font-size:10px;font-weight:600;letter-spacing:0.6px;padding:10px 12px 3px 12px">
    <span class="nw">${text}</span><span aria-hidden="true" style="flex:1;height:1px;background:${p.rail.line}"></span>${trailing ? `<span class="nw" style="font-weight:400;letter-spacing:0;color:${p.rail.DIM}">${trailing}</span>` : ""}</div>`;
  PK.macroLabel = (p, text) => `<div style="display:flex;align-items:center;gap:8px;padding:10px 12px 4px;color:${p.rail.DIM};font-size:9.5px;letter-spacing:1.2px">
    <span class="nw">${text}</span><span aria-hidden="true" style="flex:1;height:1px;background:${p.rail.line}"></span></div>`;
  PK.sectionTitle = (p, zh) => PK.subLabel(p, zh); // P1 T1

  // ── 列 ──
  // LayerNameLine：zh 不縮；alt 10px DIM 可省略；qualifier 9px 框
  PK.nameLine = (p, n) => `<span style="display:flex;align-items:baseline;gap:5px;min-width:0"><span class="nw" style="flex:0 0 auto">${n.zh}</span>`
    + (n.alt ? `<span class="ell" style="flex:0 1 auto;min-width:0;font-size:10px;color:${p.rail.DIM}">${n.alt}</span>` : "")
    + (n.qualifier ? `<span class="nw" style="flex-shrink:0;align-self:center;padding:0 4px;border:1px solid ${p.rail.BORDER};border-radius:4px;font-size:9px;line-height:13px;color:${p.rail.DIM}">${n.qualifier}</span>` : "")
    + `</span>`;
  PK.rowSwitch = (p, on) => { const r = p.rail; // LayerToggleSwitch 28×16（列開關，黑白）
    return `<span role="switch" aria-checked="${on}" style="position:relative;width:28px;height:16px;border-radius:8px;background:${on ? r.ton : r.toff};flex-shrink:0;display:inline-block"><span style="position:absolute;top:2px;left:${on ? 14 : 2}px;width:12px;height:12px;border-radius:50%;background:${on ? r.kon : r.koff}"></span></span>`; };
  PK.miniSwitch = (p, on) => // .lpc-sw 20×11（細項開關，強調色）
    `<span role="switch" aria-checked="${on}" style="position:relative;width:20px;height:11px;border-radius:9999px;background:${on ? p.accent : p.ctrlBorder};flex-shrink:0;display:inline-block"><span style="position:absolute;top:2px;left:${on ? 11 : 2}px;width:7px;height:7px;border-radius:50%;background:${on ? "#fff" : p.strong}"></span></span>`;
  // 共用 ListRow：label 12px TEXT_STRONG；計數 11px 等寬＋10px 中文單位；開啟時左緣 2px 資料色
  PK.row = (p, g) => {
    const r = p.rail, on = !!g.on, unit = g.unit ?? "顆";
    const icon = g.icon ?? PK.icon.sat(on ? g.c : r.DIM);
    const cnt = g.cnt != null && g.cnt > 0 ? `<span class="nw" style="display:inline-flex;align-items:baseline;gap:2px;margin-right:4px;color:${on ? g.c : r.INACT}"><span class="mono" style="font-size:11px">${Number(g.cnt).toLocaleString("zh-TW")}</span>${unit ? `<span style="font-size:10px">${unit}</span>` : ""}</span>` : "";
    const chev = g.expandable === false ? "" : `<span style="display:flex;color:${r.DIM}">${PK.icon.chev(r.DIM, g.open)}</span>`;
    return `<div style="display:flex;align-items:center;border-left:2px solid ${on ? g.c : "transparent"};border-top:1px solid ${p.soft}">
    <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0;padding:5px 8px 5px 10px">${icon}
      <span style="flex:1;min-width:0;display:flex;align-items:baseline;font-size:12px;color:${r.TEXT}">${g.label}${g.meta ?? ""}</span>${cnt}${chev}</div>
    <span style="padding-right:12px;display:flex">${PK.rowSwitch(p, on)}</span></div>`;
  };
  // HEAD 現況群組列的 meta：tier 框（等寬 9px、borderMid、radius 4）＋ ⚡N（rgba 紅底框、等寬 9px 粗）
  PK.curGroupMeta = (p, g) => {
    const tier = g.tier ? `<span class="mono" style="margin-left:6px;padding:0 5px;border-radius:4px;border:1px solid ${p.mid};font-size:9px;color:${p.muted};line-height:14px">${g.tier}</span>` : "";
    const man = g.man ? `<span class="mono" style="margin-left:4px;padding:1px 6px;border-radius:4px;background:${PK.alpha(p.err, 0.16)};border:1px solid ${PK.alpha(p.err, 0.45)};font-size:9px;font-weight:700;color:${p.err}">⚡${g.man}</span>` : "";
    return tier + man;
  };
  PK.curGroupRow = (p, g) => PK.row(p, { label: `<span class="ell">${g.label}</span>`, meta: PK.curGroupMeta(p, g), cnt: g.cnt, c: g.color, on: g.on, open: g.open });
  PK.toggleRow = (p, on = true) =>
    `<div style="display:flex;align-items:center;gap:6px;padding:7px 14px;border-top:1px solid ${p.soft}">${PK.miniSwitch(p, on)}<span style="font-size:10px;color:${on ? p.def : p.muted}">顯示全部軌道</span></div>`;

  // ── P1 實作後基底（HEAD 956f9a07：SatelliteConsoleHeader.tsx／SatelliteConsole.tsx） ──
  PK.p1Header = (p, o = {}) => {
    const h = !!o.history, man = o.maneuvers ?? 3;
    const head = `<div style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid ${p.border}">
    <div style="flex:1;min-width:0"><div style="color:${p.dim};font-size:9px;letter-spacing:1.4px;line-height:1.3">情報 · 太空</div>
    <h2 style="margin:1px 0 0;color:${p.strong};font-size:13px;font-weight:700;line-height:1.4">衛星情報</h2></div>
    <span style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;flex-shrink:0" title="關閉衛星情報">${PK.icon.x(p.muted)}</span></div>`;
    const right = h ? `<span class="ell" style="margin-left:auto;color:${p.dim}">變軌警報固定看近 24 小時</span>`
      : (man > 0 ? `<span style="margin-left:auto">${PK.badge(p, p.err, `變軌 ${PK.num(man)}`)}</span>` : "");
    const status = `<div style="padding:6px 14px 7px;border-bottom:1px solid ${p.soft};display:flex;align-items:center;gap:8px;font-size:10px;background:${h ? (p.isDark ? "rgba(255,152,0,0.06)" : "rgba(194,65,12,0.05)") : "transparent"}">
    ${h ? PK.badge(p, p.warn, "歷史") : PK.badge(p, p.live, "即時")}<span class="nw" style="color:${p.dim}">顯示時間</span><span class="mono" style="color:${p.def};font-weight:600">${h ? "12:17" : "14:32"}</span>
    ${h ? `<span class="nw" style="color:${p.warn}">（<span class="mono">-2:15</span>）</span>` : ""}${right}</div>`;
    return head + status;
  };
  PK.p1Footer = (p, o = {}) => {
    const src = (n) => `<div>${n} · <span style="color:${p.link}">原始下載頁 ↗</span></div>`;
    const fresh = `<div class="mono">抓取於 10/04 13:20${o.expired ? `<span style="color:${p.warn};font-family:var(--f-ui)"> · 資料過期</span>` : ""} · 變軌 13:22${o.stale ? `<span style="color:${p.warn};font-family:var(--f-ui)"> · 變軌更新中斷</span>` : ""}</div>`;
    return PK.toggleRow(p, true) + `<div style="padding:8px 14px;border-top:1px solid ${p.soft};font-size:9px;line-height:1.5;color:${p.dim}">${src("UCS 衛星資料庫")}${src("Space-Track 軌道資料")}${fresh}</div>`;
  };
  PK.p1Panel = (p, inner, o = {}) =>
    PK.shell(p, (o.header === false ? "" : PK.p1Header(p, o)) + inner + (o.footer === false ? "" : PK.p1Footer(p, o)), o);

  PK.pair = (fn) => {
    const one = (p, t) => { let h; try { h = fn(p); } catch (e) { console.error(e); h = `<div class="err">示意產生失敗：${PK.esc(e && e.message)}</div>`; } return `<div><div class="tl">${t}</div>${h}</div>`; };
    return `<div class="pair">${one(PK.P.dark, "暗")}${one(PK.P.light, "淡")}</div>`;
  };

  // ═════════════════ 頁面：註冊、渲染、選擇、答案 ═════════════════
  const phases = {}; // id → def
  const failed = {}; // id → 訊息（檔案載入失敗或頂層例外）
  const errors = []; // 代號檢查錯誤
  const STORE_KEY = "satRestylePicks.v1";
  let state = { picks: {}, notes: {}, p1: {} };
  try { const raw = window.localStorage.getItem(STORE_KEY); if (raw) { const s = JSON.parse(raw); state = { picks: s.picks || {}, notes: s.notes || {}, p1: s.p1 || {} }; } } catch (e) { /* storage 不可用 */ }
  const save = () => { try { window.localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ } };

  PK.registerPhase = (def) => {
    try {
      if (!def || !ALLOC[def.id]) { errors.push(`registerPhase：未知的 phase id「${def && def.id}」`); return; }
      if (phases[def.id]) errors.push(`${def.id} 重複註冊（後者覆蓋前者）`);
      phases[def.id] = def;
    } catch (e) { console.error(e); }
  };
  PK.markMissing = (id) => { if (!phases[id]) failed[id] = failed[id] || "missing"; };
  // phase 檔頂層例外：用 filename 對到 picks-pN.js
  window.addEventListener("error", (e) => {
    const m = /picks-(p\d)\.js/i.exec((e && e.filename) || "");
    if (m) failed[m[1].toUpperCase()] = (e.message || "未知錯誤");
  });

  const P1Q = [
    { id: "ucs", t: "UCS連結", d: "footer「UCS 衛星資料庫 · 原始下載頁 ↗」連到 <a href=\"https://www.ucsusa.org/resources/satellite-database\" target=\"_blank\" rel=\"noopener noreferrer\">https://www.ucsusa.org/resources/satellite-database</a>，這個頁面對嗎？" },
    { id: "hdr", t: "標頭高度", d: "標頭改用共用 PanelHeader 後上下內距從 13px 變 10px，整個標頭變矮一點，可以接受嗎？" },
    { id: "fetch", t: "抓取時間", d: "footer「抓取於 10/04 13:20」是<b>瀏覽器讀到資料的時間</b>，不是資料本身的時間（TLE 與變軌資料沒有可用的資料時間欄）。這樣標示可以嗎？" },
  ];

  function validate() {
    const seen = {};
    for (const id of ORDER) {
      const ph = phases[id]; if (!ph) continue;
      for (const q of ph.questions || []) {
        if (P1_USED.includes(q.k)) errors.push(`${id} 題目「${q.k}」使用了 P1 已用的字母`);
        else if (!ALLOC[id].includes(q.k)) errors.push(`${id} 題目「${q.k}」不在 ${id} 的配額（${ALLOC[id].join(" ")}）`);
        if (seen[q.k]) errors.push(`題目代號「${q.k}」重複（${seen[q.k]}、${id}）`); else seen[q.k] = id;
        for (const o of q.opts || []) {
          const m = /^([A-Z]+)(\d+)$/.exec(o.c || "");
          if (!m || m[1] !== q.k) errors.push(`${id} 選項「${o.c}」格式不對（應為 ${q.k}＋數字）`);
          if (seen["opt:" + o.c]) errors.push(`選項代號「${o.c}」重複`); else seen["opt:" + o.c] = id;
        }
      }
    }
    errors.forEach((e) => console.error("[picks-kit] " + e));
  }

  // ── 答案文字 ──
  function answerText() {
    const lines = [];
    const p1 = P1Q.map((q) => { const v = state.p1[q.id] || "？"; const n = (state.p1[q.id + "Note"] || "").trim(); return `${q.t} ${v}${n ? `（${n}）` : ""}`; });
    lines.push("P1確認：" + p1.join("；"));
    for (const id of ORDER) {
      const ph = phases[id];
      if (!ph) { lines.push(`${id}：（尚未產生）`); continue; }
      lines.push(`${id}：` + (ph.questions || []).map((q) => state.picks[q.k] || `${q.k}？`).join(" "));
      const n = (state.notes[id] || "").trim(); if (n) lines.push(`${id}備註：${n.replace(/\s*\n\s*/g, " / ")}`);
    }
    return lines.join("\n");
  }
  function refreshAnswer() {
    const t = answerText();
    const a = document.getElementById("pk-ans-text"); if (a) a.textContent = t;
    const ta = document.getElementById("pk-ans-ta"); if (ta) ta.value = t;
  }

  // ── 渲染 ──
  function renderP1Check() {
    return `<section class="q" id="P1check"><h2><span class="k">P1</span>P1 實作確認</h2>
      <p>P1 已照 E3＋H1＋B1＋T1＋S1＋F1 實作。下面三點請確認，「需改」時可在旁邊寫原因。</p>
      ${P1Q.map((q) => { const v = state.p1[q.id]; return `<div class="chk" data-p1="${q.id}"><div class="chk-t"><b>${q.t}</b> ${q.d}</div>
        <div class="chk-c" role="radiogroup" aria-label="${q.t}">${["OK", "需改"].map((o) => `<label class="seg"><input type="radio" name="p1-${q.id}" value="${o}"${v === o ? " checked" : ""}><span>${o}</span></label>`).join("")}
        <input type="text" class="note1" data-p1note="${q.id}" placeholder="選填說明" value="${PK.esc(state.p1[q.id + "Note"] || "")}"></div></div>`; }).join("")}
    </section>`;
  }
  function renderPhase(id) {
    const ph = phases[id];
    if (!ph) {
      const msg = failed[id] && failed[id] !== "missing" ? `（此段載入失敗：${PK.esc(failed[id])}）` : "（此段比較尚未產生）";
      return `<section class="phase" id="${id}"><h1 class="ph">${id}</h1><p class="missing">${msg}</p></section>`;
    }
    try {
      const qs = (ph.questions || []).map((q) => {
        let cur = "";
        try { cur = q.curLight ? PK.pair(q.cur) : q.cur(PK.P.dark); } catch (e) { console.error(e); cur = `<div class="err">現況產生失敗：${PK.esc(e.message)}</div>`; }
        return `<section class="q" id="q-${q.k}"><h2><span class="k">${q.k}</span>${q.t}</h2><p>${q.note || ""}</p>
          <div class="ref"><div class="lab"><b>現況</b><span style="color:var(--muted)">${q.curLight ? "暗／淡" : "只有暗色"}</span></div>${cur}</div>
          <div class="opts" role="radiogroup" aria-label="${PK.esc(q.k + " " + q.t)}">${(q.opts || []).map((o) => `<div class="opt${state.picks[q.k] === o.c ? " sel" : ""}" role="radio" tabindex="0" aria-checked="${state.picks[q.k] === o.c}" data-q="${q.k}" data-c="${o.c}">
            <div class="lab"><b>${o.c}</b><span>${o.d}</span>${o.rec ? '<span class="rec">建議</span>' : ""}${o.shared ? '<span class="shared">⚠ 改共用元件</span>' : ""}<span class="selmark">已選</span></div>
            <p class="cap">依據：${o.spec || "—"}</p>${o.shared ? `<p class="cap warnc">⚠ ${o.shared}</p>` : ""}${PK.pair(o.f)}</div>`).join("")}</div></section>`;
      }).join("");
      let ov = "";
      if (ph.overview) {
        const cell = (t, fn, p) => { let h; try { h = fn(p); } catch (e) { h = `<div class="err">${PK.esc(e.message)}</div>`; } return `<div><div class="tl">${t}</div>${h}</div>`; };
        ov = `<section class="q"><h2><span class="k">總覽</span>現況 vs 建議組合</h2><div class="ov">${cell("現況（只有暗色）", ph.overview.cur, PK.P.dark)}${ph.overview.rec ? cell("建議組合・暗", ph.overview.rec, PK.P.dark) + cell("建議組合・淡", ph.overview.rec, PK.P.light) : ""}</div></section>`;
      }
      const rules = ph.rules && ph.rules.length ? `<div class="summary"><b>不需要選、會照規則做的：</b><ul>${ph.rules.map((r) => `<li>${r}</li>`).join("")}</ul></div>` : "";
      return `<section class="phase" id="${id}"><h1 class="ph">${id}　${ph.title || ""}</h1>${ph.intro ? `<div class="intro">${ph.intro}</div>` : ""}
        ${ov}${qs}${rules}<div class="pnote"><label for="note-${id}"><b>${id} 備註</b>（選填）</label><textarea id="note-${id}" data-note="${id}" rows="2" placeholder="對本段的其他意見">${PK.esc(state.notes[id] || "")}</textarea></div></section>`;
    } catch (e) {
      console.error(e);
      return `<section class="phase" id="${id}"><h1 class="ph">${id}</h1><p class="err">此段渲染失敗：${PK.esc(e.message)}</p></section>`;
    }
  }

  function select(card) {
    const k = card.dataset.q, c = card.dataset.c;
    const next = state.picks[k] === c ? null : c;
    if (next) state.picks[k] = next; else delete state.picks[k];
    document.querySelectorAll(`.opt[data-q="${k}"]`).forEach((el) => { const on = el.dataset.c === next; el.classList.toggle("sel", on); el.setAttribute("aria-checked", String(on)); });
    save(); refreshAnswer();
  }
  function applyRec() {
    for (const id of ORDER) { const ph = phases[id]; if (!ph) continue;
      for (const q of ph.questions || []) { if (state.picks[q.k]) continue; const r = (q.opts || []).find((o) => o.rec); if (r) state.picks[q.k] = r.c; } }
    document.querySelectorAll(".opt").forEach((el) => { const on = state.picks[el.dataset.q] === el.dataset.c; el.classList.toggle("sel", on); el.setAttribute("aria-checked", String(on)); });
    save(); refreshAnswer(); flash("已填入建議（只填未選的題目）");
  }
  function clearAll() {
    if (!window.confirm("清除所有選擇與備註？")) return;
    state = { picks: {}, notes: {}, p1: {} }; save();
    document.querySelectorAll(".opt").forEach((el) => { el.classList.remove("sel"); el.setAttribute("aria-checked", "false"); });
    document.querySelectorAll("textarea[data-note], input[data-p1note]").forEach((el) => { el.value = ""; });
    document.querySelectorAll('input[type="radio"]').forEach((el) => { el.checked = false; });
    refreshAnswer(); flash("已清除");
  }
  let flashTimer;
  function flash(msg) { const el = document.getElementById("pk-flash"); if (!el) return; el.textContent = msg; clearTimeout(flashTimer); flashTimer = setTimeout(() => { el.textContent = ""; }, 2500); }
  async function copy() {
    const t = answerText();
    try { if (!navigator.clipboard) throw new Error("no clipboard"); await navigator.clipboard.writeText(t); flash("已複製"); }
    catch (e) { flash("無法自動複製，請改用頁面最下方文字框（點一下會全選）"); const ta = document.getElementById("pk-ans-ta"); if (ta) { ta.focus(); ta.select(); } }
  }

  function render() {
    validate();
    const root = document.getElementById("pk-root"); if (!root) return;
    const toc = `<nav class="toc" aria-label="段落"><a href="#P1check">P1 確認</a>${ORDER.map((id) => `<a href="#${id}">${id}${phases[id] ? " " + PK.esc(phases[id].title || "") : "（未產生）"}</a>`).join("")}<a href="#pk-final">答案文字</a></nav>`;
    const errHtml = errors.length ? `<div class="err" role="alert"><b>代號檢查錯誤：</b><ul>${errors.map((e) => `<li>${PK.esc(e)}</li>`).join("")}</ul></div>` : "";
    root.innerHTML = toc + errHtml + renderP1Check() + ORDER.map(renderPhase).join("")
      + `<section class="q" id="pk-final"><h2><span class="k">答案</span>答案文字（複製失敗時用這裡）</h2><p>點一下文字框會全選，再按 ⌘C／Ctrl+C。</p><textarea id="pk-ans-ta" readonly rows="7"></textarea></section>`;
    const bar = document.createElement("div");
    bar.className = "ansbar"; bar.setAttribute("role", "region"); bar.setAttribute("aria-label", "答案");
    bar.innerHTML = `<div class="ans-in"><pre id="pk-ans-text" aria-live="polite"></pre><div class="ans-btns"><button type="button" id="pk-copy">複製答案</button><button type="button" id="pk-rec">全部採用建議</button><button type="button" id="pk-clear">清除</button><span id="pk-flash" role="status"></span></div></div>`;
    document.body.appendChild(bar);

    root.addEventListener("click", (e) => { const card = e.target.closest(".opt[role=radio]"); if (card && !e.target.closest("a,button,input,textarea")) select(card); });
    root.addEventListener("keydown", (e) => { const card = e.target.closest && e.target.closest(".opt[role=radio]"); if (card && e.target === card && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); select(card); } });
    root.addEventListener("input", (e) => {
      const t = e.target;
      if (t.dataset.note) { state.notes[t.dataset.note] = t.value; }
      else if (t.dataset.p1note) { state.p1[t.dataset.p1note + "Note"] = t.value; }
      else return;
      save(); refreshAnswer();
    });
    root.addEventListener("change", (e) => { const t = e.target; const m = /^p1-(\w+)$/.exec(t.name || ""); if (m && t.checked) { state.p1[m[1]] = t.value; save(); refreshAnswer(); } });
    const ta = document.getElementById("pk-ans-ta");
    ta.addEventListener("focus", () => ta.select()); ta.addEventListener("click", () => ta.select());
    document.getElementById("pk-copy").addEventListener("click", copy);
    document.getElementById("pk-rec").addEventListener("click", applyRec);
    document.getElementById("pk-clear").addEventListener("click", clearAll);
    refreshAnswer();
  }
  PK.answerText = answerText;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", render); else setTimeout(render, 0);
})();
