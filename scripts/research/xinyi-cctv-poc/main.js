import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildTrafficState, cameraPosition, MAX_PREDICTION_HORIZON } from './traffic.js';
import { CAMERA_CONFIGS } from './camera-configs.js';
import { analyzeCamera } from './analytics.js';

const $ = (id) => document.getElementById(id);
const CAMERA_ORDER = ['T000354', 'T000330', 'T000283'];
const cameraNames = { T000354: '西段', T000330: '中段', T000283: '東段' };
const dom = {
  host: $('scene'), observed: $('observed-count'), stationary: $('stationary-count'), predicted: $('predicted-count'), scenario: $('scenario-count'),
  sceneStatus: $('scene-status'), sceneMode: $('scene-mode-badge'), method: $('method-summary'), fps: $('scene-fps'), compass: document.querySelector('.compass'), empty: $('viewport-empty'), captureTime: $('capture-time'),
  mode: $('data-mode'), source: $('source-note'), filter: $('filter-note'), model: $('model-note'), cameras: $('camera-list'),
  play: $('play-toggle'), playIcon: $('play-icon'), timeline: $('timeline'), current: $('time-current'), total: $('time-total'),
  speed: $('speed'), speedValue: $('speed-value'), horizon: $('horizon'), horizonValue: $('horizon-value'),
  modeSelect: $('view-mode'), smooth: $('smooth-motion'), stationaryToggle: $('show-stationary'), corridorDirection: $('corridor-direction'),
  predictions: $('show-prediction'), outage: $('simulate-outage'), all: $('focus-all'), selected: $('focus-selected'), classFilter: $('class-filter'),
  comparisonCamera: $('comparison-camera'), matchedFrame: $('matched-frame'), frameOverlay: $('frame-overlay'), frameFallback: $('frame-fallback'), frameEnded: $('frame-ended'),
  frameTime: $('frame-time'), frameSourceStatus: $('frame-source-status'), frameCaveat: $('frame-caveat'), roiOccupancy: $('roi-occupancy'),
  crossingAB: $('crossing-ab'), crossingBA: $('crossing-ba'), classCounts: $('class-counts'), classCrossings: $('class-crossings'), calibrationSpeed: $('calibration-speed'),
};

const state = { data: null, selected: 'T000354', viewDirections: {}, t: 0, maxT: 0, playing: false, lastUiAt: 0, lastRealAt: 0, fpsAt: 0, fpsFrames: 0, frameUrl: '', frameLoaded: false, overlayKey: '', renderedVehicles: new Map(), viewArrows: new Map(), roadBuilt: false, disposed: false };
const scene = new THREE.Scene();
scene.background = new THREE.Color('#172723');
scene.fog = new THREE.FogExp2('#172723', 0.00035);
const viewCamera = new THREE.PerspectiveCamera(39, 1, 1, 3500);
viewCamera.position.set(80, 850, 1200);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
dom.host.appendChild(renderer.domElement);
const controls = new OrbitControls(viewCamera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.065;
controls.maxPolarAngle = Math.PI / 2.07;
controls.minDistance = 90;
controls.maxDistance = 1900;
controls.target.set(0, 0, 0);
controls.update();
const compassCenter = new THREE.Vector3();
const compassNorth = new THREE.Vector3();

const ambient = new THREE.AmbientLight('#d6e8d7', 2.1);
scene.add(ambient);
const sun = new THREE.DirectionalLight('#f2e5c5', 2.8);
sun.position.set(-350, 700, 450);
scene.add(sun);
const rim = new THREE.DirectionalLight('#54c9aa', 1.1);
rim.position.set(450, 150, -250);
scene.add(rim);

const staticGroup = new THREE.Group();
scene.add(staticGroup);
const vehicleGroup = new THREE.Group();
scene.add(vehicleGroup);
const markerObjects = [];
const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: .82, metalness: .08, ...opts });
const baseMaterial = mat('#254039');
const roadMaterial = mat('#283432', { roughness: 1 });
const walkwayMaterial = mat('#425049', { roughness: 1 });
const laneMaterial = new THREE.MeshBasicMaterial({ color: '#d8cda8', transparent: true, opacity: .38 });
const crossingMaterial = new THREE.MeshBasicMaterial({ color: '#d5d7bf', transparent: true, opacity: .48 });
const tealMaterial = mat('#68d7b8', { emissive: '#1d6658', emissiveIntensity: .4 });
const stationaryMaterial = mat('#aebcb4', { emissive: '#4b5f58', emissiveIntensity: .18 });
const scenarioMaterial = mat('#73b9df', { emissive: '#245b76', emissiveIntensity: .28 });
const amberMaterial = new THREE.MeshBasicMaterial({ color: '#eabd70', wireframe: true, transparent: true, opacity: .62, depthWrite: false });
const glassMaterial = mat('#c1e5d5', { metalness: .12 });
const lightMaterial = new THREE.MeshBasicMaterial({ color: '#ffeab2' });
const wheelMaterial = mat('#1b2926');
const vehicleGeometries = {
  car: new THREE.BoxGeometry(5, 1.2, 2.1), carRoof: new THREE.BoxGeometry(2.8, .8, 1.8),
  motorcycle: new THREE.BoxGeometry(2.2, .55, .75), wheel: new THREE.CylinderGeometry(.43, .43, .18, 12),
  bus: new THREE.BoxGeometry(11.5, 2.7, 2.5), busWindow: new THREE.BoxGeometry(9.8, .72, 2.52),
  truck: new THREE.BoxGeometry(6.3, 2.5, 2.45), truckCab: new THREE.BoxGeometry(2.5, 1.95, 2.35),
  lamp: new THREE.BoxGeometry(.1, .26, .32),
};

