import { fitCalibration, projectCalibrated } from './calibration.js';
import { addVehicle, createAnnotation, positionAt, removeKeyframe, removeVehicle, setKeyframe, validateAnnotation, ENTRY_STATES, EXIT_STATES } from './annotation.js';

const CAMERA_ID = 'T000354';
const $ = id => document.getElementById(id);
const els = {
  run: $('run-label'), source: $('source-label'), message: $('load-message'), review: $('review-status'),
  play: $('play-button'), slider: $('time-slider'), back: $('step-back'), forward: $('step-forward'),
  time: $('time-label'), index: $('frame-index'), timestamp: $('frame-timestamp'), capture: $('frame-capture'),
  detectorStage: $('detector-stage'), detectorImage: $('detector-image'), detectorOverlay: $('detector-overlay'), detectorCount: $('detector-count'),
  trackStage: $('track-stage'), trackImage: $('track-image'), trackOverlay: $('track-overlay'), trackCount: $('track-count'),
  eventForm: $('event-form'), eventTime: $('event-time'), eventRows: $('event-rows'), eventCount: $('event-count'),
  coverageStart: $('coverage-start'), coverageEnd: $('coverage-end'), coverageNote: $('coverage-note'),
  export: $('export-button'), pointRows: $('point-rows'), addPoint: $('add-point'), fit: $('fit-button'),
  sourceInput: $('ground-source'), scaleConfirmed: $('scale-confirmed'), calibrationStatus: $('calibration-status'),
  calibrationResult: $('calibration-result'), projectionResult: $('projection-result'),
  referenceImage: $('reference-img'), referencePick: $('reference-pick'), referenceStatus: $('reference-status'),
  referenceSource: $('reference-source'), referenceMark: $('reference-mark'), referenceProjections: $('reference-projections'), projectionCount: $('projection-count'),
};

const state = {
  data: null, camera: null, frames: [], duration: 0, t: 0, frameIndex: -1,
  playing: false, lastTick: 0, imageToken: 0, loadedFrame: -1,
  storageKey: '', events: [], points: [], coverage: { start: '', end: '' },
  groundSource: '', scaleConfirmed: false, pickedImage: null, calibration: null,
  reference: null, referencePointIndex: -1, fallback: false,
  annotation: null, annotationKey: '', activeVehicle: null, clickMode: 'control',
};

