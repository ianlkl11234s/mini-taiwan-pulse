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

const DARK_COLORS = {
  cargo: new THREE.Color("#39bff4"), tanker: new THREE.Color("#ff8f43"),
  passenger: new THREE.Color("#b3a0ff"), fishing: new THREE.Color("#58d68d"),
  other: new THREE.Color("#f0cc66"), mixed: new THREE.Color("#f5f1db"),
} as const;
const LIGHT_COLORS = {
  cargo: new THREE.Color("#007da8"), tanker: new THREE.Color("#b54c00"),
  passenger: new THREE.Color("#6552b8"), fishing: new THREE.Color("#187c46"),
  other: new THREE.Color("#8a6500"), mixed: new THREE.Color("#34413e"),
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
  private readonly trailGeometry = new THREE.BufferGeometry();
  private readonly trailPositions: Float32Array;
  private readonly trailColors: Float32Array;
  private readonly trailLines: THREE.LineSegments;
  private readonly matrix = new THREE.Matrix4();
  private isDark = true;
  private opacity = 0.8;

  constructor(private readonly budget: FrameBudget) {
    this.heads = new THREE.InstancedMesh(
      new THREE.CircleGeometry(1, 12),
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
      budget.maxHeads,
    );
    this.heads.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.heads.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(budget.maxHeads * 3), 3);
    this.heads.count = 0;
    this.heads.frustumCulled = false;
    this.scene.add(this.heads);

    // Every logical trail edge is two LineSegments vertices.
    this.trailPositions = new Float32Array(budget.maxTrailVertices * 2 * 3);
    this.trailColors = new Float32Array(budget.maxTrailVertices * 2 * 3);
    this.trailGeometry.setAttribute("position", new THREE.BufferAttribute(this.trailPositions, 3).setUsage(THREE.DynamicDrawUsage));
    this.trailGeometry.setAttribute("color", new THREE.BufferAttribute(this.trailColors, 3).setUsage(THREE.DynamicDrawUsage));
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

  setTheme(theme: "dark" | "light" | boolean): void { this.isDark = theme === true || theme === "dark"; }

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
      const color = head.buckets.length === 1 ? palette[head.buckets[0]!] : palette.mixed;
      this.heads.setColorAt(index, color);
    });
    this.heads.count = visible.heads.length;
    this.heads.instanceMatrix.needsUpdate = true;
    if (this.heads.instanceColor) this.heads.instanceColor.needsUpdate = true;

    let vertex = 0;
    const maxVertices = this.budget.maxTrailVertices * 2;
    for (const trail of visible.trails) {
      const color = palette[trail.bucket];
      for (let index = 0; index < trail.coordinates.length - 1 && vertex + 1 < maxVertices; index++) {
        const pair = [trail.coordinates[index]!, trail.coordinates[index + 1]!] as const;
        for (const [lon, lat] of pair) {
          const point = MercatorCoordinate.fromLngLat([lon, lat], 0);
          const offset = vertex * 3;
          this.trailPositions[offset] = point.x;
          this.trailPositions[offset + 1] = point.y;
          this.trailPositions[offset + 2] = point.z;
          this.trailColors[offset] = color.r;
          this.trailColors[offset + 1] = color.g;
          this.trailColors[offset + 2] = color.b;
          vertex += 1;
        }
      }
    }
    this.trailGeometry.setDrawRange(0, vertex);
    (this.trailGeometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    (this.trailGeometry.getAttribute("color") as THREE.BufferAttribute).needsUpdate = true;
    return visible;
  }

  render(matrix: number[]): void {
    if (!this.renderer) return;
    this.camera.projectionMatrix.fromArray(matrix);
    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
    this.renderer.resetState();
  }

  dispose(): void {
    this.heads.geometry.dispose();
    (this.heads.material as THREE.Material).dispose();
    this.trailGeometry.dispose();
    (this.trailLines.material as THREE.Material).dispose();
    this.renderer?.dispose();
    this.renderer = null;
  }
}