function addBox(w, h, d, material, x, y, z, group = staticGroup) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.receiveShadow = false;
  group.add(mesh);
  return mesh;
}
function buildRoad(cameras = []) {
  if (state.roadBuilt) return;
  state.roadBuilt = true;
  addBox(1320, 1.2, 580, baseMaterial, 0, -2, 0);
  const gridMaterial = new THREE.LineBasicMaterial({ color: '#395e4e', transparent: true, opacity: .23 });
  const grid = new THREE.GridHelper(1320, 44, '#557c66', '#395e4e');
  grid.position.y = -1.2;
  grid.material = gridMaterial;
  staticGroup.add(grid);
  // These are three schematic crossroads along the measured camera longitude spacing.
  const junctions = cameras.map(c => ({ id: c.id, x: cameraPosition(c).x }));
  for (const { x } of junctions) {
    addBox(40, .32, 420, roadMaterial, x, .02, 0);
    for (const side of [-1, 1]) {
      addBox(6, .38, 164, walkwayMaterial, x - 25, .14, side * 126);
      addBox(6, .38, 164, walkwayMaterial, x + 25, .14, side * 126);
    }
  }
  addBox(1050, .36, 52, roadMaterial, 0, .04, 0);
  const sortedJunctions = junctions.map(j => j.x).sort((a, b) => a - b);
  let sidewalkStart = -525;
  for (let i = 0; i <= sortedJunctions.length; i++) {
    const end = i < sortedJunctions.length ? sortedJunctions[i] - 28 : 525;
    if (end > sidewalkStart) for (const z of [-31, 31]) addBox(end - sidewalkStart, .35, 8, walkwayMaterial, (sidewalkStart + end) / 2, .12, z);
    sidewalkStart = i < sortedJunctions.length ? sortedJunctions[i] + 28 : 525;
  }
  for (const z of [-13, 0, 13]) for (let x = -510; x <= 510; x += 25) {
    if (junctions.some(j => Math.abs(j.x - x) < 32)) continue;
    addBox(13, .04, .45, laneMaterial, x, .29, z);
  }
  for (const { id, x } of junctions) {
    for (let z = -190; z <= 190; z += 25) {
      if (Math.abs(z) < 35) continue;
      addBox(.48, .04, 12, laneMaterial, x, .29, z);
    }
    for (const side of [-1, 1]) {
      for (let z = -22; z <= 22; z += 5.7) addBox(2.5, .05, 3.2, crossingMaterial, x + side * 32, .32, z);
      for (let localX = -16; localX <= 16; localX += 5.4) addBox(3.1, .05, 2.5, crossingMaterial, x + localX, .32, side * 33);
    }
    const streetName = CAMERA_CONFIGS[id]?.crossStreetName || '交叉道路（名稱待確認）';
    const roadSign = labelSprite(streetName, '#d6e4d0');
    roadSign.position.set(x, 16, -192);
    staticGroup.add(roadSign);
    const localXinyi = labelSprite('信義路 → 東', '#c8ddcc');
    localXinyi.scale.set(64, 12, 1);
    localXinyi.position.set(x + 76, 6, 39);
    staticGroup.add(localXinyi);
    const busSign = labelSprite('← 公車示意', '#81b9d7');
    busSign.scale.set(49, 9, 1);
    busSign.position.set(x + 79, 5, -38);
    staticGroup.add(busSign);
    staticGroup.add(new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(x + 48, .5, 13), 31, '#9dd7bc', 5, 3));
    staticGroup.add(new THREE.ArrowHelper(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(x + 79, .5, -13), 31, '#81b9d7', 5, 3));
  }
  const xinyiSign = labelSprite('信義路四段', '#c8ddcc');
  xinyiSign.position.set(-220, 14, 62);
  staticGroup.add(xinyiSign);
  const eastSign = labelSprite('E →', '#9de6c7');
  eastSign.scale.set(54, 12, 1);
  eastSign.position.set(-108, 13, 62);
  staticGroup.add(eastSign);
  const northSign = labelSprite('N ↑', '#9de6c7');
  northSign.scale.set(54, 12, 1);
  northSign.position.set(-595, 12, -154);
  staticGroup.add(northSign);
  const tickMaterial = new THREE.MeshBasicMaterial({ color: '#7fae93', transparent: true, opacity: .55 });
  for (let x = -500; x <= 500; x += 100) addBox(.5, .03, 5, tickMaterial, x, .3, -46);
}

function labelSprite(text, color = '#dbe6d2') {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#162623df';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#6b9981';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, 510, 94);
  ctx.fillStyle = color;
  ctx.font = '600 39px Avenir Next, PingFang TC, sans-serif';
  ctx.fillText(text, 22, 59);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true }));
  sprite.scale.set(108, 20, 1);
  return sprite;
}

