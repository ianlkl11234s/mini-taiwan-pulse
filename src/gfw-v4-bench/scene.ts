import * as THREE from "three";
import type { FrameBudget, TrackFrame } from "./types";

const COLORS = {
  cargo: new THREE.Color("#39bff4"),
  tanker: new THREE.Color("#ff8f43"),
  passenger: new THREE.Color("#b3a0ff"),
  fishing: new THREE.Color("#58d68d"),
  other: new THREE.Color("#f0cc66"),
  mixed: new THREE.Color("#f5f1db"),
} as const;

/** Isolated benchmark renderer only. It must not be mounted beside production ShipScene. */
export class BenchTrackScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);
  private readonly heads: THREE.InstancedMesh;
  private readonly trailGeometry = new THREE.BufferGeometry();
  private readonly trailPositions: Float32Array;
  private readonly trailColors: Float32Array;
  private readonly trailLines: THREE.LineSegments;
  private readonly matrix = new THREE.Matrix4();

  constructor(canvas: HTMLCanvasElement, private readonly budget: FrameBudget) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setClearColor(0x071412, 1);
    this.heads = new THREE.InstancedMesh(
      new THREE.CircleGeometry(0.008, 12),
      new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95 }),
      budget.maxHeads,
    );
    this.heads.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(budget.maxHeads * 3), 3);
    this.heads.count = 0;
    this.heads.frustumCulled = false;
    this.scene.add(this.heads);

    // LineSegments uses two vertices for each logical edge.
    this.trailPositions = new Float32Array(budget.maxTrailVertices * 2 * 3);
    this.trailColors = new Float32Array(budget.maxTrailVertices * 2 * 3);
    this.trailGeometry.setAttribute("position", new THREE.BufferAttribute(this.trailPositions, 3));
    this.trailGeometry.setAttribute("color", new THREE.BufferAttribute(this.trailColors, 3));
    this.trailGeometry.setDrawRange(0, 0);
    this.trailLines = new THREE.LineSegments(
      this.trailGeometry,
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.68 }),
    );
    this.trailLines.frustumCulled = false;
    this.scene.add(this.trailLines);
  }

  resize(width: number, height: number, devicePixelRatio: number): void {
    this.renderer.setPixelRatio(Math.min(2, Math.max(1, devicePixelRatio)));
    this.renderer.setSize(width, height, false);
  }

  update(frame: TrackFrame, bbox: [number, number, number, number]): void {
    const [west, south, east, north] = bbox;
    const project = (lon: number, lat: number): [number, number] => [
      ((lon - west) / (east - west)) * 2 - 1,
      ((lat - south) / (north - south)) * 2 - 1,
    ];
    frame.heads.forEach((head, index) => {
      const [x, y] = project(head.lon, head.lat);
      const scale = 1 + Math.min(4, Math.sqrt(head.members.length) - 1) * 0.45;
      this.matrix.makeScale(scale, scale, 1);
      this.matrix.setPosition(x, y, 0);
      this.heads.setMatrixAt(index, this.matrix);
      const color = head.buckets.length === 1 ? COLORS[head.buckets[0]!] : COLORS.mixed;
      this.heads.setColorAt(index, color);
    });
    this.heads.count = frame.heads.length;
    this.heads.instanceMatrix.needsUpdate = true;
    if (this.heads.instanceColor) this.heads.instanceColor.needsUpdate = true;

    let vertex = 0;
    for (const trail of frame.trails) {
      const color = COLORS[trail.bucket];
      for (let index = 0; index < trail.coordinates.length - 1; index++) {
        const a = trail.coordinates[index]!;
        const b = trail.coordinates[index + 1]!;
        for (const point of [a, b]) {
          if (vertex >= this.budget.maxTrailVertices * 2) break;
          const [x, y] = project(point[0], point[1]);
          this.trailPositions[vertex * 3] = x;
          this.trailPositions[vertex * 3 + 1] = y;
          this.trailPositions[vertex * 3 + 2] = 0;
          this.trailColors[vertex * 3] = color.r;
          this.trailColors[vertex * 3 + 1] = color.g;
          this.trailColors[vertex * 3 + 2] = color.b;
          vertex += 1;
        }
      }
    }
    this.trailGeometry.setDrawRange(0, vertex);
    (this.trailGeometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    (this.trailGeometry.getAttribute("color") as THREE.BufferAttribute).needsUpdate = true;
  }

  render(): void { this.renderer.render(this.scene, this.camera); }

  dispose(): void {
    this.heads.geometry.dispose();
    (this.heads.material as THREE.Material).dispose();
    this.trailGeometry.dispose();
    (this.trailLines.material as THREE.Material).dispose();
    this.renderer.dispose();
  }
}