function formatTime(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}.${Math.floor((s % 1) * 10 + 1e-6)}`;
}
function displayDate(value) {
  if (!value) return '未知';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '未知' : date.toLocaleString('zh-TW', { hour12: false });
}
function finiteNumber(value) { return value !== '' && value !== null && value !== undefined && Number.isFinite(Number(value)); }
function setMessage(text, isError = false) { els.message.textContent = text; els.message.classList.toggle('error', isError); }
function saveReview() {
  if (!state.storageKey) return;
  try {
    localStorage.setItem(state.storageKey, JSON.stringify({
      schemaVersion: 1, events: state.events, coverage: state.coverage, points: state.points,
      groundSource: state.groundSource, scaleConfirmed: state.scaleConfirmed,
    }));
  } catch { setMessage('瀏覽器無法儲存 localStorage；請先匯出 JSON 保留人工紀錄。', true); }
}
function restoreReview() {
  try {
    const saved = JSON.parse(localStorage.getItem(state.storageKey) || '{}');
    state.events = Array.isArray(saved.events) ? saved.events : [];
    state.points = Array.isArray(saved.points) ? saved.points : [];
    state.coverage = saved.coverage && typeof saved.coverage === 'object' ? saved.coverage : { start: '', end: '' };
    state.groundSource = typeof saved.groundSource === 'string' ? saved.groundSource : '';
    state.scaleConfirmed = saved.scaleConfirmed === true;
  } catch { setMessage('既有本機紀錄無法讀取；本次從空白紀錄開始。', true); }
  els.coverageStart.value = state.coverage.start ?? '';
  els.coverageEnd.value = state.coverage.end ?? '';
  els.sourceInput.value = state.groundSource;
  els.scaleConfirmed.checked = state.scaleConfirmed;
  renderEvents(); renderPoints(); updateCoverage();
}
function lastFrameAt(time) {
  let low = 0, high = state.frames.length - 1, answer = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (Number(state.frames[mid].t) <= time + 1e-7) { answer = mid; low = mid + 1; }
    else high = mid - 1;
  }
  return answer;
}
function setTime(time) {
  state.t = Math.min(state.duration, Math.max(0, Number(time) || 0));
  els.slider.value = String(state.t);
  els.time.textContent = `${formatTime(state.t)} / ${formatTime(state.duration)}`;
  const index = lastFrameAt(state.t);
  if (index !== state.frameIndex) {
    state.frameIndex = index;
    showFrame(index);
  }
  const ended = state.t >= state.duration - 1e-6;
  if (ended && state.playing) pause();
  els.play.textContent = ended ? '重播' : state.playing ? '暫停' : '播放';
}
function pause() { state.playing = false; state.lastTick = 0; els.play.textContent = state.t >= state.duration ? '重播' : '播放'; }
function tick(now) {
  if (state.playing) {
    if (state.lastTick) setTime(state.t + Math.min(0.2, (now - state.lastTick) / 1000));
    state.lastTick = now;
  }
  requestAnimationFrame(tick);
}
function clearImagePanels(message) {
  for (const stage of [els.detectorStage, els.trackStage]) {
    stage.classList.remove('loaded');
    stage.querySelector('.image-placeholder').textContent = message;
  }
  els.detectorOverlay.replaceChildren(); els.trackOverlay.replaceChildren();
  els.detectorImage.removeAttribute('src'); els.trackImage.removeAttribute('src');
  state.loadedFrame = -1;
  renderProjectedTracks();
}
function makeSvg(tag, attributes) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
  return node;
}
function shortId(id) {
  const raw = String(id ?? '?');
  return raw.replace(/^track[-_]?/i, '#').slice(-12);
}
function renderBoxes(svg, detections, type) {
  svg.replaceChildren();
  if (!Array.isArray(detections)) return;
  const width = Number(state.camera.width) || 960, height = Number(state.camera.height) || 540;
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  const stroke = type === 'detector' ? '#f3be72' : '#6ee0cf';
  for (const item of detections) {
    const box = item?.bbox;
    if (!Array.isArray(box) || box.length !== 4 || !box.every(Number.isFinite)) continue;
    const [x1, y1, x2, y2] = box;
    const x = Math.max(0, Math.min(1, x1)) * width, y = Math.max(0, Math.min(1, y1)) * height;
    const w = Math.max(0, Math.min(1, x2) - Math.max(0, x1)) * width;
    const h = Math.max(0, Math.min(1, y2) - Math.max(0, y1)) * height;
    if (!w || !h) continue;
    const label = `${String(item.className || 'unknown')}${type === 'track' ? ` ${shortId(item.id)}` : ''}`;
    const labelWidth = Math.min(width - x, Math.max(48, label.length * 7.5 + 12));
    const labelY = y >= 23 ? y - 20 : y;
    svg.appendChild(makeSvg('rect', { x, y, width: w, height: h, fill: 'none', stroke, 'stroke-width': 2 }));
    svg.appendChild(makeSvg('rect', { x, y: labelY, width: labelWidth, height: 19, fill: '#071619', opacity: .88 }));
    const text = makeSvg('text', { x: x + 5, y: labelY + 14, fill: stroke, 'font-size': 13, 'font-family': 'system-ui,sans-serif', 'font-weight': 700 });
    text.textContent = label;
    svg.appendChild(text);
  }
}
async function showFrame(index) {
  const frame = state.frames[index];
  els.index.textContent = frame ? `影格 ${index + 1} / ${state.frames.length}` : '無影格';
  els.timestamp.textContent = frame ? `媒體時間 ${formatTime(frame.t)}（非來源即時）` : '影格時間 —';
  els.capture.textContent = frame ? `擷取接收 ${displayDate(frame.receivedAt)}（非拍攝時間）` : '擷取接收時間 —';
  els.detectorCount.textContent = Array.isArray(frame?.detectorDetections) ? `${frame.detectorDetections.length} 候選框` : '候選框：未知';
  els.trackCount.textContent = Array.isArray(frame?.detections) ? `${frame.detections.length} 追蹤框` : '追蹤框：未知';
  $('frame-dup-flag').textContent = frame ? (frame.duplicateOfPrevious === true ? '重複畫面（評分略過）' : '新內容畫面') : '—';
  els.back.disabled = index <= 0; els.forward.disabled = index >= state.frames.length - 1;
  const token = ++state.imageToken;
  clearImagePanels(frame?.imageUrl ? '影格載入中…' : '此影格沒有可用影像');
  if (!frame?.imageUrl) return;
  const url = new URL(frame.imageUrl, document.baseURI).href;
  const preload = new Image();
  preload.onload = () => {
    if (token !== state.imageToken || index !== state.frameIndex) return;
    els.detectorImage.src = url; els.trackImage.src = url;
    renderBoxes(els.detectorOverlay, frame.detectorDetections, 'detector');
    renderBoxes(els.trackOverlay, frame.detections, 'track');
    renderAnnotationOverlay();
    els.detectorStage.classList.add('loaded'); els.trackStage.classList.add('loaded');
    state.loadedFrame = index;
    renderProjectedTracks();
  };
  preload.onerror = () => {
    if (token !== state.imageToken) return;
    clearImagePanels('影格影像載入失敗');
    setMessage(`影格 ${index + 1} 的影像無法載入；框數保留供資料檢查。`, true);
  };
  preload.src = url;
}
async function fetchData() {
  let data, fallback = false;
  try {
    const response = await fetch('./data/validation-observations.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    data = await response.json();
    if (!data?.cameras?.some(camera => camera.id === CAMERA_ID && Array.isArray(camera.frames) && camera.frames.length)) throw new Error('新資料無有效 T000354 影格');
  } catch (error) {
    try {
      const response = await fetch('./data/observations.json', { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      data = await response.json(); fallback = true;
      if (!data?.cameras?.some(camera => camera.id === CAMERA_ID && Array.isArray(camera.frames) && camera.frames.length)) throw new Error('舊資料無有效 T000354 影格');
      console.debug('Validation capture unavailable; using legacy sample.', error);
      setMessage('新驗證擷取尚未完成或檔案不可用；目前載入舊 90 秒樣本，無獨立候選框資料。', true);
    } catch (fallbackError) {
      console.debug('No validation or legacy data available.', error, fallbackError);
      setMessage('無可用影格：新驗證擷取與舊樣本均不可用。', true);
      els.run.textContent = '無資料'; els.source.textContent = '資料不可用';
      return;
    }
  }
  state.data = data; state.fallback = fallback;
  state.camera = data.cameras.find(camera => camera.id === CAMERA_ID);
  state.frames = state.camera.frames.filter(frame => Number.isFinite(Number(frame.t))).sort((a, b) => a.t - b.t);
  state.duration = Math.max(0, Number(data.durationSeconds) || Number(state.frames.at(-1)?.t) || 0);
  const runId = String(data.captureRunId || data.capturedAt || (fallback ? 'legacy-90s' : 'unknown-run'));
  state.storageKey = `xinyi-validation:v1:${CAMERA_ID}:${runId}`;
  els.run.textContent = `${fallback ? '舊 90 秒樣本 · ' : ''}${runId}`;
  els.source.textContent = fallback ? 'data/observations.json · 舊資料' : 'data/validation-observations.json';
  if (!fallback) setMessage(`${state.frames.length} 張影格已載入；偵測框為 NMS 後候選，追蹤框為 ByteTrack 輸出。`);
  els.slider.max = String(state.duration); els.slider.step = String(1 / (Number(data.sampleFps) || 5));
  els.slider.disabled = false; els.play.disabled = false;
  restoreReview();
  restoreAnnotation(runId);
  const requested = Number(new URLSearchParams(location.search).get('t'));
  setTime(Number.isFinite(requested) ? requested : 0); els.eventTime.value = state.t.toFixed(1);
}
function updateCoverage() {
  const start = state.coverage.start, end = state.coverage.end;
  const valid = finiteNumber(start) && finiteNumber(end) && Number(start) >= 0 && Number(end) > Number(start) && Number(end) <= state.duration + .1;
  els.coverageNote.textContent = valid
    ? `已標註 ${formatTime(start)}–${formatTime(end)}；manual_review incomplete（仍需逐格檢查並確認覆蓋完整性）。`
    : '尚未標註有效覆蓋區間；manual_review incomplete。';
  els.review.textContent = 'manual_review incomplete';
}
function addCell(row, value) { const cell = row.insertCell(); cell.textContent = value; return cell; }
function renderEvents() {
  els.eventRows.replaceChildren();
  if (!state.events.length) { const row = els.eventRows.insertRow(); const cell = row.insertCell(); cell.colSpan = 6; cell.className = 'empty'; cell.textContent = '尚無人工事件'; }
  state.events.forEach((event, index) => {
    const row = els.eventRows.insertRow();
    addCell(row, formatTime(event.time)); addCell(row, event.class); addCell(row, event.direction);
    addCell(row, event.verdict === 'confirmed' ? '已確認' : '不確定'); addCell(row, event.notes || '—');
    const cell = row.insertCell(); const button = document.createElement('button');
    button.type = 'button'; button.className = 'table-action'; button.textContent = '刪除';
    button.setAttribute('aria-label', `刪除 ${formatTime(event.time)} 人工事件`);
    button.addEventListener('click', () => { state.events.splice(index, 1); saveReview(); renderEvents(); });
    cell.appendChild(button);
  });
  els.eventCount.textContent = `${state.events.length} 筆人工事件（非真實車數）`;
}
function numericInput(value, placeholder, onChange) {
  const input = document.createElement('input'); input.type = 'number'; input.step = 'any';
  input.value = value ?? ''; input.placeholder = placeholder; input.addEventListener('input', () => onChange(input.value));
  return input;
}
function addPoint(imageX = '', imageY = '') {
  const fitCount = state.points.filter(p => p.role === 'fit').length;
  state.points.push({ role: fitCount < 4 ? 'fit' : 'check', imageX, imageY, east: '', north: '' });
  state.referencePointIndex = state.points.length - 1;
  state.calibration = null; saveReview(); renderPoints(); updateCalibrationStatus();
}
function renderPoints() {
  els.pointRows.replaceChildren();
  if (!state.points.length) { const row = els.pointRows.insertRow(); const cell = row.insertCell(); cell.colSpan = 6; cell.className = 'empty'; cell.textContent = '點右側影像，或手動新增控制點'; }
  state.points.forEach((point, index) => {
    const row = els.pointRows.insertRow();
    const role = document.createElement('select');
    for (const value of ['fit', 'check']) { const option = document.createElement('option'); option.value = value; option.textContent = value; role.appendChild(option); }
    role.value = point.role === 'check' ? 'check' : 'fit';
    role.addEventListener('change', () => { point.role = role.value; state.calibration = null; saveReview(); updateCalibrationStatus(); });
    row.insertCell().appendChild(role);
    for (const [field, hint] of [['imageX', '0–1'], ['imageY', '0–1'], ['east', 'm'], ['north', 'm']]) {
      row.insertCell().appendChild(numericInput(point[field], hint, value => {
        point[field] = value; state.referencePointIndex = index; state.calibration = null; saveReview(); updateCalibrationStatus();
      }));
    }
    const cell = row.insertCell(); const button = document.createElement('button');
    button.type = 'button'; button.className = 'table-action'; button.textContent = '刪除';
    button.addEventListener('click', () => { state.points.splice(index, 1); state.calibration = null; state.referencePointIndex = state.points.length - 1; saveReview(); renderPoints(); updateCalibrationStatus(); });
    cell.appendChild(button);
  });
}
function completePoints() {
  const points = [];
  for (const point of state.points) {
    if (![point.imageX, point.imageY, point.east, point.north].every(finiteNumber)) continue;
    const x = Number(point.imageX), y = Number(point.imageY);
    if (x < 0 || x > 1 || y < 0 || y > 1) continue;
    points.push({ image: [x, y], ground: [Number(point.east), Number(point.north)], role: point.role === 'check' ? 'check' : 'fit' });
  }
  return points;
}
function updateCalibrationStatus() {
  const points = completePoints();
  const fit = points.filter(p => p.role === 'fit').length, check = points.filter(p => p.role === 'check').length;
  const fitted = state.calibration?.status === 'fit';
  els.calibrationStatus.textContent = fitted ? '已擬合・待驗收' : '待校正';
  els.calibrationStatus.classList.add('amber');
  if (!fitted) els.calibrationResult.textContent = `可用 fit ${fit} 點、獨立 check ${check} 點；需至少 4 個 fit 點。地面座標未填完整的列不納入。`;
  if (state.pickedImage) projectPicked();
  renderProjectedTracks();
}
function fitPoints() {
  const points = completePoints();
  if (points.length !== state.points.length) {
    state.calibration = null; updateCalibrationStatus();
    els.calibrationResult.textContent = '有控制點未填完整或影像座標超出0–1；請修正或刪除該列後再擬合。'; return;
  }
  if (points.filter(p => p.role === 'fit').length < 4) {
    state.calibration = null; updateCalibrationStatus();
    els.calibrationResult.textContent = '至少需要 4 個完整且幾何分布有效的 fit 控制點；請先補足地面公尺座標。';
    return;
  }
  state.calibration = fitCalibration(points);
  if (state.calibration.status !== 'fit') {
    updateCalibrationStatus();
    els.calibrationResult.textContent = `擬合失敗：${state.calibration.reason || '控制點幾何或數值無效'}。`; return;
  }
  const fit = state.calibration.fit, check = state.calibration.check;
  const checkText = check?.count ? `獨立 check ${check.count} 點，RMSE ${check.rmseMeters.toFixed(2)} m、最大殘差 ${check.maxErrorMeters.toFixed(2)} m。` : '沒有獨立 check 點，無法檢查外部殘差。';
  els.calibrationResult.textContent = `fit ${fit.count} 點，內部 RMSE ${fit.rmseMeters.toFixed(2)} m、最大殘差 ${fit.maxErrorMeters.toFixed(2)} m。${checkText} 此為模型殘差，非地面真值精度。`;
  updateCalibrationStatus();
}
function projectPicked() {
  if (!state.pickedImage) return;
  const { x, y } = state.pickedImage;
  if (state.calibration?.status !== 'fit') {
    els.projectionResult.textContent = `影像試點 x=${x.toFixed(4)}, y=${y.toFixed(4)}；尚未完成有效擬合。`;
    return;
  }
  const result = projectCalibrated({ x, y }, state.calibration);
  els.projectionResult.textContent = result
    ? `影像試點 x=${x.toFixed(4)}, y=${y.toFixed(4)} → 試算東 ${result.eastMeters.toFixed(2)} m、北 ${result.northMeters.toFixed(2)} m；待人工核對來源與精度。`
    : '此影像試點無法投影；請檢查控制點幾何。';
}
function renderProjectedTracks() {
  const svg = els.referenceProjections;
  svg.replaceChildren();
  const reference = state.reference, calibration = state.calibration;
  if (!reference || calibration?.status !== 'fit') {
    els.projectionCount.textContent = '校正候選投影・未驗收：尚無有效擬合。';
    return;
  }
  const width = Number(reference.width) || els.referenceImage.naturalWidth;
  const height = Number(reference.height) || els.referenceImage.naturalHeight;
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  const frame = state.loadedFrame === state.frameIndex ? state.frames[state.frameIndex] : null;
  let shown = 0, outside = 0;
  for (const detection of Array.isArray(frame?.detections) ? frame.detections : []) {
    const bbox = detection?.bbox;
    if (!Array.isArray(bbox) || bbox.length !== 4 || !bbox.every(Number.isFinite)) continue;
    const projected = projectCalibrated({ x: (bbox[0] + bbox[2]) / 2, y: bbox[3] }, calibration);
    if (!projected) continue;
    const x = reference.originPixel[0] + projected.eastMeters / reference.metersPerPixel;
    const y = reference.originPixel[1] - projected.northMeters / reference.metersPerPixel;
    if (x < 0 || x > width || y < 0 || y > height) { outside++; continue; }
    svg.appendChild(makeSvg('circle', { cx: x, cy: y, r: 5, fill: '#74e0d0', stroke: '#071619', 'stroke-width': 2 }));
    shown++;
  }
  els.projectionCount.textContent = `校正候選投影・未驗收：當幀 ${shown} 點在圖內${outside ? `，${outside} 點落在圖外（未強制移入）` : ''}。`;
}
function normalizedImageClick(event, img) {
  const rect = img.getBoundingClientRect();
  const aspect = (img.naturalWidth || Number(state.camera?.width) || 16) / (img.naturalHeight || Number(state.camera?.height) || 9);
  let width = rect.width, height = width / aspect;
  if (height > rect.height) { height = rect.height; width = height * aspect; }
  const left = rect.left + (rect.width - width) / 2, top = rect.top + (rect.height - height) / 2;
  const x = (event.clientX - left) / width, y = (event.clientY - top) / height;
  return x >= 0 && x <= 1 && y >= 0 && y <= 1 ? { x, y } : null;
}
async function loadReference() {
  try {
    const response = await fetch('./data/ground-reference.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const reference = await response.json();
    const origin = reference.originPixel, meters = Number(reference.metersPerPixel);
    if (!Array.isArray(origin) || origin.length !== 2 || !origin.every(Number.isFinite) || !Number.isFinite(meters) || meters <= 0) throw new Error('比例與原點資訊缺失');
    const imageUrl = reference.imageUrl || 'data/ground-reference.jpg';
    const image = new Image();
    image.onload = () => {
      state.reference = reference; els.referenceImage.src = image.src; els.referencePick.disabled = false;
      els.referenceStatus.textContent = '圖資估計・精度未驗證';
      els.referenceSource.textContent = `${reference.sourceTitle || '正射參考圖'}；每像素約 ${meters.toFixed(4)} m。圖面日期不等於拍攝日期，精度未驗證。點圖填最後一個控制點。`;
      if (reference.url) {
        const link = document.createElement('a');
        link.href = reference.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = '官方圖資來源 ↗';
        els.referenceSource.append(' ', link);
      }
      renderProjectedTracks();
    };
    image.onerror = () => { els.referenceStatus.textContent = '參考圖無法載入'; };
    image.src = new URL(imageUrl, document.baseURI).href;
  } catch {
    els.referenceStatus.textContent = '參考圖未提供';
    els.referenceSource.textContent = '可手動輸入有來源的實測地面控制點；缺少正射參考圖時不產生估計座標。';
  }
}
function exportReview() {
  if (!state.data) return;
  const payload = {
    schemaVersion: 1, type: 'manual-validation-record', cameraId: CAMERA_ID,
    captureRunId: state.data.captureRunId || null, capturedAt: state.data.capturedAt || null,
    sourceData: state.fallback ? 'data/observations.json (legacy-90s)' : 'data/validation-observations.json',
    sourceTimeKnown: state.camera.sourceTimeKnown === true, reviewStatus: 'manual_review incomplete',
    reviewedCoverageSeconds: {
      start: finiteNumber(state.coverage.start) ? Number(state.coverage.start) : null,
      end: finiteNumber(state.coverage.end) ? Number(state.coverage.end) : null,
    },
    events: state.events, calibration: {
      groundSource: state.groundSource, scaleConfirmedByReviewer: state.scaleConfirmed,
      referenceMetadata: state.reference, calibrationMatrix: state.calibration?.status === 'fit' ? state.calibration.matrix : null,
      pointRows: state.points, fitDiagnostics: state.calibration?.status === 'fit'
        ? { fit: state.calibration.fit, check: state.calibration.check, validationStatus: state.calibration.validationStatus }
        : null,
      status: els.calibrationStatus.textContent,
    },
    exportedAt: new Date().toISOString(),
    note: '事件與覆蓋區間均為人工紀錄，不能據此宣稱 recall、真實車流量或校正速度。',
  };
  $('export-preview').hidden = false; $('export-preview').open = true;
  $('export-json').value = JSON.stringify(payload, null, 2);
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = `validation-${CAMERA_ID}-${String(state.data.captureRunId || 'legacy').replace(/[^\w-]/g, '')}.json`;
  const previous = $('export-download');
  if (previous.dataset.objectUrl) URL.revokeObjectURL(previous.dataset.objectUrl);
  previous.href = url; previous.download = link.download; previous.dataset.objectUrl = url; previous.hidden = false;
  setMessage('JSON 已產生，可直接複製或按下載連結儲存。');
}

els.play.addEventListener('click', () => {
  if (!state.frames.length) return;
  if (state.playing) pause();
  else { if (state.t >= state.duration) setTime(0); state.playing = true; state.lastTick = 0; els.play.textContent = '暫停'; }
});
els.slider.addEventListener('input', () => { pause(); setTime(els.slider.value); els.eventTime.value = Number(state.t).toFixed(1); });
els.back.addEventListener('click', () => { pause(); setTime(state.frames[Math.max(0, state.frameIndex - 1)].t); els.eventTime.value = Number(state.t).toFixed(1); });
els.forward.addEventListener('click', () => { pause(); setTime(state.frames[Math.min(state.frames.length - 1, state.frameIndex + 1)].t); els.eventTime.value = Number(state.t).toFixed(1); });
els.eventForm.addEventListener('submit', event => {
  event.preventDefault(); if (!state.data) return;
  const time = Number(els.eventTime.value);
  if (!Number.isFinite(time) || time < 0 || time > state.duration + .1) { setMessage('人工事件時間需在此批次片段內。', true); return; }
  state.events.push({ time, class: $('event-class').value, direction: $('event-direction').value,
    verdict: $('event-verdict').value, notes: $('event-notes').value.trim() });
  state.events.sort((a, b) => a.time - b.time); $('event-notes').value = '';
  saveReview(); renderEvents(); setMessage('人工事件已存於此瀏覽器；請視需要匯出 JSON。');
});
for (const [element, field] of [[els.coverageStart, 'start'], [els.coverageEnd, 'end']]) element.addEventListener('input', () => {
  state.coverage[field] = element.value; saveReview(); updateCoverage();
});
els.export.addEventListener('click', exportReview);
els.addPoint.addEventListener('click', () => addPoint());
els.fit.addEventListener('click', fitPoints);
els.sourceInput.addEventListener('input', () => { state.groundSource = els.sourceInput.value; saveReview(); updateCalibrationStatus(); });
els.scaleConfirmed.addEventListener('change', () => { state.scaleConfirmed = els.scaleConfirmed.checked; saveReview(); updateCalibrationStatus(); });
els.trackStage.addEventListener('click', event => {
  if (state.loadedFrame !== state.frameIndex) return;
  const point = normalizedImageClick(event, els.trackImage);
  if (!point) return;
  if (state.clickMode === 'annotate') { annotateAt(point); return; }
  state.pickedImage = point; addPoint(point.x.toFixed(5), point.y.toFixed(5)); projectPicked();
  els.referenceStatus.textContent = '影像點已加入；請點對應正射位置';
});
els.referencePick.addEventListener('click', event => {
  if (!state.reference || !state.points.length) { els.referenceStatus.textContent = '請先在 CCTV 影像選點'; return; }
  const point = normalizedImageClick(event, els.referenceImage);
  if (!point) return;
  const rowIndex = state.referencePointIndex >= 0 ? state.referencePointIndex : state.points.length - 1;
  const row = state.points[rowIndex]; if (!row) return;
  const px = point.x * (Number(state.reference.width) || els.referenceImage.naturalWidth);
  const py = point.y * (Number(state.reference.height) || els.referenceImage.naturalHeight);
  row.east = ((px - state.reference.originPixel[0]) * state.reference.metersPerPixel).toFixed(3);
  row.north = ((state.reference.originPixel[1] - py) * state.reference.metersPerPixel).toFixed(3);
  row.groundBasis = 'NLSC-PHOTO2-map-derived-unverified';
  if (!state.groundSource) { state.groundSource = state.reference.sourceTitle + '（圖資估計・精度未驗證）'; els.sourceInput.value = state.groundSource; }
  state.scaleConfirmed = false; els.scaleConfirmed.checked = false;
  state.calibration = null; saveReview(); renderPoints(); updateCalibrationStatus();
  els.referenceMark.hidden = false; els.referenceMark.style.left = `${point.x * 100}%`; els.referenceMark.style.top = `${point.y * 100}%`;
  els.referenceStatus.textContent = `已填第 ${rowIndex + 1} 點・圖資估計`;
});

function annotationTime() { return Number(state.frames[state.frameIndex]?.t); }
function saveAnnotation() {
  if (!state.annotationKey || !state.annotation) return;
  try { localStorage.setItem(state.annotationKey, JSON.stringify(state.annotation)); }
  catch { setMessage('瀏覽器無法儲存標註；請立即匯出 JSON。', true); }
}
function restoreAnnotation(runId) {
  state.annotationKey = `xinyi-annotation:v1:${CAMERA_ID}:${runId}`;
  const fresh = createAnnotation({ cameraId: CAMERA_ID, captureRunId: state.data.captureRunId || null,
    sourceData: state.fallback ? 'data/observations.json' : 'data/validation-observations.json' });
  try {
    const saved = JSON.parse(localStorage.getItem(state.annotationKey) || 'null');
    state.annotation = saved && Array.isArray(saved.vehicles) ? { ...fresh, ...saved } : fresh;
  } catch { state.annotation = fresh; setMessage('既有標註無法讀取；本次從空白開始。', true); }
  $('ann-start').value = state.annotation.window.start; $('ann-end').value = state.annotation.window.end;
  $('ann-pass').value = state.annotation.pass; $('ann-annotator').value = state.annotation.annotator;
  $('ann-complete').checked = state.annotation.allVisibleVehiclesAnnotated === true;
  state.activeVehicle = state.annotation.vehicles.at(-1)?.id ?? null;
  renderAnnotation();
}
function activeVehicle() { return state.annotation?.vehicles.find(v => v.id === state.activeVehicle) ?? null; }
function annotateAt(point) {
  const vehicle = activeVehicle();
  if (!vehicle) { setMessage('請先在「逐車標註」新增或選取一台車。', true); return; }
  const frame = state.frames[state.frameIndex];
  setKeyframe(vehicle, { t: annotationTime(), x: point.x, y: point.y, visibility: $('ann-visibility').value,
    duplicateFrame: frame?.duplicateOfPrevious === true });
  saveAnnotation(); renderAnnotation(); redrawTrackOverlay();
  setMessage(`${vehicle.id} 已記錄 ${formatTime(annotationTime())} 的位置${frame?.duplicateOfPrevious ? '（重複畫面，評分略過）' : ''}。`);
}
function redrawTrackOverlay() {
  if (state.loadedFrame !== state.frameIndex) return;
  renderBoxes(els.trackOverlay, state.frames[state.frameIndex]?.detections, 'track');
  renderAnnotationOverlay();
}
function renderAnnotationOverlay() {
  if (!state.annotation || state.loadedFrame !== state.frameIndex) return;
  const width = Number(state.camera.width) || 960, height = Number(state.camera.height) || 540, t = annotationTime();
  for (const vehicle of state.annotation.vehicles) {
    const p = positionAt(vehicle, t);
    if (!p) continue;
    const active = vehicle.id === state.activeVehicle;
    const color = active ? '#ffd27a' : '#f59bd0';
    els.trackOverlay.appendChild(makeSvg('circle', { cx: p.x * width, cy: p.y * height, r: active ? 7 : 5,
      fill: p.interpolated ? 'none' : color, stroke: color, 'stroke-width': 2, 'stroke-dasharray': p.interpolated ? '3 2' : 'none' }));
    const label = makeSvg('text', { x: p.x * width + 9, y: p.y * height + 4, fill: color, 'font-size': 13, 'font-weight': 800, 'font-family': 'system-ui,sans-serif' });
    label.textContent = vehicle.id; els.trackOverlay.appendChild(label);
  }
}
function optionSelect(values, current, onChange) {
  const select = document.createElement('select');
  for (const value of values) { const option = document.createElement('option'); option.value = value; option.textContent = value; select.appendChild(option); }
  select.value = current; select.addEventListener('change', () => onChange(select.value));
  return select;
}
function renderAnnotation() {
  const ann = state.annotation, rows = $('ann-rows');
  rows.replaceChildren();
  if (!ann?.vehicles.length) { const cell = rows.insertRow().insertCell(); cell.colSpan = 9; cell.className = 'empty'; cell.textContent = '尚未新增車輛'; }
  for (const vehicle of ann?.vehicles ?? []) {
    const row = rows.insertRow(); if (vehicle.id === state.activeVehicle) row.className = 'active';
    const pick = document.createElement('input'); pick.type = 'radio'; pick.name = 'ann-active'; pick.checked = vehicle.id === state.activeVehicle;
    pick.setAttribute('aria-label', `選取 ${vehicle.id}`);
    pick.addEventListener('change', () => { state.activeVehicle = vehicle.id; renderAnnotation(); redrawTrackOverlay(); });
    row.insertCell().appendChild(pick); addCell(row, vehicle.id);
    const change = field => value => { vehicle[field] = value; saveAnnotation(); };
    row.insertCell().appendChild(optionSelect(['car', 'motorcycle', 'bus', 'truck', 'unknown'], vehicle.className, change('className')));
    addCell(row, String(vehicle.keyframes.length));
    addCell(row, vehicle.keyframes.length ? `${formatTime(vehicle.keyframes[0].t)}–${formatTime(vehicle.keyframes.at(-1).t)}` : '—');
    row.insertCell().appendChild(optionSelect(ENTRY_STATES, vehicle.entry, change('entry')));
    row.insertCell().appendChild(optionSelect(EXIT_STATES, vehicle.exit, change('exit')));
    const notes = document.createElement('input'); notes.value = vehicle.notes; notes.maxLength = 200; notes.addEventListener('input', () => change('notes')(notes.value));
    row.insertCell().appendChild(notes);
    const del = document.createElement('button'); del.type = 'button'; del.className = 'table-action'; del.textContent = '刪除';
    del.addEventListener('click', () => { if (!confirm(`刪除 ${vehicle.id} 及其所有關鍵幀？`)) return; removeVehicle(ann, vehicle.id); if (state.activeVehicle === vehicle.id) state.activeVehicle = ann.vehicles.at(-1)?.id ?? null; saveAnnotation(); renderAnnotation(); redrawTrackOverlay(); });
    row.insertCell().appendChild(del);
  }
  const vehicle = activeVehicle(), list = $('ann-keyframes');
  list.replaceChildren();
  $('ann-active').textContent = vehicle ? `目前選取 ${vehicle.id}（${vehicle.className}）；點關鍵幀可跳到該時間，右鍵刪除。` : '尚未選取車輛。';
  for (const k of vehicle?.keyframes ?? []) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'quiet';
    button.textContent = `${formatTime(k.t)}${k.visibility === 'visible' ? '' : k.visibility === 'occluded' ? ' 遮擋' : ' ?'}${k.duplicateFrame ? ' 重複' : ''}`;
    button.addEventListener('click', () => { pause(); setTime(k.t); });
    button.addEventListener('contextmenu', event => { event.preventDefault(); removeKeyframe(vehicle, k.t); saveAnnotation(); renderAnnotation(); redrawTrackOverlay(); });
    list.appendChild(button);
  }
  const keyframes = (ann?.vehicles ?? []).reduce((n, v) => n + v.keyframes.length, 0);
  $('ann-summary').textContent = `${ann?.vehicles.length ?? 0} 台車 · ${keyframes} 個關鍵幀`;
  $('ann-status').textContent = ann?.allVisibleVehiclesAnnotated ? '已宣告完整' : ann?.vehicles.length ? '標註中' : '未開始';
}
function exportAnnotation() {
  if (!state.annotation) return;
  const errors = validateAnnotation(state.annotation);
  const payload = { ...state.annotation, exportedAt: new Date().toISOString(), validationErrors: errors,
    note: '人工關鍵幀標註；位置為影像歸一化座標（車輛底部中心），不是地面座標。' };
  const text = JSON.stringify(payload, null, 2);
  $('ann-export-preview').hidden = false; $('ann-export-preview').open = true; $('ann-export-json').value = text;
  const link = $('ann-export-download');
  if (link.dataset.objectUrl) URL.revokeObjectURL(link.dataset.objectUrl);
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  link.href = url; link.dataset.objectUrl = url; link.hidden = false;
  link.download = `annotation-${CAMERA_ID}-${String(state.annotation.captureRunId || 'legacy').replace(/[^\w-]/g, '')}-${state.annotation.pass}.json`;
  setMessage(errors.length ? `已匯出，但有 ${errors.length} 個問題：${errors.slice(0, 3).join('；')}` : '標註 JSON 已產生，請下載保存。', errors.length > 0);
}
for (const radio of document.querySelectorAll('input[name="click-mode"]')) radio.addEventListener('change', () => {
  state.clickMode = radio.value;
  els.trackStage.querySelector('.image-placeholder').textContent = state.clickMode === 'annotate' ? '點車輛底部中心以標註' : '點影像以新增校正影像點';
});
$('ann-add').addEventListener('click', () => {
  if (!state.annotation) return;
  const vehicle = addVehicle(state.annotation, $('ann-class').value);
  state.activeVehicle = vehicle.id; saveAnnotation(); renderAnnotation();
  const annotateRadio = document.querySelector('input[name="click-mode"][value="annotate"]');
  if (!annotateRadio.checked) { annotateRadio.checked = true; annotateRadio.dispatchEvent(new Event('change')); }
  setMessage(`已新增 ${vehicle.id}；請在右圖點它的底部中心。`);
});
for (const [id, field, parse] of [['ann-start', 'start', Number], ['ann-end', 'end', Number]]) $(id).addEventListener('input', () => {
  if (!state.annotation) return; state.annotation.window[field] = parse($(id).value); saveAnnotation();
});
$('ann-pass').addEventListener('change', () => { state.annotation.pass = $('ann-pass').value; saveAnnotation(); });
$('ann-annotator').addEventListener('input', () => { state.annotation.annotator = $('ann-annotator').value.trim(); saveAnnotation(); });
$('ann-complete').addEventListener('change', () => { state.annotation.allVisibleVehiclesAnnotated = $('ann-complete').checked; saveAnnotation(); renderAnnotation(); });
$('ann-export').addEventListener('click', exportAnnotation);

requestAnimationFrame(tick);
fetchData();
loadReference();