function buildMarkers(cameras) {
  const poleMaterial = mat('#a4c1a6');
  const ringMaterial = new THREE.MeshBasicMaterial({ color: '#8dd3ad', transparent: true, opacity: .8, side: THREE.DoubleSide });
  for (const [i, camera] of cameras.entries()) {
    const p = cameraPosition(camera);
    const marker = new THREE.Group();
    marker.position.set(p.x + 22, 0, p.z + 78);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(.65, .9, 25, 8), poleMaterial);
    stem.position.y = 12.5;
    marker.add(stem);
    const gimbal = new THREE.Group();
    const head = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 5), poleMaterial);
    head.position.set(0, 25.5, -1.7);
    gimbal.add(head);
    const lens = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.25, .3), tealMaterial);
    lens.position.set(0, 25.5, -4.35);
    gimbal.add(lens);
    marker.add(gimbal);
    const ring = new THREE.Mesh(new THREE.RingGeometry(11.5, 12.2, 48), ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = .45;
    marker.add(ring);
    const label = labelSprite(`${String(i + 1).padStart(2, '0')}  ${camera.id}`);
    label.scale.set(46, 8.5, 1);
    label.position.set(40, 15, 35);
    marker.add(label);
    // The default strip looks north along the cross street; it is not a calibrated footprint.
    const view = new THREE.Group();
    view.position.set(-22, .48, -42);
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(24, 165), new THREE.MeshBasicMaterial({ color: '#76cdb0', transparent: true, opacity: .11, side: THREE.DoubleSide, depthWrite: false }));
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(0, 0, -82.5);
    view.add(strip);
    const axis = new THREE.Mesh(new THREE.BoxGeometry(.65, .08, 150), new THREE.MeshBasicMaterial({ color: '#8dd7ba', transparent: true, opacity: .65 }));
    axis.position.set(0, .08, -78);
    view.add(axis);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(3, 8, 4), new THREE.MeshBasicMaterial({ color: '#9de6c7' }));
    tip.rotation.x = -Math.PI / 2;
    tip.position.set(0, .08, -160);
    view.add(tip);
    marker.add(view);
    state.viewArrows.set(camera.id, { view, gimbal });
    updateViewArrow(camera.id);
    const target = new THREE.Mesh(new THREE.SphereGeometry(9, 12, 8), new THREE.MeshBasicMaterial({ visible: false }));
    target.position.y = 24;
    target.userData.cameraId = camera.id;
    marker.add(target);
    markerObjects.push(target);
    staticGroup.add(marker);
  }
}
function directionYaw(direction) {
  return { N: 0, E: -Math.PI / 2, S: Math.PI, W: Math.PI / 2 }[direction] ?? 0;
}
function updateViewArrow(id) {
  const marker = state.viewArrows.get(id);
  if (!marker) return;
  const yaw = directionYaw(state.viewDirections[id]);
  marker.view.rotation.y = yaw;
  marker.gimbal.rotation.y = yaw;
}

function normalizeClass(value) {
  const name = String(value || '').toLowerCase();
  if (name.includes('motorcycle') || name.includes('motorbike')) return 'motorcycle';
  if (name.includes('bus')) return 'bus';
  if (name.includes('truck')) return 'truck';
  return 'car';
}
function addVehiclePart(group, geometry, material, x, y, z, rotationX = 0) {
  const part = new THREE.Mesh(geometry, material);
  part.position.set(x, y, z);
  part.rotation.x = rotationX;
  group.add(part);
  return part;
}
function makeVehicle(v) {
  const group = new THREE.Group();
  const predicted = v.kind === 'predicted';
  const scenario = v.kind === 'scenario';
  const bodyMaterial = predicted ? amberMaterial.clone() : scenario ? scenarioMaterial.clone() : v.kind === 'stationary' ? stationaryMaterial : tealMaterial;
  if (predicted || scenario) group.userData.fadeMaterial = bodyMaterial;
  const cls = normalizeClass(v.className);
  if (cls === 'motorcycle') {
    addVehiclePart(group, vehicleGeometries.motorcycle, bodyMaterial, 0, .88, 0);
    for (const x of [-.75, .75]) addVehiclePart(group, vehicleGeometries.wheel, predicted ? bodyMaterial : wheelMaterial, x, .48, 0, Math.PI / 2);
  } else if (cls === 'bus') {
    addVehiclePart(group, vehicleGeometries.bus, bodyMaterial, 0, 1.6, 0);
    if (!predicted) addVehiclePart(group, vehicleGeometries.busWindow, glassMaterial, -.2, 2.33, 0);
  } else if (cls === 'truck') {
    addVehiclePart(group, vehicleGeometries.truck, bodyMaterial, -1.3, 1.55, 0);
    addVehiclePart(group, vehicleGeometries.truckCab, bodyMaterial, 3.05, 1.3, 0);
    if (!predicted) for (const z of [-.82, .82]) addVehiclePart(group, vehicleGeometries.lamp, lightMaterial, 4.35, 1.2, z);
  } else {
    addVehiclePart(group, vehicleGeometries.car, bodyMaterial, 0, .96, 0);
    if (!predicted) {
      addVehiclePart(group, vehicleGeometries.carRoof, glassMaterial, -.35, 1.88, 0);
      for (const z of [-.7, .7]) addVehiclePart(group, vehicleGeometries.lamp, lightMaterial, 2.56, 1.0, z);
    }
  }
  vehicleGroup.add(group);
  return group;
}
function removeVehicle(item) {
  vehicleGroup.remove(item.group);
  item.group.userData.fadeMaterial?.dispose();
}
function updateVehicles(vehicles) {
  const keep = new Set();
  let visibleCount = 0;
  for (const v of vehicles) {
    if (dom.classFilter.value !== 'all' && normalizeClass(v.className) !== dom.classFilter.value) continue;
    if (v.kind === 'predicted' && !dom.predictions.checked) continue;
    if (v.kind === 'stationary' && !dom.stationaryToggle.checked) continue;
    keep.add(v.key);
    let item = state.renderedVehicles.get(v.key);
    const cls = normalizeClass(v.className);
    if (item && (item.kind !== v.kind || item.cls !== cls)) { removeVehicle(item); state.renderedVehicles.delete(v.key); item = null; }
    if (!item) { item = { group: makeVehicle(v), kind: v.kind, cls }; state.renderedVehicles.set(v.key, item); }
    item.group.position.set(v.x, 0, v.z);
    item.group.rotation.y = -v.heading;
    item.group.visible = v.opacity > .02;
    if (item.group.visible) visibleCount++;
    if (v.kind === 'predicted' || v.kind === 'scenario') {
      const m = item.group.userData.fadeMaterial;
      m.transparent = true;
      m.opacity = Math.min(v.kind === 'predicted' ? .62 : 1, Math.max(.04, v.opacity * (v.kind === 'predicted' ? 1.3 : 1)));
      m.depthWrite = v.kind !== 'predicted';
    }
  }
  for (const [key, item] of state.renderedVehicles) if (!keep.has(key)) { removeVehicle(item); state.renderedVehicles.delete(key); }
  return visibleCount;
}

