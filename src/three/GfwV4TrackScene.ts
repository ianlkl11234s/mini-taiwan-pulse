import * as THREE from "three";
import { MercatorCoordinate } from "mapbox-gl";
import type { FrameBudget, FrameHead, FrameTrail, TrackFrame } from "../gfw-v4-bench/types";

export interface GfwV4ViewBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface GfwV4RenderedFrame {
  heads: FrameHead[];
  trails: FrameTrail[];
  trailVertices: number;
}

/** Worker-owned viewport cull result. Coordinates stay packed until GPU upload. */
export interface GfwV4SpatialPointFrame {
  /** lon/lat pairs, already constrained to the active viewport shard. */
  points: Float32Array;
  /** Index into the canonical GFW v4 bucket order. */
  buckets: Uint8Array;
  /** Same-coordinate visual aggregation; popup identities stay in the hit source. */
  memberCounts?: Uint16Array;
  /** Per-head transition alpha (0..255), aligned 1:1 with buckets. Defaults to fully visible. */
  pointAlphas?: Uint8Array;
  /** selected-H successor segments: lon/lat/from + lon/lat/to; singletons omit them. */
  segments?: Float32Array;
  segmentBuckets?: Uint8Array;
  /** Per-segment transition alpha (0..255), aligned 1:1 with segmentBuckets. Defaults to fully visible. */
  segmentAlphas?: Uint8Array;
}

export interface GfwV4RenderedSpatialFrame { pointCount: number; }

/**
 * 預算超標不能丟例外 —— 這條路徑跑在 Mapbox 的 paint pass 裡，丟出去會中斷整張圖。
 * 改成 clamp 到預算上限，每個 session 只警告一次。
 */
let warnedHeadBudget = false;
let warnedSegmentBudget = false;

const DARK_COLORS = {
  cargo: new THREE.Color("#39bff4"), carrier: new THREE.Color("#ff8f43"),
  passenger: new THREE.Color("#b3a0ff"), fishing: new THREE.Color("#58d68d"),
  other: new THREE.Color("#f0cc66"), unknown: new THREE.Color("#f5f1db"), mixed: new THREE.Color("#f5f1db"),
} as const;
const LIGHT_COLORS = {
  cargo: new THREE.Color("#007da8"), carrier: new THREE.Color("#b54c00"),
  passenger: new THREE.Color("#6552b8"), fishing: new THREE.Color("#187c46"),
  other: new THREE.Color("#8a6500"), unknown: new THREE.Color("#34413e"), mixed: new THREE.Color("#34413e"),
} as const;

function inside(lon: number, lat: number, bounds: GfwV4ViewBounds, pad = 0.5): boolean {
  return lon >= bounds.west - pad && lon <= bounds.east + pad && lat >= bounds.south - pad && lat <= bounds.north + pad;
}

export function cullGfwV4Frame(frame: TrackFrame, bounds: GfwV4ViewBounds): GfwV4RenderedFrame {
  const heads = frame.heads.filter((head) => inside(head.lon, head.lat, bounds));
  const trails = frame.trails.filter((trail) => trail.coordinates.some(([lon, lat]) => inside(lon, lat, bounds)));
  return {
    heads,
    trails,
    trailVertices: trails.reduce((sum, trail) => sum + trail.coordinates.length, 0),
  };
}

/** Mapbox shared-context scene: fixed-capacity GPU buffers, no private canvas. */
export class GfwV4TrackScene {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.Camera();
  private renderer: THREE.WebGLRenderer | null = null;
  private readonly heads: THREE.InstancedMesh;
  private readonly headAlphas: THREE.InstancedBufferAttribute;
  private readonly trailGeometry = new THREE.BufferGeometry();
  private readonly trailPositions: Float32Array;
  private readonly trailColors: Uint8Array;
  private readonly trailLines: THREE.LineSegments;
  private readonly matrix = new THREE.Matrix4();
  private isDark = true;
  private opacity = 0.8;

