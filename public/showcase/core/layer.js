// Mapbox CustomLayer + Three.js 場景管理。
// 共享 GL context、單一 scene、每幀呼叫所有 effect 的 update。
import * as THREE from "three";

export function createShowcaseLayer({ effects, state, mapboxgl }) {
  return {
    id: "showcase-3d",
    type: "custom",
    renderingMode: "3d",
    scene: new THREE.Scene(),
    camera: new THREE.Camera(),
    renderer: null,
    map: null,
    lastTime: performance.now(),

    onAdd(mapObj, gl) {
      this.map = mapObj;
      this.renderer = new THREE.WebGLRenderer({
        canvas: mapObj.getCanvas(),
        context: gl,
        antialias: true,
      });
      this.renderer.autoClear = false;

      // 為每個 effect 建立 group 並執行 build
      for (const eff of effects) {
        const group = new THREE.Group();
        const params = {};
        for (const p of eff.params) params[p.id] = p.value;

        let buildCtx = {};
        if (eff.isLine || eff.isArc) {
          // 兩點型（line / arc）：兩端用 mercator 絕對座標，group 不平移
          const aMC = mapboxgl.MercatorCoordinate.fromLngLat(eff.loc, 0);
          const bMC = mapboxgl.MercatorCoordinate.fromLngLat(eff.lineEnd, 0);
          const midLat = (eff.loc[1] + eff.lineEnd[1]) / 2;
          const midLng = (eff.loc[0] + eff.lineEnd[0]) / 2;
          const midMC = mapboxgl.MercatorCoordinate.fromLngLat([midLng, midLat], 0);
          const dx = bMC.x - aMC.x, dy = bMC.y - aMC.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const meterScale = midMC.meterInMercatorCoordinateUnits();
          buildCtx = {
            lineStartMC: aMC, lineEndMC: bMC, lineScale: meterScale,  // flowline 用
            startMC: aMC, endMC: bMC, distance: dist, scale: meterScale, // arc 用
          };
          eff.build(group, params, buildCtx);
        } else {
          const mc = mapboxgl.MercatorCoordinate.fromLngLat(eff.loc, 0);
          group.position.set(mc.x, mc.y, mc.z);
          eff._mc = mc;
          eff._scale = mc.meterInMercatorCoordinateUnits();
          eff.build(group, params);
        }

        eff._group = group;
        eff._params = params;
        this.scene.add(group);
      }
    },

    render(_gl, matrix) {
      const now = performance.now();
      const dt = Math.min(0.05, (now - this.lastTime) / 1000);
      this.lastTime = now;
      const t = now / 1000;

      // 更新所有 effect
      for (const eff of effects) {
        if (!eff._group.visible) continue;
        if (state.paused) continue;
        eff.update(eff._group, dt, t, eff._params, eff._scale ?? 1);
      }

      this.camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix);

      // 保存 / 恢復 GL state（Mapbox 跟 Three 共用同 context）
      const gl = this.renderer.getContext();
      const blendEnabled = gl.isEnabled(gl.BLEND);
      const blendSrc = gl.getParameter(gl.BLEND_SRC_RGB);
      const blendDst = gl.getParameter(gl.BLEND_DST_RGB);
      const blendSrcA = gl.getParameter(gl.BLEND_SRC_ALPHA);
      const blendDstA = gl.getParameter(gl.BLEND_DST_ALPHA);

      this.renderer.resetState();
      this.renderer.render(this.scene, this.camera);
      this.renderer.resetState();

      if (blendEnabled) gl.enable(gl.BLEND); else gl.disable(gl.BLEND);
      gl.blendFuncSeparate(blendSrc, blendDst, blendSrcA, blendDstA);

      this.map?.triggerRepaint();
    },
  };
}
