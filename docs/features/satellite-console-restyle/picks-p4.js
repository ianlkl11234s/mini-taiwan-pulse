/* P4 變軌警報區、變軌對比彈窗、衛星百科卡、地圖 popup、歷史模式變軌清單
 * 現況依 HEAD（P-D 實作後）：
 *   src/components/satelliteConsole/ManeuverAlertSection.tsx（SEV_TOKEN、Banner、ManeuverCard、ImpactChip、btnStyle）
 *   src/components/satelliteConsole/ManeuverCompareModal.tsx（MiniMap 320×260、PassDiffHeadline、PassBar、RegionDiffChips）
 *   src/components/satelliteConsole/SatelliteDetailCard.tsx（手刻標頭、Section 等寬標題、Row 寬 70、預測區）
 *   src/components/featureInfo/satellitePanels.tsx（手寫標題 div、Row、足跡說明、SourceFooter）
 *   src/components/satelliteConsole/satelliteConsoleTokens.ts（MANEUVER_TOKEN.zh）、src/data/satelliteDataState.ts
 *   Z 題：gis-platform/migrations/169、171（get_satellite_maneuvers_recent）、401（satellite_maneuvers MV）、
 *         282（satellite_tle_history 保留 30 天）、312（get_satellite_tle_history）
 * 代號：A R D Q U O Z J（見 picks-kit.js 檔頭分配） */
