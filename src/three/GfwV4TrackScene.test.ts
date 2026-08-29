import { describe, expect, it } from "vitest";
import * as THREE from "three";
import type { TrackFrame } from "../gfw-v4-bench/types";
import { cullGfwV4Frame, GfwV4TrackScene } from "./GfwV4TrackScene";

describe("GfwV4TrackScene viewport culling", () => {
  it("keeps complete same-coordinate members and only visible geometry", () => {
    const frame: TrackFrame = {
      heads: [
        { lon: 121, lat: 24, buckets: ["cargo"], members: [
          { vesselId: "a", mmsi: "1", shipName: null, vesselType: "CARGO", flag: null },
          { vesselId: "b", mmsi: "2", shipName: null, vesselType: "CARGO", flag: null },
        ] },
        { lon: 140, lat: 40, buckets: ["other"], members: [] },
      ],
      trails: [
        { trackId: "visible", bucket: "cargo", coordinates: [[120, 24], [121, 24]] },
        { trackId: "outside", bucket: "other", coordinates: [[140, 40], [141, 40]] },
      ],
      visibleHeadGroups: 2, visibleMembers: 2, visibleTrailVertices: 4,
      renderedHeadGroups: 2, renderedTrailVertices: 4, overBudgetHeads: 0, overBudgetTrailVertices: 0,
    };
    const visible = cullGfwV4Frame(frame, { west: 119, south: 22, east: 123, north: 26 });
    expect(visible.heads).toHaveLength(1);
    expect(visible.heads[0]?.members.map((member) => member.vesselId)).toEqual(["a", "b"]);
    expect(visible.trails.map((trail) => trail.trackId)).toEqual(["visible"]);
  });

  it("does not hide geometry through viewport culling before reporting it", () => {
    const frame: TrackFrame = {
      heads: [], trails: [{ trackId: "edge", bucket: "cargo", coordinates: [[120, 24], [121, 24], [122, 24]] }],
      visibleHeadGroups: 0, visibleMembers: 0, visibleTrailVertices: 3,
      renderedHeadGroups: 0, renderedTrailVertices: 3, overBudgetHeads: 0, overBudgetTrailVertices: 0,
    };
    expect(cullGfwV4Frame(frame, { west: 119, south: 22, east: 123, north: 26 }).trailVertices).toBe(3);
  });

  it("throws a diagnostic error before writing beyond the explicit GPU budget", () => {
    const frame: TrackFrame = {
      heads: [
        { lon: 121, lat: 24, buckets: ["cargo"], members: [] },
        { lon: 121.1, lat: 24.1, buckets: ["cargo"], members: [] },
      ],
      trails: [], visibleHeadGroups: 2, visibleMembers: 0, visibleTrailVertices: 0,
      renderedHeadGroups: 2, renderedTrailVertices: 0, overBudgetHeads: 0, overBudgetTrailVertices: 0,
    };
    const scene = new GfwV4TrackScene({ maxHeads: 1, maxTrailVertices: 10 });
    expect(() => scene.update(frame, { west: 119, south: 22, east: 123, north: 26 }, 5)).toThrow(/GPU budget exceeded/);
    scene.dispose();
  });

  it("scales an aggregated spatial marker from its complete member count", () => {
    const frame = { points: new Float32Array([121, 24]), buckets: new Uint8Array([1]), memberCounts: new Uint16Array([9]) };
    const scene = new GfwV4TrackScene({ maxHeads: 2, maxTrailVertices: 2 });
    scene.updateSpatialPoints(frame, 5);
    const heads = (scene as unknown as { heads: { getMatrixAt(index: number, target: { elements: number[] }): void } }).heads;
    const matrix = new THREE.Matrix4();
    heads.getMatrixAt(0, matrix);
    expect(matrix.elements[0]).toBeGreaterThan(2.8 / (512 * 2 ** 5));
    scene.dispose();
  });

  it("uses instance colors without requiring a missing geometry color attribute", () => {
    const scene = new GfwV4TrackScene({ maxHeads: 2, maxTrailVertices: 2 });
    const heads = (scene as unknown as { heads: THREE.InstancedMesh }).heads;
    const material = heads.material as THREE.MeshBasicMaterial;
    expect(material.vertexColors).toBe(false);
    expect(heads.instanceColor).toBeInstanceOf(THREE.InstancedBufferAttribute);
    expect(heads.geometry.getAttribute("color")).toBeUndefined();
    scene.dispose();
  });

  it("patches the head shader with a real per-instance opacity attribute", () => {
    const scene = new GfwV4TrackScene({ maxHeads: 2, maxTrailVertices: 2 });
    const heads = (scene as unknown as { heads: THREE.InstancedMesh }).heads;
    const material = heads.material as THREE.MeshBasicMaterial;
    const shader = {
      vertexShader: "#include <common>\nvoid main() {\n#include <color_vertex>\n}",
      fragmentShader: "#include <common>\nvoid main() {\nvec4 diffuseColor = vec4( diffuse, opacity );\n}",
    };
    material.onBeforeCompile(shader as never, {} as THREE.WebGLRenderer);
    expect(shader.vertexShader).toContain("attribute float aGfwAlpha");
    expect(shader.vertexShader).toContain("vGfwAlpha = aGfwAlpha");
    expect(shader.fragmentShader).toContain("diffuseColor.a *= clamp( vGfwAlpha, 0.0, 1.0 )");
    const alpha = heads.geometry.getAttribute("aGfwAlpha");
    expect(alpha).toBeInstanceOf(THREE.InstancedBufferAttribute);
    expect(alpha.normalized).toBe(true);
    expect(alpha.array).toBeInstanceOf(Uint8Array);
    scene.dispose();
  });

  it("uploads point alpha and RGBA trail alpha, defaulting both to one", () => {
    const scene = new GfwV4TrackScene({ maxHeads: 3, maxTrailVertices: 2 });
    const faded = {
      points: new Float32Array([121, 24, 122, 25]),
      buckets: new Uint8Array([1, 2]),
      pointAlphas: new Uint8Array([64, 191]),
      segments: new Float32Array([121, 24, 122, 25]),
      segmentBuckets: new Uint8Array([1]),
      segmentAlphas: new Uint8Array([102]),
    };
    scene.updateSpatialPoints(faded, 5);
    const heads = (scene as unknown as { heads: THREE.InstancedMesh }).heads;
    const headAlpha = heads.geometry.getAttribute("aGfwAlpha") as THREE.InstancedBufferAttribute;
    const trailGeometry = (scene as unknown as { trailGeometry: THREE.BufferGeometry }).trailGeometry;
    const trailColor = trailGeometry.getAttribute("color") as THREE.BufferAttribute;
    expect(headAlpha.normalized).toBe(true);
    expect(Array.from(headAlpha.array.slice(0, 2))).toEqual([64, 191]);
    expect(headAlpha.getX(0)).toBeCloseTo(64 / 255);
    expect(headAlpha.getX(1)).toBeCloseTo(191 / 255);
    expect(trailColor.itemSize).toBe(4);
    expect(trailColor.normalized).toBe(true);
    expect(trailColor.array).toBeInstanceOf(Uint8Array);
    expect(trailColor.getW(0)).toBeCloseTo(102 / 255);
    expect(trailColor.getW(1)).toBeCloseTo(102 / 255);

    scene.updateSpatialPoints({
      points: faded.points,
      buckets: faded.buckets,
      segments: faded.segments,
      segmentBuckets: faded.segmentBuckets,
    }, 5);
    expect(Array.from(headAlpha.array.slice(0, 2))).toEqual([255, 255]);
    expect([headAlpha.getX(0), headAlpha.getX(1)]).toEqual([1, 1]);
    expect(trailColor.getW(0)).toBe(1);
    expect(trailColor.getW(1)).toBe(1);
    scene.dispose();
  });

  it("rejects opacity buffers that are not aligned with their geometry", () => {
    const scene = new GfwV4TrackScene({ maxHeads: 3, maxTrailVertices: 2 });
    expect(() => scene.updateSpatialPoints({
      points: new Float32Array([121, 24, 122, 25]),
      buckets: new Uint8Array([1, 2]),
      pointAlphas: new Uint8Array([128]),
    }, 5)).toThrow(/spatial point buffer shape mismatch/);
    expect(() => scene.updateSpatialPoints({
      points: new Float32Array([121, 24]),
      buckets: new Uint8Array([1]),
      segments: new Float32Array([121, 24, 122, 25]),
      segmentBuckets: new Uint8Array([1]),
      segmentAlphas: new Uint8Array([128, 191]),
    }, 5)).toThrow(/segment alpha buffer shape mismatch/);
    scene.dispose();
  });

  it("uses normal blending on light maps so instance colors keep their contrast", () => {
    const scene = new GfwV4TrackScene({ maxHeads: 2, maxTrailVertices: 2 });
    const heads = (scene as unknown as { heads: THREE.InstancedMesh }).heads;
    const material = heads.material as THREE.MeshBasicMaterial;
    expect(material.blending).toBe(THREE.AdditiveBlending);
    scene.setTheme("light");
    expect(material.blending).toBe(THREE.NormalBlending);
    scene.setTheme("dark");
    expect(material.blending).toBe(THREE.AdditiveBlending);
    scene.dispose();
  });

  it("restores Mapbox shared GL blend state after rendering", () => {
    const calls: string[] = [];
    const gl = {
      BLEND: 1, BLEND_SRC_RGB: 2, BLEND_DST_RGB: 3, BLEND_SRC_ALPHA: 4, BLEND_DST_ALPHA: 5,
      BLEND_EQUATION_RGB: 6, BLEND_EQUATION_ALPHA: 7, BLEND_COLOR: 8,
      isEnabled: () => true, getParameter: (value: number) => value === 8 ? new Float32Array([0.1, 0.2, 0.3, 0.4]) : value + 10,
      enable: () => calls.push("enable"), disable: () => calls.push("disable"),
      blendFuncSeparate: (a: number, b: number, c: number, d: number) => calls.push(`${a}/${b}/${c}/${d}`),
      blendEquationSeparate: (rgb: number, alpha: number) => calls.push(`eq:${rgb}/${alpha}`),
      blendColor: (r: number, g: number, b: number, a: number) => calls.push(`color:${r.toFixed(1)}/${g.toFixed(1)}/${b.toFixed(1)}/${a.toFixed(1)}`),
    };
    const scene = new GfwV4TrackScene({ maxHeads: 1, maxTrailVertices: 1 });
    (scene as unknown as { renderer: unknown }).renderer = { getContext: () => gl, resetState: () => {}, render: () => {}, dispose: () => {} };
    scene.render(new Array<number>(16).fill(0));
    expect(calls).toEqual(["enable", "12/13/14/15", "eq:16/17", "color:0.1/0.2/0.3/0.4"]);
    scene.dispose();
  });
});
