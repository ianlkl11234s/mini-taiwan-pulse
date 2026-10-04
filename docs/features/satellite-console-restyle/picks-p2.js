/* P2 群組列：名稱、國別、等級徽章、變軌徽章、展開清單
 * 現況依 HEAD：CNGroupSection.tsx（ListRow＋手刻 tier／⚡ meta、展開清單）、satelliteConsoleTokens.ts（CN_GROUPS_META／INTL_GROUPS_META）
 * 代號：N G K M L（見 picks-kit.js 檔頭分配） */
(function () {
  const PK = window.PK;
  const { num, badge, row, subLabel } = PK;
  const byKey = Object.fromEntries(PK.GROUPS.map((g) => [g.key, g]));
  const CN = PK.GROUPS.filter((g) => g.cn), INTL = PK.GROUPS.filter((g) => !g.cn);

  // 名稱對照（N1／N2 用 zh、alt；N3 用 n3；G2 用 cc）
  const NM = {
    china_yaogan: { zh: "遙感", alt: "Yaogan", n3: "遙感" },
    china_jilin: { zh: "吉林一號", alt: "Jilin-1", n3: "吉林一號" },
    china_gaofen: { zh: "高分", alt: "Gaofen", n3: "高分" },
    china_tjs: { zh: "通信技術試驗", alt: "TJS / TJSW", n3: "通信技術試驗" },
    china_beidou: { zh: "北斗", alt: "Beidou", n3: "北斗" },
    china_shiyan: { zh: "實踐與其他", alt: "Shiyan", n3: "實踐與其他" },
    usa: { zh: "美國", alt: "USA", n3: "美國", cc: "US" },
    japan: { zh: "日本", alt: "IGS 情報採集衛星", n3: "日本 情報採集衛星", cc: "JP" },
    russia: { zh: "俄羅斯", alt: "Russia", n3: "俄羅斯", cc: "RU" },
    korea: { zh: "南韓", alt: "KOMPSAT", n3: "南韓 KOMPSAT", cc: "KR" },
    france: { zh: "法國", alt: "CSO / Pléiades", n3: "法國 CSO / Pléiades", cc: "FR" },
    germany: { zh: "德國", alt: "SAR-Lupe", n3: "德國 SAR-Lupe", cc: "DE" },
    italy: { zh: "義大利", alt: "COSMO-SkyMed", n3: "義大利 COSMO-SkyMed", cc: "IT" },
    israel: { zh: "以色列", alt: "Ofeq", n3: "以色列 Ofeq", cc: "IL" },
    india: { zh: "印度", alt: "CARTOSAT / RISAT", n3: "印度 CARTOSAT / RISAT", cc: "IN" },
  };
  const TIER_ZH = { S: "重點", A: "關注", B: "一般", C: "其他" };
  const REC = { N: "N1", G: "G1", K: "K1", M: "M2" };

  // 一列：cfg 指定各維度選項，未指定用建議值
  function gRow(p, g, cfg = {}) {
    const c = Object.assign({}, REC, cfg), n = NM[g.key];
    let label;
    if (c.N === "N2") label = `<span class="ell">${n.zh}</span>`;
    else if (c.N === "N3") label = `<span class="ell">${n.n3}</span>`;
    else label = PK.nameLine(p, { zh: n.zh, alt: n.alt });
    if (c.G === "G2" && n.cc) label = `<span class="mono nw" style="flex-shrink:0;width:18px;font-size:9px;color:${p.rail.DIM}">${n.cc}</span>` + label;
    let meta = "";
    if (c.K === "K1") meta += `<span style="margin-left:6px;align-self:center;display:inline-flex">${badge(p, p.muted, TIER_ZH[g.tier])}</span>`;
    if (g.man) {
      if (c.M === "M1") meta += `<span style="margin-left:4px;align-self:center;display:inline-flex">${badge(p, p.err, `變軌 ${num(g.man)}`, "tint")}</span>`;
      else if (c.M === "M3") meta += `<span class="mono" title="近 24 小時變軌" style="margin-left:5px;align-self:center;display:inline-flex;align-items:center;justify-content:center;min-width:14px;height:14px;padding:0 4px;border-radius:9999px;background:${p.err};color:#fff;font-size:9px;font-weight:700">${g.man}</span>`;
      else meta += `<span style="margin-left:4px;align-self:center;display:inline-flex">${badge(p, p.err, `變軌 ${num(g.man)}`)}</span>`;
    }
    return row(p, { label, meta, cnt: g.cnt, c: g.color, on: g.on, open: g.open });
  }
  const gRows = (p, list, cfg) => list.map((g) => gRow(p, g, cfg)).join("");
  // 區段（P1 T1：SubGroupLabel；國際區段外包 marginTop 4＋上框）
  const sec = (p, zh, inner, first) => first ? PK.sectionTitle(p, zh) + inner
    : `<div style="margin-top:4px;border-top:1px solid ${p.soft}">${PK.sectionTitle(p, zh)}</div>${inner}`;
  const list = (p, cn, intl, rowFn) => `<div style="border-bottom:1px solid ${p.soft}">${cn.length ? sec(p, "中國", cn.map(rowFn).join(""), true) : ""}${intl.length ? sec(p, "國際偵察", intl.map(rowFn).join(""), !cn.length) : ""}</div>`;
  const curRow = (p) => (g) => PK.curGroupRow(p, g);
  const pick = (...keys) => keys.map((k) => byKey[k]);

  // ── 展開清單 ──
  const SATS = [
    { n: "YAOGAN-30 01", alt: 601 }, { n: "YAOGAN-30 02", alt: 600 }, { n: "YAOGAN-35 01A", alt: 495, man: true },
    { n: "YAOGAN-35 01B", alt: 496 }, { n: "YAOGAN-36 02A", alt: 498, man: true }, { n: "YAOGAN-39 01A", alt: 497 },
  ];
  function curExpanded(p) { // HEAD：名稱 11px CJK、高度 9.5px 等寬（含「km」）、⚡、底部提示整行等寬
    return `<div style="padding:0 14px 8px">${SATS.map((s) => `<div style="display:flex;align-items:center;gap:6px;padding:3px 0;font-size:11px;color:${p.def}">
      <span class="ell" style="flex:1">${s.n}</span><span class="mono" style="font-size:9.5px;color:${p.dim}">${s.alt} km</span>${s.man ? `<span style="color:${p.err};font-size:11px">⚡</span>` : ""}</div>`).join("")}
      <div class="mono" style="padding:4px 0;font-size:9px;color:${p.faint};text-align:center">… 共 128，顯示前 80</div></div>`;
  }
  const more = (p) => `<div style="padding:4px 0;font-size:9px;color:${p.dim};text-align:center">共 ${num(128)} 顆，只列前 ${num(80)} 顆</div>`;
  const altTxt = (p, a) => `<span class="nw" style="font-size:10px;color:${p.dim}"><span class="mono">${a}</span> km</span>`;
  function expanded(p, L) {
    if (L === "L2") {
      return `<div style="padding:2px 14px 8px">
        <div style="display:flex;gap:6px;padding:2px 0 3px 12px;font-size:9px;color:${p.dim};border-bottom:1px solid ${p.soft}"><span style="flex:1">名稱</span><span>高度</span></div>
        ${SATS.map((s) => `<div style="display:flex;align-items:center;gap:6px;padding:3px 0;font-size:10px;color:${p.def}">
          <span style="width:6px;height:6px;border-radius:50%;flex-shrink:0;background:${s.man ? p.err : "transparent"}"${s.man ? ' title="近 24 小時變軌"' : ""}></span>
          <span class="mono ell" style="flex:1">${s.n}</span><span class="mono" style="color:${p.dim};min-width:52px;text-align:right">${s.alt}<span style="font-family:var(--f-ui)"> km</span></span></div>`).join("")}
        ${more(p)}</div>`;
    }
    if (L === "L3") {
      return `<div style="padding:0 14px 8px 34px">${SATS.map((s) => `<div style="padding:3px 0;border-top:1px solid ${p.soft}">
          <div class="ell" style="font-size:11px;color:${p.def}">${s.n}</div>
          <div style="font-size:10px;color:${p.dim}">高度 <span class="mono">${s.alt}</span> km${s.man ? ` · <span style="color:${p.err}">近 24 小時變軌</span>` : ""}</div></div>`).join("")}
        ${more(p)}</div>`;
    }
    return `<div style="padding:0 14px 8px">${SATS.map((s) => `<div style="display:flex;align-items:center;gap:6px;padding:3px 0;font-size:11px;color:${p.def}">
        <span class="ell" style="flex:1">${s.n}</span>${s.man ? badge(p, p.err, "變軌") : ""}${altTxt(p, s.alt)}</div>`).join("")}
      ${more(p)}</div>`;
  }
  const yaoOpen = Object.assign({}, byKey.china_yaogan, { open: true });
  const expandBlock = (p, L) => `<div style="border-bottom:1px solid ${p.soft}">${PK.sectionTitle(p, "中國")}${gRow(p, yaoOpen)}${expanded(p, L)}${gRow(p, byKey.china_jilin)}</div>`;
  const curExpandBlock = (p) => `<div style="border-bottom:1px solid ${p.soft}">${PK.sectionTitle(p, "中國")}${PK.curGroupRow(p, yaoOpen)}${curExpanded(p)}${PK.curGroupRow(p, byKey.china_jilin)}</div>`;

  // ── 名稱對照表（說明用） ──
  const table = `<table class="t"><thead><tr><th>群組</th><th>現況</th><th>N1／N2 中文主名</th><th>N1 外文小字</th><th>N3 單行</th></tr></thead><tbody>${PK.GROUPS.map((g) => {
    const n = NM[g.key]; return `<tr><td>${g.cn ? "中國" : "國際"}</td><td>${g.label}</td><td>${n.zh}</td><td>${n.alt}</td><td>${n.n3}</td></tr>`; }).join("")}</tbody></table>`;

  PK.registerPhase({
    id: "P2",
    title: "群組列",
    intro: `<p>範圍：中國 6 群＋國際 9 群的群組列（共用 <code>ListRow</code>）——名稱寫法、國別標示、等級徽章、變軌徽章、展開後的衛星清單。示意面板只畫群組清單那一段，上下的標頭與 footer 已是 P1 實作後的樣子（總覽有完整面板）。</p>
      <p><b>每題只變一個項目，其他項目用建議值畫</b>（N1＋G1＋K1＋M2＋L1），這樣看得出最後會長什麼樣。現況照 HEAD 程式碼畫，只有暗色。</p>
      <p>國旗 emoji 的決定（G 題）也會套到變軌警報卡上的國旗與地圖 popup 的群組名（屬 P4，P4 會沿用這裡的結果）。</p>`,
    overview: {
      cur: (p) => PK.p1Panel(p, PK.stub(p, "變軌警報區（P4）") + PK.stub(p, "覆蓋統計（P3）") + list(p, CN, INTL, curRow(p))),
      rec: (p) => PK.p1Panel(p, PK.stub(p, "變軌警報區（P4）") + PK.stub(p, "覆蓋統計（P3）") + list(p, CN, INTL, (g) => gRow(p, g))),
    },
    questions: [
      { k: "N", t: "群組名稱寫法",
        note: `現況是英文在前、中文在後（「Yaogan 遙感」），國際群是國旗＋英文（「🇺🇸 USA」）。§5.5／§6.1：中文主名在前，外文只在需要時以小字附註；圖層列已有共用寫法 <code>LayerNameLine</code>（中文 12px＋外文 10px 淡色，空間不夠先省略外文）。三個選項的名稱對照：${table}
          N3 的解讀：國際群「國名＋計畫名」寫成同一行、同字級，沒有外文小字；計畫名有通行中譯就用中譯（日本「情報採集衛星」），沒有的保留原文（KOMPSAT 等）。中國群本身就是計畫名，N2、N3 相同。`,
        cur: (p) => PK.curShell(list(p, CN, INTL, curRow(p))),
        opts: [
          { c: "N1", d: "中文主名＋外文小字（共用 LayerNameLine，與圖層列同一種寫法）", spec: "§5.5 名稱 {zh, alt}、§6.1", rec: true,
            f: (p) => PK.shell(p, list(p, CN, INTL, (g) => gRow(p, g, { N: "N1" }))) },
          { c: "N2", d: "只有中文；國際群只剩國名，看不出是哪個計畫", spec: "§6.1",
            f: (p) => PK.shell(p, list(p, CN, INTL, (g) => gRow(p, g, { N: "N2" }))) },
          { c: "N3", d: "中文＋計畫名同一行、同字級，不用外文小字（解讀見上）", spec: "§6.1（計畫名非小字，偏離「外文小字附註」）",
            f: (p) => PK.shell(p, list(p, CN, INTL, (g) => gRow(p, g, { N: "N3" }))) },
        ] },
      { k: "G", t: "國際群的國別標示",
        note: "國際 9 群現在用國旗 emoji 標國別（「🇯🇵 Japan IGS」）；§5.5 圖層列不用 emoji，國旗在不同系統顯示也不一致（Windows 會變成兩個字母）。名稱已照 N1 以國名開頭。原本想的「只靠名稱」與 G1 是同一件事（國名已經在主名裡），所以只列兩個選項。",
        cur: (p) => PK.curShell(list(p, [], INTL, curRow(p))),
        opts: [
          { c: "G1", d: "拿掉國旗不補，國別靠中文主名", spec: "§5.5、§6.1", rec: true,
            f: (p) => PK.shell(p, list(p, [], INTL, (g) => gRow(p, g, { G: "G1" }))) },
          { c: "G2", d: "名稱前加兩個字母國碼小字（9px 等寬、淡色，固定寬度讓名稱對齊）", spec: "§6.1 英文代碼僅必要時小字附註",
            f: (p) => PK.shell(p, list(p, [], INTL, (g) => gRow(p, g, { G: "G2" }))) },
        ] },
      { k: "K", t: "等級徽章 S／A／B／C",
        note: `現況把內部等級代碼 S／A／B／C 直接印在名稱後（§6.3 不印內部代碼）。等級來自 <code>SATELLITE_TIER</code>（<code>satelliteTypes.ts</code>），程式註解只寫「UI 用來排序與標 tier chip」，<b>沒有文件定義它代表什麼</b>。從分配看是「對台灣的監看優先度」：S＝遙感、吉林一號、高分、美、日、俄；A＝通信技術試驗、韓、法、德、義、以；B＝北斗、印度；C＝實踐與其他。清單已照等級排序，預設開啟的也正是 S＋A 的中國群。下面的中文用詞是依這個推測取的，<b>請確認或在備註改字</b>：S「重點」、A「關注」、B「一般」、C「其他」。`,
        cur: (p) => PK.curShell(list(p, CN, [], curRow(p))),
        opts: [
          { c: "K1", d: "改中文程度詞，chipOutline 中性色（S 重點／A 關注／B 一般／C 其他）", spec: "§5.21 程度用 chipOutline、§6.3", rec: true,
            f: (p) => PK.shell(p, list(p, CN, [], (g) => gRow(p, g, { K: "K1" }))) },
          { c: "K2", d: "拿掉徽章，群組清單內再分「重點」「其他」兩個小分組（S 一組、其餘一組）",
            spec: "§5.5（需要第三層小標題）", shared: "spec 沒有 L2 群組底下的小分組標題；要嘛新增一種，要嘛借用 MacroGroupLabel（它是比 L2 更大的分類，層級顛倒）",
            f: (p) => PK.shell(p, `<div style="border-bottom:1px solid ${p.soft}">${PK.sectionTitle(p, "中國")}${PK.macroLabel(p, "重點")}${gRows(p, CN.filter((g) => g.tier === "S"), { K: "K2" })}${PK.macroLabel(p, "其他")}${gRows(p, CN.filter((g) => g.tier !== "S"), { K: "K2" })}</div>`) },
          { c: "K3", d: "拿掉徽章不補，只靠排序（重點群在上、預設開啟）", spec: "§6.3",
            f: (p) => PK.shell(p, list(p, CN, [], (g) => gRow(p, g, { K: "K3" }))) },
        ] },
      { k: "M", t: "變軌徽章 ⚡N",
        note: "現況是紅底紅框、等寬粗體的「⚡2」，會一直閃。§5.21 只有兩種徽章：分類用 chipTint、程度／狀態用 chipOutline，禁止第三種。「這群近 24 小時有 N 顆變軌」是狀態，而且 P1 標頭的「變軌 N」已選 B1＝chipOutline；README 早先寫 chipTint 是 B1 之前的規劃。選項都不閃（標頭的變軌徽章也不閃）；要保留閃爍請寫在備註。",
        cur: (p) => PK.curShell(list(p, pick("china_yaogan", "china_jilin", "china_gaofen"), pick("russia", "usa"), curRow(p))),
        opts: [
          { c: "M1", d: "chipTint 錯誤色「變軌 N」（淡紅底、無框，比較醒目）", spec: "§5.21 chipTint（分類用，與標頭不同）",
            f: (p) => PK.shell(p, list(p, pick("china_yaogan", "china_jilin", "china_gaofen"), pick("russia", "usa"), (g) => gRow(p, g, { M: "M1" }))) },
          { c: "M2", d: "chipOutline 錯誤色「變軌 N」，與標頭狀態列的「變軌 N」同一種", spec: "§5.21 程度／狀態、與 P1 B1 一致", rec: true,
            f: (p) => PK.shell(p, list(p, pick("china_yaogan", "china_jilin", "china_gaofen"), pick("russia", "usa"), (g) => gRow(p, g, { M: "M2" }))) },
          { c: "M3", d: "只留數字紅點（實心紅圓、白字），最省空間但沒寫「變軌」", spec: "非 §5.21 公式（要在 spec 補例外）",
            f: (p) => PK.shell(p, list(p, pick("china_yaogan", "china_jilin", "china_gaofen"), pick("russia", "usa"), (g) => gRow(p, g, { M: "M3" }))) },
        ] },
      { k: "L", t: "展開後的衛星清單",
        note: "點群組列展開該群衛星（最多 80 顆，可捲動）。現況：名稱 11px、高度 9.5px 等寬（非 7 階字級，單位「km」也落等寬）、變軌用 ⚡、底部「… 共 128，顯示前 80」整行等寬（中文落等寬字）。§3.13 字級只用 9／10／11…；§6.2 數字等寬、單位與數字空一格且不用等寬。示意展開「遙感」。",
        cur: (p) => PK.curShell(curExpandBlock(p)),
        opts: [
          { c: "L1", d: "結構不變：名稱 11px、變軌改 chipOutline「變軌」、高度 10px 數字等寬＋中文字型「km」；底部提示改中文字型", spec: "§3.13、§5.21、§6.2", rec: true,
            f: (p) => PK.shell(p, expandBlock(p, "L1")) },
          { c: "L2", d: "表格式：加「名稱／高度」欄頭，名稱 10px 等寬（衛星編號），高度靠右對齊；變軌改名稱前紅點", spec: "§3.13、§6.2（紅點為狀態點，非徽章）",
            f: (p) => PK.shell(p, expandBlock(p, "L2")) },
          { c: "L3", d: "兩行式、對齊群組名稱縮排：第一行名稱，第二行「高度 N km · 近 24 小時變軌」；最好讀，但高度約多一倍、一次看得到的顆數變少", spec: "§3.13、§6.2",
            f: (p) => PK.shell(p, expandBlock(p, "L3")) },
        ] },
    ],
    rules: [
      "展開清單的空狀態「無資料（loader 仍在抓 TLE）」改成「讀取中…」／「資料讀取失敗」／「尚未開啟此圖層」三種（§6.3、§6.4，比照 P-D）；群組清單改用 <code>loadSatellitesResult</code> 才分得出失敗。",
      "提示字「近 24h 變軌」改「近 24 小時變軌」；列的無障礙名稱改用中文主名。",
      "群組列維持共用 <code>ListRow</code>；名稱改傳結構化名稱給既有的 <code>LayerNameLine</code>，不改共用元件本身。",
      "等級仍用來排序與決定預設開啟，只是不再把代碼印出來。",
    ],
  });
})();
