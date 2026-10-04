/* P3 台灣衛星隊＋覆蓋統計：卡片樣式、卡片按鈕、卡片資訊列、覆蓋統計主數字、篩選與展開
 * 現況依 HEAD：TWFleetSection.tsx（手刻卡、P1 已換 SubGroupLabel「台灣衛星隊」）、CoverageStatsSection.tsx（P-D 已加讀取中／—／失敗字）、
 *              satelliteDataState.ts（deriveFleetView）、satelliteTaiwanLocale.ts（中文名／用途／tier）
 * 代號：C V W X Y（見 picks-kit.js 檔頭分配） */
(function () {
  const PK = window.PK;
  const { num, badge } = PK;
  const TW = PK.SAT.taiwan; // #4fc3f7＝SATELLITE_COLORS.taiwan（資料色 §3.16）
  const REC = { C: "C1", V: "V1", W: "W2", X: "X1", Y: "Y1" };

  // 控制項 token（designTokens CONTROL／LIGHT.control*、--accent-faint）
  const ctrlBg = (p) => (p.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.035)");
  const accFaint = (p) => PK.alpha(p.accent, p.isDark ? 0.16 : 0.10);
  const dot = (p) => `<span style="color:${p.faint}">·</span>`;

  // ── 示意資料（數值為示意） ──
  const SATS = [
    { zh: "福衛 8A", en: "FORMOSAT-8A", norad: 61045, use: "光學遙測", tier: "core", alt: 561, lat: 23.9, lon: 120.4, next: 0, man: null },
    { zh: "獵風者", en: "TRITON", norad: 57803, use: "GNSS-R 海風", tier: "core", alt: 598, lat: -12.3, lon: 96.1, next: 37, man: 6 },
    { zh: "玉山", en: "YUSHAN", norad: 58400, use: "AIS 船舶", tier: "research", alt: 512, lat: 41.2, lon: -148.7, next: 212, man: null },
    { zh: "福衛 3 號 1", en: "FORMOSAT-3 FM1", norad: 29047, use: "氣象掩星", tier: "legacy", alt: 742, lat: 5.6, lon: 33.8, next: null, man: 12 },
  ];
  const PASSES = [
    { n: "YAOGAN-30 01", m: 12, c: "china_yaogan" }, { n: "JILIN-1 GAOFEN 03D", m: 38, c: "china_jilin" },
    { n: "FORMOSAT-8A", m: 95, c: "taiwan" }, { n: "GAOFEN-11 04", m: 140, c: "china_gaofen", man: true },
    { n: "YAOGAN-35 01A", m: 210, c: "china_yaogan", man: true }, { n: "IGS-OPTICAL 7", m: 262, c: "japan" },
    { n: "KOMPSAT-3A", m: 318, c: "korea" },
  ];
  const COVER_NAMES = "FORMOSAT-8A · YAOGAN-35 01A · BEIDOU-3 M5";

  // ── 小元件 ──
  // C2 小尺寸按鈕（.lpc-btn：高 22、padding 0 8、10px／500、RADIUS.md）；primary＝主要樣式
  const btn = (p, inner, o = {}) => `<span role="button" class="nw" style="display:inline-flex;align-items:center;justify-content:center;gap:4px;height:22px;padding:0 8px;border-radius:4px;font-size:10px;font-weight:${o.primary ? 600 : 500};line-height:1;${o.flex ? "flex:1;" : ""}border:1px solid ${o.primary ? p.accent : p.ctrlBorder};background:${o.primary ? accFaint(p) : ctrlBg(p)};color:${o.primary ? p.accent : p.strong}">${inner}</span>`;
  // 圖示鈕（§5.7 圖示：正方、必有 title；控制區小尺寸 22）
  const iconBtn = (p, svg, title) => `<span role="button" title="${title}" aria-label="${title}" style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;flex-shrink:0;border-radius:4px;border:1px solid ${p.ctrlBorder};background:${ctrlBg(p)}">${svg}</span>`;
  const svgLocate = (c) => `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"><path d="M2 12h3M19 12h3M12 2v3M12 19v3"/><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3"/></svg>`;
  const svgBook = (c) => `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`;
  // 分段控制（.lpc-seg 控制區版）
  const seg = (p, items, sel) => `<span role="group" style="display:inline-flex;gap:2px;padding:1px;border:1px solid ${p.ctrlBorder};border-radius:4px;background:${ctrlBg(p)}">${items.map((t, i) => `<span role="button" aria-pressed="${i === sel}" class="nw" style="padding:4px 7px;border-radius:3px;font-size:10px;line-height:1;font-weight:${i === sel ? 600 : 500};background:${i === sel ? accFaint(p) : "transparent"};color:${i === sel ? p.accent : p.muted}">${t}</span>`).join("")}</span>`;
  // 原生 select 外觀（§5.9：高 20、padding 0 20 0 7、10px、自繪箭頭）
  const select = (p, t) => `<span class="nw" style="position:relative;display:inline-flex;align-items:center;height:20px;padding:0 20px 0 7px;border-radius:4px;border:1px solid ${p.ctrlBorder};background:${ctrlBg(p)};font-size:10px;color:${p.strong}">${t}<svg width="8" height="5" viewBox="0 0 8 5" style="position:absolute;right:7px;top:7px"><path d="M0.5 0.5 4 4l3.5-3.5" fill="none" stroke="${p.muted}" stroke-width="1.2"/></svg></span>`;
  // 區段標題（同 PK.sectionTitle，可在細線右邊放控制項）
  const titleWith = (p, zh, right) => right
    ? `<div style="display:flex;align-items:center;gap:8px;color:${p.rail.sub};font-size:10px;font-weight:600;letter-spacing:0.6px;padding:8px 12px 3px 12px"><span class="nw">${zh}</span><span aria-hidden="true" style="flex:1;height:1px;background:${p.rail.line}"></span><span style="letter-spacing:0;display:inline-flex">${right}</span></div>`
    : PK.sectionTitle(p, zh);
  const coords = (s, zh) => {
    const la = Math.abs(s.lat).toFixed(1), lo = Math.abs(s.lon).toFixed(1);
    if (zh) return `<span class="nw">${s.lat >= 0 ? "北緯" : "南緯"} ${num(la + "°")} ${s.lon >= 0 ? "東經" : "西經"} ${num(lo + "°")}</span>`;
    return `<span class="mono nw">${la}°${s.lat >= 0 ? "N" : "S"} ${lo}°${s.lon >= 0 ? "E" : "W"}</span>`;
  };

  // ═════ 台灣衛星隊 ═════
  // HEAD 現況卡（TWFleetSection.tsx:206-321；字級 12.5／10.5／9.5、座標列整列等寬含中文）
  function curCard(p, s) {
    const cov = s.next === 0, mono = "font-family:var(--f-data)";
    const leg = s.tier === "legacy" ? `<span style="padding:0 5px;border-radius:4px;background:rgba(255,152,0,0.16);border:1px solid rgba(255,152,0,0.45);font-size:9.5px;color:${p.warn}">⚠ 超齡服役</span>` : "";
    const res = s.tier === "research" ? `<span style="padding:0 5px;border-radius:4px;background:rgba(255,255,255,0.06);border:1px solid ${p.mid};font-size:9.5px;color:${p.muted}">學研</span>` : "";
    const st = cov ? "正覆蓋台灣" : s.next == null ? "12h 內無通過" : `下次過台 ${s.next} 分`;
    return `<div style="padding:8px 11px;border-radius:8px;background:${cov ? "rgba(79,195,247,0.10)" : "rgba(255,255,255,0.025)"};border:1px solid ${cov ? "rgba(79,195,247,0.45)" : p.soft}">
      <div style="display:flex;align-items:center;gap:6px"><span class="nw" style="font-size:12.5px;font-weight:700;color:${p.strong}">${s.zh}</span><span class="nw" style="${mono};font-size:9.5px;color:${p.dim}">${s.en}</span>${leg}${res}<span class="nw" style="margin-left:auto;${mono};font-size:9.5px;color:${p.dim}">NORAD ${s.norad}</span></div>
      <div style="margin-top:4px;display:flex;gap:8px;font-size:10.5px;color:${p.muted}"><span>${s.use}</span>${dot(p)}<span style="${mono}">${s.alt} km</span></div>
      <div style="margin-top:5px;display:flex;flex-wrap:wrap;gap:10px;${mono};font-size:10px;color:${p.muted}"><span>${Math.abs(s.lat).toFixed(1)}°${s.lat >= 0 ? "N" : "S"} ${Math.abs(s.lon).toFixed(1)}°${s.lon >= 0 ? "E" : "W"}</span>${dot(p)}<span style="color:${cov ? TW : p.def}">${st}</span>${s.man != null ? `${dot(p)}<span>距上次變軌 ${s.man}d</span>` : ""}</div>
      <div style="margin-top:6px;display:flex;gap:6px"><span style="flex:1;text-align:center;padding:4px 0;border-radius:4px;border:1px solid ${p.mid};color:${p.def};font-size:10.5px">飛到衛星</span><span style="flex:1;text-align:center;padding:4px 0;border-radius:4px;border:1px solid rgba(100,170,255,0.55);background:rgba(100,170,255,0.16);color:#cfe4ff;font-size:10.5px">百科</span></div></div>`;
  }
  const curFleet = (p, list = SATS) => `<div style="border-bottom:1px solid ${p.soft}">${PK.sectionTitle(p, "台灣衛星隊")}<div style="padding:0 12px 10px;display:flex;flex-direction:column;gap:6px">${list.map((s) => curCard(p, s)).join("")}</div></div>`;

  // 建議後的卡：cfg 指定 C／V／W，未指定用建議值
  function card(p, s, cfg = {}) {
    const c = Object.assign({}, REC, cfg), cov = s.next === 0, tc = PK.chipText(TW, p);
    const badges = (s.tier === "legacy" ? badge(p, p.warn, "超齡服役") : "") + (s.tier === "research" ? badge(p, p.muted, "學研") : "");
    const stDot = c.C === "C3" ? `<span title="${cov ? "正覆蓋台灣" : ""}" style="width:7px;height:7px;border-radius:50%;flex-shrink:0;align-self:center;box-sizing:border-box;${cov ? `background:${TW}` : `border:1px solid ${p.dim}`}"></span>` : "";
    let right = "";
    if (c.W === "W1") right = `<span class="nw" style="margin-left:auto;font-size:9px;color:${p.dim}">NORAD 編號 ${num(s.norad)}</span>`;
    if (c.V === "V3") right = `<span style="margin-left:auto;display:inline-flex;gap:4px">${iconBtn(p, svgLocate(p.strong), "飛到衛星")}${iconBtn(p, svgBook(p.strong), "開啟衛星百科")}</span>`;
    const head = `<div style="display:flex;align-items:center;gap:6px;min-width:0">${stDot}<span class="nw" style="font-size:12px;font-weight:700;color:${p.strong}">${s.zh}</span><span class="ell" style="font-size:10px;color:${p.dim}">${s.en}</span>${badges}${right}</div>`;
    const st = cov ? `<span class="nw" style="color:${tc};font-weight:600">正覆蓋台灣</span>`
      : s.next == null ? `<span class="nw" style="color:${p.def}">12 小時內不會經過</span>`
        : `<span class="nw" style="color:${p.def}">${num(s.next)} 分鐘後過台</span>`;
    const man = s.man != null ? `${dot(p)}<span class="nw">距上次變軌 ${num(s.man)} 天</span>` : "";
    const l2 = `<div style="margin-top:3px;display:flex;flex-wrap:wrap;gap:4px 8px;font-size:11px;color:${p.muted}"><span class="nw">${s.use}</span>${dot(p)}<span class="nw">${num(s.alt)} km</span></div>`;
    const l3 = c.W === "W2"
      ? `<div style="margin-top:2px;display:flex;flex-wrap:wrap;gap:4px 8px;font-size:10px;color:${p.muted}">${st}${man}</div>`
      : `<div style="margin-top:2px;display:flex;flex-wrap:wrap;gap:4px 8px;font-size:10px;color:${p.muted}">${coords(s, c.W === "W3")}${dot(p)}${st}${man}</div>`;
    let btns = "";
    if (c.V === "V1") btns = `<div style="margin-top:6px;display:flex;gap:6px">${btn(p, "飛到衛星", { flex: true })}${btn(p, "百科", { flex: true })}</div>`;
    if (c.V === "V2") btns = `<div style="margin-top:6px;display:flex;gap:6px">${btn(p, "飛到衛星", { flex: true })}${btn(p, "百科", { flex: true, primary: true })}</div>`;
    let box;
    if (c.C === "C3") box = `padding:7px 2px 8px;border-top:1px solid ${p.soft}`;
    else if (c.C === "C2") box = `padding:8px 10px;border-radius:6px;background:${cov ? PK.alpha(TW, 0.10) : ctrlBg(p)};border:1px solid ${cov ? PK.alpha(TW, 0.45) : p.soft}`;
    else box = `padding:8px 10px;border-radius:6px;background:${ctrlBg(p)};border:1px solid ${p.soft};border-left:2px solid ${cov ? TW : p.soft}`;
    return `<div style="${box}">${head}${l2}${l3}${btns}</div>`;
  }
  const fleet = (p, cfg = {}, list = SATS) => {
    const c = Object.assign({}, REC, cfg);
    return `<div style="border-bottom:1px solid ${p.soft}">${PK.sectionTitle(p, "台灣衛星隊")}<div style="padding:0 12px 10px;display:flex;flex-direction:column;gap:${c.C === "C3" ? 0 : 6}px">${list.map((s) => card(p, s, cfg)).join("")}</div></div>`;
  };
  const above = (p) => PK.stub(p, "中國／國際群組清單（P2）");
  const fleetPanel = (p, cfg) => PK.p1Panel(p, above(p) + fleet(p, cfg, SATS.slice(0, 3)), { header: false });

  // ═════ 覆蓋統計 ═════
  // HEAD 現況（CoverageStatsSection.tsx:231-413）
  function curCov(p, o = {}) {
    const mono = "font-family:var(--f-data)", ld = o.state === "loading";
    const head = `<div style="display:flex;align-items:center;gap:12px;font-size:11px">
      <div class="nw"><span style="color:${p.dim}">覆蓋台灣中</span><span style="margin-left:6px;${mono};font-size:18px;font-weight:700;color:${ld ? p.def : TW}">${ld ? "讀取中…" : 3}</span>${ld ? "" : `<span style="color:${p.dim};margin-left:2px">顆</span>`}</div>
      <div style="width:1px;height:18px;background:${p.soft}"></div>
      <div class="nw"><span style="color:${p.dim}">未來 6h 通過</span><span style="margin-left:6px;${mono};font-size:18px;font-weight:700;color:${p.def}">${ld ? "讀取中…" : 41}</span>${ld ? "" : `<span style="color:${p.dim};margin-left:2px">次</span>`}</div>
      <span class="nw" style="margin-left:auto;padding:3px 8px;border-radius:4px;border:1px solid ${p.mid};color:${p.muted};font-size:10px">${o.open ? "▾ 收合" : "▸ 看 timeline"}</span></div>`;
    if (ld) return `<div style="padding:10px 14px 8px;border-bottom:1px solid ${p.soft}">${head}</div>`;
    const bd = `<div style="margin-top:5px;display:flex;flex-wrap:wrap;gap:8px;${mono};font-size:10px;color:${p.muted}"><span>CN <b style="color:${p.def};font-weight:600">2</b></span><span>/ TW <b style="color:${TW};font-weight:600">1</b></span>${dot(p)}<span>遙測類 <b style="color:#22c55e">2</b> 顆</span><span style="margin-left:auto;color:${p.faint}">6h 內</span><span>遙測 <b style="color:#22c55e;font-weight:600">18</b> 次</span></div>
      <div class="ell" style="margin-top:4px;${mono};font-size:10px;color:${p.muted}">${COVER_NAMES}</div>`;
    let ex = "";
    if (o.open) {
      ex = `<div style="margin-top:10px;padding:10px;border-radius:6px;background:rgba(0,0,0,0.25)">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:10.5px"><span style="color:${p.muted}">顯示</span>
          <span class="nw" style="padding:3px 8px;border-radius:4px;background:rgba(34,197,94,0.16);border:1px solid rgba(34,197,94,0.55);color:#22c55e;font-weight:600">只看遙測偵察</span>
          <span class="nw" style="padding:3px 8px;border-radius:4px;border:1px solid ${p.mid};color:${p.muted}">全部</span>
          <span class="nw" style="margin-left:auto;${mono};font-size:9.5px;color:${p.faint}">7 / 41 次</span></div>
        ${axis(p, true)}${ticks(p, true)}</div>`;
    }
    return `<div style="padding:10px 14px 8px;border-bottom:1px solid ${p.soft}">${head}${bd}${ex}</div>`;
  }
  // 時間軸刻度：cur＝「+0h…+6h」等寬；新＝「現在、+1 … +6 小時」
  function axis(p, cur) {
    const labs = cur ? [0, 1, 2, 3, 4, 5, 6].map((h) => `+${h}h`) : ["現在", "+1", "+2", "+3", "+4", "+5", "+6 小時"];
    return `<div style="position:relative;height:18px;margin:0 6px 8px"><div style="position:absolute;left:0;right:0;top:14px;height:1px;background:${p.mid}"></div>
      ${labs.map((t, h) => `<span class="nw${cur ? " mono" : ""}" style="position:absolute;left:${(h / 6) * 100}%;top:0;transform:translateX(${h === 0 ? "0" : h === 6 ? "-100%" : "-50%"});font-size:9px;color:${p.faint}">${t}</span>`).join("")}</div>`;
  }
  function ticks(p, cur) {
    return `<div style="position:relative;margin:0 6px">${PASSES.map((t) => {
      const left = (t.m / 360) * 100, col = PK.SAT[t.c];
      const mark = t.man ? (cur ? " ⚡" : "") : "";
      const ring = t.man ? (cur ? `box-shadow:0 0 5px ${p.err}` : `outline:1.5px solid ${p.err};outline-offset:1px`) : "";
      const tag = t.man && !cur ? `<span style="margin-left:4px;display:inline-flex;vertical-align:1px">${badge(p, p.err, "變軌")}</span>` : "";
      return `<div style="position:relative;height:18px"><span style="position:absolute;left:${left}%;top:5px;width:8px;height:8px;border-radius:50%;background:${col};transform:translateX(-50%);${ring}"></span>
        <span class="nw" style="position:absolute;left:min(${left + 2}%, calc(100% - 150px));top:1px;font-size:${cur ? "9.5px" : "10px"};color:${p.muted}"><span class="mono">${t.n}</span>${mark}${tag}</span></div>`;
    }).join("")}</div>`;
  }

  // 建議後的覆蓋統計：cfg 指定 X／Y；state: ok | loading（TLE 讀取中）| scanning（覆蓋已算出、6 小時掃描計算中）
  function cov(p, cfg = {}, o = {}) {
    const c = Object.assign({}, REC, cfg), st = o.state || "ok", open = !!o.open;
    const ld = st === "loading", sc = st === "scanning";
    const tc = PK.chipText(TW, p);
    const big = (v, unit, color) => `<span class="nw"><span class="mono" style="font-size:18px;font-weight:700;color:${color}">${v}</span><span style="margin-left:3px;font-size:10px;color:${p.dim}">${unit}</span></span>`;
    const wait = (t) => `<span class="nw" style="font-size:11px;color:${p.muted};line-height:22px">${t}</span>`;
    const covV = ld ? wait("讀取中…") : big(3, "顆", tc);
    const passV = ld ? wait("讀取中…") : sc ? wait("計算中…") : big(41, "次", p.def);
    const bdCov = `<span class="nw">台灣 ${num(1)}</span>${dot(p)}<span class="nw">其他國家 ${num(2)}</span>${dot(p)}<span class="nw">遙測偵察 ${num(2)}</span>`;
    const bdPass = sc ? "" : `<span class="nw">遙測偵察 ${num(18)} 次</span>`;
    // Y：展開入口
    const chevBtn = btn(p, `${PK.icon.chev(p.muted, open)}通過時間`);
    const title = c.Y === "Y2" ? titleWith(p, "覆蓋統計") : titleWith(p, "覆蓋統計", ld ? "" : chevBtn);
    let main;
    if (c.X === "X2") {
      main = ld ? `<div style="font-size:11px;color:${p.muted}">讀取中…</div>`
        : `<div style="font-size:12px;color:${p.def};line-height:1.6">目前 <span class="mono" style="font-weight:700;color:${tc}">3</span> 顆覆蓋台灣${dot(p)}未來 6 小時預計通過 ${sc ? `<span style="color:${p.muted}">計算中…</span>` : `<span class="mono" style="font-weight:700;color:${p.strong}">41</span> 次`}</div>
          <div style="margin-top:2px;display:flex;flex-wrap:wrap;gap:4px 6px;font-size:10px;color:${p.muted}">${bdCov}${bdPass ? dot(p) + `<span class="nw">6 小時內</span>` + bdPass : ""}</div>`;
    } else if (c.X === "X3") {
      main = `<div style="display:flex;align-items:center;gap:12px;font-size:11px"><span class="nw" style="display:inline-flex;align-items:center;gap:6px"><span style="color:${p.dim}">覆蓋台灣中</span>${covV}</span>
        <span style="width:1px;height:18px;background:${p.soft}"></span><span class="nw" style="display:inline-flex;align-items:center;gap:6px"><span style="color:${p.dim}">未來 6 小時通過</span>${passV}</span></div>`
        + (ld ? "" : `<div style="margin-top:4px;display:flex;flex-wrap:wrap;gap:4px 6px;font-size:10px;color:${p.muted}">${bdCov}${bdPass ? `<span style="margin-left:auto" class="nw">6 小時內 </span>` + bdPass : ""}</div>`);
    } else {
      const col = (lab, v, bd) => `<div style="min-width:0"><div style="font-size:10px;color:${p.dim}">${lab}</div><div style="margin-top:1px;min-height:22px">${v}</div>${bd ? `<div style="margin-top:2px;display:flex;flex-wrap:wrap;gap:2px 5px;font-size:10px;color:${p.muted}">${bd}</div>` : ""}</div>`;
      main = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">${col("覆蓋台灣中", covV, ld ? "" : bdCov)}${col("未來 6 小時通過", passV, ld || sc ? "" : bdPass)}</div>`;
    }
    const names = ld ? "" : `<div class="ell mono" style="margin-top:5px;font-size:10px;color:${p.muted}" title="目前覆蓋台灣的衛星">${COVER_NAMES}</div>`;
    let disc = "";
    if (c.Y === "Y2" && !ld) disc = `<div role="button" aria-expanded="${open}" style="margin-top:8px;display:flex;align-items:center;gap:6px;padding:6px 0 0;border-top:1px solid ${p.soft};font-size:10px;color:${p.muted}">${PK.icon.chev(p.muted, open)}<span class="nw">未來 6 小時通過時間</span><span class="nw" style="margin-left:auto">${num(41)} 次</span></div>`;
    let ex = "";
    if (open && !ld) {
      const filter = c.Y === "Y3" ? `<span class="nw" style="font-size:10px;color:${p.muted}">顯示</span>${select(p, "只看遙測偵察")}` : seg(p, ["遙測偵察", "全部"], 0);
      ex = `<div style="margin-top:8px;padding:8px;border-radius:6px;background:${ctrlBg(p)};border:1px solid ${p.soft}">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">${filter}<span class="nw" style="margin-left:auto;font-size:10px;color:${p.dim}">${num(7)} / ${num(41)} 次</span></div>
        ${axis(p, false)}${ticks(p, false)}</div>`;
    }
    return `<div style="border-bottom:1px solid ${p.soft}">${title}<div style="padding:2px 14px 9px">${main}${names}${disc}${ex}</div></div>`;
  }
  const alertStub = (p) => PK.stub(p, "變軌警報區（P4）");
  const capt = (p, t) => `<div style="padding:6px 14px 0;font-size:9px;color:${p.dim}">↓ ${t}</div>`;
  // X 題：一般狀態＋讀取中＋掃描計算中
  const covStates = (p, cfg) => PK.p1Panel(p, alertStub(p) + cov(p, cfg) + capt(p, "衛星資料讀取中") + cov(p, cfg, { state: "loading" }) + capt(p, "覆蓋已算出、6 小時通過計算中") + cov(p, cfg, { state: "scanning" }) + above(p), { footer: false });
  const curCovStates = (p) => PK.p1Panel(p, alertStub(p) + curCov(p) + capt(p, "衛星資料讀取中（P-D 後）") + curCov(p, { state: "loading" }) + above(p), { footer: false });
  // Y 題：收合＋展開
  const covOpen = (p, cfg) => PK.p1Panel(p, alertStub(p) + cov(p, cfg) + capt(p, "展開後") + cov(p, cfg, { open: true }) + above(p), { footer: false });

  // 台灣衛星名稱對照（說明用）
  const table = `<table class="t"><thead><tr><th>欄位</th><th>現況</th><th>W1</th><th>W2</th><th>W3</th></tr></thead><tbody>
    <tr><td>NORAD 編號</td><td>右上「NORAD 61045」等寬</td><td>右上「NORAD 編號 61045」9px</td><td>拿掉（百科卡已有）</td><td>拿掉（百科卡已有）</td></tr>
    <tr><td>英文原名</td><td>9.5px 等寬</td><td colspan="3">中文名後 10px 淡色小字（§6.1 外文小字）</td></tr>
    <tr><td>用途 · 高度</td><td>10.5px，「561 km」整段等寬</td><td colspan="3">11px，數字等寬、「km」中文字型、空一格</td></tr>
    <tr><td>座標</td><td>「23.9°N 120.4°E」</td><td>保留原寫法</td><td>拿掉（「飛到衛星」與地圖上已看得到位置）</td><td>「北緯 23.9° 東經 120.4°」</td></tr>
    <tr><td>過台狀態</td><td>「下次過台 37 分」「12h 內無通過」</td><td colspan="3">「37 分鐘後過台」「12 小時內不會經過」「正覆蓋台灣」</td></tr>
    <tr><td>距上次變軌</td><td>「距上次變軌 6d」</td><td colspan="3">「距上次變軌 6 天」</td></tr></tbody></table>`;

  PK.registerPhase({
    id: "P3",
    title: "台灣衛星隊＋覆蓋統計",
    intro: `<p>範圍：面板裡的<b>覆蓋統計</b>（標頭下、變軌警報之後）與<b>台灣衛星隊</b>（群組清單之後、最底部）兩塊。示意面板用 P1 實作後的標頭與 footer，其他區塊以灰色佔位，讓這兩塊放在實際位置。數值為示意。</p>
      <p><b>每題只變一個項目，其他項目用建議值畫</b>（C1＋V1＋W2＋X1＋Y1）。現況依 HEAD 程式碼畫，只有暗色。</p>
      <p>已做完、不在本段的：台灣衛星隊的區段標題已在 P1 換成「台灣衛星隊」；讀取中、讀取失敗、「—」等狀態文字 P-D 已改（X 題示意這些狀態放進新版面的樣子）；資料更新時間在 P1 footer「抓取於」，本段不另放。</p>`,
    overview: {
      cur: (p) => PK.p1Panel(p, alertStub(p) + curCov(p) + above(p) + curFleet(p)),
      rec: (p) => PK.p1Panel(p, alertStub(p) + cov(p) + above(p) + fleet(p)),
    },
    questions: [
      { k: "C", t: "台灣衛星卡樣式",
        note: `現況每顆衛星一張卡：圓角 8（<code>RADIUS.xl</code>，那是面板外框用的；§3.10 面板內卡片用 <code>RADIUS.lg</code>＝6）、底色與 hover 色手寫；正在覆蓋台灣的卡整張換成淡藍底＋藍框（<code>#4fc3f7</code>，台灣衛星的資料色）。三個選項都改成 6px 圓角、底色框線走 token，差在資料色怎麼用。`,
        cur: (p) => PK.curShell(curFleet(p, SATS.slice(0, 3))),
        opts: [
          { c: "C1", d: "中性卡；覆蓋中只在左緣加 2px 資料色條，「正覆蓋台灣」字用資料色（與群組列「開啟時左緣資料色」同一種語言）", spec: "§3.10 RADIUS.lg、§3.16、§5.5 列左緣色", rec: true,
            f: (p) => fleetPanel(p, { C: "C1" }) },
          { c: "C2", d: "沿用現況做法：覆蓋中整張淡藍底＋藍框，其他卡中性（最醒目；淡色版藍底較不明顯）", spec: "§3.10、§3.16",
            f: (p) => fleetPanel(p, { C: "C2" }) },
          { c: "C3", d: "不用卡框，改成清單列（列間細線分隔），資料色只用在名稱前的狀態點（實心＝覆蓋中）", spec: "§3.16（色點）、§5.5 列分隔",
            f: (p) => fleetPanel(p, { C: "C3" }) },
        ] },
      { k: "V", t: "卡片按鈕「飛到衛星」「百科」",
        note: "現況兩顆手刻按鈕（10.5px、高度不固定），「百科」手寫藍底＋淺藍字。另外：<b>點整張卡本身就會開百科</b>（<code>TWFleetSection.tsx:217</code>），所以「百科」按鈕和點卡片是同一件事。§5.7 按鈕用 C2，控制區小尺寸＝高 22、10px（<code>.lpc-btn</code>）。",
        cur: (p) => PK.curShell(curFleet(p, SATS.slice(0, 2))),
        opts: [
          { c: "V1", d: "兩顆 C2 小按鈕並排、同樣式（一般）", spec: "§5.7 小尺寸（.lpc-btn）", rec: true,
            f: (p) => fleetPanel(p, { V: "V1" }) },
          { c: "V2", d: "一主一次：「百科」用主要樣式（淡藍底藍字），「飛到衛星」一般", spec: "§5.7 主要／一般",
            f: (p) => fleetPanel(p, { V: "V2" }) },
          { c: "V3", d: "改成名稱列右側兩顆圖示鈕（定位、書本），滑過顯示說明；每張卡少一行，但手機沒有滑過提示，要認圖示", spec: "§5.7 圖示（必有 title／aria-label）",
            f: (p) => fleetPanel(p, { V: "V3" }) },
        ] },
      { k: "W", t: "卡片資訊列",
        note: `現況卡上有 NORAD 編號、英文原名、用途、高度、座標、過台狀態、距上次變軌；座標那一列整列等寬（中文也落在等寬字），單位「d」「12h」是英文且沒空白，字級 12.5／10.5／9.5 不在 7 階。三個選項共同會做：字級改 12／11／10、數字等寬＋中文字型單位並空一格（§6.2）、「⚠ 超齡服役」「學研」改 §5.21 外框徽章；差在 NORAD 與座標怎麼處理：${table}`,
        cur: (p) => PK.curShell(curFleet(p, SATS.slice(0, 2))),
        opts: [
          { c: "W1", d: "全部保留；「NORAD」改寫「NORAD 編號」小字，座標維持「23.9°N」寫法", spec: "§6.1、§6.2、§3.13",
            f: (p) => fleetPanel(p, { W: "W1" }) },
          { c: "W2", d: "拿掉 NORAD 編號與座標（百科卡有 NORAD；位置看地圖或按飛到衛星），卡片只留名稱、用途、高度、過台狀態、距上次變軌", spec: "§6.1、§6.3（編號類資訊收到百科）、§6.2", rec: true,
            f: (p) => fleetPanel(p, { W: "W2" }) },
          { c: "W3", d: "拿掉 NORAD 編號，座標改中文「北緯 23.9° 東經 120.4°」", spec: "§6.1、§6.2",
            f: (p) => fleetPanel(p, { W: "W3" }) },
        ] },
      { k: "X", t: "覆蓋統計主數字版面＋區段標題",
        note: `覆蓋統計現在<b>沒有區段標題</b>；三個選項都加中文標題「覆蓋統計」（共用 <code>SubGroupLabel</code>，與 P1 T1 一致）。現況主數字「覆蓋台灣中 3 顆｜未來 6h 通過 41 次」，下面一行細項「CN 2 / TW 1 · 遙測類 2 顆 … 6h 內 遙測 18 次」整行等寬。
          <b>細項的「CN」其實是「台灣以外全部」</b>（<code>CoverageStatsSection.tsx:198-199</code>：不是台灣就算進 CN，含美、日等國際群），寫「CN／中國」會誤導；選項一律改成「台灣 N · 其他國家 N · 遙測偵察 N」。綠色（遙測數字）改回一般字色，資料色只留給台灣。
          每個選項都畫三種狀態：一般、衛星資料讀取中（P-D 後現況顯示「讀取中…」，現在的大字級等寬字放中文）、覆蓋已算出但 6 小時通過還在算（現況顯示「…」，改「計算中…」）。`,
        cur: (p) => curCovStates(p),
        opts: [
          { c: "X1", d: "兩欄：上面小標籤、下面大數字（18px）＋單位，細項各自放在數字下面；讀取中／計算中在數字位置顯示文字", spec: "§3.13（18＝卡片大標）、§6.2、§6.4；版面同監看 MonitorMetric", rec: true,
            f: (p) => covStates(p, { X: "X1" }) },
          { c: "X2", d: "一句話：「目前 3 顆覆蓋台灣 · 未來 6 小時預計通過 41 次」（數字 12px 粗體），細項第二行；最省高度，但數字不顯眼", spec: "§6.1、§6.2",
            f: (p) => covStates(p, { X: "X2" }) },
          { c: "X3", d: "沿用現況排法（標籤與大數字同一列、中間直線分隔），只改字型、單位與細項寫法", spec: "§6.2、§6.4",
            f: (p) => covStates(p, { X: "X3" }) },
        ] },
      { k: "Y", t: "覆蓋統計的展開與篩選",
        note: "現況展開鈕寫「▸ 看 timeline」，展開後變「▾ 收合」（文字切換、寬度會跳，§7 禁止；<code>▸▾</code> 字元 §5.16 要換 chevron）；展開後「只看遙測偵察／全部」是兩顆手刻按鈕，選中一個綠、一個藍。§5.8：2–3 個互斥選項用分段控制，選中一律強調色。三個選項都改：時間軸刻度「+1h」改「現在、+1 … +6 小時」，清單裡變軌衛星的 ⚡ 改成點外紅框＋「變軌」外框徽章（徽章樣式跟 P2 M 題結果走），「共 N 次 · 顯示前 80」改中文字型。",
        cur: (p) => PK.p1Panel(p, alertStub(p) + curCov(p) + capt(p, "展開後") + curCov(p, { open: true }) + above(p), { footer: false }),
        opts: [
          { c: "Y1", d: "標題列右側 C2 小按鈕「通過時間」＋chevron（展開時轉 90°，文字不變）；展開後篩選用分段控制「遙測偵察｜全部」", spec: "§5.7、§5.8、§5.16", rec: true,
            f: (p) => covOpen(p, { Y: "Y1" }) },
          { c: "Y2", d: "區塊底部整列可點「› 未來 6 小時通過時間　41 次」（像清單列展開）；篩選同 Y1 分段控制", spec: "§5.16、§5.8",
            f: (p) => covOpen(p, { Y: "Y2" }) },
          { c: "Y3", d: "展開同 Y1；篩選改下拉選單「只看遙測偵察／全部」（只有兩個選項，§5.8 建議用分段）", spec: "§5.9（>3 選項才用選單，偏離）",
            f: (p) => covOpen(p, { Y: "Y3" }) },
        ] },
    ],
    rules: [
      "字級收到 7 階（12.5→12、10.5→11 或 10、9.5→10 或 9）；中文一律中文字型，數字包等寬＋tabular-nums；「km」「天」「小時」「分鐘」與數字之間空一格（§3.13、§4、§6.2）。",
      "「⚠ 超齡服役」改警示色外框徽章「超齡服役」（拿掉 ⚠），「學研」改中性外框徽章（§5.21，與 P2 K1 等級徽章同公式）。",
      "台灣資料色 <code>#4fc3f7</code> 改引用既有 <code>SATELLITE_COLORS.taiwan</code>（§3.16 資料色常數）；淡色版字色過 <code>chipText</code>。手寫的 hover 色、<code>#cfe4ff</code>、<code>rgba(0,0,0,0.25)</code>、綠色 <code>#22c55e</code> 改 token（淡色版本身在 P5）。",
      "台灣衛星隊的狀態文字（載入中／讀取失敗／目前沒有資料／N 顆暫無法計算，P-D 已做）改放在「台灣衛星隊」區段標題下，不再單獨一行「台灣衛星 — 載入中…」取代整區。",
      "覆蓋中衛星英文原名清單（「FORMOSAT-8A · YAOGAN-35 01A …」）保留等寬：衛星代號屬英文代碼，§6.1 允許。",
      "展開鈕加 <code>aria-expanded</code>；分段控制選中態用 <code>aria-pressed</code>（§5.8）。",
    ],
  });
})();
