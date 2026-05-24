import * as THREE from "three";

export default [
  {
    id: "smoke",
    name: "體積煙霧（Volumetric Smoke）",
    loc: [120.2535, 23.7531], city: "麥寮",
    tech: "多顆軟邊球 cluster + 隨機抖動 + 慢速向上飄 + 越高越大越淡",
    desc: "10~15 顆半透明球疊在一起飄 → 模擬煙霧 / 雲 / 污染擴散。比真實 volumetric rendering 便宜很多，視覺夠用。可改色變雲、火、霾。",
    prompt: "在 <b>[位置]</b> 噴出 <b>[12 顆]</b> 半徑 <b>[350m]</b> 的 <b>[灰白色]</b> 軟球團，慢慢向上飄 + 輕微抖動 + 越高越淡，普通混合 opacity 0.18。",
    params: [
      { id: "count", label: "球數", min: 3, max: 25, step: 1, value: 12 },
      { id: "size", label: "球徑(m)", min: 100, max: 1000, step: 25, value: 400 },
      { id: "rise", label: "上升", min: 0, max: 1.0, step: 0.05, value: 0.3 },
      { id: "spread", label: "散度", min: 0.5, max: 5.0, step: 0.1, value: 2.0 },
    ],
    build: (group) => {
      const puffs = [];
      for (let i = 0; i < 25; i++) {
        const geo = new THREE.IcosahedronGeometry(1, 2);
        const mat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(0.85, 0.85, 0.9),
          transparent: true, opacity: 0.18,
          depthWrite: false, side: THREE.DoubleSide,
        });
        const m = new THREE.Mesh(geo, mat);
        group.add(m);
        puffs.push({
          mesh: m, seed: Math.random() * 100, phaseOffset: Math.random(),
          baseX: (Math.random() - 0.5), baseY: (Math.random() - 0.5),
        });
      }
      group.userData.puffs = puffs;
    },
    update: (group, dt, t, params, scale) => {
      const visible = Math.round(params.count);
      const sz = params.size * scale;
      const spread = params.spread;
      const rise = params.rise;
      group.userData.puffs.forEach((p, i) => {
        if (i >= visible) { p.mesh.visible = false; return; }
        p.mesh.visible = true;
        const life = ((t * rise * 0.3) + p.phaseOffset) % 1;
        const x = p.baseX * sz * spread + Math.sin(t * 0.5 + p.seed) * sz * 0.2;
        const y = p.baseY * sz * spread + Math.cos(t * 0.6 + p.seed) * sz * 0.2;
        const z = life * sz * 5;
        p.mesh.position.set(x, y, z);
        const grow = 1 + life * 1.5;
        const s = sz * grow;
        p.mesh.scale.set(s, s, s);
        p.mesh.material.opacity = 0.28 * (1 - life);
      });
    },
  },

  {
    id: "noisecloud",
    name: "噪聲雲團（Noise Cluster）",
    loc: [121.4985, 22.6667], city: "綠島",
    tech: "InstancedMesh 球 + 位置由 sin/cos noise 函數決定 + 慢速漂移",
    desc: "用噪聲函數決定每球位置 → 一團不規則雲體。改 seed 變不同形狀。同技術可做星雲、火焰外圍、霧氣場。",
    prompt: "在 <b>[位置]</b> 高空 <b>[600m]</b> 散佈 <b>[250 顆]</b> 直徑 <b>[80m]</b> 的小球，由 noise 決定位置，整團慢慢飄。",
    params: [
      { id: "count", label: "球數", min: 50, max: 500, step: 10, value: 250 },
      { id: "spread", label: "範圍(m)", min: 200, max: 2500, step: 50, value: 1000 },
      { id: "altitude", label: "高度(m)", min: 0, max: 2000, step: 50, value: 600 },
      { id: "drift", label: "漂速", min: 0, max: 2, step: 0.05, value: 0.3 },
    ],
    build: (group) => {
      const N = 500;
      const geo = new THREE.IcosahedronGeometry(1, 0);
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.7, 0.85, 1.0),
        transparent: true, opacity: 0.45,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const inst = new THREE.InstancedMesh(geo, mat, N);
      inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const seeds = [];
      for (let i = 0; i < N; i++) {
        seeds.push({
          a: Math.random() * 100, b: Math.random() * 100, c: Math.random() * 100,
          size: 0.5 + Math.random() * 1.0,
        });
      }
      group.add(inst);
      group.userData = { inst, seeds, N };
    },
    update: (group, dt, t, params, scale) => {
      const { inst, seeds, N } = group.userData;
      const visible = Math.round(params.count);
      const spread = params.spread * scale;
      const alt = params.altitude * scale;
      const tt = t * params.drift;
      const dummy = new THREE.Object3D();
      for (let i = 0; i < N; i++) {
        const s = seeds[i];
        if (i >= visible) {
          dummy.scale.set(0, 0, 0); dummy.updateMatrix();
          inst.setMatrixAt(i, dummy.matrix); continue;
        }
        const x = Math.sin(s.a + tt) * Math.cos(s.b + tt * 0.7) * spread;
        const y = Math.sin(s.b + tt * 1.1) * Math.cos(s.c + tt * 0.9) * spread;
        const z = alt + Math.sin(s.c + tt * 0.5) * spread * 0.4;
        dummy.position.set(x, y, z);
        const sz = scale * 80 * s.size;
        dummy.scale.set(sz, sz, sz);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
      }
      inst.count = N;
      inst.instanceMatrix.needsUpdate = true;
    },
  },

  {
    id: "fog",
    name: "霧效（Low Fog Layer）",
    loc: [121.7388, 25.0260], city: "平溪",
    tech: "扁平軟邊球 cluster + 低空緩慢漂移（比 smoke 更稀薄、更貼地）",
    desc: "貼近地面的稀薄霧氣，扁平球體散佈在大範圍。比 smoke 弱，比 cloud 低。表達晨霧、霾害低層、神秘氣氛。",
    prompt: "在 <b>[位置]</b> 鋪 <b>[3000m]</b> 範圍 <b>[200m]</b> 高的稀薄霧層，<b>[20 團]</b> 軟球扁平散佈，緩慢漂移。",
    params: [
      { id: "count", label: "團數", min: 5, max: 30, step: 1, value: 18 },
      { id: "spread", label: "範圍(m)", min: 500, max: 5000, step: 100, value: 2800 },
      { id: "altitude", label: "高度(m)", min: 50, max: 800, step: 25, value: 250 },
      { id: "size", label: "團徑(m)", min: 200, max: 1500, step: 50, value: 800 },
    ],
    build: (group) => {
      const N = 30;
      const puffs = [];
      for (let i = 0; i < N; i++) {
        const geo = new THREE.IcosahedronGeometry(1, 2);
        const mat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(0.85, 0.88, 0.92),
          transparent: true, opacity: 0.13,
          depthWrite: false, side: THREE.DoubleSide,
        });
        const m = new THREE.Mesh(geo, mat);
        group.add(m);
        puffs.push({
          mesh: m,
          baseX: (Math.random() - 0.5),
          baseY: (Math.random() - 0.5),
          baseZ: 0.2 + Math.random() * 0.5,
          seed: Math.random() * 100,
          size: 0.7 + Math.random() * 0.8,
        });
      }
      group.userData = { puffs };
    },
    update: (group, dt, t, params, scale) => {
      const spread = params.spread * scale;
      const altitude = params.altitude * scale;
      const visible = Math.round(params.count);
      group.userData.puffs.forEach((p, i) => {
        if (i >= visible) { p.mesh.visible = false; return; }
        p.mesh.visible = true;
        const drift = t * 0.08;
        const x = p.baseX * spread + Math.sin(drift + p.seed) * spread * 0.08;
        const y = p.baseY * spread + Math.cos(drift + p.seed * 1.3) * spread * 0.08;
        const z = altitude * (0.4 + p.baseZ * 0.6);
        p.mesh.position.set(x, y, z);
        const sz = params.size * scale * p.size;
        p.mesh.scale.set(sz, sz, sz * 0.35); // 扁平
      });
    },
  },
];
