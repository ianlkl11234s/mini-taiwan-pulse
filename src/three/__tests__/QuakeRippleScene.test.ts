import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { setMercatorEngine } from "../../utils/coordinates";
import { QuakeRippleScene, RIPPLE_CYCLE_MS, ripplePhase, rippleRing } from "../QuakeRippleScene";

setMercatorEngine({
  fromLngLat: ([, lat], altitude = 0) => ({
    x: 0, y: (90 - lat) / 180, z: altitude / 1_000_000,
    meterInMercatorCoordinateUnits: () => 1 / 1_000_000,
  }),
});

const item = (lng: number, lat: number, mag = 5) => ({ lng, lat, mag, rgb: [1, 0.5, 0] as [number, number, number] });

describe("QuakeRippleScene", () => {
  it("builds two ring instances per quake and skips invalid coordinates", () => {
    const scene = new QuakeRippleScene();
    scene.setRipples([item(140, 35), item(-170, -19), item(Number.NaN, 10)]);
    expect(scene.count).toBe(2);
    expect(scene.instanceCount).toBe(4);
    scene.setRipples([]);
    expect(scene.count).toBe(0);
    expect(scene.instanceCount).toBe(0);
  });

  it("disposes the previous geometry on every rebuild and the material on dispose", () => {
    const geomDispose = vi.spyOn(THREE.BufferGeometry.prototype, "dispose");
    const matDispose = vi.spyOn(THREE.Material.prototype, "dispose");
    const scene = new QuakeRippleScene();
    scene.setRipples([item(140, 35)]);
    scene.setRipples([item(120, 23)]);
    expect(geomDispose).toHaveBeenCalledTimes(1);
    scene.dispose();
    expect(geomDispose).toHaveBeenCalledTimes(2);
    expect(matDispose).toHaveBeenCalledTimes(1);
    expect(scene.instanceCount).toBe(0);
    geomDispose.mockRestore();
    matDispose.mockRestore();
  });

  it("keeps the old ripple timing and size curve (2 rings, half-cycle apart, bigger quakes → bigger rings)", () => {
    expect(ripplePhase(0, 0)).toBe(0);
    expect(ripplePhase(0, 1)).toBeCloseTo(0.5);
    expect(ripplePhase(RIPPLE_CYCLE_MS * 3 + 600, 0)).toBeCloseTo(0.25);
    const start = rippleRing(0, 5);
    const end = rippleRing(0.999, 5);
    expect(start).toMatchObject({ radiusPx: 16, strokePx: 2.5, strokeOpacity: 0.7 });
    expect(end.radiusPx).toBeCloseTo(76, 0);
    expect(end.strokeOpacity).toBeLessThan(0.01);
    expect(rippleRing(0.5, 7).radiusPx - rippleRing(0.5, 5).radiusPx).toBeCloseTo(4);
  });
});
