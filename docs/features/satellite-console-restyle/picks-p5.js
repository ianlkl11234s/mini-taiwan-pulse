/* P5 淡色版：面板跟底圖主題
 * 前例：即時情報（intelTheme.tsx getIntelPalette／LIGHT_INTEL、chipText、levelColor；IntelPanel.tsx:101-107,453）
 *       監看模式 P5（monitor-restyle/p5-picks.html，選 S1／W1／D2／P2／X1／R2；monitorTheme.ts lightDataFill）
 * 現況依 HEAD：SatelliteConsole.tsx:69-72（歷史框）、SatelliteConsoleHeader.tsx:55（狀態列底）、
 *       ManeuverAlertSection.tsx:35-41,251-294（SEV_TOKEN、嚴重度 chip）、TWFleetSection.tsx:209-212,272（台灣卡）
 * 代號：SC HT SV（I 已由即時情報定案，不出題） */
(function () {
  const PK = window.PK;
  const { num, badge } = PK;

  // ── 對比工具（同 intelTheme.tsx relLuminance／contrastRatio；monitorTheme.ts lightDataFill） ──
  const h2r = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const lum = (h) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const [r, g, b] = h2r(h).map(f); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const fillCache = {};
  const lightFill = (hex) => { if (fillCache[hex]) return fillCache[hex]; let o = hex;
    for (let t = 0.1; cr(o, "#ffffff") < 3 && t <= 0.6 + 1e-9; t += 0.1) o = PK.mix(hex, "#111827", t);
    return (fillCache[hex] = o); };
  // 面板實際底色：面板半透明疊在示意底圖上（暗 rgba(10,10,20,.88)／#10121a；淡 rgba(255,255,255,.95)／#e5e8ec）
  const BG = { dark: PK.mix("#10121a", "#0a0a14", 0.88), light: PK.mix("#e5e8ec", "#ffffff", 0.95) };
  const bgOf = (p) => (p.isDark ? BG.dark : BG.light);
  const ratio = (fg, bg, min) => { const v = cr(fg, bg); const bad = v < min;
    return `<span class="mono" style="${bad ? "font-weight:700;text-decoration:underline" : ""}">${v.toFixed(1)}</span>`; };

  // ── SC：資料色的三種處理（暗色一律原色） ──
  const SCM = {
    SC1: { line: (h) => h, text: (h, p) => PK.chipText(h, p) },                                  // 即時情報 §5.21：只有字加深
    SC2: { line: (h, p) => (p.isDark ? h : lightFill(h)), text: (h, p) => PK.chipText(h, p) },    // 監看 D2：線／點補到 3:1，字 chipText
    SC3: { line: (h) => h, text: (h) => h },                                                      // 全原色（圖層面板淡色現況）
  };
  const REC_SC = "SC2";

  // 群組列名稱（P2 建議 N1＋G1＋K1＋M2 的簡化版；picks-p2.js 沒有匯出函式，這裡另抄一份最小對照）
  const NM = {
    china_yaogan: ["遙感", "Yaogan"], china_jilin: ["吉林一號", "Jilin-1"], china_gaofen: ["高分", "Gaofen"],
    china_tjs: ["通信技術試驗", "TJS / TJSW"], china_beidou: ["北斗", "Beidou"], china_shiyan: ["實踐與其他", "Shiyan"],
    usa: ["美國", "USA"], japan: ["日本", "IGS 情報採集衛星"], russia: ["俄羅斯", "Russia"], korea: ["南韓", "KOMPSAT"],
    france: ["法國", "CSO / Pléiades"], germany: ["德國", "SAR-Lupe"], italy: ["義大利", "COSMO-SkyMed"],
    israel: ["以色列", "Ofeq"], india: ["印度", "CARTOSAT / RISAT"], taiwan: ["台灣", "Taiwan"],
  };
  const TIER_ZH = { S: "重點", A: "關注", B: "一般", C: "其他" };

  // ListRow（同 PK.row，但計數字色可與左緣／icon 分開：SC2 需要 ListRow 多一個參數）
  function gRow(p, g, mode, o = {}) {
    const r = p.rail, m = SCM[mode], on = o.allOn ? true : g.on;
    const line = m.line(g.color, p), txt = m.text(g.color, p);
    const cntColor = txt;
    const n = NM[g.key];
    const meta = (o.meta === false ? "" : `<span style="margin-left:6px;align-self:center;display:inline-flex">${badge(p, p.muted, TIER_ZH[g.tier])}</span>`)
      + (g.man && o.meta !== false ? `<span style="margin-left:4px;align-self:center;display:inline-flex">${badge(p, p.err, `變軌 ${num(g.man)}`)}</span>` : "");
    const icon = PK.icon.sat(on ? line : r.DIM);
    const cnt = `<span class="nw" style="display:inline-flex;align-items:baseline;gap:2px;margin-right:4px;color:${on ? cntColor : r.INACT}"><span class="mono" style="font-size:11px">${g.cnt}</span><span style="font-size:10px">顆</span></span>`;
    const rt = o.ratios ? `<span class="nw" style="font-size:9px;color:${p.dim};margin-right:6px;width:58px;text-align:right">線 ${ratio(line, bgOf(p), 3)}／字 ${ratio(cntColor, bgOf(p), 4.5)}</span>` : "";
    return `<div style="display:flex;align-items:center;border-left:2px solid ${on ? line : "transparent"};border-top:1px solid ${p.soft}">
      <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0;padding:5px 8px 5px 10px">${icon}
        <span style="flex:1;min-width:0;display:flex;align-items:baseline;font-size:12px;color:${r.TEXT}">${PK.nameLine(p, { zh: n[0], alt: n[1] })}${meta}</span>${rt}${cnt}
        <span style="display:flex">${PK.icon.chev(r.DIM, false)}</span></div>
      <span style="padding-right:12px;display:flex">${PK.rowSwitch(p, on)}</span></div>`;
  }
  const CN = PK.GROUPS.filter((g) => g.cn), INTL = PK.GROUPS.filter((g) => !g.cn);
  const sec = (p, zh, inner, first) => first ? PK.sectionTitle(p, zh) + inner
    : `<div style="margin-top:4px;border-top:1px solid ${p.soft}">${PK.sectionTitle(p, zh)}</div>${inner}`;
  const groupList = (p, mode, o = {}) => `<div style="border-bottom:1px solid ${p.soft}">${sec(p, "中國", CN.map((g) => gRow(p, g, mode, o)).join(""), true)}${sec(p, "國際偵察", INTL.map((g) => gRow(p, g, mode, o)).join(""), false)}</div>`;

  // 台灣卡（版型待 P3，這裡只看顏色）：覆蓋中＝台灣藍 10% 底＋45% 框＋「覆蓋中」字
  function twCard(p, mode, o = {}) {
    const c = PK.SAT.taiwan, m = SCM[mode], line = m.line(c, p), txt = m.text(c, p);
    const cardBg = PK.mix(bgOf(p), c, 0.10);
    const rt = o.ratios ? `<div style="margin-top:4px;font-size:9px;color:${p.dim}">「覆蓋中」字對卡底 ${ratio(txt, cardBg, 4.5)}　框（不透明換算）對面板 ${ratio(PK.mix(bgOf(p), line, 0.45), bgOf(p), 3)}</div>` : "";
    return `<div style="padding:4px 12px 8px">${PK.sectionTitle(p, "台灣衛星隊").replace("padding:10px 12px 3px 12px", "padding:6px 0 3px")}
      <div style="padding:8px 11px;border-radius:6px;background:${PK.alpha(line, 0.10)};border:1px solid ${PK.alpha(line, 0.45)}">
        <div style="display:flex;align-items:baseline;gap:6px"><span style="font-size:12px;font-weight:700;color:${p.strong}">福衛八號</span>
          <span style="margin-left:auto;font-size:10px;color:${txt};font-weight:600">覆蓋中</span></div>
        <div style="margin-top:3px;font-size:10px;color:${p.muted}">高度 ${num(561)} km · 下次過境 ${num("15:08")}</div>${rt}</div></div>`;
  }

  // 16 色票列：每色一格，色塊（線／點用色）＋字樣（計數用色）＋對比
  function swatches(p, mode) {
    const m = SCM[mode], bg = bgOf(p);
    const keys = PK.GROUPS.map((g) => g.key).concat("taiwan");
    return `<div style="padding:8px 12px 10px;border-top:1px solid ${p.soft}">
      <div style="font-size:9px;color:${p.dim};margin-bottom:5px">16 色：圓點＝線／點用色，數字＝字用色；對比對面板底 <span class="mono">${bg}</span>（線 &lt;3、字 &lt;4.5 加底線）</div>
      <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px 8px">${keys.map((k) => {
        const h = PK.SAT[k], line = m.line(h, p), txt = m.text(h, p);
        return `<div style="display:flex;align-items:center;gap:4px;font-size:9px;color:${p.dim};min-width:0">
          <span style="width:8px;height:8px;border-radius:50%;background:${line};flex-shrink:0"></span>
          <span class="ell" style="color:${txt};font-size:10px;font-weight:600;flex:1">${NM[k][0]}</span>
          <span class="nw">${ratio(line, bg, 3)}/${ratio(txt, bg, 4.5)}</span></div>`; }).join("")}</div></div>`;
  }
  const scDemo = (mode) => (p) => PK.shell(p, groupList(p, mode, { allOn: true, meta: false, ratios: true }) + twCard(p, mode, { ratios: true }) + swatches(p, mode));
  const scCur = (p) => PK.curShell(groupList(p, "SC3", { allOn: true, meta: false }) + twCard(p, "SC3") + swatches(p, "SC3"));

  // ── SV：嚴重度卡與狀態徽章 ──
  // 色值（不是題目）：紅 #ef4444＝COLORS.statusErr → 淡色 LIGHT.statusErr；橘 #f97316 → chipText；灰 → textMuted（同 intelTheme levelColor）
  const sevColor = (p, s) => s === "red" ? p.err : s === "orange" ? PK.chipText("#f97316", p) : p.muted;
  const sevRaw = { red: "#ef4444", orange: "#f97316" };
  const SEV_LABEL = { red: "重大", orange: "注意", grey: "例行" };
  // 卡底／框：暗色 HEAD 值；淡色同 alpha 換到淡色色相（灰卡用黑 alpha）
  function sevCard(p, s, style, o = {}) {
    const c = sevColor(p, s);
    const baseHue = s === "grey" ? null : (p.isDark ? sevRaw[s] : (s === "red" ? p.err : "#f97316"));
    const soft = baseHue ? PK.alpha(baseHue, s === "red" ? 0.12 : 0.10) : (p.isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)");
    const bd = baseHue ? PK.alpha(baseHue, s === "red" ? 0.55 : 0.50) : (p.isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)");
    let chip;
    if (o.cur) chip = `<span class="mono" style="padding:1px 6px;border-radius:4px;background:${PK.alpha(sevRaw[s] || "#9ca3af", 0.13)};border:1px solid ${PK.alpha(sevRaw[s] || "#9ca3af", 0.33)};font-size:9px;font-weight:700;color:${sevRaw[s] || "#9ca3af"}">${SEV_LABEL[s]}</span>`;
    else chip = badge(p, s === "grey" ? p.muted : c, SEV_LABEL[s], style === "tint" && !p.isDark ? "tint" : "outline", { textColor: c });
    const g = s === "red" ? "china_yaogan" : s === "orange" ? "russia" : "china_jilin";
    const gc = SCM[REC_SC].line(PK.SAT[g], p);
    const name = { red: "YAOGAN-35 01A", orange: "KOSMOS 2558", grey: "JILIN-1 GAOFEN 03D" }[s];
    const type = { red: "軌道面變化", orange: "高度變化", grey: "離心率變化" }[s];
    const typeC = s === "red" ? p.err : s === "orange" ? p.warn : PK.chipText("#facc15", p);
    const typeChip = o.cur ? `<span class="mono" style="padding:1px 6px;border-radius:4px;font-size:9px;color:${s === "grey" ? "#facc15" : typeC}">${type}</span>`
      : `<span style="display:inline-flex">${badge(p, s === "grey" ? "#facc15" : typeC, type, "tint", { textColor: s === "grey" ? PK.chipText("#facc15", p) : typeC })}</span>`;
    return `<div style="margin:0 12px 6px;padding:8px 10px;border-radius:6px;background:${soft};border:1px solid ${bd}">
      <div style="display:flex;align-items:center;gap:6px"><span style="width:7px;height:7px;border-radius:50%;background:${gc};flex-shrink:0"></span>
        <span class="ell" style="flex:1;font-size:12px;font-weight:600;color:${p.strong}">${name}</span>${chip}${typeChip}</div>
      <div style="margin-top:4px;font-size:10px;color:${p.muted}">偵測於 ${num("13:05")} · 傾角 ${num("+0.42")}°</div></div>`;
  }
  function statusRow(p, style) { // 標頭狀態列 + 台灣卡警示 chip（P1 B1：即時／歷史／變軌 N 皆 chipOutline）
    const b = (c, t) => badge(p, c, t, style === "tint" && !p.isDark ? "tint" : "outline");
    return `<div style="padding:6px 14px 8px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;border-bottom:1px solid ${p.soft};font-size:10px">
      ${b(p.live, "即時")}${b(p.warn, "歷史")}${b(p.err, `變軌 ${num(3)}`)}${b(p.warn, `軌道資料 ${num(3)} 天前`)}${b(p.muted, "例行")}</div>`;
  }
  const svBlock = (p, style) => statusRow(p, style) + `<div style="padding-top:8px">${sevCard(p, "red", style)}${sevCard(p, "orange", style)}${sevCard(p, "grey", style)}</div>`;
  const svCur = (p) => PK.curShell(`<div style="padding-top:8px">${sevCard(p, "red", null, { cur: true })}${sevCard(p, "orange", null, { cur: true })}${sevCard(p, "grey", null, { cur: true })}</div>`);

  // ── HT：歷史模式 ──
  function htShell(p, inner, mode) {
    // HT1：框 45%＋外圈 18%＋狀態列 6%（暗 HEAD 原樣；淡色同 alpha 換 LIGHT.statusWarn）；HT2：去外圈
    const warnHex = p.isDark ? "#ff9800" : "#c2410c";
    const ring = mode === "HT1" ? `0 0 0 1px ${PK.alpha(warnHex, 0.18)}, ` : "";
    return `<div class="stage ${p.isDark ? "dk" : "lt"}"><div class="pn" style="background:${p.panel};border:1px solid ${PK.alpha(warnHex, 0.45)};box-shadow:${ring}${p.shadow};color:${p.def}">${inner}</div></div>`;
  }
  const htInner = (p) => PK.p1Header(p, { history: true }) + PK.stub(p, "變軌警報區（P4）") + `<div style="border-bottom:1px solid ${p.soft}">${PK.sectionTitle(p, "中國")}${CN.slice(0, 3).map((g) => gRow(p, g, REC_SC)).join("")}</div>` + PK.p1Footer(p);
  const htCur = () => { const p = PK.P.dark; return `<div class="stage dk"><div class="pn" style="background:${p.panel};border:1px solid rgba(255,152,0,0.45);box-shadow:0 0 0 1px rgba(255,152,0,0.18), ${p.shadow};color:${p.def}">${htInner(p)}</div></div>`; };

  // ── 總覽 ──
  const recInner = (p) => PK.stub(p, "變軌警報區（P4）") + PK.stub(p, "覆蓋統計（P3）") + twCard(p, REC_SC) + groupList(p, REC_SC);
  const curInner = (p) => PK.stub(p, "變軌警報區（P4）") + PK.stub(p, "覆蓋統計（P3）") + twCard(p, "SC3")
    + `<div style="border-bottom:1px solid ${p.soft}">${PK.sectionTitle(p, "中國")}${CN.map((g) => PK.curGroupRow(p, g)).join("")}${PK.sectionTitle(p, "國際偵察")}${INTL.map((g) => PK.curGroupRow(p, g)).join("")}</div>`;

  PK.registerPhase({
    id: "P5",
    title: "淡色版",
    intro: `<p>範圍：整個衛星情報面板（外殼、標頭、群組列、台灣衛星隊、覆蓋統計、變軌警報、對比彈窗、百科卡）跟著底圖切暗／淡。現況只有暗色，所以每題的「現況」都是暗色；選項才暗淡並排。</p>
      <p><b>何時切淡色（原本的 I 題）不出題，沿用即時情報</b>：同一個 <code>isDarkTheme</code>（<code>App.tsx:573</code>，底圖是 light 或 streets 就是淡色），App 傳給面板 → <code>getIntelPalette</code> → <code>IntelThemeProvider</code>（範本 <code>IntelPanel.tsx:101-107,453</code>）；群組列把寫死的 <code>DARK_PALETTE</code> 換成 <code>railPalette(isDarkTheme)</code>。面板底、框、陰影、文字階、按鈕全部取 <code>LIGHT_INTEL</code>（值來自 spec §3.9 <code>LIGHT</code>），不另開色票。</p>
      <p>示意面板用 P1 已實作的標頭與 footer，群組列畫 P2 建議（N1＋G1＋K1＋M2），P3／P4 還沒定的區塊用灰色佔位；台灣卡只看顏色，版型等 P3。對比值是 WCAG 對比，算法同 <code>intelTheme.tsx</code> 的 <code>contrastRatio</code>，底色用「面板半透明疊在示意底圖上」的實際顏色。</p>`,
    overview: { cur: (p) => PK.p1Panel(p, curInner(p)), rec: (p) => PK.p1Panel(p, recInner(p)) },
    questions: [
      { k: "SC", t: "衛星資料色在淡底",
        note: `15 群＋台灣共 16 色（<code>SATELLITE_COLORS</code>）在面板上出現在三處：群組列左緣線與 icon、計數字、台灣卡的框／淡底／「覆蓋中」字。它們同時是地圖上衛星點的顏色，等於面板兼圖例。淡底上 11 色對白不到 3:1（最低德國金黃 <span class="mono">1.3</span>、美國淺藍 <span class="mono">1.8</span>、台灣藍 <span class="mono">2.0</span>）。
          兩個前例做法不同：即時情報（§5.21）只把<b>字</b>過 <code>chipText</code>，線與色塊維持原色；監看 P5 你選了 D2，<b>填色／線</b>補到對白至少 3:1（<code>monitorTheme.ts</code> 的 <code>lightDataFill</code>），字再過 <code>chipText</code>。
          取捨：<code>chipText</code> 把字壓得很深，深到幾群很難分（實踐 <span class="mono">#50545d</span>、俄羅斯 <span class="mono">#55565d</span> 幾乎同色；遙感、吉林一號、日本都變深紅褐），所以不適合拿來畫線；<code>lightDataFill</code> 保住色相，但只到 3.1–3.6，拿來當 11px 字不夠（字要 4.5）。
          示意把 15 群全部打開，列上寫「線／字」對比，下方 16 色票格「圓點＝線用色、名稱＝字用色」。地圖上的衛星點不在這題範圍，維持原色。`,
        cur: scCur,
        opts: [
          { c: "SC1", d: "照即時情報：只有字（計數、「覆蓋中」）過 chipText，左緣線、icon、圓點、卡框維持原色",
            spec: "§5.21 淡色徽章對比規則、§3.16",
            f: scDemo("SC1") },
          { c: "SC2", d: "照監看 D2：線、icon、圓點、卡框補到對白 3:1（保色相、只加深一點），字過 chipText", rec: true,
            spec: "§5.35 P5 D2、§5.21",
            shared: "共用 ListRow 的 accent 同時決定左緣線、icon、計數字色；要讓計數字另外走 chipText，ListRow 得多一個計數字色參數（圖層面板等其他用 ListRow 的地方不傳就不變）。不改的話計數字停在 3:1 左右",
            f: scDemo("SC2") },
          { c: "SC3", d: "全部照原色（淡色圖層面板現在就是這樣）", spec: "§3.16（不違規，但 11 色字與線都低於 3:1）",
            f: scDemo("SC3") },
        ] },
      { k: "HT", t: "歷史模式在淡底",
        note: `時間軸拉到過去時，暗色面板用橘色標示：外框 45%＋外圈光暈 18%＋標頭狀態列 6% 橘底（<code>SatelliteConsole.tsx:69-72</code>、<code>SatelliteConsoleHeader.tsx:55</code>）。淡色的值已經決定：橘色換成 <code>LIGHT.statusWarn</code>（<span class="mono">#c2410c</span>），alpha 不變；P1 比較頁的淡色欄已經畫過這個樣子。只剩外圈光暈要不要留：監看 P5 的壓力環你選了 R2（淡色保留光暈），這裡是 1px 外圈，在淡色底圖上會讓外框看起來變粗、變糊。`,
        cur: htCur,
        opts: [
          { c: "HT1", d: "框＋外圈光暈＋狀態列底全部照暗色換到淡色橘（同 alpha）", spec: "§3.9 statusWarn、與監看 R2 一致", rec: true,
            f: (p) => htShell(p, htInner(p), "HT1") },
          { c: "HT2", d: "淡色拿掉外圈光暈，只留 1px 框與狀態列底", spec: "§3.9 statusWarn",
            f: (p) => htShell(p, htInner(p), p.isDark ? "HT1" : "HT2") },
        ] },
      { k: "SV", t: "嚴重度卡與狀態徽章在淡底",
        note: `色值不是題目，沿用即時情報 <code>levelColor</code>：紅 <span class="mono">#ef4444</span>（＝<code>statusErr</code>）→ <code>LIGHT.statusErr</code> <span class="mono">#b42318</span>；橘 <span class="mono">#f97316</span> → <code>chipText</code>；灰 → <code>textMuted</code>；「歷史」「資料過期」→ <code>LIGHT.statusWarn</code>；「即時」→ <code>LIGHT.statusLive</code>（<code>LIGHT_INTEL</code> 都已有）。
          沒決定的是<b>徽章公式</b>：P1 你選了 B1，狀態徽章用 <code>chipOutline</code>（外框），即時情報暗淡也都用外框；但監看 P5 你選了 P2，淡色的狀態 pill 改成淡底實心（tint）。卡片本身的淡底與框照暗色同 alpha 換到淡色色相；類型徽章（軌道面變化等）是分類，兩案都用 tint。示意的「變軌 3」「軌道資料 3 天前」等字是舉例，實際字由 P1／P4 定。`,
        cur: svCur,
        opts: [
          { c: "SV1", d: "淡色維持外框徽章（與 P1 B1、即時情報同一種，暗淡不換公式）", spec: "§5.21 程度／狀態用 chipOutline", rec: true,
            f: (p) => PK.shell(p, svBlock(p, "outline")) },
          { c: "SV2", d: "淡色改淡底實心（跟監看 P2），暗色維持外框", spec: "§5.35 P5 P2（§5.21 說程度用 chipOutline，淡色換 tint 會跟分類徽章長一樣）",
            f: (p) => PK.shell(p, svBlock(p, "tint")) },
        ] },
    ],
    rules: [
      "面板底 <code>LIGHT.surfacePanel</code>、框 <code>LIGHT.border</code>、陰影 <code>LIGHT.elevationLg</code>，文字四階與按鈕底取 <code>LIGHT_INTEL</code>；彈窗底 <code>LIGHT.surfaceSolid</code>（同 §5.27）。",
      "群組列走 <code>RailThemeContext</code>＝<code>railPalette(isDarkTheme)</code>，不再寫死 <code>DARK_PALETTE</code>（<code>CNGroupSection.tsx:183-184</code>）。",
      "中性疊色（列 hover、灰卡底、未覆蓋台灣卡底）用 <code>neutralFill</code>：同 alpha 換極性（白→黑）。",
      "變軌對比彈窗的地圖與軌跡、百科卡預測區的手寫淺藍，P4 改完後一起照本段 SC 的選擇處理；地圖上的衛星點與軌道線不在本輪範圍。",
      "淡色實作後補 <code>intelTheme.contrast.test.ts</code> 同型的測試，把 16 個衛星色依選定做法驗對比。",
    ],
  });
})();
