import * as THREE from "three";
import type { HistoricalFlightCollection, HistoricalFlightParams } from "../data/historicalFlightTrailsTypes";
import { getAltExaggeration, toMercator } from "../utils/coordinates";

const ALTITUDE_COLOR_MAX_METERS = 12_000;
const PICK_THRESHOLD_PX = 10;
const MAX_GLOBE_STEP_RADIANS = Math.PI / 72;
const GLOBE_RADIUS = 8192 / (2 * Math.PI);
const GLOBE_EXTENT = 8192;
const IDENTITY_MATRIX = new THREE.Matrix4();
const ZERO_VECTOR = new THREE.Vector3();

type RenderSegment = { featureIndex: number; visible: boolean };
function constrained(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)); }
function smoothstep(edge0: number, edge1: number, value: number) {
  const t = constrained((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}
function angularDistance(a: GeoJSON.Position, b: GeoJSON.Position) {
  const aLat = a[1]! * Math.PI / 180, bLat = b[1]! * Math.PI / 180, dLng = (b[0]! - a[0]!) * Math.PI / 180;
  return Math.acos(constrained(Math.sin(aLat) * Math.sin(bLat) + Math.cos(aLat) * Math.cos(bLat) * Math.cos(dLng), -1, 1));
}

/** One static, batched full-detail track geometry. Great-circle subdivision is render-only. */
export class HistoricalFlightTrailsScene {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.Camera();
  private renderer: THREE.WebGLRenderer | null = null;
  private geometry: THREE.BufferGeometry | null = null;
  private material: THREE.ShaderMaterial | null = null;
  private lines: THREE.LineSegments | null = null;
  private visibility: THREE.BufferAttribute | null = null;
  private segments: RenderSegment[] = [];
  private data: HistoricalFlightCollection | null = null;
  private params: HistoricalFlightParams | null = null;
  private lastMatrix: THREE.Matrix4 | null = null;
  private globeToMerc: THREE.Matrix4 | null = null;
  private globeTransition = 1;
  private cameraEcef: THREE.Vector3 | null = null;

  init(gl: WebGLRenderingContext) {
    this.renderer = new THREE.WebGLRenderer({ canvas: gl.canvas as HTMLCanvasElement, context: gl as unknown as WebGL2RenderingContext, antialias: true });
    this.renderer.autoClear = false;
  }

  setData(data: HistoricalFlightCollection) {
    if (data === this.data) return;
    this.data = data;
    this.removeMeshes();
    const positions: number[] = [], colors: number[] = [], ecefs: number[] = [], visible: number[] = [];
    const segments: RenderSegment[] = [], altitudeScale = this.localAltitudeScale();
    for (let featureIndex = 0; featureIndex < data.features.length; featureIndex++) {
      const feature = data.features[featureIndex]!;
      let previous: GeoJSON.Position | null = null;
      for (const part of feature.geometry.coordinates) for (const point of part) {
        if (!this.validCoordinate(point)) { previous = null; continue; }
        if (previous) {
          // User-selected direct gap connection; extra vertices make the same join spherical on globe.
          const steps = Math.max(1, Math.ceil(angularDistance(previous, point) / MAX_GLOBE_STEP_RADIANS));
          let start = previous;
          for (let step = 1; step <= steps; step++) {
            const end = this.interpolateGreatCircle(previous, point, step / steps);
            // Preserve the nearest wrapped world in the Mercator half of Mapbox's
            // globe transition. ECEF is periodic, so longitudes above 180 remain valid.
            const unwrappedEnd: GeoJSON.Position = [
              this.unwrapAdjacentLongitude(start[0]!, end[0]!),
              end[1]!,
              end[2] ?? 0,
            ];
            this.pushSegment(positions, colors, ecefs, visible, segments, featureIndex, start, unwrappedEnd, altitudeScale);
            start = unwrappedEnd;
          }
        }
        previous = point;
      }
    }
    this.segments = segments;
    if (!segments.length) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute("aEcef", new THREE.Float32BufferAttribute(ecefs, 3));
    this.visibility = new THREE.Float32BufferAttribute(visible, 1);
    geometry.setAttribute("aHistoricalVisible", this.visibility);
    const material = this.createMaterial();
    const lines = new THREE.LineSegments(geometry, material);
    lines.frustumCulled = false;
    this.geometry = geometry;
    this.material = material;
    this.lines = lines;
    this.scene.add(lines);
    if (this.params) this.setParams(this.params);
  }

  setParams(params: HistoricalFlightParams) {
    const altitudeChanged = this.params && this.altitudeScale(this.params) !== this.altitudeScale(params);
    this.params = params;
    if (altitudeChanged && this.data) { const data = this.data; this.data = null; this.setData(data); return; }
    if (this.material) {
      this.material.uniforms["uOpacity"]!.value = constrained(params.opacity, 0, 1);
      // WebGL lines are one physical pixel: width behaves as subpixel alpha, not geometry thickness.
      this.material.uniforms["uWidth"]!.value = constrained(params.width, .05, 1);
    }
    if (!this.visibility || !this.data) return;
    for (let index = 0; index < this.segments.length; index++) {
      const segment = this.segments[index]!, properties = this.data.features[segment.featureIndex]!.properties;
      const isVisible = (params.direction === "all" || properties.roles.includes(params.direction)) && (params.routeScope === "all" || properties.route_scope === params.routeScope);
      segment.visible = isVisible;
      this.visibility.setX(index * 2, isVisible ? 1 : 0);
      this.visibility.setX(index * 2 + 1, isVisible ? 1 : 0);
    }
    this.visibility.needsUpdate = true;
  }

  setGlobe(globeToMercator: number[] | null | undefined, transition: number | undefined, cameraMercator: { x: number; y: number; z: number } | null) {
    if (!globeToMercator || globeToMercator.length < 16 || (transition ?? 1) >= 1) {
      this.globeToMerc = null; this.globeTransition = 1; this.cameraEcef = null;
    } else {
      this.globeToMerc = new THREE.Matrix4().fromArray(globeToMercator);
      this.globeTransition = constrained(transition ?? 0, 0, 1);
      const inverse = this.globeToMerc.clone().invert();
      const cam = cameraMercator && new THREE.Vector4(cameraMercator.x, cameraMercator.y, cameraMercator.z, 1).applyMatrix4(inverse);
      this.cameraEcef = cam ? new THREE.Vector3(cam.x, cam.y, cam.z) : null;
    }
    if (this.material) this.updateGlobeUniforms();
  }

  render(matrix: number[]) {
    const renderer = this.renderer;
    if (!renderer) return;
    const gl = renderer.getContext();
    const wasBlending = gl.isEnabled(gl.BLEND), src = gl.getParameter(gl.BLEND_SRC_RGB), dst = gl.getParameter(gl.BLEND_DST_RGB), srcA = gl.getParameter(gl.BLEND_SRC_ALPHA), dstA = gl.getParameter(gl.BLEND_DST_ALPHA);
    this.lastMatrix ??= new THREE.Matrix4(); this.lastMatrix.fromArray(matrix); this.camera.projectionMatrix.copy(this.lastMatrix);
    renderer.resetState(); renderer.render(this.scene, this.camera); renderer.resetState();
    if (wasBlending) gl.enable(gl.BLEND); else gl.disable(gl.BLEND);
    gl.blendFuncSeparate(src, dst, srcA, dstA);
  }

  pick(x: number, y: number, width: number, height: number): GeoJSON.Feature<GeoJSON.MultiLineString> | null {
    if (!this.data || !this.lastMatrix || !this.geometry || width <= 0 || height <= 0) return null;
    const positions = this.geometry.getAttribute("position"), ecefs = this.geometry.getAttribute("aEcef");
    let best: { featureIndex: number; distance: number } | null = null;
    for (let index = 0; index < this.segments.length; index++) {
      const segment = this.segments[index]!; if (!segment.visible) continue;
      const a = this.projectVertex(index * 2, positions, ecefs, width, height), b = this.projectVertex(index * 2 + 1, positions, ecefs, width, height);
      if (!a || !b) continue;
      const distance = this.segmentDistance(x, y, a.x, a.y, b.x, b.y);
      if (distance <= PICK_THRESHOLD_PX && (!best || distance < best.distance)) best = { featureIndex: segment.featureIndex, distance };
    }
    if (!best) return null;
    const feature = this.data.features[best.featureIndex]!;
    return { ...feature, properties: { ...feature.properties, sample_date: this.data.meta.date, timezone: this.data.meta.timezone, timeZone: this.data.meta.timezone, country: this.data.meta.country } };
  }

  dispose() { this.removeMeshes(); this.renderer?.dispose(); this.renderer = null; }

  private pushSegment(positions: number[], colors: number[], ecefs: number[], visible: number[], segments: RenderSegment[], featureIndex: number, start: GeoJSON.Position, end: GeoJSON.Position, altitudeScale: number) {
    const a = this.toRenderPoint(start, altitudeScale), b = this.toRenderPoint(end, altitudeScale);
    positions.push(...a.merc, ...b.merc); colors.push(...a.color, ...b.color); ecefs.push(...a.ecef, ...b.ecef); visible.push(1, 1); segments.push({ featureIndex, visible: true });
  }
  private toRenderPoint(point: GeoJSON.Position, altitudeScale: number) {
    const altitude = point[2] ?? 0, merc = toMercator(point[1]!, point[0]!, altitude * altitudeScale), lat = point[1]! * Math.PI / 180, lng = point[0]! * Math.PI / 180, cosLat = Math.cos(lat), radius = GLOBE_RADIUS + merc.z * GLOBE_EXTENT * cosLat, t = constrained(altitude / ALTITUDE_COLOR_MAX_METERS, 0, 1);
    return { merc: [merc.x, merc.y, merc.z] as const, ecef: [cosLat * Math.sin(lng) * radius, -Math.sin(lat) * radius, cosLat * Math.cos(lng) * radius] as const, color: [.302 + .698 * t, .6 + .4 * t, 1] as const };
  }
  private interpolateGreatCircle(a: GeoJSON.Position, b: GeoJSON.Position, t: number): GeoJSON.Position {
    const angle = angularDistance(a, b), altitude = (a[2] ?? 0) + ((b[2] ?? 0) - (a[2] ?? 0)) * t;
    if (angle < 1e-7) return [a[0]! + (b[0]! - a[0]!) * t, a[1]! + (b[1]! - a[1]!) * t, altitude];
    const aLat = a[1]! * Math.PI / 180, aLng = a[0]! * Math.PI / 180, bLat = b[1]! * Math.PI / 180, bLng = b[0]! * Math.PI / 180, sin = Math.sin(angle), aw = Math.sin((1 - t) * angle) / sin, bw = Math.sin(t * angle) / sin;
    const x = aw * Math.cos(aLat) * Math.cos(aLng) + bw * Math.cos(bLat) * Math.cos(bLng), y = aw * Math.cos(aLat) * Math.sin(aLng) + bw * Math.cos(bLat) * Math.sin(bLng), z = aw * Math.sin(aLat) + bw * Math.sin(bLat);
    return [Math.atan2(y, x) * 180 / Math.PI, Math.atan2(z, Math.hypot(x, y)) * 180 / Math.PI, altitude];
  }
  private createMaterial() {
    return new THREE.ShaderMaterial({ vertexShader: VERTEX_SHADER, fragmentShader: FRAGMENT_SHADER, uniforms: { uOpacity: { value: .28 }, uWidth: { value: .75 }, uGlobeToMerc: { value: IDENTITY_MATRIX.clone() }, uTransition: { value: 1 }, uCameraEcef: { value: ZERO_VECTOR.clone() } }, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false });
  }
  private updateGlobeUniforms() {
    if (!this.material) return;
    this.material.uniforms["uGlobeToMerc"]!.value.copy(this.globeToMerc ?? IDENTITY_MATRIX);
    this.material.uniforms["uTransition"]!.value = this.globeTransition;
    this.material.uniforms["uCameraEcef"]!.value.copy(this.cameraEcef ?? ZERO_VECTOR);
  }
  private removeMeshes() { if (this.lines) this.scene.remove(this.lines); this.material?.dispose(); this.geometry?.dispose(); this.lines = null; this.material = null; this.geometry = null; this.visibility = null; this.segments = []; }
  private localAltitudeScale() { return this.altitudeScale(this.params) / Math.max(getAltExaggeration(), Number.EPSILON); }
  private altitudeScale(params: HistoricalFlightParams | null) { return constrained(params?.altitudeScale ?? 3, 0, 100); }
  private validCoordinate(value: GeoJSON.Position) { return Number.isFinite(value[0]) && Number.isFinite(value[1]) && (value[2] === undefined || Number.isFinite(value[2])); }
  private projectVertex(index: number, positions: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, ecefs: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, width: number, height: number) {
    const world = new THREE.Vector3(positions.getX(index), positions.getY(index), positions.getZ(index));
    if (this.globeToMerc && this.globeTransition < 1) {
      const ecef = new THREE.Vector3(ecefs.getX(index), ecefs.getY(index), ecefs.getZ(index));
      if (this.cameraEcef && this.globeCull(ecef) <= 0) return null;
      ecef.applyMatrix4(this.globeToMerc); world.lerp(ecef, 1 - this.globeTransition);
    }
    const clip = new THREE.Vector4(world.x, world.y, world.z, 1).applyMatrix4(this.lastMatrix!); if (clip.w <= 0) return null;
    return { x: (clip.x / clip.w * .5 + .5) * width, y: (-clip.y / clip.w * .5 + .5) * height };
  }
  private globeCull(ecef: THREE.Vector3) {
    const dir = ecef.clone().normalize();
    const surface = dir.clone().multiplyScalar(GLOBE_RADIUS);
    const toCamera = this.cameraEcef!.clone().sub(surface).normalize();
    const facing = dir.dot(toCamera);
    return Math.min(smoothstep(-.08, .02, facing), smoothstep(.08, .35, facing));
  }
  private unwrapAdjacentLongitude(startLng: number, endLng: number) {
    const difference = endLng - startLng;
    if (difference > 180) return endLng - 360;
    if (difference < -180) return endLng + 360;
    return endLng;
  }
  private segmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number) { const dx = bx - ax, dy = by - ay, length = dx * dx + dy * dy; if (!length) return Math.hypot(px - ax, py - ay); const t = constrained(((px - ax) * dx + (py - ay) * dy) / length, 0, 1); return Math.hypot(px - (ax + dx * t), py - (ay + dy * t)); }
}

const VERTEX_SHADER = /* glsl */`
attribute vec3 color; attribute vec3 aEcef; attribute float aHistoricalVisible;
uniform mat4 uGlobeToMerc; uniform float uTransition; uniform vec3 uCameraEcef;
varying vec3 vColor; varying float vAlpha;
void main() {
  vec3 world = position; float cull = 1.0;
  if (uTransition < 1.0) {
    vec3 globeWorld = (uGlobeToMerc * vec4(aEcef, 1.0)).xyz;
    vec3 dir = normalize(aEcef); float facing = dot(dir, normalize(uCameraEcef - dir * ${GLOBE_RADIUS.toFixed(8)}));
    cull = mix(min(smoothstep(-0.08, 0.02, facing), smoothstep(0.08, 0.35, facing)), 1.0, uTransition);
    world = mix(globeWorld, position, uTransition);
  }
  vColor = color; vAlpha = aHistoricalVisible * cull * mix(3.0, 1.0, uTransition);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 1.0);
}`;
const FRAGMENT_SHADER = /* glsl */`
uniform float uOpacity; uniform float uWidth; varying vec3 vColor; varying float vAlpha;
void main() { float alpha = vAlpha * uOpacity * uWidth; if (alpha < 0.002) discard; gl_FragColor = vec4(vColor, alpha); }
`;
export const HISTORICAL_FLIGHT_ALTITUDE_COLOR_MAX_METERS = ALTITUDE_COLOR_MAX_METERS;
