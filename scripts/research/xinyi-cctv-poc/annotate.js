import { longestRunStart, DEFAULT_REVIEW, TRUTH_CLASSES, TRUTH_SCHEMA, addBox, deleteBox, moveBox, newReviewFrame, resizeBox, selectFrames, summarize } from './box-edit.js';

const CAMERA_ID = 'T000354';
// ?batch=<id> loads data/training-batches/<id>.json (pre-labelled training stills) instead of a replay batch.
const BATCH_ID = (new URLSearchParams(location.search).get('batch') || '').replace(/[^\w.-]/g, '');
// ?data=<file in data/>; default is the fixed blurred validation batch.
// ?count=<n> extends a saved review with more consecutive frames (kept work is preserved).
const REQUESTED_COUNT = Math.max(1, Math.min(200, Number(new URLSearchParams(location.search).get('count')) || 0)) || null;
const DATA_FILE = (new URLSearchParams(location.search).get('data') || 'validation-observations.json').replace(/[^\w.-]/g, '');
const LABELS = { car: '汽車', motorcycle: '機車', bus: '公車', truck: '貨車' };
const COLORS = { car: '#6ee0cf', motorcycle: '#ff8fd0', bus: '#f3be72', truck: '#b9a4ff' };
const $ = id => document.getElementById(id);
const svg = $('overlay');
const state = { data: null, camera: null, review: null, current: 0, selected: null, drawClass: 'car', drag: null, key: '' };

const reviewFrame = () => state.review.frames[state.current];
const selectedBox = () => reviewFrame()?.boxes.find(b => b.id === state.selected) ?? null;
function message(text) { $('message').textContent = text; }
function save() {
  try { localStorage.setItem(state.key, JSON.stringify(state.review)); }
  catch { message('瀏覽器無法自動保存，請盡快下載 JSON。'); }
}
function el(tag, attrs) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}
function toNormalized(event) {
  const point = svg.createSVGPoint();
  point.x = event.clientX; point.y = event.clientY;
  const p = point.matrixTransform(svg.getScreenCTM().inverse());
  return { x: Math.max(0, Math.min(1, p.x / state.camera.width)), y: Math.max(0, Math.min(1, p.y / state.camera.height)) };
}

function render() {
  const frame = reviewFrame(), W = state.camera.width, H = state.camera.height;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.replaceChildren();
  for (const box of frame.boxes) {
    const [x1, y1, x2, y2] = box.bbox, color = COLORS[box.className];
    const selected = box.id === state.selected;
    const rect = el('rect', { x: x1 * W, y: y1 * H, width: (x2 - x1) * W, height: (y2 - y1) * H, fill: selected ? `${color}33` : 'transparent',
      stroke: box.suggested ? '#f4cf91' : color, 'stroke-width': selected ? 3 : 2, 'stroke-dasharray': box.origin === 'added' || box.suggested ? '6 3' : 'none', 'data-id': box.id, style: 'cursor:move' });
    svg.appendChild(rect);
    const label = el('text', { x: x1 * W + 3, y: Math.max(12, y1 * H - 4), fill: color, 'font-size': 13, 'font-weight': 800, 'pointer-events': 'none',
      'paint-order': 'stroke', stroke: '#071619', 'stroke-width': 3 });
    label.textContent = box.suggested ? `${LABELS[box.className]}?` : LABELS[box.className] + (box.edited || box.origin === 'added' ? ' ✎' : '');
    svg.appendChild(label);
    if (selected) for (const corner of ['nw', 'ne', 'sw', 'se']) {
      svg.appendChild(el('rect', { x: (corner.includes('w') ? x1 : x2) * W - 6, y: (corner.includes('n') ? y1 : y2) * H - 6, width: 12, height: 12,
        fill: '#fff', stroke: '#071619', 'data-corner': corner, style: `cursor:${corner}-resize` }));
    }
  }
  if (state.drag?.mode === 'draw' && state.drag.box) {
    const [x1, y1, x2, y2] = state.drag.box;
    svg.appendChild(el('rect', { x: x1 * W, y: y1 * H, width: (x2 - x1) * W, height: (y2 - y1) * H, fill: 'none', stroke: COLORS[state.drawClass], 'stroke-width': 2, 'stroke-dasharray': '6 3' }));
  }
  renderPanel();
}

