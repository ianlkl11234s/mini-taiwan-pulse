// 側邊欄卡片 + 工具列。所有狀態存在 state 物件，effect 的 _group / _params 由 layer.js 賦值。

export function setupUI({ effects, state, map }) {
  buildSidebar(effects, state, map);
  setupToolbar(effects, state, map);
}

function buildSidebar(effects, state, map) {
  const cards = document.getElementById("cards");
  cards.innerHTML = "";

  for (const eff of effects) {
    const card = document.createElement("div");
    card.className = "card";
    card.dataset.id = eff.id;
    card.innerHTML = `
      <div class="card-head">
        <span class="card-title">${eff.name}</span>
        <span class="card-loc">📍 ${eff.city}</span>
      </div>
      <div class="card-tech">${eff.tech}</div>
      <div class="card-desc">${eff.desc}</div>
      <div class="card-prompt">💬 ${eff.prompt}</div>
      <div class="params"></div>
    `;

    const paramsDiv = card.querySelector(".params");
    for (const p of eff.params) {
      const row = document.createElement("div");
      row.className = "param-row";
      row.innerHTML = `
        <label>${p.label}</label>
        <input type="range" min="${p.min}" max="${p.max}" step="${p.step}" value="${p.value}" />
        <span class="val">${p.value}</span>
      `;
      const input = row.querySelector("input");
      const valSpan = row.querySelector(".val");
      input.addEventListener("input", (e) => {
        e.stopPropagation();
        const v = Number(e.target.value);
        eff._params[p.id] = v;
        valSpan.textContent = v;
      });
      input.addEventListener("click", (e) => e.stopPropagation());
      paramsDiv.appendChild(row);
    }

    card.addEventListener("click", () => onCardClick(eff, card, effects, state, map));
    cards.appendChild(card);
  }
}

function onCardClick(eff, card, effects, state, map) {
  document.querySelectorAll(".card").forEach((c) => c.classList.remove("active", "expanded"));
  card.classList.add("active", "expanded");
  state.selected = eff.id;

  if (eff.lineEnd) {
    const midLng = (eff.loc[0] + eff.lineEnd[0]) / 2;
    const midLat = (eff.loc[1] + eff.lineEnd[1]) / 2;
    const dx = eff.lineEnd[0] - eff.loc[0];
    const dy = eff.lineEnd[1] - eff.loc[1];
    const dist = Math.sqrt(dx * dx + dy * dy);
    const zoom = dist > 1.5 ? 7.2 : dist > 0.5 ? 8.5 : 9.5;
    map.flyTo({ center: [midLng, midLat], zoom, pitch: 55, duration: 1500 });
  } else {
    map.flyTo({ center: eff.loc, zoom: 12, pitch: 60, duration: 1500 });
  }

  if (!state.showAll) updateVisibility(effects, state);
}

function updateVisibility(effects, state) {
  for (const eff of effects) {
    if (!eff._group) continue;
    eff._group.visible = state.showAll || eff.id === state.selected;
  }
}

function setupToolbar(effects, state, map) {
  document.getElementById("btn-fit").addEventListener("click", () => {
    map.flyTo({ center: [120.9, 23.7], zoom: 6.6, pitch: 50, bearing: 0, duration: 1500 });
  });
  document.getElementById("btn-toggle-all").addEventListener("click", (e) => {
    state.showAll = !state.showAll;
    e.target.textContent = state.showAll ? "全顯/單顯" : "單顯/全顯";
    updateVisibility(effects, state);
  });
  document.getElementById("btn-pause").addEventListener("click", (e) => {
    state.paused = !state.paused;
    e.target.textContent = state.paused ? "繼續動畫" : "暫停動畫";
  });
}