function seconds(t) {
  const n = Math.max(0, Math.floor(t));
  return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
}
function preciseSeconds(t) {
  const tenths = Math.floor(Math.max(0, Number(t) || 0) * 10 + 1e-6);
  return `${String(Math.floor(tenths / 600)).padStart(2, '0')}:${String(Math.floor(tenths / 10) % 60).padStart(2, '0')}.${tenths % 10}`;
}
function frameAtOrBefore(camera, time) {
  const frames = camera?.frames || [];
  let lo = 0, hi = frames.length;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (frames[mid].t <= time) lo = mid + 1; else hi = mid; }
  return lo ? frames[lo - 1] : null;
}
function svgElement(name, attrs = {}) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}
function shortLocalId(cameraId, trackerId) {
  let hash = 2166136261;
  for (const ch of `${cameraId}:${trackerId}`) { hash ^= ch.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(16).toUpperCase().padStart(8, '0').slice(-4);
}
const classLabels = { car: '小客車', motorcycle: '機車', bus: '公車', truck: '貨車' };
function drawFrameOverlay(camera, frame, synchronized, config) {
  const width = Number(camera.width) || 640, height = Number(camera.height) || 360;
  const overlay = dom.frameOverlay;
  overlay.setAttribute('viewBox', `0 0 ${width} ${height}`);
  overlay.replaceChildren();
  const toPixels = p => [p[0] * width, p[1] * height];
  if (Array.isArray(config?.perspectiveQuad) && config.perspectiveQuad.length === 4) {
    const quad = svgElement('polygon', { points: config.perspectiveQuad.map(p => toPixels(p).join(',')).join(' '), class: 'overlay-quad' });
    overlay.appendChild(quad);
  }
  if (Array.isArray(config?.roi) && config.roi.length >= 3) {
    const roi = svgElement('polygon', { points: config.roi.map(p => toPixels(p).join(',')).join(' '), class: 'overlay-roi' });
    overlay.appendChild(roi);
  }
  if (Array.isArray(config?.countLine) && config.countLine.length === 2) {
    const [[x1, y1], [x2, y2]] = config.countLine.map(toPixels);
    overlay.appendChild(svgElement('line', { x1, y1, x2, y2, class: 'overlay-line' }));
    const midX = (x1 + x2) / 2, midY = (y1 + y2) / 2;
    const length = Math.hypot(x2 - x1, y2 - y1) || 1;
    const nx = -(y2 - y1) / length, ny = (x2 - x1) / length;
    for (const [name, sign] of [['A', 1], ['B', -1]]) {
      const text = svgElement('text', { x: midX + sign * nx * 16, y: midY + sign * ny * 16, fill: '#f3c47e', class: 'bbox-label', 'text-anchor': 'middle' });
      text.textContent = name;
      overlay.appendChild(text);
    }
  }
  // Fixed previews can show baked boxes from another time. Never draw current boxes over them.
  if (!synchronized || !frame) return;
  const selectedClass = dom.classFilter.value;
  for (const detection of frame.detections || []) {
    if (!Array.isArray(detection.bbox) || detection.bbox.length !== 4) continue;
    const cls = normalizeClass(detection.className);
    if (selectedClass !== 'all' && cls !== selectedClass) continue;
    const [left, top, right, bottom] = detection.bbox;
    if (![left, top, right, bottom].every(Number.isFinite) || right <= left || bottom <= top) continue;
    const color = { car: '#71e4c0', motorcycle: '#e2d890', bus: '#8ec5ed', truck: '#e8aa8d' }[cls];
    overlay.appendChild(svgElement('rect', { x: left * width, y: top * height, width: (right - left) * width, height: (bottom - top) * height, fill: 'none', stroke: color, 'stroke-width': 2 }));
    const label = svgElement('text', { x: left * width + 3, y: Math.max(13, top * height - 4), fill: color, class: 'bbox-label' });
    label.textContent = `${classLabels[cls]} #${shortLocalId(camera.id, detection.id)}`;
    overlay.appendChild(label);
  }
}
function metricText(value, status) {
  if (value != null) return String(value);
  return { unavailable: '無資料', waiting: '等待影格', stale: '已過期' }[status] || '待設定';
}
function updateComparison() {
  if (!state.data) return;
  const camera = state.data.cameras.find(c => c.id === state.selected);
  if (!camera) return;
  const config = CAMERA_CONFIGS[camera.id] || {};
  const frame = frameAtOrBefore(camera, state.t);
  const synchronized = Boolean(frame?.imageUrl);
  const imageUrl = synchronized ? frame.imageUrl : camera.previewUrl || '';
  dom.comparisonCamera.textContent = `${camera.id} · ${cameraNames[camera.id] || '鏡頭'}`;
  if (imageUrl !== state.frameUrl) {
    state.frameUrl = imageUrl;
    state.frameLoaded = false;
    state.overlayKey = '';
    dom.matchedFrame.style.visibility = 'hidden';
    dom.frameOverlay.replaceChildren();
    dom.frameFallback.hidden = false;
    dom.frameFallback.textContent = imageUrl ? '影格載入中…' : '此鏡頭沒有可顯示的影像';
    if (imageUrl) {
      const expected = new URL(imageUrl, document.baseURI).href;
      dom.matchedFrame.onload = () => {
        if (state.frameUrl !== imageUrl || dom.matchedFrame.currentSrc !== expected) return;
        state.frameLoaded = true;
        dom.matchedFrame.style.visibility = 'visible';
        dom.frameFallback.hidden = true;
        updateComparison();
      };
      dom.matchedFrame.onerror = () => {
        if (state.frameUrl !== imageUrl) return;
        state.frameLoaded = false;
        dom.frameFallback.hidden = false;
        dom.frameFallback.textContent = '影格影像無法載入';
        dom.frameOverlay.replaceChildren();
      };
      dom.matchedFrame.src = imageUrl;
    } else dom.matchedFrame.removeAttribute('src');
  }
  dom.frameTime.textContent = frame ? `相對影格 ${preciseSeconds(frame.t)} / 回放 ${preciseSeconds(state.t)}` : `回放 ${preciseSeconds(state.t)} · 尚無影格`;
  dom.frameSourceStatus.textContent = camera.sourceTimeKnown === true ? '來源時間依資料標示' : '來源時戳未知・非即時';
  dom.frameCaveat.textContent = synchronized
    ? '原始辨識框・約 5 fps；不晚於回放時間的最近影格。3D 為相鄰影格連續追蹤，短時延續另以琥珀色標示。原始框與 3D 分類可能不同。'
    : imageUrl ? '固定擷取預覽・非同步；不疊加目前影格偵測框。' : '影像不可用；不以其他時間的畫面替代。';
  if (Array.isArray(config.countLine)) dom.frameCaveat.textContent += ' 計數線主要切過南北交叉道路；A近側／B遠側是影像線兩側，不能當成信義路東向流量。';
  const overlayKey = `${camera.id}:${frame?.t ?? 'none'}:${synchronized}:${dom.classFilter.value}`;
  if (state.frameLoaded && overlayKey !== state.overlayKey) { state.overlayKey = overlayKey; drawFrameOverlay(camera, frame, synchronized, config); }
  const outage = dom.outage.checked && state.t > (camera.frames?.at(-1)?.t || 0) / 2;
  const analysis = analyzeCamera(camera, state.t, { ...config, simulateOutage: dom.outage.checked });
  dom.roiOccupancy.textContent = metricText(analysis.counts.occupancyTotal, analysis.status);
  dom.crossingAB.textContent = metricText(analysis.counts.crossings?.['A→B'], analysis.status);
  dom.crossingBA.textContent = metricText(analysis.counts.crossings?.['B→A'], analysis.status);
  dom.classCounts.textContent = analysis.counts.occupancyByClass == null
    ? `各車種占用：${metricText(null, analysis.status)}`
    : `各車種占用（全類）：${['car', 'motorcycle', 'bus', 'truck'].map(c => `${classLabels[c]} ${analysis.counts.occupancyByClass[c] || 0}`).join(' · ')}`;
  if (analysis.counts.crossings == null) dom.classCrossings.textContent = `各車種累計跨線：${metricText(null, analysis.status)}`;
  else {
    const byClass = Object.create(null);
    for (const event of analysis.events || []) byClass[normalizeClass(event.className)] = (byClass[normalizeClass(event.className)] || 0) + 1;
    dom.classCrossings.textContent = `各車種累計跨線（全類）：${['car', 'motorcycle', 'bus', 'truck'].map(c => `${classLabels[c]} ${byClass[c] || 0}`).join(' · ')}`;
  }
  dom.calibrationSpeed.textContent = '待地面尺度校正';
  if (outage) dom.frameCaveat.textContent += ' 模擬斷訊時影像仍顯示原始存檔；3D 與分析依斷訊截止。';
  const finished = state.t >= state.maxT - .01;
  dom.frameEnded.hidden = !finished;
  if (finished) dom.frameCaveat.textContent += ' 此為片段最後影格，非即時畫面。';
}
function formatDate(iso) {
  if (!iso) return '擷取時間未提供';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '擷取時間未提供' : new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(d) + ' 台灣時間';
}
function median(values) {
  const xs = values.filter(Number.isFinite).sort((a, b) => a - b);
  return xs.length ? xs[Math.floor(xs.length / 2)] : null;
}
function renderSourceSummary() {
  const cameras = state.data.cameras || [];
  const ok = cameras.filter(c => c.status === 'ok');
  const frameCount = ok.reduce((sum, c) => sum + (c.metrics?.frames || c.frames?.length || 0), 0);
  const inference = median(ok.flatMap(c => (c.frames || []).map(f => f.inferenceMs)));
  dom.source.textContent = `${ok.length}/${cameras.length} 支鏡頭有影格 · ${frameCount} 個影格 · 約 ${Math.round(state.data.durationSeconds || 0)} 秒${inference == null ? '' : ` · 單影格推論中位 ${Math.round(inference)} ms`}。來源時間未知；這是擷取後回放，並非當下即時畫面。`;
  dom.model.textContent = `辨識模型：${state.data.model?.name || '未提供'}${state.data.model?.sha256 ? ` · SHA-256 ${state.data.model.sha256.slice(0, 12)}…` : ''}`;
}
function safeSourceLink(url) {
  try { const parsed = new URL(url, location.href); return ['https:', 'http:'].includes(parsed.protocol) ? parsed.href : null; } catch { return null; }
}
function buildCameraCards() {
  dom.cameras.replaceChildren();
  const sorted = [...(state.data.cameras || [])].sort((a, b) => CAMERA_ORDER.indexOf(a.id) - CAMERA_ORDER.indexOf(b.id));
  for (const [i, camera] of sorted.entries()) {
    const card = document.createElement('article');
    card.className = `camera-card${state.selected === camera.id ? ' selected' : ''}`;
    card.dataset.id = camera.id;
    const head = document.createElement('button');
    head.type = 'button'; head.className = 'camera-card-head';
    head.setAttribute('aria-label', `選取 ${camera.id} ${cameraNames[camera.id] || ''}`);
    const index = document.createElement('span'); index.className = 'camera-index'; index.textContent = String(i + 1).padStart(2, '0');
    const info = document.createElement('span'); info.className = 'camera-info';
    const title = document.createElement('strong'); title.textContent = camera.id;
    const subtitle = document.createElement('small'); subtitle.textContent = `${cameraNames[camera.id] || '信義路四段'} · ${CAMERA_CONFIGS[camera.id]?.crossStreetName || '交叉道路（名稱待確認）'}`;
    info.append(title, subtitle);
    const status = document.createElement('span'); status.className = `camera-status ${camera.status !== 'ok' ? 'unavailable' : ''}`;
    status.textContent = camera.status === 'ok' ? '有影格' : '無影格';
    head.append(index, info, status);
    head.addEventListener('click', () => selectCamera(camera.id));
    const details = document.createElement('div'); details.className = 'camera-details';
    const preview = document.createElement('div'); preview.className = 'preview';
    if (camera.previewUrl) {
      const img = document.createElement('img'); img.src = camera.previewUrl; img.alt = `${camera.id} 的擷取預覽影格`; img.loading = 'lazy';
      img.addEventListener('error', () => { img.remove(); const msg = document.createElement('span'); msg.className = 'preview-empty'; msg.textContent = '預覽影像無法顯示'; preview.appendChild(msg); });
      preview.appendChild(img);
      const tag = document.createElement('span'); tag.className = 'preview-tag'; tag.textContent = `固定擷取預覽 ${Number.isFinite(camera.previewTime) ? seconds(camera.previewTime) : ''} · 偵測框`; preview.appendChild(tag);
    } else {
      const msg = document.createElement('span'); msg.className = 'preview-empty'; msg.textContent = '未提供擷取預覽'; preview.appendChild(msg);
    }
    const meta = document.createElement('div'); meta.className = 'camera-meta';
    const count = document.createElement('span'); count.textContent = `${camera.metrics?.frames ?? camera.frames?.length ?? 0} 影格`;
    const sourceUrl = safeSourceLink(camera.sourceUrl);
    if (sourceUrl) { const link = document.createElement('a'); link.href = sourceUrl; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = '原始來源 ↗'; meta.append(count, link); }
    else meta.append(count);
    details.append(preview, meta);
    const orientation = document.createElement('div'); orientation.className = 'camera-orientation';
    const viewLabel = document.createElement('label'); viewLabel.htmlFor = `view-${camera.id}`; viewLabel.textContent = '視角假設・未校正';
    const viewSelect = document.createElement('select'); viewSelect.id = `view-${camera.id}`; viewSelect.className = 'view-direction-select';
    for (const [value, name] of [['N', '向北'], ['E', '向東'], ['W', '向西']]) {
      const option = document.createElement('option'); option.value = value; option.textContent = name; viewSelect.appendChild(option);
    }
    viewSelect.value = state.viewDirections[camera.id] || 'N';
    viewSelect.addEventListener('change', () => { state.viewDirections[camera.id] = viewSelect.value; updateViewArrow(camera.id); updateReadout(true); });
    orientation.append(viewLabel, viewSelect);
    details.appendChild(orientation);
    const viewBasis = document.createElement('div'); viewBasis.className = 'camera-original-direction';
    viewBasis.textContent = CAMERA_CONFIGS[camera.id]?.viewDirectionBasis || '鏡頭北向；場景未現勘校正。';
    details.appendChild(viewBasis);
    if (camera.status !== 'ok' && camera.error) { const error = document.createElement('div'); error.className = 'camera-error'; error.textContent = camera.error; details.appendChild(error); }
    card.append(head, details); dom.cameras.appendChild(card);
  }
}
function selectCamera(id) {
  state.selected = id;
  for (const card of dom.cameras.querySelectorAll('.camera-card')) card.classList.toggle('selected', card.dataset.id === id);
  updateReadout(true);
}
function focus(all) {
  if (all || !state.data) { controls.target.set(0, 0, 0); viewCamera.position.set(80, 850, 1200); }
  else {
    const camera = state.data.cameras.find(c => c.id === state.selected);
    if (!camera) return;
    const p = cameraPosition(camera);
    viewCamera.position.set(p.x, 160, p.z + 220);
    controls.target.set(p.x, 0, p.z - 20);
  }
  controls.update();
}
function trafficOptions() {
  return {
    mode: dom.modeSelect.value,
    smooth: dom.smooth.checked,
    showStationary: dom.stationaryToggle.checked,
    corridorDirection: dom.corridorDirection.value,
    viewDirections: state.viewDirections,
    cameraConfigs: CAMERA_CONFIGS,
    speedKmh: Number(dom.speed.value),
    horizonSeconds: Number(dom.horizon.value),
    simulateOutage: dom.outage.checked ? state.selected : false,
  };
}
function updateModeUi() {
  const corridor = dom.modeSelect.value === 'corridor';
  for (const item of document.querySelectorAll('.corridor-only')) item.hidden = !corridor;
  for (const item of document.querySelectorAll('.observed-only')) item.hidden = corridor;
  dom.sceneMode.textContent = corridor ? '同向走廊假設・非跨鏡追蹤' : '觀測重建・鏡頭局部';
  dom.sceneMode.classList.toggle('scenario', corridor);
  dom.method.textContent = corridor
    ? '藍色粒子是同向通過的情境假設，非跨鏡追蹤或量測車流；各鏡頭相對時間未同步。車體尺寸為示意。'
    : '信義路一般車東向、公車可反向；交叉道路雙向。影格逐幀辨識，3D 同鏡軌跡重建，琥珀色短時延續非觀測。';
}
function updateReadout(force = false, now = performance.now()) {
  if (!state.data) return;
  const result = buildTrafficState(state.data, state.t, trafficOptions());
  const visibleCount = updateVehicles(result.vehicles);
  if (!force && now - state.lastUiAt < 150) return;
  state.lastUiAt = now;
  const corridor = dom.modeSelect.value === 'corridor';
  dom.filter.textContent = `截至回放時刻，前景設備遮罩（人工初設）排除 ${result.diagnostics?.excludedForeground || 0} 框，邊緣殘框排除 ${result.diagnostics?.excludedEdgeFragments || 0} 框；同一物件可能重複計入。`;
  const shownPredictions = dom.predictions.checked ? result.counts.predicted || 0 : 0;
  const shownStationary = dom.stationaryToggle.checked ? result.counts.stationary || 0 : 0;
  const shownScenario = result.counts.scenario || 0;
  dom.observed.textContent = String(result.counts.observed || 0);
  dom.stationary.textContent = String(result.counts.stationary || 0);
  dom.predicted.textContent = String(shownPredictions);
  dom.scenario.textContent = String(shownScenario);
  dom.empty.hidden = visibleCount > 0;
  const finished = state.t >= state.maxT - 0.11;
  const filteredEmpty = dom.classFilter.value !== 'all' && result.vehicles.length > 0 && visibleCount === 0;
  dom.empty.querySelector('span').textContent = filteredEmpty ? '此車種目前沒有可顯示標記' : finished ? '這段回放已結束' : corridor ? '目前沒有可推演的走廊粒子' : '目前沒有可繪製的車輛觀測';
  dom.empty.querySelector('small').textContent = filteredEmpty ? '只代表這個篩選在片段此刻沒有標記，不代表道路沒有車。' : finished ? '按播放可從頭重看；這不是目前道路沒有車。' : corridor ? '入口鏡頭缺乏符合條件的移動觀測時，情境會保持空白。' : '未取得的影像不會補成車流；低位移車影可於右側切換。';
  dom.sceneStatus.textContent = corridor
    ? `${shownScenario} 同向假設粒子 · 非跨鏡追蹤`
    : `${result.counts.observed || 0} 移動辨識 · ${shownStationary} 低位移 · ${shownPredictions} 短時延續`;
  dom.current.textContent = preciseSeconds(state.t);
  dom.timeline.value = String(state.t);
  dom.timeline.style.setProperty('--progress', `${state.maxT ? state.t / state.maxT * 100 : 0}%`);
  updateComparison();
  for (const card of dom.cameras.querySelectorAll('.camera-card')) {
    const cs = result.cameraStates.find(c => c.id === card.dataset.id);
    const status = card.querySelector('.camera-status');
    if (!cs || !status) continue;
    const label = { observed: `${(cs.observed || 0) + (cs.stationary || 0)} 觀測`, stale: '短時無影格', waiting: '等待影格', unavailable: '無影格', 'simulated-outage': '模擬斷訊' }[cs.status] || cs.status;
    const camera = state.data.cameras.find(c => c.id === card.dataset.id);
    const sampleEnded = state.t > (camera?.frames?.at(-1)?.t ?? Infinity) + 1.5;
    status.textContent = cs.status === 'stale' && sampleEnded ? '片段已結束' : label;
    status.classList.toggle('unavailable', cs.status === 'unavailable' || cs.status === 'simulated-outage');
  }
}
function setPlaying(playing) {
  state.playing = playing;
  dom.playIcon.textContent = playing ? 'Ⅱ' : '▶';
  dom.play.setAttribute('aria-label', playing ? '暫停' : '播放');
  state.lastRealAt = performance.now();
}
function animate(now) {
  if (state.disposed) return;
  requestAnimationFrame(animate);
  const dt = Math.min(.1, Math.max(0, (now - (state.lastRealAt || now)) / 1000));
  state.lastRealAt = now;
  state.fpsFrames += 1;
  if (!state.fpsAt) state.fpsAt = now;
  if (now - state.fpsAt >= 1000) { dom.fps.textContent = `畫面 ${Math.round(state.fpsFrames * 1000 / (now - state.fpsAt))} FPS`; state.fpsAt = now; state.fpsFrames = 0; }
  if (state.playing && state.data) {
    state.t = Math.min(state.maxT, state.t + dt);
    // Vehicle positions follow every animation frame; DOM readouts update at 150 ms.
    updateReadout(false, now);
    if (state.t >= state.maxT) { setPlaying(false); updateReadout(true, now); }
  }
  controls.update();
  viewCamera.updateMatrixWorld();
  compassCenter.copy(controls.target).project(viewCamera);
  compassNorth.copy(controls.target).z -= 60;
  compassNorth.project(viewCamera);
  dom.compass.style.transform = `rotate(${Math.atan2(compassNorth.x - compassCenter.x, compassNorth.y - compassCenter.y)}rad)`;
  renderer.render(scene, viewCamera);
}
requestAnimationFrame(animate);
const resizeObserver = new ResizeObserver(() => {
  const width = dom.host.clientWidth, height = dom.host.clientHeight;
  if (!width || !height) return;
  viewCamera.aspect = width / height; viewCamera.updateProjectionMatrix(); renderer.setSize(width, height, false);
});
resizeObserver.observe(dom.host);
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let pointerDown = null;
renderer.domElement.addEventListener('pointerdown', (e) => { pointerDown = { x: e.clientX, y: e.clientY }; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!pointerDown || Math.hypot(e.clientX - pointerDown.x, e.clientY - pointerDown.y) > 6) return;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1);
  raycaster.setFromCamera(pointer, viewCamera);
  const hit = raycaster.intersectObjects(markerObjects)[0];
  if (hit?.object.userData.cameraId) selectCamera(hit.object.userData.cameraId);
});