function renderPanel() {
  const frame = reviewFrame(), box = selectedBox(), total = state.review.frames.length;
  $('progress').textContent = `第 ${state.current + 1} / ${total} 張`;
  const when = frame.t == null
    ? `${frame.cameraId ?? ''}・${frame.receivedAt ? new Date(frame.receivedAt).toLocaleString('zh-TW', { hour12: false }) : '時間未知'}（擷取接收時間）`
    : `媒體時間 ${frame.t.toFixed(1)} 秒`;
  const pending = frame.boxes.filter(b => b.suggested).length;
  $('frame-info').textContent = `${when}・${frame.boxes.length} 個框${pending ? `・${pending} 個「機車?」待確認` : ''}${frame.reviewed ? '・已完成' : ''}`;
  $('prev').disabled = state.current === 0;
  $('next').textContent = state.current === total - 1 ? '完成最後一張' : '完成，下一張 →';
  $('dots').replaceChildren(...state.review.frames.map((f, i) => {
    const dot = document.createElement('span'); dot.textContent = i + 1;
    dot.className = `${f.reviewed ? 'done' : ''} ${i === state.current ? 'now' : ''}`; return dot;
  }));
  $('selected-label').textContent = box ? `已選取：${LABELS[box.className]}${box.modelClassName && box.modelClassName !== box.className ? `（電腦原判 ${LABELS[box.modelClassName] ?? box.modelClassName}）` : ''}` : `沒有選取框・新增時用「${LABELS[state.drawClass]}」`;
  const active = box ? box.className : state.drawClass;
  $('classes').replaceChildren(...TRUTH_CLASSES.map((c, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = `${i + 1} ${LABELS[c]}`;
    b.style.borderColor = COLORS[c]; b.setAttribute('aria-pressed', String(c === active));
    b.addEventListener('click', () => setClass(c)); return b;
  }));
  $('delete').disabled = !box;
  const s = summarize(state.review);
  $('summary').textContent = `已完成 ${s.reviewed}/${s.frames} 張・改車種 ${s.reclassified}・刪除 ${s.deleted}・新增 ${s.added}`;
}

function setClass(className) {
  const box = selectedBox();
  if (box) { box.className = className; box.edited = true; box.suggested = false; save(); }
  else state.drawClass = className;
  render();
}
function removeSelected() {
  if (!state.selected) return;
  deleteBox(reviewFrame(), state.selected); state.selected = null; save(); render();
}
function go(index) {
  state.current = Math.max(0, Math.min(state.review.frames.length - 1, index)); state.selected = null;
  $('frame').src = new URL(reviewFrame().imageUrl, document.baseURI).href;
  render();
}

svg.addEventListener('pointerdown', event => {
  const p = toNormalized(event), corner = event.target.dataset?.corner, id = event.target.dataset?.id;
  svg.setPointerCapture(event.pointerId);
  if (corner && selectedBox()) state.drag = { mode: 'resize', corner };
  else if (id) { state.selected = id; state.drag = { mode: 'move', last: p }; }
  else { state.selected = null; state.drag = { mode: 'draw', start: p, box: null }; }
  render();
});
svg.addEventListener('pointermove', event => {
  if (!state.drag) return;
  const p = toNormalized(event), box = selectedBox();
  if (state.drag.mode === 'move' && box) {
    const dx = p.x - state.drag.last.x, dy = p.y - state.drag.last.y;
    if (dx || dy) { box.bbox = moveBox(box.bbox, dx, dy); box.edited = true; box.suggested = false; state.drag.last = p; }
  } else if (state.drag.mode === 'resize' && box) {
    box.bbox = resizeBox(box.bbox, state.drag.corner, p.x, p.y); box.edited = true; box.suggested = false;
  } else if (state.drag.mode === 'draw') {
    const s = state.drag.start; state.drag.box = [Math.min(s.x, p.x), Math.min(s.y, p.y), Math.max(s.x, p.x), Math.max(s.y, p.y)];
  }
  render();
});
svg.addEventListener('pointerup', () => {
  const drag = state.drag; state.drag = null;
  if (drag?.mode === 'draw' && drag.box && (drag.box[2] - drag.box[0]) * state.camera.width > 4 && (drag.box[3] - drag.box[1]) * state.camera.height > 4) {
    state.selected = addBox(reviewFrame(), drag.box, state.drawClass).id;
    message(`已新增${LABELS[state.drawClass]}框。`);
  }
  if (drag) save();
  render();
});