  constructor(private readonly budget: FrameBudget) {
    const headGeometry = new THREE.CircleGeometry(1, 12);
    const headMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    headMaterial.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nattribute float aGfwAlpha;\nvarying float vGfwAlpha;")
        .replace("#include <color_vertex>", "#include <color_vertex>\nvGfwAlpha = aGfwAlpha;");
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying float vGfwAlpha;")
        .replace(
          "vec4 diffuseColor = vec4( diffuse, opacity );",
          "vec4 diffuseColor = vec4( diffuse, opacity );\ndiffuseColor.a *= clamp( vGfwAlpha, 0.0, 1.0 );",
        );
    };
    headMaterial.customProgramCacheKey = () => "gfw-v4-head-instance-alpha-v1";
    this.headAlphas = new THREE.InstancedBufferAttribute(new Uint8Array(budget.maxHeads).fill(255), 1, true);
    this.headAlphas.setUsage(THREE.DynamicDrawUsage);
    headGeometry.setAttribute("aGfwAlpha", this.headAlphas);
    this.heads = new THREE.InstancedMesh(
      headGeometry,
      headMaterial,
      budget.maxHeads,
    );
    this.heads.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.heads.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(budget.maxHeads * 3), 3);
    this.heads.count = 0;
    this.heads.frustumCulled = false;
    this.scene.add(this.heads);

    // Every logical trail edge is two LineSegments vertices.
    this.trailPositions = new Float32Array(budget.maxTrailVertices * 2 * 3);
    this.trailColors = new Uint8Array(budget.maxTrailVertices * 2 * 4);
    this.trailGeometry.setAttribute("position", new THREE.BufferAttribute(this.trailPositions, 3).setUsage(THREE.DynamicDrawUsage));
    this.trailGeometry.setAttribute("color", new THREE.BufferAttribute(this.trailColors, 4, true).setUsage(THREE.DynamicDrawUsage));
    this.trailGeometry.setDrawRange(0, 0);
    this.trailLines = new THREE.LineSegments(
      this.trailGeometry,
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.62, depthWrite: false }),
    );
    this.trailLines.frustumCulled = false;
    this.scene.add(this.trailLines);
  }

  init(gl: WebGLRenderingContext): void {
    this.renderer = new THREE.WebGLRenderer({
      canvas: gl.canvas as HTMLCanvasElement,
      context: gl as unknown as WebGL2RenderingContext,
      antialias: true,
    });
    this.renderer.autoClear = false;
  }

  setTheme(theme: "dark" | "light" | boolean): void {
    const isDark = theme === true || theme === "dark";
    if (this.isDark === isDark) return;
    this.isDark = isDark;
    const material = this.heads.material as THREE.MeshBasicMaterial;
    material.blending = isDark ? THREE.AdditiveBlending : THREE.NormalBlending;
    material.needsUpdate = true;
  }

  setOpacity(opacity: number): void {
    this.opacity = Math.max(0, Math.min(1, opacity));
    (this.heads.material as THREE.MeshBasicMaterial).opacity = this.opacity;
    (this.trailLines.material as THREE.LineBasicMaterial).opacity = this.opacity * 0.7;
  }

  update(frame: TrackFrame, bounds: GfwV4ViewBounds, zoom: number): GfwV4RenderedFrame {
    const visible = cullGfwV4Frame(frame, bounds);
    if (visible.heads.length > this.budget.maxHeads || visible.trailVertices > this.budget.maxTrailVertices) {
      throw new Error(
        `GFW v4 GPU budget exceeded: heads=${visible.heads.length}/${this.budget.maxHeads}, ` +
        `trailVertices=${visible.trailVertices}/${this.budget.maxTrailVertices}`,
      );
    }
    const palette = this.isDark ? DARK_COLORS : LIGHT_COLORS;
    const headScale = 2.8 / (512 * 2 ** zoom);
    visible.heads.forEach((head, index) => {
      const position = MercatorCoordinate.fromLngLat([head.lon, head.lat], 0);
      const scale = headScale * (1 + Math.min(3, Math.sqrt(head.members.length) - 1) * 0.35);
      this.matrix.makeScale(scale, scale, scale);
      this.matrix.setPosition(position.x, position.y, position.z);
      this.heads.setMatrixAt(index, this.matrix);
      const legacyBucket = head.buckets[0] === "tanker" ? "carrier" : head.buckets[0];
      const color = head.buckets.length === 1 && legacyBucket ? palette[legacyBucket] : palette.mixed;
      this.heads.setColorAt(index, color);
      (this.headAlphas.array as Uint8Array)[index] = 255;
    });
    this.heads.count = visible.heads.length;
    this.heads.instanceMatrix.needsUpdate = true;
    if (this.heads.instanceColor) this.heads.instanceColor.needsUpdate = true;
    this.headAlphas.needsUpdate = true;

    let vertex = 0;
    const maxVertices = this.budget.maxTrailVertices * 2;
    for (const trail of visible.trails) {
      const legacyBucket = trail.bucket === "tanker" ? "carrier" : trail.bucket;
      const color = palette[legacyBucket];
      for (let index = 0; index < trail.coordinates.length - 1 && vertex + 1 < maxVertices; index++) {
        const pair = [trail.coordinates[index]!, trail.coordinates[index + 1]!] as const;
        for (const [lon, lat] of pair) {
          const point = MercatorCoordinate.fromLngLat([lon, lat], 0);
          const offset = vertex * 3;
          this.trailPositions[offset] = point.x;
          this.trailPositions[offset + 1] = point.y;
          this.trailPositions[offset + 2] = point.z;
          const colorOffset = vertex * 4;
          this.trailColors[colorOffset] = Math.round(color.r * 255);
          this.trailColors[colorOffset + 1] = Math.round(color.g * 255);
          this.trailColors[colorOffset + 2] = Math.round(color.b * 255);
          this.trailColors[colorOffset + 3] = 255;
          vertex += 1;
        }
      }
    }
    this.trailGeometry.setDrawRange(0, vertex);
    (this.trailGeometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    (this.trailGeometry.getAttribute("color") as THREE.BufferAttribute).needsUpdate = true;
    return visible;
  }

  /**
   * Phase-2 fast path: no GeoJSON and no per-tick rebuild of day packs. The
   * Worker delivers a transfer-owned typed buffer already viewport culled.
   */
  updateSpatialPoints(frame: GfwV4SpatialPointFrame, zoom: number): GfwV4RenderedSpatialFrame {
    if (
      frame.points.length !== frame.buckets.length * 2
      || (frame.memberCounts && frame.memberCounts.length !== frame.buckets.length)
      || (frame.pointAlphas && frame.pointAlphas.length !== frame.buckets.length)
    ) throw new Error("GFW v4 spatial point buffer shape mismatch");
    const headCount = Math.min(frame.buckets.length, this.budget.maxHeads);
    if (frame.buckets.length > this.budget.maxHeads && !warnedHeadBudget) {
      warnedHeadBudget = true;
      console.warn(`GFW v4 GPU budget clamped: heads=${frame.buckets.length}/${this.budget.maxHeads}`);
    }
    const palette = this.isDark ? DARK_COLORS : LIGHT_COLORS;
    const colors = [palette.fishing, palette.cargo, palette.passenger, palette.carrier, palette.other, palette.unknown] as const;
    const headScale = 2.8 / (512 * 2 ** zoom);
    for (let index = 0; index < headCount; index++) {
      const position = MercatorCoordinate.fromLngLat([frame.points[index * 2]!, frame.points[index * 2 + 1]!], 0);
      const members = frame.memberCounts?.[index] ?? 1;
      const scale = headScale * (1 + Math.min(3, Math.sqrt(members) - 1) * 0.35);
      this.matrix.makeScale(scale, scale, scale);
      this.matrix.setPosition(position.x, position.y, position.z);
      this.heads.setMatrixAt(index, this.matrix);
      this.heads.setColorAt(index, colors[frame.buckets[index]!] ?? palette.mixed);
      (this.headAlphas.array as Uint8Array)[index] = frame.pointAlphas?.[index] ?? 255;
    }
    this.heads.count = headCount;
    this.heads.instanceMatrix.needsUpdate = true;
    if (this.heads.instanceColor) this.heads.instanceColor.needsUpdate = true;
    this.headAlphas.needsUpdate = true;
    const requestedSegments = frame.segmentBuckets?.length ?? 0;
    if (frame.segmentAlphas && frame.segmentAlphas.length !== requestedSegments) throw new Error("GFW v4 spatial segment alpha buffer shape mismatch");
    const segmentCount = Math.min(requestedSegments, this.budget.maxTrailVertices);
    if (requestedSegments > this.budget.maxTrailVertices && !warnedSegmentBudget) {
      warnedSegmentBudget = true;
      console.warn(`GFW v4 GPU budget clamped: segments=${requestedSegments}/${this.budget.maxTrailVertices}`);
    }
    if (frame.segments && frame.segmentBuckets && frame.segments.length === requestedSegments * 4) {
      for (let index = 0; index < segmentCount; index += 1) {
        const color = colors[frame.segmentBuckets[index]!] ?? palette.mixed;
        for (let endpoint = 0; endpoint < 2; endpoint += 1) {
          const offset = (index * 4) + endpoint * 2; const point = MercatorCoordinate.fromLngLat([frame.segments[offset]!, frame.segments[offset + 1]!], 0); const vertex = index * 2 + endpoint; const out = vertex * 3; const colorOut = vertex * 4;
          this.trailPositions[out] = point.x; this.trailPositions[out + 1] = point.y; this.trailPositions[out + 2] = point.z;
          this.trailColors[colorOut] = Math.round(color.r * 255); this.trailColors[colorOut + 1] = Math.round(color.g * 255); this.trailColors[colorOut + 2] = Math.round(color.b * 255); this.trailColors[colorOut + 3] = frame.segmentAlphas?.[index] ?? 255;
        }
      }
      this.trailGeometry.setDrawRange(0, segmentCount * 2);
      (this.trailGeometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
      (this.trailGeometry.getAttribute("color") as THREE.BufferAttribute).needsUpdate = true;
    } else this.trailGeometry.setDrawRange(0, 0);
    return { pointCount: headCount };
  }

  render(matrix: number[]): void {
    if (!this.renderer) return;
    const gl = this.renderer.getContext();
    const blendEnabled = gl.isEnabled(gl.BLEND);
    const blendSrc = gl.getParameter(gl.BLEND_SRC_RGB);
    const blendDst = gl.getParameter(gl.BLEND_DST_RGB);
    const blendSrcA = gl.getParameter(gl.BLEND_SRC_ALPHA);
    const blendDstA = gl.getParameter(gl.BLEND_DST_ALPHA);
    const blendEquation = gl.getParameter(gl.BLEND_EQUATION_RGB);
    const blendEquationA = gl.getParameter(gl.BLEND_EQUATION_ALPHA);
    const blendColor = gl.getParameter(gl.BLEND_COLOR) as Float32Array | number[];
    this.camera.projectionMatrix.fromArray(matrix);
    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
    this.renderer.resetState();
    if (blendEnabled) gl.enable(gl.BLEND); else gl.disable(gl.BLEND);
    gl.blendFuncSeparate(blendSrc, blendDst, blendSrcA, blendDstA);
    gl.blendEquationSeparate(blendEquation, blendEquationA);
    gl.blendColor(blendColor[0] ?? 0, blendColor[1] ?? 0, blendColor[2] ?? 0, blendColor[3] ?? 0);
  }

  dispose(): void {
    this.scene.remove(this.heads);
    this.scene.remove(this.trailLines);
    this.heads.geometry.dispose();
    (this.heads.material as THREE.Material).dispose();
    this.trailGeometry.dispose();
    (this.trailLines.material as THREE.Material).dispose();
    this.renderer?.dispose();
    this.renderer = null;
  }
}