dom.all.addEventListener('click', () => focus(true));
dom.selected.addEventListener('click', () => focus(false));
dom.play.addEventListener('click', () => { if (state.t >= state.maxT) { state.t = 0; updateReadout(true); } setPlaying(!state.playing); });
dom.timeline.addEventListener('input', () => { state.t = Number(dom.timeline.value); updateReadout(true); });
dom.speed.addEventListener('input', () => { dom.speedValue.textContent = `${dom.speed.value} km/h`; updateReadout(true); });
dom.horizon.max = String(MAX_PREDICTION_HORIZON);
if (Number(dom.horizon.value) > MAX_PREDICTION_HORIZON) dom.horizon.value = String(MAX_PREDICTION_HORIZON);
dom.horizonValue.textContent = `${dom.horizon.value} 秒`;
dom.horizon.addEventListener('input', () => { dom.horizonValue.textContent = `${dom.horizon.value} 秒`; updateReadout(true); });
dom.modeSelect.addEventListener('change', () => { updateModeUi(); updateReadout(true); });
dom.classFilter.addEventListener('change', () => updateReadout(true));
for (const input of [dom.predictions, dom.outage, dom.smooth, dom.stationaryToggle, dom.corridorDirection]) input.addEventListener('change', () => updateReadout(true));