(function () {
  const PK = window.PK;
  const { num, badge, alpha, chipText } = PK;

  // ── 資料色（§3.16，暗淡不變；淡色當字色時過 chipText） ──
  const OR = "#ff9800"; // 變軌前軌跡（HEAD MiniMap BEFORE）
  const BL = "#4fc3f7"; // 變軌後軌跡（HEAD MiniMap AFTER）＝台灣資料色
  const TYPE = {
    PLANE: { zh: "軌道面變化", head: "PLANE", icon: "↻", color: "#ef4444" },
    ALT: { zh: "高度變化", head: "ALT", icon: "⬆", color: "#ff9800" },
    SHAPE: { zh: "離心率變化", head: "SHAPE", icon: "◓", color: "#facc15" },
  };
  const SEV = { red: { zh: "重大", c: (p) => p.err }, orange: { zh: "注意", c: (p) => p.warn }, grey: { zh: "例行", c: (p) => p.muted }, unknown: { zh: "無法判定", c: (p) => p.muted } };
  // HEAD SEV_TOKEN（只有暗色）
  const CUR_SEV = {
    red: { c: "#ef4444", soft: "rgba(239,68,68,0.12)", bd: "rgba(239,68,68,0.55)", pulse: true },
    orange: { c: "#f97316", soft: "rgba(249,115,22,0.10)", bd: "rgba(249,115,22,0.50)" },
    grey: { c: "#9ca3af", soft: "rgba(255,255,255,0.02)", bd: "rgba(255,255,255,0.12)" },
    unknown: { c: "#9ca3af", soft: "rgba(255,255,255,0.02)", bd: "rgba(255,255,255,0.12)" },
  };
  const CUR_LABEL = { red: "重大", orange: "注意", grey: "例行", unknown: "無法判定" };

  // ── 示意資料（近 24 小時 11 筆：重大 1、注意 2、例行 7、無法判定 1；全是中國） ──
  const EV = [
    { name: "YAOGAN-35 01A", g: "china_yaogan", t: "PLANE", sev: "red", dl: "傾角", dv: "+0.14°", du: "", raw: "傾角 +0.14°", rel: "2 小時前", imp: { k: "aff", b: 2, a: 4 } },
    { name: "JILIN-1 GAOFEN 03D", g: "china_jilin", t: "ALT", sev: "orange", dl: "週期", dv: "+0.21", du: " 分鐘", raw: "週期 +0.21 min", rel: "5 小時前", imp: { k: "same", b: 3 } },
    { name: "GAOFEN-11 04", g: "china_gaofen", t: "SHAPE", sev: "orange", dl: "離心率", dv: "+2.1e-4", du: "", raw: "離心率 +2.1e-4", rel: "9 小時前", imp: { k: "na" } },
  ];
  const UNK = { name: "SHIYAN-6 03", g: "china_shiyan", t: "ALT", sev: "unknown", dl: "週期", dv: "—", du: "", raw: "週期 —", rel: "14 小時前", imp: { k: "calc" } };
  const CNT = { cn: 11, intl: 0, tw: 0, red: 1, orange: 2, grey: 7, unknown: 1 };

  const PULSE_CSS = `<style>@keyframes p4pulse{0%,100%{opacity:1}50%{opacity:.45}}</style>`;
  const ctrlBg = (p) => (p.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.035)");
  const solid = (p) => (p.isDark ? "rgba(10,10,20,0.94)" : "#ffffff");

  // §5.7 C2 按鈕（一般／主要／小尺寸）
  const btn = (p, text, o = {}) => {
    const pr = !!o.primary, h = o.small ? 22 : 26;
    return `<span role="button" class="nw" style="display:inline-flex;align-items:center;justify-content:center;gap:5px;height:${h}px;padding:0 ${o.small ? 8 : 10}px;border-radius:4px;border:1px solid ${pr ? p.accent : p.ctrlBorder};background:${pr ? alpha(p.accent, p.isDark ? 0.14 : 0.10) : ctrlBg(p)};color:${pr ? p.accent : p.strong};font-size:${o.small ? 10 : 11}px;font-weight:${pr ? 600 : 500};flex-shrink:0${o.full ? ";width:100%;justify-content:flex-start" : ""}">${text}</span>`;
  };
  const iconBtn = (p, title) => `<span role="button" title="${title}" aria-label="${title}" style="width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;border-radius:4px;border:1px solid ${p.ctrlBorder};background:${ctrlBg(p)};flex-shrink:0">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="${p.strong}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/></svg></span>`;
  // PanelHeader（eyebrow 版）
  const ph = (p, eyebrow, title, o = {}) => `<div style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid ${p.border}">
    ${o.back ? `<span role="button" title="返回衛星情報" style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;flex-shrink:0;transform:rotate(180deg)">${PK.icon.chev(p.muted)}</span>` : ""}
    <div style="flex:1;min-width:0"><div style="color:${p.dim};font-size:9px;letter-spacing:1.4px;line-height:1.3">${eyebrow}</div>
    <h2 class="ell" style="margin:1px 0 0;color:${p.strong};font-size:13px;font-weight:700;line-height:1.4">${title}</h2></div>
    <span title="關閉${title}" style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;flex-shrink:0">${PK.icon.x(p.muted)}</span></div>`;
  const dot = (c, s = 7) => `<span style="width:${s}px;height:${s}px;border-radius:50%;background:${c};flex-shrink:0;display:inline-block"></span>`;
  // legendKit 色票
  const swDot = (p, c) => `<span style="width:10px;height:10px;border-radius:50%;background:${c};opacity:.9;box-shadow:0 0 0 1px ${p.isDark ? "#10121a" : "#fff"};flex-shrink:0"></span>`;
  const swSq = (c) => `<span style="width:12px;height:10px;border-radius:2px;background:${alpha(c, 0.22)};border:1px solid ${alpha(c, 0.75)};flex-shrink:0"></span>`;
  const swLine = (c) => `<span style="width:20px;height:2px;border-radius:1px;background:${c};flex-shrink:0"></span>`;
  const lgItem = (sw, t) => `<span class="nw" style="display:inline-flex;align-items:center;gap:6px">${sw}${t}</span>`;
  const legend = (p, o = {}) => `<div style="display:flex;flex-wrap:wrap;gap:4px 12px;font-size:10px;color:${p.muted}">
    ${lgItem(swLine(OR), "變軌前軌跡")}${lgItem(swLine(BL), "變軌後軌跡")}${o.noRegion ? "" : lgItem(swSq(p.live), "新增覆蓋") + lgItem(swSq(p.err), "失去覆蓋")}${lgItem(swDot(p, BL), "台灣")}</div>`;

  // ════════════ 警報區 ════════════
  // ── 現況（HEAD，只有暗色） ──
  function curCard(p, m, compact) {
    const s = CUR_SEV[m.sev], t = TYPE[m.t], gc = PK.SAT[m.g];
    const imp = m.imp.k === "aff" ? `<span style="padding:${compact ? "1px 6px" : "2px 7px"};border-radius:4px;background:rgba(34,197,94,0.16);border:1px solid rgba(34,197,94,0.55);font-size:10px;color:#22c55e;font-weight:600">✓ 影響 TW <span class="mono" style="font-size:9px;opacity:.8">(${m.imp.b}→${m.imp.a})</span></span>`
      : m.imp.k === "same" ? `<span style="padding:2px 7px;border-radius:4px;background:rgba(255,255,255,0.03);border:1px solid ${p.soft};font-size:10px;color:${p.faint}">過台不變 (${m.imp.b}=)</span>`
      : m.imp.k === "na" ? `<span style="padding:2px 7px;border-radius:4px;background:rgba(255,255,255,0.04);border:1px solid ${p.mid};font-size:9px;color:${p.dim}">影響 TW · 無法計算</span>`
      : `<span class="mono" style="padding:1px 6px;border-radius:4px;background:rgba(255,255,255,0.04);border:1px solid ${p.mid};font-size:9px;color:${p.dim}">計算 TW 影響中…</span>`;
    const b = (bd, c, bg, txt, sm) => `<span class="nw" style="padding:${sm ? "3px 8px" : "5px 10px"};border-radius:4px;background:${bg};border:1px solid ${bd};color:${c};font-size:${sm ? 10 : 11}px">${txt}</span>`;
    return `<div style="padding:${compact ? "5px 9px" : "9px 11px"};border-radius:6px;background:${s.soft};border:1px solid ${s.bd};display:flex;flex-direction:column;gap:${compact ? 3 : 5}px;${s.pulse && !compact ? "animation:p4pulse 1.5s ease-in-out infinite" : ""}">
      <div style="display:flex;align-items:center;gap:6px">${dot(gc)}<span style="font-size:13px">🇨🇳</span>
        <span class="ell" style="flex:1;font-size:${compact ? 11 : 12}px;font-weight:600;color:${p.strong}">${m.name}</span>
        <span class="mono" style="padding:1px 6px;border-radius:4px;background:${s.c}22;border:1px solid ${s.c}55;font-size:9px;font-weight:700;color:${s.c}">${CUR_LABEL[m.sev]}</span>
        <span class="mono" style="padding:1px 6px;border-radius:4px;background:${t.color}22;border:1px solid ${t.color}55;font-size:9px;font-weight:700;color:${t.color}">${t.icon}${t.head}</span></div>
      <div class="mono" style="display:flex;gap:8px;font-size:10px;color:${p.muted}"><span>${m.raw}</span><span style="margin-left:auto;color:${p.dim}">${m.rel}</span></div>
      <div style="display:flex;align-items:center;gap:6px">${imp}${compact ? b("rgba(100,170,255,0.35)", "#cfe4ff", "transparent", "對比", true)
        : b(p.mid, p.def, "transparent", "詳情") + b("rgba(100,170,255,0.55)", "#cfe4ff", "rgba(100,170,255,0.16)", "覆蓋變化")}</div></div>`;
  }
  function curAlert(p, o = {}) {
    const sd = (c, pulse) => `<span style="width:6px;height:6px;border-radius:50%;background:${c};display:inline-block;${pulse ? "animation:p4pulse 1.1s ease-in-out infinite" : ""}"></span>`;
    return PULSE_CSS + `<div style="padding:12px 14px;border-bottom:1px solid ${p.soft}">
      <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;margin-bottom:9px;border-radius:6px;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.45);font-size:11.5px;color:${p.strong}">
        <span style="width:7px;height:7px;border-radius:50%;background:#ef4444;box-shadow:0 0 6px #ef4444;animation:p4pulse 1.1s ease-in-out infinite"></span>
        <span class="nw" style="font-weight:600">近 24h 變軌偵測</span>
        <span class="mono nw" style="margin-left:auto;color:${p.def};letter-spacing:.3px">CN <b style="color:#ef4444">${CNT.cn}</b> / INTL <b style="color:${p.dim}">${CNT.intl}</b> / TW <b style="color:${p.dim}">${CNT.tw}</b></span></div>
      <div class="mono" style="margin-bottom:8px;font-size:9px;color:${p.faint};display:flex;align-items:center;gap:8px;flex-wrap:wrap">${sd("#ef4444", true)} 重大 ${CNT.red} ${sd("#f97316")} 注意 ${CNT.orange} ${sd("#9ca3af")} 例行 ${CNT.grey} ${sd("#9ca3af")} 無法判定 ${CNT.unknown}</div>
      <div style="display:flex;flex-direction:column;gap:6px">${EV.map((m) => curCard(p, m)).join("")}</div>
      <div style="margin-top:8px"><div style="display:flex;align-items:center;gap:6px;padding:6px 10px;border-radius:6px;background:rgba(255,255,255,0.025);border:1px dashed ${p.mid};color:${p.muted};font-size:11px">${sd("#9ca3af")}
        <span>${CNT.grey} 筆例行機動 (drift/station-keeping)、${CNT.unknown} 筆無法判定</span><span class="nw" style="margin-left:auto;color:${p.dim}">${o.open ? "▾ 收合" : "▸ 展開"}</span></div>
        ${o.open ? `<div style="margin-top:6px">${curCard(p, UNK, true)}</div>` : ""}</div></div>`;
  }

  // ── 改版後 ──
  function impText(p, m, small) {
    const fs = small ? 10 : 10;
    if (m.imp.k === "aff") return badge(p, p.warn, `台灣過境 ${num(m.imp.b)}→${num(m.imp.a)} 次`);
    if (m.imp.k === "same") return `<span class="nw" style="font-size:${fs}px;color:${p.dim}">台灣過境不變（${num(m.imp.b)} 次）</span>`;
    if (m.imp.k === "na") return `<span class="nw" style="font-size:${fs}px;color:${p.dim}">台灣過境 · 無法計算</span>`;
    return `<span class="nw" style="font-size:${fs}px;color:${p.dim}">台灣過境計算中…</span>`;
  }
  const detail = (p, m) => `<span class="nw">${m.dl} <span class="mono">${m.dv}</span>${m.du}</span>`;
  const nameBtn = (p, m, fs) => `<span role="button" class="ell" title="查看 ${m.name} 的衛星百科" style="flex:1;min-width:0;font-size:${fs}px;font-weight:600;color:${p.strong};text-decoration:underline;text-decoration-color:${p.mid};text-underline-offset:3px">${m.name}</span>`;
  function card(p, m, R, compact) {
    const sc = SEV[m.sev].c(p), t = TYPE[m.t], gc = PK.SAT[m.g];
    const sevB = badge(p, sc, SEV[m.sev].zh);
    if (R === "R3") { // 清單列：無卡片外框
      return `<div style="display:flex;align-items:flex-start;gap:8px;padding:7px 0;border-top:1px solid ${p.soft}">
        <span style="margin-top:4px">${dot(sc, 8)}</span>
        <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
          <div style="display:flex;align-items:baseline;gap:6px">${nameBtn(p, m, 12)}<span class="nw" style="font-size:10px;color:${p.dim}">${m.rel}</span></div>
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:10px;color:${p.muted}"><span class="nw">${SEV[m.sev].zh} · ${t.zh}</span>${detail(p, m)}${impText(p, m)}</div></div>
        ${iconBtn(p, "看覆蓋變化")}</div>`;
    }
    const typeB = R === "R2" ? badge(p, t.color, t.zh, "tint", { textColor: chipText(t.color, p) }) : badge(p, p.muted, t.zh, "tint");
    const wrap = R === "R2"
      ? `border-radius:6px;background:${alpha(sc, m.sev === "red" || m.sev === "orange" ? 0.08 : 0.03)};border:1px solid ${alpha(sc, m.sev === "red" || m.sev === "orange" ? 0.4 : 0.25)}`
      : `border-radius:6px;background:${ctrlBg(p)};border:1px solid ${p.soft};border-left:3px solid ${sc}`;
    return `<div style="${wrap};padding:${compact ? "6px 9px" : "8px 10px"};display:flex;flex-direction:column;gap:${compact ? 4 : 6}px">
      <div style="display:flex;align-items:center;gap:6px">${dot(gc)}${nameBtn(p, m, compact ? 11 : 12)}${sevB}${typeB}</div>
      <div style="display:flex;gap:8px;font-size:10px;color:${p.muted}">${detail(p, m)}<span class="nw" style="margin-left:auto;color:${p.dim}">${m.rel}</span></div>
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><span style="flex:1;min-width:0;display:flex">${impText(p, m)}</span>
        ${compact ? btn(p, "覆蓋變化", { small: true }) : btn(p, "詳情") + btn(p, "覆蓋變化", { primary: true })}</div></div>`;
  }
  const foldRow = (p, open) => `<div style="margin-top:8px">${btn(p, `${PK.icon.chev(p.muted, open)}<span>例行調整 ${num(CNT.grey)} 筆、無法判定 ${num(CNT.unknown)} 筆</span>`, { full: true })}</div>`;
  const countLine = (p) => {
    const c = (zh, n, hot) => `<span class="nw">${zh} <span class="mono" style="color:${n > 0 ? (hot ? p.strong : p.def) : p.dim};font-weight:${n > 0 ? 600 : 400}">${n}</span></span>`;
    return `${c("中國", CNT.cn, true)}<span style="color:${p.faint}">·</span>${c("國際", CNT.intl)}<span style="color:${p.faint}">·</span>${c("台灣", CNT.tw)}`;
  };
  const sevBadges = (p) => [badge(p, p.err, `重大 ${num(CNT.red)}`), badge(p, p.warn, `注意 ${num(CNT.orange)}`), badge(p, p.muted, `例行 ${num(CNT.grey)}`), badge(p, p.muted, `無法判定 ${num(CNT.unknown)}`)].join("");
  function summary(p, A) {
    if (A === "A2") {
      return `<div style="padding:10px 14px 0"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 10px;border-radius:6px;background:${alpha(p.err, 0.08)};border:1px solid ${alpha(p.err, 0.35)};font-size:11px;color:${p.strong}">
        ${dot(p.err)}<span class="nw" style="font-weight:600">近 24 小時變軌</span><span style="margin-left:auto;display:inline-flex;gap:6px;font-size:10px;color:${p.muted}">${countLine(p)}</span></div>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:6px 0 0;font-size:10px;color:${p.muted}">${lgItem(swDot(p, p.err), `重大 ${num(CNT.red)}`)}${lgItem(swDot(p, p.warn), `注意 ${num(CNT.orange)}`)}${lgItem(swDot(p, p.muted), `例行 ${num(CNT.grey)}`)}${lgItem(swDot(p, p.muted), `無法判定 ${num(CNT.unknown)}`)}</div></div>`;
    }
    if (A === "A3") {
      const cell = (zh, n, c) => `<div style="flex:1;min-width:0;padding:6px 8px;border-radius:6px;background:${ctrlBg(p)};border:1px solid ${p.soft}"><div class="mono" style="font-size:18px;font-weight:700;line-height:1.1;color:${n > 0 ? c : p.dim}">${n}</div><div class="nw" style="font-size:10px;color:${p.muted}">${zh}</div></div>`;
      return PK.subLabel(p, "變軌警報", `近 24 小時 · 共 ${num(CNT.cn + CNT.intl + CNT.tw)} 筆`) + `<div style="padding:4px 14px 0">
        <div style="display:flex;gap:6px">${cell("重大", CNT.red, p.err)}${cell("注意", CNT.orange, p.warn)}${cell("例行", CNT.grey, p.def)}${cell("無法判定", CNT.unknown, p.def)}</div>
        <div style="display:flex;gap:6px;padding-top:6px;font-size:10px;color:${p.muted}">${countLine(p)}</div></div>`;
    }
    // A1
    return PK.subLabel(p, "變軌警報", "近 24 小時") + `<div style="padding:4px 14px 0;display:flex;flex-direction:column;gap:6px">
      <div style="display:flex;gap:6px;font-size:10px;color:${p.muted}">${countLine(p)}</div>
      <div style="display:flex;gap:4px;flex-wrap:wrap">${sevBadges(p)}</div></div>`;
  }
  const REC = { A: "A1", R: "R1" };
  function alertBlock(p, cfg = {}) {
    const c = Object.assign({}, REC, cfg);
    const cards = c.R === "R3" ? `<div style="margin-top:8px;border-bottom:1px solid ${p.soft}">${EV.map((m) => card(p, m, "R3")).join("")}</div>`
      : `<div style="display:flex;flex-direction:column;gap:6px;margin-top:8px">${EV.map((m) => card(p, m, c.R)).join("")}</div>`;
    const unk = c.open ? `<div style="margin-top:6px">${c.R === "R3" ? card(p, UNK, "R3") : card(p, UNK, c.R, true)}</div>` : "";
    return `<div style="border-bottom:1px solid ${p.soft};padding-bottom:12px">${summary(p, c.A)}<div style="padding:0 14px">${cards}${foldRow(p, c.open)}${unk}</div></div>`;
  }
  const stubsBelow = (p) => PK.stub(p, "覆蓋統計（P3）") + PK.stub(p, "中國／國際群組（P2）");

  // ════════════ 對比彈窗 ════════════
  const px = (lon) => ((lon - 108) / 37) * 320, py = (lat) => ((35 - lat) / 30) * 260;
  const REG = { tw: [119.5, 21.8, 122.2, 25.4], luzon: [119.5, 12.5, 124.5, 18.7], okinawa: [126.5, 24, 128.8, 27.2], fujian: [116.5, 23.5, 119.6, 27.5] };
  const TRK = { before: ["M20,260 L140,0", "M95,260 L215,0", "M170,260 L290,0"], after: ["M45,260 L165,0", "M120,260 L240,0", "M195,260 L315,0", "M265,260 L320,140"] };
  function miniMap(p, side, o = {}) {
    const bg = p.isDark ? "#0b0f14" : "#f1f3f6", grid = p.isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)", neu = p.isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.20)";
    const live = o.cur ? "#22c55e" : p.live, err = o.cur ? "#ef4444" : p.err;
    const rect = (k, c, strong) => { const [w, s, e, n] = REG[k]; return `<rect x="${px(w).toFixed(1)}" y="${py(n).toFixed(1)}" width="${(px(e) - px(w)).toFixed(1)}" height="${(py(s) - py(n)).toFixed(1)}" rx="1.5" fill="${c ? alpha(c, strong ? 0.22 : 0.10) : (p.isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)")}" stroke="${c ? alpha(c, strong ? 0.75 : 0.45) : neu}"/>`; };
    const regs = side === "before" ? rect("tw") + rect("fujian") + rect("luzon", err, true) + rect("okinawa", live, false)
      : rect("tw") + rect("fujian") + rect("okinawa", live, true) + rect("luzon", err, false);
    const lines = (arr, c) => arr.map((d) => `<path d="${d}" stroke="${c}" stroke-width="1.6" fill="none" opacity=".85" stroke-linecap="round"/>`).join("");
    const trk = side === "both" ? lines(TRK.before, OR) + lines(TRK.after, BL) : lines(TRK[side], side === "before" ? OR : BL);
    let g = ""; for (let i = 0; i < 8; i++) { const x = px(108 + i * 5); g += `<line x1="${x}" y1="0" x2="${x}" y2="260" stroke="${grid}"/>`; }
    for (let i = 0; i < 7; i++) { const y = py(5 + i * 5); g += `<line x1="0" y1="${y}" x2="320" y2="${y}" stroke="${grid}"/>`; }
    const tx = px(121), ty = py(23.7);
    const lab = o.cur ? `<text x="${tx + 6}" y="${ty + 3}" font-family="ui-monospace,monospace" font-size="9" fill="${BL}">TW</text>` : `<text x="${tx + 7}" y="${ty + 3}" font-family="${PK.CJK.replace(/"/g, "'")}" font-size="9" fill="${chipText(BL, p)}">台灣</text>`;
    const size = o.fixed ? `width="320" height="260" style="flex-shrink:0;display:block;background:${bg};border:1px solid ${p.soft};border-radius:6px"` : `width="100%" style="display:block;height:auto;background:${bg};border:1px solid ${p.soft};border-radius:6px"`;
    return `<svg viewBox="0 0 320 260" ${size} role="img" aria-label="示意小地圖">${g}${regs}<circle cx="${tx}" cy="${ty}" r="4" fill="${BL}" stroke="${p.isDark ? "#fff" : "#1f2937"}" stroke-width="1"/>${lab}${trk}</svg>`;
  }
  // 現況彈窗內容（HEAD）
  function curHeadline(p) {
    const bar = (lab, v, c) => `<div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:4px"><div style="display:flex;align-items:baseline;gap:6px">
      <span class="mono" style="font-size:9px;letter-spacing:1.5px;color:${p.faint}">${lab}</span><span class="mono" style="margin-left:auto;font-size:18px;font-weight:700;color:${p.strong};line-height:1">${v}</span><span class="mono" style="font-size:10px;color:${p.dim}">次</span></div>
      <div style="height:8px;border-radius:4px;background:rgba(255,255,255,0.05);position:relative"><div style="position:absolute;left:0;top:0;bottom:0;width:${(v / 5) * 100}%;background:${c};border-radius:4px"></div></div></div>`;
    return `<div style="padding:12px 14px;border-radius:8px;background:rgba(255,255,255,0.025);border:1px solid ${p.soft}">
      <div class="mono" style="font-size:9px;letter-spacing:2px;color:${p.faint};margin-bottom:8px">OVERHEAD PASSES · 以變軌前／後軌道推算未來 7 天</div>
      <div style="display:flex;gap:16px">${bar("BEFORE", 3, "rgba(255,152,0,0.55)")}<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:70px;gap:2px">
        <span class="mono" style="font-size:22px;font-weight:800;color:${BL};line-height:1">+33%</span><span class="mono" style="font-size:10px;color:${p.muted}">↑ 增加 1 次</span></div>${bar("AFTER", 4, BL)}</div></div>`;
  }
  const curMapHead = (p, lab, c, n) => `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">${dot(c, 8)}<span class="mono ell" style="font-size:9.5px;letter-spacing:1.5px;color:${p.muted}">${lab}</span><span class="mono nw" style="margin-left:auto;font-size:10px;color:${p.def};font-weight:600">過台 ${n} 次 / 7d</span></div>`;
  const curChip = (c, t) => `<span class="nw" style="padding:2px 7px;border-radius:4px;background:${c}22;border:1px solid ${c}66;font-size:11px;color:${c}">${t}</span>`;
  function curModalHeader(p) {
    return `<div style="padding:12px 16px;border-bottom:1px solid ${p.border};display:flex;align-items:center;gap:10px">
      <span class="mono nw" style="padding:2px 8px;border-radius:4px;background:rgba(239,68,68,0.16);border:1px solid #ef444466;font-size:10px;font-weight:700;color:#ef4444;animation:p4pulse 1.1s ease-in-out infinite">↻ 軌道面變化</span>
      <span class="nw" style="font-size:13px;font-weight:700;color:${p.strong}">YAOGAN-35 01A</span><span class="mono nw" style="font-size:10px;color:${p.dim}">NORAD 49390</span>
      <span class="mono nw" style="font-size:11px;color:${p.def}">傾角 +0.14°</span>
      <span style="margin-left:auto;width:28px;height:28px;display:flex;align-items:center;justify-content:center">${PK.icon.x(p.dim)}</span></div>`;
  }
  function curModalBody(p, o = {}) {
    return `<div style="padding:14px 16px 16px">${curHeadline(p)}
      <div style="display:flex;gap:14px;margin-top:14px${o.fixed ? ";width:654px" : ""}">
        <div style="flex:1;min-width:0">${curMapHead(p, "BEFORE · 變軌前軌道推算 7 天", OR, 3)}${miniMap(p, "before", { cur: true, fixed: o.fixed })}</div>
        <div style="flex:1;min-width:0">${curMapHead(p, "AFTER · 變軌後軌道推算 7 天", BL, 4)}${miniMap(p, "after", { cur: true, fixed: o.fixed })}</div></div>
      <div style="margin-top:14px;display:flex;flex-wrap:wrap;align-items:center;gap:6px"><span class="mono" style="font-size:9px;color:${p.faint};letter-spacing:1.5px">新增覆蓋</span>${curChip("#22c55e", "<b>+</b>沖繩")}<span style="color:${p.mid}">·</span><span class="mono" style="font-size:9px;color:${p.faint};letter-spacing:1.5px">失去覆蓋</span>${curChip("#ef4444", "<b>−</b>呂宋")}</div>
      <div class="mono" style="margin-top:10px;font-size:9px;color:${p.faint}">顯示框：經度 108–145°E · 緯度 5–35°N ｜ 比對方法：前後兩條 TLE 跑 SGP4 7 天（10 min 步進），elevation&gt;10° 入境邊緣 = 1 次過台</div></div>`;
  }
  function curModal(p) {
    return `<div class="stage dk" style="padding:12px">${PULSE_CSS}<div style="background:rgba(0,0,0,0.6);border-radius:8px;padding:14px;display:flex;justify-content:center">
      <div style="width:100%;max-width:760px;background:rgba(0,0,0,0.52);border:1px solid ${p.border};border-radius:8px;color:${p.def};overflow:hidden">${curModalHeader(p)}${curModalBody(p)}</div></div></div>`;
  }
  // 改版後彈窗
  const QREC = "Q1";
  function headline(p, Q) {
    const title = `<div style="font-size:10px;color:${p.muted};margin-bottom:8px">台灣上空過境次數 · 以變軌前／後軌道推算未來 7 天</div>`;
    const delta = `<span class="nw" style="font-size:11px;color:${p.def}">增加 <span class="mono" style="font-size:18px;font-weight:700;color:${p.strong}">1</span> 次（<span class="mono">+33%</span>）</span>`;
    if (Q === "Q2") {
      return `<div>${title}<div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;font-size:11px;color:${p.muted}">
        <span class="nw">變軌前 <span class="mono" style="font-size:18px;font-weight:700;color:${p.strong}">3</span> 次</span><span style="color:${p.dim}">→</span>
        <span class="nw">變軌後 <span class="mono" style="font-size:18px;font-weight:700;color:${p.strong}">4</span> 次</span><span style="margin-left:auto">${badge(p, p.warn, `增加 ${num(1)} 次（${num("+33%")}）`)}</span></div></div>`;
    }
    if (Q === "Q3") {
      const bar = (lab, v, c) => `<div style="display:flex;align-items:center;gap:8px;font-size:10px;color:${p.muted}"><span class="nw" style="width:40px">${lab}</span>
        <span style="flex:1;height:8px;border-radius:4px;background:${ctrlBg(p)};position:relative"><span style="position:absolute;left:0;top:0;bottom:0;width:${(v / 5) * 100}%;background:${c};border-radius:4px"></span></span>
        <span class="nw" style="width:34px;text-align:right"><span class="mono" style="color:${p.strong};font-weight:600">${v}</span> 次</span></div>`;
      return `<div>${title}<div style="display:flex;gap:14px;align-items:center"><div style="flex:1;display:flex;flex-direction:column;gap:6px">${bar("變軌前", 3, OR)}${bar("變軌後", 4, BL)}</div>${delta}</div></div>`;
    }
    // Q1：HazardTrendBars 型兩柱（柱色＝軌跡色）
    const col = (lab, v, c) => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px"><span class="mono" style="font-size:10px;color:${p.def}">${v}</span>
      <span style="width:70%;height:${(v / 5) * 48}px;background:${c};border-radius:2px 2px 0 0;opacity:.9"></span></div>`;
    return `<div>${title}<div style="display:flex;gap:16px;align-items:flex-end">
      <div style="flex:0 0 150px"><div style="display:flex;align-items:flex-end;height:64px;border-bottom:1px solid ${p.mid}">${col("變軌前", 3, OR)}${col("變軌後", 4, BL)}</div>
        <div style="display:flex;font-size:10px;color:${p.dim};padding-top:3px"><span style="flex:1;text-align:center">變軌前</span><span style="flex:1;text-align:center">變軌後</span></div></div>
      <div style="padding-bottom:18px">${delta}</div></div></div>`;
  }
  const mapHead = (p, zh, n) => `<div style="display:flex;align-items:baseline;gap:6px;margin-bottom:4px;font-size:10px;color:${p.muted}"><span class="ell">${zh}</span><span class="nw" style="margin-left:auto">過境 <span class="mono" style="color:${p.strong};font-weight:600">${n}</span> 次</span></div>`;
  const regionChips = (p) => `<div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px;font-size:10px;color:${p.muted}"><span>新增覆蓋</span>${badge(p, p.live, "沖繩", "tint")}<span style="color:${p.faint}">·</span><span>失去覆蓋</span>${badge(p, p.err, "呂宋", "tint")}</div>`;
  const footnote = (p) => `<div style="font-size:9px;color:${p.dim};line-height:1.5">顯示範圍：東經 <span class="mono">108–145°</span>、北緯 <span class="mono">5–35°</span> · 以變軌前、後兩組軌道各推算 <span class="mono">7</span> 天（每 <span class="mono">10</span> 分鐘一點），仰角 <span class="mono">10°</span> 以上進入台灣上空算一次過境</div>`;
  const subline = (p) => `<div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px;font-size:10px;color:${p.dim}">${badge(p, p.err, "重大")}${badge(p, p.muted, "軌道面變化", "tint")}
    <span class="nw" style="font-size:11px;color:${p.def}">傾角 <span class="mono">+0.14°</span></span><span class="nw" title="NORAD 編號">衛星編號 <span class="mono">49390</span></span></div>`;
  function modalBody(p, o = {}) {
    const Q = o.Q || QREC, L = o.layout || "cols";
    let maps;
    if (L === "overlay") maps = `<div>${mapHead(p, "變軌前、後軌跡疊在同一張", "3 → 4")}${miniMap(p, "both")}</div>`;
    else {
      const a = `<div style="flex:1;min-width:0">${mapHead(p, "變軌前軌道", 3)}${miniMap(p, "before")}</div>`, b = `<div style="flex:1;min-width:0">${mapHead(p, "變軌後軌道", 4)}${miniMap(p, "after")}</div>`;
      maps = L === "stack" ? `<div style="display:flex;flex-direction:column;gap:10px">${a}${b}</div>` : `<div style="display:flex;gap:12px">${a}${b}</div>`;
    }
    return `<div style="padding:12px 14px 14px;display:flex;flex-direction:column;gap:12px">${subline(p)}${headline(p, Q)}${maps}${legend(p)}${regionChips(p)}${footnote(p)}</div>`;
  }
  function modalStage(p, inner, w) {
    return `<div class="stage ${p.isDark ? "dk" : "lt"}" style="padding:12px"><div style="background:rgba(0,0,0,${p.isDark ? 0.55 : 0.30});border-radius:8px;padding:14px;display:flex;justify-content:center">
      <div style="width:100%;max-width:${w}px;background:${solid(p)};border:1px solid ${p.border};border-radius:8px;box-shadow:${p.shadow};color:${p.def};overflow:hidden">${inner}</div></div></div>`;
  }
  const modal = (p, o = {}) => modalStage(p, ph(p, "變軌 · 覆蓋變化", "YAOGAN-35 01A") + modalBody(p, o), o.w || 760);

  // 手機（約 360 寬螢幕）
  function phone(p, inner, o = {}) {
    return `<div class="stage ${p.isDark ? "dk" : "lt"}" style="padding:12px"><div style="max-width:320px;height:560px;margin:0 auto;position:relative;border-radius:14px;border:1px solid ${p.mid};overflow:hidden;background:rgba(0,0,0,${p.isDark ? 0.55 : 0.30})">
      <div style="position:absolute;inset:0;display:flex;align-items:${o.sheet ? "flex-end" : "center"};justify-content:center;padding:${o.pad ?? 0}px">${inner}</div></div></div>`;
  }
  function jCur(p) {
    return phone(p, `<div style="width:100%;max-height:92%;background:rgba(0,0,0,0.52);border:1px solid ${p.border};border-radius:8px;overflow:hidden;color:${p.def}">${curModalHeader(p)}${curModalBody(p, { fixed: true })}</div>`, { pad: 24 }) + PULSE_CSS;
  }
  function jOpt(p, J) {
    if (J === "J2") {
      return phone(p, `<div style="width:92%;max-height:88%;overflow:hidden;background:${solid(p)};border:1px solid ${p.border};border-radius:8px;color:${p.def}">${ph(p, "變軌 · 覆蓋變化", "YAOGAN-35 01A")}${modalBody(p, { layout: "cols" })}</div>`);
    }
    const seg = `<div role="group" aria-label="選擇軌道" style="display:inline-flex;gap:2px;padding:2px;border-radius:5px;border:1px solid ${p.ctrlBorder};background:${ctrlBg(p)}">
      <span aria-pressed="true" style="padding:3px 10px;border-radius:3px;background:${alpha(p.accent, p.isDark ? 0.14 : 0.10)};color:${p.accent};font-size:11px;font-weight:600">變軌前</span><span aria-pressed="false" style="padding:3px 10px;border-radius:3px;color:${p.muted};font-size:11px">變軌後</span></div>`;
    const body = J === "J3"
      ? `<div style="padding:12px 14px;display:flex;flex-direction:column;gap:12px">${subline(p)}${headline(p, QREC)}<div>${seg}</div><div>${mapHead(p, "變軌前軌道", 3)}${miniMap(p, "before")}</div>${legend(p)}</div>`
      : modalBody(p, { layout: "stack" });
    return phone(p, `<div style="width:100%;height:92%;overflow:hidden;background:${solid(p)};border-top:1px solid ${p.border};border-radius:16px 16px 0 0;color:${p.def}">${ph(p, "變軌 · 覆蓋變化", "YAOGAN-35 01A")}${body}</div>`, { sheet: true });
  }

  // ════════════ 衛星百科卡 ════════════
  function curDetail(p) {
    const sec = (t, inner) => `<div style="margin-bottom:10px"><div class="mono" style="font-size:9px;letter-spacing:1.5px;color:${p.faint};margin-bottom:4px;padding-bottom:3px;border-bottom:1px solid ${p.soft}">${t}</div>${inner}</div>`;
    const row = (l, v) => `<div style="display:flex;gap:8px;font-size:11px;padding:2px 0"><span style="width:70px;color:${p.dim};flex-shrink:0">${l}</span><span style="color:${p.def};flex:1">${v}</span></div>`;
    const ev = (t, d, x) => { const T = TYPE[t]; return `<div style="display:flex;align-items:center;gap:8px;font-size:11px"><span class="mono" style="color:${T.color};width:16px">${T.icon}</span><span class="mono" style="font-size:10.5px;color:${p.muted};width:78px">${d}</span><span class="mono" style="font-size:9.5px;color:${T.color};width:50px">${T.head}</span><span class="mono" style="font-size:10px;color:${p.def}">${x}</span></div>`; };
    return `<div style="width:100%;max-width:380px;background:${p.panel};border:1px solid ${p.border};border-radius:8px;box-shadow:${p.shadow};color:${p.def};overflow:hidden">
      <div style="padding:11px 14px 9px;border-bottom:1px solid ${p.border};display:flex;align-items:center;gap:8px"><div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:700;color:${p.strong}">YAOGAN-35 01A</div><div class="mono" style="font-size:10px;color:${p.dim};margin-top:2px">NORAD 49390 · COSPAR 2021-099A</div></div>
        <span title="close" style="width:24px;height:24px;display:flex;align-items:center;justify-content:center">${PK.icon.x(p.dim)}</span></div>
      <div style="padding:11px 14px 14px">
        ${sec("操作方／用途", row("國家", "🇨🇳 中國") + row("運營商", "Chinese Academy of Sciences") + row("用途", "Earth Observation") + row("用戶", "Military"))}
        ${sec("發射", row("日期", "2021-11-03") + row("場地", "Xichang Satellite Launch Center") + row("火箭", "Long March 2D") + row("製造", "—") + row("已運作", "4 年 11 個月"))}
        ${sec("軌道", row("參數", "LEO · 492 × 500 km · 35.0° · 94.5 min"))}
        ${sec("變軌歷史 · 近 30 天（5 筆）", `<div style="display:flex;flex-direction:column;gap:4px">${ev("PLANE", "2026-10-04", "傾角 +0.14°")}${ev("ALT", "2026-09-21", "週期 +0.08 min")}${ev("ALT", "2026-09-07", "週期 −0.11 min")}</div>`)}
        ${sec("依歷史間隔估算", `<div style="padding:8px 10px;border-radius:6px;background:rgba(100,170,255,0.08);border:1px solid rgba(100,170,255,0.25)">
          <div style="display:flex;align-items:baseline;gap:8px"><span style="font-size:10px;color:${p.muted}">下次變軌約</span><span class="mono" style="font-size:18px;font-weight:700;color:#cfe4ff">12–18</span><span style="font-size:10px;color:${p.muted}">天內</span><span style="margin-left:auto;font-size:10px;color:${p.muted}">依歷史間隔估算</span></div>
          <div class="mono" style="margin-top:5px;font-size:9.5px;color:${p.faint}">μ = 14.2d · σ = 3.1d · n = 4</div>
          <div style="margin-top:6px;position:relative;height:6px;border-radius:4px;background:rgba(255,255,255,0.08)"><div style="position:absolute;left:40%;width:20%;height:100%;border-radius:4px;background:rgba(100,170,255,0.5)"></div></div>
          <div style="margin-top:6px;font-size:9.5px;color:${p.faint}">⚠ 估算 · 非精準預測 · 依歷史軌道資料中的變軌間隔推算</div></div>`)}
        <div class="mono" style="margin-top:10px;font-size:9px;color:${p.faint}">來源：UCS 衛星資料庫 · 歷史軌道資料</div></div></div>`;
  }
  // shared Row：null 不渲染、標籤 10px muted minWidth 56、列間細線
  const fiRows = (p, rows) => rows.filter((r) => r && r[1]).map((r, i) => `<div style="display:flex;gap:8px;padding:3px 0;font-size:11px;line-height:1.3;${i ? `border-top:1px solid ${p.soft}` : ""}">
    <span style="color:${p.muted};flex-shrink:0;min-width:56px;font-size:10px">${r[0]}</span><span style="color:${r[2] || p.strong};word-break:break-word"${r[3] ? ` title="${r[3]}"` : ""}>${r[1]}</span></div>`).join("");
  const alt = (p, zh, en) => `${zh} <span style="font-size:10px;color:${p.dim}">${en}</span>`;
  const srcFooter = (p, org, fetched) => `<div style="margin-top:10px;padding-top:8px;border-top:1px solid ${p.soft};font-size:9px;color:${p.dim};line-height:1.5"><div>${org} · <span style="color:${p.link}">原始下載頁 ↗</span></div><div class="mono">${fetched}</div></div>`;
  function detailBody(p) {
    const sec = (t, inner, tr) => `<div style="margin:0 -14px">${PK.subLabel(p, t, tr)}</div><div style="padding:2px 0 4px">${inner}</div>`;
    const ev = (t, d, dl, dv) => `<div style="display:flex;align-items:center;gap:8px;padding:3px 0;font-size:11px;border-top:1px solid ${p.soft}"><span class="mono" style="font-size:10px;color:${p.muted};width:44px">${d}</span>${badge(p, p.muted, TYPE[t].zh, "tint")}<span class="nw" style="color:${p.def}">${dl} <span class="mono">${dv}</span></span></div>`;
    return `<div style="padding:8px 14px 14px">
      <div style="font-size:10px;color:${p.dim}"><span title="NORAD 編號">衛星編號 <span class="mono">49390</span></span> · <span title="COSPAR 編號">國際編號 <span class="mono">2021-099A</span></span></div>
      ${sec("操作方與用途", fiRows(p, [["國家", "中國"], ["運營商", alt(p, "中國科學院", "Chinese Academy of Sciences")], ["用途", alt(p, "對地觀測", "Earth Observation")], ["用戶", alt(p, "軍用", "Military")]]))}
      ${sec("發射", fiRows(p, [["日期", `<span class="mono">2021-11-03</span>`], ["場地", alt(p, "西昌衛星發射中心", "Xichang")], ["火箭", alt(p, "長征二號丁", "Long March 2D")], ["製造", null], ["已運作", `<span class="mono">4</span> 年 <span class="mono">11</span> 個月`]]))}
      ${sec("軌道", fiRows(p, [["類型", "低軌道"], ["高度", `<span class="mono">492 × 500</span> km`], ["傾角", `<span class="mono">35.0°</span>`], ["週期", `<span class="mono">94.5</span> 分鐘`]]))}
      ${sec("變軌歷史", `<div style="margin-top:-1px">${ev("PLANE", "10/04", "傾角", "+0.14°")}${ev("ALT", "09/21", "週期", "+0.08 分鐘")}${ev("ALT", "09/07", "週期", "−0.11 分鐘")}</div>`, `近 30 天 ${num(5)} 筆`)}
      ${sec("下次變軌", `<div style="font-size:11px;color:${p.def}">約 <span class="mono" style="font-size:13px;font-weight:700;color:${p.strong}">12–18</span> 天內</div>
        <div style="margin-top:3px;font-size:10px;color:${p.dim};line-height:1.5">依歷史間隔估算：近 30 天 ${num(5)} 次變軌、平均間隔 ${num(14)} 天 · 非精準預測</div>`)}
      ${srcFooter(p, "UCS 衛星資料庫 · 歷史軌道資料（Space-Track）", "抓取於 10/04 13:20")}</div>`;
  }
  const detailCard = (p, w) => `<div style="width:100%;max-width:${w || 380}px;background:${p.panel};border:1px solid ${p.border};border-radius:8px;box-shadow:${p.shadow};color:${p.def};overflow:hidden">${ph(p, "衛星百科", "YAOGAN-35 01A")}${detailBody(p)}</div>`;
  const miniPanel = (p) => `<div style="flex:0 0 38%;min-width:0;background:${p.panel};border:1px solid ${p.border};border-radius:8px;box-shadow:${p.shadow};overflow:hidden;color:${p.def}">${PK.p1Header(p, { maneuvers: 11 })}${PK.stub(p, "衛星情報面板（縮略）")}${PK.stub(p, "變軌警報")}${PK.stub(p, "群組清單")}</div>`;
  function uOpt(p, U) {
    const st = `class="stage ${p.isDark ? "dk" : "lt"}"`;
    if (U === "U2") {
      return PK.shell(p, ph(p, "衛星情報 · 衛星百科", "YAOGAN-35 01A", { back: true }) + detailBody(p));
    }
    if (U === "U3") {
      return `<div ${st} style="position:relative;min-height:620px">${miniPanel(p).replace("flex:0 0 38%", "position:absolute;left:12px;top:12px;width:38%;max-height:596px")}
        <div style="position:absolute;right:12px;bottom:12px;width:min(280px,55%);max-height:520px;overflow:hidden;background:${p.panel};border:1px solid ${p.isDark ? "rgba(100,170,255,0.25)" : p.border};border-radius:8px;box-shadow:${p.shadow};color:${p.def}">
          <div style="padding:12px 14px 0;display:flex;align-items:center"><span style="flex:1;font-size:9px;color:${p.dim};letter-spacing:1.2px">衛星 · 衛星百科</span>${PK.icon.x(p.muted)}</div>
          <div style="padding:6px 14px 0">${popTitle(p, PK.SAT.china_yaogan, "YAOGAN-35 01A")}</div><div style="margin-top:-8px">${detailBody(p)}</div></div></div>`;
    }
    return `<div ${st}><div style="display:flex;gap:8px;align-items:flex-start">${miniPanel(p)}<div style="flex:1;min-width:0">${detailCard(p)}</div></div></div>`;
  }

  // ════════════ 地圖 popup ════════════
  const popTitle = (p, c, name) => `<div style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:700;color:${p.strong};border-bottom:1px solid ${p.border};padding-bottom:5px;margin-bottom:4px"><span style="width:9px;height:9px;border-radius:50%;background:${c};flex-shrink:0"></span>${name}</div>`;
  const popFrame = (p, inner) => `<div class="stage ${p.isDark ? "dk" : "lt"}"><div style="margin-left:auto;width:100%;max-width:280px;background:${p.panel};border:1px solid ${p.isDark ? "rgba(100,170,255,0.25)" : p.border};border-radius:8px;padding:12px 14px;box-shadow:${p.shadow};color:${p.def};position:relative">
    <span style="position:absolute;top:8px;right:8px">${PK.icon.x(p.muted)}</span><div style="font-size:9px;color:${p.dim};letter-spacing:1.2px;margin-bottom:6px">衛星</div>${inner}</div></div>`;
  const POP_SRC = "Space-Track（TLE）· UCS 衛星資料庫（分類）";
  const footNote = (p) => `<div style="margin-top:6px;font-size:10px;color:${p.dim}">足跡：內圈 50 km 掃描寬度／外圈 1,500 km 仰角 ≥10° 可見範圍</div>`;
  function popCur(p) {
    const c = PK.SAT.usa;
    return popFrame(p, `<div style="font-weight:700;color:${c};font-size:13px">USA 338</div>${fiRows(p, [["類別", "🇺🇸 美國偵察", c], ["NORAD", "59001"], ["高度", "512 km"]])}${footNote(p)}${srcFooter(p, POP_SRC, "2026-10-04 13:20（台灣時間）")}`);
  }
  function popOpt(p, O) {
    const c = PK.SAT.usa;
    const rows = fiRows(p, [["類別", "美國偵察"], ["編號", `<span class="mono">59001</span>`, null, "NORAD 編號"], ["高度", `<span class="mono">512</span> km`],
      O === "O3" ? ["近期", badge(p, p.err, "近 24 小時變軌")] : null]);
    const act = O === "O2" ? "" : `<div style="margin-top:8px">${btn(p, "查看衛星百科", { small: true })}</div>`;
    return popFrame(p, popTitle(p, c, "USA 338") + rows + `<div style="margin-top:6px;font-size:10px;color:${p.dim}">足跡：內圈 <span class="mono">50</span> km 掃描寬度、外圈 <span class="mono">1,500</span> km 可見範圍（仰角 <span class="mono">≥10°</span>）</div>` + act + srcFooter(p, POP_SRC, "2026-10-04 13:20（台灣時間）"));
  }

  // ════════════ 歷史模式 ════════════
  const histHeader = (p, keepNote) => { const h = PK.p1Header(p, { history: true }); return keepNote ? h : h.replace("變軌警報固定看近 24 小時", ""); };
  function zOpt(p, Z) {
    if (Z === "Z1") {
      const note = `<div style="margin:4px 14px 0;padding:8px 10px;border-radius:6px;background:${alpha(p.warn, 0.08)};border:1px solid ${p.warnBorder};font-size:10px;line-height:1.6;color:${p.def}">
        時間軸在過去（<span class="mono">12:17</span>），變軌警報<b>只有「現在」的近 24 小時</b>，不會跟著時間軸。</div>
        <div style="padding:8px 14px 12px">${btn(p, `${PK.icon.chev(p.muted)}<span>仍顯示現在的變軌警報（${num(11)} 筆）</span>`, { full: true })}</div>`;
      return PK.shell(p, histHeader(p, true) + PK.subLabel(p, "變軌警報", "現在近 24 小時") + note + stubsBelow(p), { history: true });
    }
    if (Z === "Z2") {
      return PK.shell(p, histHeader(p, true) + PK.subLabel(p, "變軌警報") + PK.stub(p, "做不到可用的版本：現有 RPC 只算「現在往前 N 小時」，<br>MV 每顆衛星只留最新一筆，過去的變軌已被覆蓋（見說明）") + stubsBelow(p), { history: true });
    }
    // Z3
    const past = `<div style="padding:0 14px 12px"><div style="display:flex;flex-direction:column;gap:6px;margin-top:6px">${card(p, Object.assign({}, EV[1], { rel: "10/04 07:40" }), "R1")}</div></div>`;
    const old = `<div style="margin:4px 14px 12px;padding:8px 10px;border-radius:6px;border:1px dashed ${p.mid};font-size:10px;color:${p.muted}">（另一狀態示意）時間軸在 <span class="mono">30</span> 天前以前：歷史軌道資料只保留 <span class="mono">30</span> 天，這段時間無法推算變軌</div>`;
    return PK.shell(p, histHeader(p, false) + PK.subLabel(p, "變軌警報", `10/04 <span class="mono">12:17</span> 前 24 小時`) + `<div style="padding:4px 14px 0;display:flex;gap:4px;flex-wrap:wrap">${badge(p, p.warn, `注意 ${num(1)}`)}${badge(p, p.muted, `例行 ${num(4)}`)}</div>` + past + old + stubsBelow(p), { history: true });
  }

  // ════════════ 註冊 ════════════
  PK.registerPhase({
    id: "P4",
    title: "變軌警報、對比彈窗、百科卡、地圖 popup",
    intro: `<p>範圍：面板裡的變軌警報區、「覆蓋變化」對比彈窗、點衛星名開的衛星百科卡、點地圖衛星的 popup，以及時間軸拉到過去時變軌清單怎麼辦（README 決策 #4）。現況照 HEAD 程式碼畫（P-D 已實作後），只有暗色；地圖 popup 本來就有淡色，所以現況暗淡並排。顆數、時間、衛星名為示意。</p>
      <p><b>README 對照表 A 有幾項 P-D 已經做掉</b>，下面不再出題：popup 足跡說明已是中文、已掛 <code>SourceFooter</code>；彈窗與百科卡的錯誤文字已分態、不再印表名；彈窗已寫「以變軌前／後軌道推算未來 7 天」；百科卡預測已拿掉信心百分比，事件少於 4 筆不顯示。<b>仍待 P4 處理</b>：警報區 CN／INTL／TW、PLANE／ALT、整張卡閃爍、「影響 TW」綠色、橘色 <code>#f97316</code> 不是 token、衛星名是 <code>&lt;span onClick&gt;</code>；彈窗 760 寬、底 <code>SURFACE.panel</code>、z 100、無 Esc、無手機版、SVG 寫死 320×260、BEFORE／AFTER／OVERHEAD PASSES、等寬說明；百科卡手刻標頭、等寬區段標題、Row 印「—」、μ σ n 與手刻 bar、國旗 emoji；popup 手寫標題、類別帶 emoji、「NORAD」欄名。</p>
      <p><b>每題只變一個項目，其他用建議值畫</b>（A1＋R1＋D1＋Q1＋J1＋U1＋O1＋Z3）。卡片上的國旗 emoji 跟 P2 G 題走（G1＝拿掉，只留群組色點）；群組與類別名稱跟 P2 N 題走。</p>`,
    overview: {
      cur: (p) => PK.p1Panel(p, curAlert(p) + stubsBelow(p), { maneuvers: 11 }),
      rec: (p) => PK.p1Panel(p, alertBlock(p) + stubsBelow(p), { maneuvers: 11 }),
    },
    questions: [
      { k: "A", t: "警報區摘要列",
        note: `現況是一塊紅底紅框的橫幅「近 24h 變軌偵測」，右邊等寬的「CN 11 / INTL 0 / TW 0」，下一行等寬的嚴重度計數，紅點一直閃。問題：英文代碼（§6.1）、中文落等寬（§4.1）、字級 11.5（§3.13）、國際數大於 0 時用綠色 <code>#22c55e</code>（§3.5 綠＝正常，變軌不是正常）。另外 P1 標頭狀態列已有「變軌 11」徽章（B1），橫幅再寫一次總數是重複的。三個選項都不閃、計數都是中文＋等寬數字。`,
        cur: (p) => PK.curShell(curAlert(p)),
        opts: [
          { c: "A1", d: "區段標題「變軌警報 · 近 24 小時」（與其他區段同一種）＋一行國別計數＋嚴重度 chipOutline 徽章；不再有紅色橫幅，總數只留在標頭", spec: "§5.5 SubGroupLabel（P1 T1）、§5.21 chipOutline、§6.1", rec: true,
            f: (p) => PK.shell(p, alertBlock(p, { A: "A1" })) },
          { c: "A2", d: "保留橫幅但改 token 淡紅底、不閃；嚴重度改成圖例式色點列（legendKit SwatchDot）", spec: "§3.5、§5.32 色票（橫幅本身不在 spec 元件清單）",
            f: (p) => PK.shell(p, alertBlock(p, { A: "A2" })) },
          { c: "A3", d: "區段標題＋四格嚴重度數字（重大／注意／例行／無法判定），國別放下一行；最醒目但佔高度約多 40px", spec: "§5.5、§6.2（四格是本面板自刻，非 MonitorKpis：那是監看 S13 字級）",
            f: (p) => PK.shell(p, alertBlock(p, { A: "A3" })) },
        ] },
      { k: "R", t: "變軌卡",
        note: `現況：整張卡依嚴重度上底色，重大卡<b>整張呼吸閃爍</b>；國旗 emoji；嚴重度與類型兩個 chip 都是等寬粗體，類型印「↻PLANE／⬆ALT／◓SHAPE」；類型色（紅／橘／黃）和嚴重度色（紅／橘）<b>撞色</b>，相鄰兩個 chip 同色卻是不同意思；「✓ 影響 TW」用綠色；按鈕高度不固定、主要鈕自訂 <code>#cfe4ff</code>；衛星名是可點的 <code>&lt;span&gt;</code>（鍵盤點不到）。示意含展開後的「無法判定」小卡。<br>「影響 TW」改寫成「台灣過境 2→4 次／台灣過境不變（3 次）／台灣過境 · 無法計算／台灣過境計算中…」（各選項相同）；有變化用警示色 chipOutline。類型文字用 <code>MANEUVER_TOKEN.zh</code>。`,
        cur: (p) => PK.curShell(curAlert(p, { open: true })),
        opts: [
          { c: "R1", d: "中性卡（CONTROL 底）＋左側 3px 嚴重度色條；嚴重度 chipOutline 有色、類型 chipTint 中性灰，顏色只代表嚴重度；C2 按鈕（覆蓋變化＝主要）", spec: "§5.27 卡片「左側 3px 色條」、§5.21、§5.7、§3.5", rec: true,
            f: (p) => PK.shell(p, alertBlock(p, { R: "R1", open: true })) },
          { c: "R2", d: "保留整張淡底上色（改 token、不閃）；類型 chip 保留類型色（撞色仍在）", spec: "§3.5、§5.21（§5.35 G2「不改卡底」只約束監看卡）",
            f: (p) => PK.shell(p, alertBlock(p, { R: "R2", open: true })) },
          { c: "R3", d: "不用卡片，改清單列：嚴重度色點＋名稱（點名稱＝詳情）＋右側圖示鈕「看覆蓋變化」；最省高度，但「覆蓋變化」只剩圖示", spec: "§5.7 圖示鈕須有 title／aria-label",
            f: (p) => PK.shell(p, alertBlock(p, { R: "R3", open: true })) },
        ] },
      { k: "D", t: "對比彈窗版面",
        note: `現況：寬 760、底 <code>SURFACE.panel</code>（半透明 0.52，§3.1 新面板不要用）、z 100、手刻標頭（類型 chip 一直閃、「NORAD 49390」、關閉鈕 28×28 沒有 aria-label）、沒有 Esc。三個選項共同：§5.27 置中視窗——<code>Z_INDEX.modal</code>、<code>SURFACE.solid</code>、PanelHeader 式標頭（eyebrow「變軌 · 覆蓋變化」＋衛星名，24×24 關閉鈕）、Esc 關閉、點遮罩關閉；標頭下一行放嚴重度、類型、變化量、衛星編號。§5.27 的寬度 <code>min(920px, 92vw)</code> 是寫給說明視窗的，這個彈窗的寬度要另外定。圖表用 Q 題建議（Q1）畫。`,
        cur: (p) => curModal(p),
        opts: [
          { c: "D1", d: "前後兩欄並排，寬 min(760px, 92vw)；左右對照最直接", spec: "§5.27（寬度沿用現況 760）", rec: true, f: (p) => modal(p, { layout: "cols", w: 760 }) },
          { c: "D2", d: "上下兩張，寬 min(520px, 92vw)；比較要捲動，但地圖較大、窄螢幕也同一版面", spec: "§5.27", f: (p) => modal(p, { layout: "stack", w: 520 }) },
          { c: "D3", d: "一張地圖疊兩條軌跡（橘＝前、藍＝後），寬 min(560px, 92vw)；最省空間，但新增／失去覆蓋的框只能畫一組", spec: "§5.27、§5.32 圖例", f: (p) => modal(p, { layout: "overlay", w: 560 }) },
        ] },
      { k: "Q", t: "彈窗圖表與用字",
        note: `現況：「OVERHEAD PASSES」「BEFORE／AFTER」英文大寫加字距、全部等寬（含中文）、大字 22px 字重 800、手刻橫條；小地圖上綠／紅框和橘／藍軌跡<b>沒有圖例</b>。三個選項共同：標題改「台灣上空過境次數 · 以變軌前／後軌道推算未來 7 天」、欄名「變軌前／變軌後」、補一行 legendKit 圖例（SwatchLine 軌跡、SwatchSquare 覆蓋、SwatchDot 台灣），地圖上「TW」改「台灣」。只示意彈窗內容區。`,
        cur: (p) => PK.curShell(curModalBody(p)),
        opts: [
          { c: "Q1", d: "兩根直柱（HazardTrendBars 型，柱色＝軌跡色）＋右側「增加 1 次（+33%）」", spec: "README 對照表 A「圖用 HazardTrendBars」；但它是時間序列計數圖，只放兩根是借用，§5.35 E3 也只約束監看卡", rec: true,
            f: (p) => PK.shell(p, `<div style="padding:12px 14px;display:flex;flex-direction:column;gap:12px">${headline(p, "Q1")}<div style="display:flex;gap:12px"><div style="flex:1;min-width:0">${mapHead(p, "變軌前軌道", 3)}${miniMap(p, "before")}</div><div style="flex:1;min-width:0">${mapHead(p, "變軌後軌道", 4)}${miniMap(p, "after")}</div></div>${legend(p)}</div>`) },
          { c: "Q2", d: "不畫柱，只寫「變軌前 3 次 → 變軌後 4 次」＋徽章「增加 1 次（+33%）」；兩個數字用文字最清楚", spec: "§6.2、§5.21",
            f: (p) => PK.shell(p, `<div style="padding:12px 14px;display:flex;flex-direction:column;gap:12px">${headline(p, "Q2")}<div style="display:flex;gap:12px"><div style="flex:1;min-width:0">${mapHead(p, "變軌前軌道", 3)}${miniMap(p, "before")}</div><div style="flex:1;min-width:0">${mapHead(p, "變軌後軌道", 4)}${miniMap(p, "after")}</div></div>${legend(p)}</div>`) },
          { c: "Q3", d: "保留橫條（改 token、中文、柱色＝軌跡色），仍是手刻", spec: "§3.13、§6.1（手刻柱，偏離 §5.35 E3 精神）",
            f: (p) => PK.shell(p, `<div style="padding:12px 14px;display:flex;flex-direction:column;gap:12px">${headline(p, "Q3")}<div style="display:flex;gap:12px"><div style="flex:1;min-width:0">${mapHead(p, "變軌前軌道", 3)}${miniMap(p, "before")}</div><div style="flex:1;min-width:0">${mapHead(p, "變軌後軌道", 4)}${miniMap(p, "after")}</div></div>${legend(p)}</div>`) },
        ] },
      { k: "J", t: "彈窗在手機上",
        note: `現況沒有手機分支：遮罩內距 24、兩張地圖寫死 320px 並排（共 654px），手機上右邊整張被切掉（現況示意即此）。範本是說明視窗 <code>InfoModal</code> 的 <code>isMobile</code>：<code>100vw × 92vh</code> 由下緣出現、上緣圓角 16。示意為約 360px 寬的手機。`,
        cur: (p) => jCur(p),
        opts: [
          { c: "J1", d: "底部 sheet（100vw × 92vh），兩張地圖上下排、寬度隨螢幕", spec: "§5.27 手機（同 InfoModal）", rec: true, f: (p) => jOpt(p, "J1") },
          { c: "J2", d: "仍置中、寬 92vw，兩張地圖並排縮小（每張約 140px 寬，看不太清楚）", spec: "§5.27 桌機寫法套到手機", f: (p) => jOpt(p, "J2") },
          { c: "J3", d: "底部 sheet＋分段控制「變軌前／變軌後」切換同一張地圖", spec: "§5.27 手機、§5.8 分段控制", f: (p) => jOpt(p, "J3") },
        ] },
      { k: "U", t: "衛星百科卡：放哪裡",
        note: `內容各選項相同（照規則改）：PanelHeader（eyebrow「衛星百科」）；「NORAD／COSPAR」改「衛星編號／國際編號」，英文名放 tooltip；區段標題用 SubGroupLabel（不再等寬）；欄位改 popup 的共用 <code>Row</code>（null 不渲染，不再印「—」；<code>useFeatureTheme</code> 沒包 Provider 時預設暗色，淡色要 P5 包 Provider）；UCS 英文原值加中文、英文小字附註（中譯為示意，實作需對照表）；國家去 emoji；來源改 F2。<br>現況卡寬 380、寫死 <code>left: 64+412+8</code> 貼在面板右邊（z 35）。這題選位置。`,
        cur: (p) => `<div class="stage dk">${curDetail(p)}</div>`,
        opts: [
          { c: "U1", d: "維持貼在面板右邊並排（位置改引用 PANEL_WIDTH／LAYOUT 常數）；面板與百科同時看得到", spec: "§5.1、§5.2 Row、§5.3", rec: true, f: (p) => uOpt(p, "U1") },
          { c: "U2", d: "在面板裡換頁（標頭左側「返回」），不另開卡；不擋地圖，手機也可用，但看百科時看不到警報清單", spec: "§5.1（返回鈕為新增樣式）", f: (p) => uOpt(p, "U2") },
          { c: "U3", d: "放進右下停靠 popup（§5.2），點地圖衛星與點面板衛星名都開同一個地方，順便解決「popup 與百科卡不相通」", spec: "§5.2 停靠 popup", shared: "要改 FeatureInfoPanel：讓非地圖圖徵（面板點名）也能開 popup，且 popup 內容變長（需 PopupScroll）；O 題的「查看衛星百科」鈕就不需要", f: (p) => uOpt(p, "U3") },
        ] },
      { k: "O", t: "地圖 popup",
        note: `現況（P-D 後）：標題是手寫 div（類別色字、沒有色點與底線，淡色時淺藍字對白底對比不足）；類別「🇺🇸 美國偵察」帶 emoji；欄名「NORAD」；足跡說明與來源 footer 已是中文。三個選項共同：改共用 <code>Title</code>（色點＋底線）、類別去 emoji、「NORAD」改「編號」（英文放 tooltip，§6.3）、數字等寬。eyebrow「衛星」是推測（衛星圖層 key 不在 THEMES 時退回 HEADER_LABELS），以實機為準。`,
        curLight: true,
        cur: (p) => popCur(p),
        opts: [
          { c: "O1", d: "共用 Title＋中文欄位＋小按鈕「查看衛星百科」（點地圖衛星也能開百科卡）", spec: "§5.2、§5.7 小尺寸按鈕", rec: true,
            shared: "類別名來自 SATELLITE_LABELS，圖例（LegendPanel）也在用；去 emoji 會一起改到圖例",
            f: (p) => popOpt(p, "O1") },
          { c: "O2", d: "只改 Title 與中文，不加按鈕（popup 與百科卡仍不相通）", spec: "§5.2",
            shared: "同 O1（SATELLITE_LABELS 與圖例共用）", f: (p) => popOpt(p, "O2") },
          { c: "O3", d: "O1＋這顆在近 24 小時變軌清單內時多一列「近期 · 近 24 小時變軌」", spec: "§5.2、§5.21 chipOutline",
            shared: "同 O1；另外 popup 要讀 App 層變軌狀態", f: (p) => popOpt(p, "O3") },
        ] },
      { k: "Z", t: "時間軸拉到過去時的變軌清單",
        note: `README 決策 #4：使用者要清單<b>跟著時間軸走</b>，作法待定。現況：歷史模式面板有橘框，標頭寫「變軌警報固定看近 24 小時」，清單仍是真實現在的 24 小時。<b>查到的事實</b>（gis-platform <code>migrations/</code>，只讀）：<br>
          ① <code>get_satellite_maneuvers_recent(p_hours)</code> 只有 <code>p_hours</code>，條件寫死 <code>curr_fetched_at &gt; NOW() - p_hours</code>（169、171），沒有時間錨點參數。<br>
          ② 它讀的 MV <code>satellite_maneuvers</code> <b>每顆衛星只有一列</b>（<code>norad_id</code> 唯一索引），內容是「最新一筆與前一筆 TLE 的差」（401）。不是事件紀錄：之後再來一筆沒變化的 TLE，過去那次變軌就被蓋掉。所以就算加錨點參數，這個 MV 也查不到過去。也代表現在的「近 24 小時」其實是「最近一次 TLE 更新在 24 小時內且有變化」。<br>
          ③ 唯一能看過去的是逐顆的 <code>get_satellite_tle_history(p_norad, p_days)</code>（312），也是從 NOW 往前算。<br>
          ④ 歷史軌道表 <code>live.satellite_tle_history</code> 只保留 30 天（282），約 2.3 GB；這張表的 MV 刷新是 2026-09-04 Disk IO 事故的來源之一（401）。<br>
          註：401 檔頭寫明是先在正式庫直接執行、事後補檔，repo 與正式庫一致性只確認到 2026-09-04。`,
        cur: (p) => PK.p1Panel(p, curAlert(p) + stubsBelow(p), { history: true, maneuvers: 11 }),
        opts: [
          { c: "Z1", d: "純前端：歷史模式時清單收起，顯示一行提示「變軌警報只有現在的近 24 小時」，可點開看現在的清單。馬上能做、不碰資料庫，但<b>沒有跟著時間軸走</b>（不符決策 #4）", spec: "§6.4 時間基準要一致",
            f: (p) => zOpt(p, "Z1") },
          { c: "Z2", d: "純前端以時間軸重查：<b>做不到可用的版本</b>。現有 RPC 沒錨點、MV 沒有過去；只能對每顆衛星各打一次 get_satellite_tle_history 再在前端算（數百次請求、每拉一次時間軸重打），不建議", spec: "—（列出來說明為何不可行）",
            f: (p) => zOpt(p, "Z2") },
          { c: "Z3", d: "gis-platform 新增帶 p_anchor 的 RPC，直接從歷史軌道表算「錨點前 24 小時」的逐次變軌；前端走 timeStore 訂閱（拖動時防抖）。上線前先做 Z1 當過渡。錨點早於 30 天顯示「無法推算」而不是空清單", spec: "決策 #4、§6.4、CLAUDE.md 跨 repo 順序（上游先動）", rec: true,
            shared: "需要 gis-platform migration（使用者拍板、另開 PR、上游先部署）；查 2.3 GB 表要先 /check-rpc 量成本（IO 事故前例）；覆蓋統計也吃同一份變軌資料，會一起跟著時間軸變",
            f: (p) => zOpt(p, "Z3") },
        ] },
    ],
    rules: [
      "所有閃爍拿掉：橫幅紅點、重大卡整張呼吸、嚴重度小點、彈窗類型 chip。",
      "嚴重度「注意」的橘改 <code>COLORS.statusWarn</code>（<code>#f97316</code> → <code>#ff9800</code>，淡色 <code>#c2410c</code>）；「例行」「無法判定」用中性灰；「影響 TW」不再用綠色（§3.5 綠＝正常）。",
      "例行摺疊鈕：「▸ 展開／▾ 收合」改 lucide chevron；「N 筆例行機動 (drift/station-keeping)」改「例行調整 N 筆、無法判定 N 筆」。",
      "類型一律 <code>MANEUVER_TOKEN.zh</code>（軌道面變化／高度變化／離心率變化），↻⬆◓ 符號拿掉；變化量單位「min」改「分鐘」、單位前補空白。",
      "衛星名改 <code>&lt;button&gt;</code>（focus-visible、aria-label「查看 X 的衛星百科」）；按鈕一律 C2（高 26、11px／500，主要＝accentFaint＋accent）。",
      "等寬只包數字；字級 11.5／10.5／9.5 收回 7 階、字重 800 改 700；手寫 rgba 改 token（資料色 bbox 綠紅、軌跡橘藍維持資料色常數）。",
      "彈窗：Esc 關閉、關閉鈕 <code>aria-label</code>、SVG 改 viewBox 隨寬縮放；說明行改中文（見 Q 題示意），框外區域的「(框外)」保留。",
      "百科卡預測（決策 #3 延伸）：拿掉「μ = … · σ = … · n = …」與手刻區間條，改一句「依歷史間隔估算：近 30 天 N 次變軌、平均間隔 M 天 · 非精準預測」。想保留區間條請寫在備註。",
      "百科卡、彈窗、警報區的 z 值維持已登記的例外，不在 P4 動。",
    ],
  });
})();