$('delete').addEventListener('click', removeSelected);
$('prev').addEventListener('click', () => go(state.current - 1));
$('next').addEventListener('click', () => {
  reviewFrame().reviewed = true; save();
  if (state.current < state.review.frames.length - 1) go(state.current + 1);
  else { render(); message('全部完成了，請按「下載結果 JSON」。'); }
});
$('reset').addEventListener('click', () => {
  if (!confirm('這張的修改都會清除，確定還原？')) return;
  const f = reviewFrame();
  state.review.frames[state.current] = newReviewFrame(state.camera.frames[f.frameIndex], f.frameIndex);
  state.selected = null; save(); render();
});
$('download').addEventListener('click', () => {
  const payload = { ...state.review, exportedAt: new Date().toISOString(), summary: summarize(state.review),
    note: '人工修正後的框（由電腦偵測框起始修改）；只代表這幾張畫面與此審查者的判斷。' };
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = BATCH_ID ? `box-truth-${BATCH_ID}.json` : `box-truth-${CAMERA_ID}-${state.review.captureRunId}.json`;
  a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  message('已下載。');
});
document.addEventListener('keydown', event => {
  if (!state.review || event.target.closest?.('input,textarea,select')) return;
  if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); removeSelected(); }
  else if (/^[1-4]$/.test(event.key)) setClass(TRUTH_CLASSES[Number(event.key) - 1]);
  else if (event.key === 'ArrowLeft') go(state.current - 1);
  else if (event.key === 'ArrowRight') go(state.current + 1);
  else if (event.key === 'Escape') { state.selected = null; render(); }
});

async function loadBatch() {
  let batch;
  try {
    const response = await fetch(`./data/training-batches/${BATCH_ID}.json`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    batch = await response.json();
  } catch (error) { message(`讀不到標註批次 ${BATCH_ID}：${error.message}`); return; }
  state.camera = { width: batch.width, height: batch.height, frames: batch.frames };
  state.key = `xinyi-box-truth:v3-batch:${BATCH_ID}`;
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(state.key) || 'null'); } catch { /* start fresh */ }
  if (saved?.type === TRUTH_SCHEMA && Array.isArray(saved.frames) && saved.frames.length) state.review = saved;
  else {
    state.review = { schemaVersion: 1, type: TRUTH_SCHEMA, batchId: BATCH_ID, captureRunId: BATCH_ID,
      sourceData: `data/training-batches/${BATCH_ID}.json`, framesBlurred: false, startedFrom: batch.prelabel,
      frames: batch.frames.map((f, i) => newReviewFrame(f, i)) };
    save();
  }
  const next = state.review.frames.findIndex(f => !f.reviewed);
  go(next < 0 ? 0 : next);
  message(next > 0 ? `接續上次進度：第 ${next + 1} 張。` : '開始吧：框是電腦的判斷；漏掉的機車請在空白處拖曳補上（先按 2 選機車）。');
}

async function load() {
  if (BATCH_ID) return loadBatch();
  try {
    const response = await fetch(`./data/${DATA_FILE}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.data = await response.json();
  } catch (error) { message(`讀不到驗證資料：${error.message}`); return; }
  state.camera = state.data.cameras.find(c => c.id === CAMERA_ID);
  const runId = state.data.captureRunId;
  state.key = `xinyi-box-truth:v2-consecutive:${CAMERA_ID}:${runId}`;
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(state.key) || 'null'); } catch { /* start fresh */ }
  if (saved?.type === TRUTH_SCHEMA && Array.isArray(saved.frames) && saved.frames.length) {
    state.review = saved;
    if (REQUESTED_COUNT && REQUESTED_COUNT > saved.frames.length && saved.selection?.consecutive) {
      const have = new Set(saved.frames.map(f => f.frameIndex));
      const more = selectFrames(state.camera.frames, { ...saved.selection, end: saved.selection.end ?? Infinity, count: REQUESTED_COUNT })
        .filter(i => !have.has(i));
      state.review.frames.push(...more.map(i => newReviewFrame(state.camera.frames[i], i)));
      state.review.selection.count = state.review.frames.length;
      state.review.window.end = state.review.frames.at(-1).t;
      save();
    }
  } else {
    const fixed = DATA_FILE === 'validation-observations.json';
    const run = longestRunStart(state.camera.frames);
    const count = REQUESTED_COUNT ?? DEFAULT_REVIEW.count;
    const selection = fixed ? { ...DEFAULT_REVIEW, count } : { start: run.start, end: Infinity, count, consecutive: true };
    const indices = selectFrames(state.camera.frames, selection);
    state.review = { schemaVersion: 1, type: TRUTH_SCHEMA, cameraId: CAMERA_ID, captureRunId: runId,
      sourceData: `data/${DATA_FILE}`, framesBlurred: state.data.captureSettings?.framesBlurred !== false,
      window: { start: state.camera.frames[indices[0]]?.t ?? null, end: state.camera.frames[indices.at(-1)]?.t ?? null }, selection: { ...selection, end: Number.isFinite(selection.end) ? selection.end : null },
      startedFrom: 'detectorDetections (post-NMS)', frames: indices.map(i => newReviewFrame(state.camera.frames[i], i)) };
    save();
  }
  const next = state.review.frames.findIndex(f => !f.reviewed);
  go(next < 0 ? 0 : next);
  message(next > 0 ? `接續上次進度：第 ${next + 1} 張。` : '開始吧：先看框對不對。');
}
load();