async function loadData() {
  try {
    const response = await fetch('./data/observations.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data.schemaVersion !== 1 || !Array.isArray(data.cameras)) throw new Error('觀測資料格式不符');
    state.data = data;
    if (!data.cameras.some(c => c.id === state.selected)) state.selected = data.cameras[0]?.id || '';
    state.viewDirections = Object.fromEntries(data.cameras.map(c => [c.id, CAMERA_CONFIGS[c.id]?.assumedViewDirection || 'N']));
    state.maxT = Math.max(0, Number(data.durationSeconds) || 0);
    state.t = Number(data.durationSeconds) >= 24 ? 24 : 0;
    dom.timeline.max = String(state.maxT);
    dom.timeline.disabled = state.maxT <= 0;
    dom.play.disabled = state.maxT <= 0;
    dom.total.textContent = preciseSeconds(state.maxT);
    dom.mode.textContent = data.mode === 'captured' ? '實際擷取' : data.mode === 'synthetic' ? '合成示範' : '來源待確認';
    dom.mode.classList.toggle('error', data.mode !== 'captured');
    dom.captureTime.textContent = formatDate(data.capturedAt);
    updateModeUi();
    buildRoad(data.cameras);
    buildMarkers(data.cameras);
    buildCameraCards();
    renderSourceSummary();
    focus(false);
    updateReadout(true);
  } catch (error) {
    buildRoad();
    dom.mode.textContent = '資料不可用'; dom.mode.classList.add('error');
    dom.captureTime.textContent = '無擷取資料';
    dom.source.textContent = `無法讀取觀測資料：${error.message}。道路示意仍可瀏覽。`;
    dom.cameras.textContent = '沒有攝影機觀測資料。';
    dom.empty.hidden = false;
    dom.sceneStatus.textContent = '無可用觀測';
    dom.model.textContent = '模型資訊未取得';
  }
}
loadData();

window.addEventListener('beforeunload', () => {
  state.disposed = true;
  resizeObserver.disconnect();
  controls.dispose();
  for (const item of state.renderedVehicles.values()) removeVehicle(item);
  for (const material of [baseMaterial, roadMaterial, walkwayMaterial, laneMaterial, crossingMaterial, tealMaterial, stationaryMaterial, scenarioMaterial, amberMaterial, glassMaterial, lightMaterial, wheelMaterial]) material.dispose();
  for (const geometry of Object.values(vehicleGeometries)) geometry.dispose();
  staticGroup.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const materials = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of materials) { if (m.map) m.map.dispose(); m.dispose(); }
  });
  renderer.dispose();
});
