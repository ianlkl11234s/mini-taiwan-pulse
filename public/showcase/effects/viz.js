import * as THREE from "three";

export default [
  {
    id: "bars",
    name: "3D 長條圖（Bar Chart）",
    loc: [120.5421, 24.0735], city: "彰化",
    tech: "BoxGeometry × N + scale.z 動態 + HSL 顏色梯變",
    desc: "資料視覺化最基本款。每根長條 = 一個值（過去 N 期、N 個分類），高度動態變化、顏色依數值梯變。可排成 grid 表示矩陣資料。",
    prompt: "在 <b>[位置]</b> 放 <b>[7 根]</b> 並排長條，寬 <b>[80m]</b> 間距 <b>[120m]</b>，最高 <b>[700m]</b>，顏色由低（藍）到高（紅）梯變，數據隨時間波動。",
    params: [
      { id: "count", label: "根數", min: 3, max: 20, step: 1, value: 7 },
      { id: "width", label: "寬(m)", min: 30, max: 300, step: 10, value: 100 },
      { id: "spacing", label: "間距倍", min: 1.0, max: 3.0, step: 0.1, value: 1.6 },
      { id: "maxH", label: "最高(m)", min: 100, max: 1500, step: 50, value: 800 },
    ],
    build: (group) => {
      const bars = [];
      const baseGeo = new THREE.BoxGeometry(1, 1, 1);
      baseGeo.translate(0, 0, 0.5);
      for (let i = 0; i < 20; i++) {
        const mat = new THREE.MeshBasicMaterial({
          color: 0xffffff, transparent: true, opacity: 0.85, side: THREE.DoubleSide,
        });
        const m = new THREE.Mesh(baseGeo, mat);
        group.add(m);
        bars.push(m);
      }
      group.userData.bars = bars;
    },
    update: (group, dt, t, params, scale) => {
      const w = params.width * scale;
      const spacing = w * params.spacing;
      const maxH = params.maxH * scale;
      const N = Math.round(params.count);
      group.userData.bars.forEach((m, i) => {
        if (i >= N) { m.visible = false; return; }
        m.visible = true;
        const norm = (Math.sin(t * 1.2 + i * 0.5) + 1) / 2;
        const h = (0.2 + 0.8 * norm) * maxH;
        m.scale.set(w * 0.85, w * 0.85, h);
        m.position.x = (i - (N - 1) / 2) * spacing;
        m.material.color.setHSL(0.62 - norm * 0.55, 0.85, 0.55);
      });
    },
  },

  {
    id: "heatmap",
    name: "熱力 3D 曲面（Heatmap Surface）",
    loc: [121.5985, 24.1908], city: "太魯閣",
    tech: "PlaneGeometry 高細分 + 每幀更新 vertex z + vertex color HSL",
    desc: "把平面細分成網格，每頂點高度 = 數值、顏色 = 高度梯變。模擬熱力圖、海拔、人口密度、訊號強度。專案的溫度波浪走同 pattern。",
    prompt: "在 <b>[位置]</b> 鋪 <b>[2500×2500m]</b> 的熱力曲面，<b>[48×48 細分]</b>，高度由 noise 動態起伏，顏色由低（藍）到高（紅）。",
    params: [
      { id: "size", label: "範圍(m)", min: 500, max: 5000, step: 100, value: 2500 },
      { id: "maxH", label: "最高(m)", min: 50, max: 1500, step: 50, value: 600 },
      { id: "speed", label: "波速", min: 0, max: 3, step: 0.1, value: 0.5 },
    ],
    build: (group) => {
      const SEG = 48;
      const geo = new THREE.PlaneGeometry(1, 1, SEG, SEG);
      const vcount = (SEG + 1) * (SEG + 1);
      const colors = new Float32Array(vcount * 3);
      geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      const mat = new THREE.MeshBasicMaterial({
        vertexColors: true, transparent: true, opacity: 0.85,
        side: THREE.DoubleSide, depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      group.add(mesh);
      group.userData = { mesh, SEG };
    },
    update: (group, dt, t, params, scale) => {
      const { mesh, SEG } = group.userData;
      const size = params.size * scale;
      const maxH = params.maxH * scale;
      const speed = params.speed;
      mesh.scale.set(size, size, 1);
      const positions = mesh.geometry.attributes.position.array;
      const colors = mesh.geometry.attributes.color.array;
      const vcount = (SEG + 1) * (SEG + 1);
      const tmp = new THREE.Color();
      for (let i = 0; i < vcount; i++) {
        const x = positions[i * 3];
        const y = positions[i * 3 + 1];
        const n = Math.sin(x * 8 + t * speed) * Math.cos(y * 8 + t * speed * 0.7) +
                  Math.sin(x * 14 + y * 6 - t * speed * 0.5) * 0.5;
        const norm = Math.max(0, Math.min(1, (n + 1.5) / 3));
        positions[i * 3 + 2] = norm * maxH;
        tmp.setHSL(0.62 - norm * 0.55, 0.85, 0.5);
        colors[i * 3] = tmp.r;
        colors[i * 3 + 1] = tmp.g;
        colors[i * 3 + 2] = tmp.b;
      }
      mesh.geometry.attributes.position.needsUpdate = true;
      mesh.geometry.attributes.color.needsUpdate = true;
    },
  },

  {
    id: "pie",
    name: "3D 圓餅圖（Pie Chart）",
    loc: [120.9686, 23.9619], city: "埔里",
    tech: "CylinderGeometry thetaStart/thetaLength 切扇形 + 各扇不同高度",
    desc: "用 cylinder 的 theta 參數切出扇形拼成圓餅。各扇可有不同高度（雙重編碼：角度 = 比例 / 高度 = 數值）。",
    prompt: "在 <b>[位置]</b> 放一個半徑 <b>[600m]</b> 的圓餅，<b>[5 個]</b> 區塊（30% 22% 18% 16% 14%），各區塊不同顏色 + 高度依數值延伸。",
    params: [
      { id: "radius", label: "半徑(m)", min: 100, max: 1500, step: 25, value: 700 },
      { id: "maxH", label: "最高(m)", min: 50, max: 800, step: 25, value: 350 },
    ],
    build: (group) => {
      const slices = [
        { ratio: 0.30, color: 0x6cb8ff, height: 0.6 },
        { ratio: 0.22, color: 0xff7eb6, height: 0.45 },
        { ratio: 0.18, color: 0x4cffa6, height: 0.35 },
        { ratio: 0.16, color: 0xffd87a, height: 0.55 },
        { ratio: 0.14, color: 0xa080ff, height: 0.4 },
      ];
      let theta = 0;
      const meshes = [];
      for (const s of slices) {
        const arc = s.ratio * Math.PI * 2;
        const geo = new THREE.CylinderGeometry(1, 1, 1, 24, 1, false, theta, arc);
        geo.translate(0, 0.5, 0);
        geo.rotateX(Math.PI / 2);
        const mat = new THREE.MeshBasicMaterial({
          color: s.color, transparent: true, opacity: 0.9, side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geo, mat);
        group.add(mesh);
        meshes.push({ mesh, height: s.height });
        theta += arc;
      }
      group.userData.meshes = meshes;
    },
    update: (group, dt, t, params, scale) => {
      const r = params.radius * scale;
      const maxH = params.maxH * scale;
      const wobble = 1 + 0.04 * Math.sin(t);
      group.userData.meshes.forEach((m) => {
        m.mesh.scale.set(r * wobble, r * wobble, maxH * m.height);
      });
    },
  },

  {
    id: "polyextrude",
    name: "區塊 Extrude（Polygon Buildings）",
    loc: [120.6253, 24.3457], city: "大甲",
    tech: "ExtrudeGeometry on Shape 多邊形 → 模擬建築/區域拉高（同 Mapbox fill-extrusion）",
    desc: "把 2D 多邊形（行政區、建築輪廓、商圈）推出厚度變 3D。本專案水庫水量 / 車站光柱概念。多塊拼接成城市天際線。",
    prompt: "在 <b>[位置]</b> 鋪 <b>[6 個]</b> 隨機矩形 polygon，各自高度 <b>[200~700m]</b>，顏色由低到高 HSL 梯變，模擬城市區塊。",
    params: [
      { id: "count", label: "塊數", min: 2, max: 10, step: 1, value: 6 },
      { id: "size", label: "範圍(m)", min: 200, max: 2500, step: 50, value: 1500 },
      { id: "maxH", label: "最高(m)", min: 100, max: 1500, step: 50, value: 700 },
    ],
    build: (group) => {
      let seed = 42;
      const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
      const blocks = [];
      for (let i = 0; i < 10; i++) {
        const cx = (rand() - 0.5) * 0.7;
        const cy = (rand() - 0.5) * 0.7;
        const w = 0.08 + rand() * 0.12;
        const h = 0.08 + rand() * 0.12;
        const shape = new THREE.Shape();
        shape.moveTo(cx - w, cy - h);
        shape.lineTo(cx + w, cy - h);
        shape.lineTo(cx + w, cy + h);
        shape.lineTo(cx - w, cy + h);
        shape.closePath();
        const geo = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false });
        const mat = new THREE.MeshBasicMaterial({
          color: 0xffffff, transparent: true, opacity: 0.85, side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geo, mat);
        group.add(mesh);
        blocks.push({ mesh, heightFactor: 0.3 + rand() * 0.7 });
      }
      group.userData.blocks = blocks;
    },
    update: (group, dt, t, params, scale) => {
      const sz = params.size * scale;
      const maxH = params.maxH * scale;
      const visible = Math.round(params.count);
      group.userData.blocks.forEach((b, i) => {
        if (i >= visible) { b.mesh.visible = false; return; }
        b.mesh.visible = true;
        const wobble = 1 + 0.05 * Math.sin(t * 0.8 + i);
        b.mesh.scale.set(sz, sz, b.heightFactor * maxH * wobble);
        b.mesh.material.color.setHSL(0.55 - b.heightFactor * 0.35, 0.75, 0.55);
      });
    },
  },

  {
    id: "waveform",
    name: "音波柱（Audio Waveform）",
    loc: [120.3043, 23.5755], city: "北港",
    tech: "並排 BoxGeometry 柱 + 多頻 sin 疊加模擬音波 + HSL 顏色",
    desc: "一排 bar 高度由多頻 sin 疊加（模擬 FFT 頻譜）。換成真實 Web Audio analyser 數據就是音樂視覺化。表達聲音、震動、節奏。",
    prompt: "在 <b>[位置]</b> 排 <b>[48 根]</b> 並列細柱，高度由多頻 sin 疊加模擬音波，最高 <b>[500m]</b>，顏色隨振幅梯變。",
    params: [
      { id: "count", label: "根數", min: 16, max: 96, step: 4, value: 56 },
      { id: "width", label: "寬(m)", min: 10, max: 200, step: 5, value: 40 },
      { id: "maxH", label: "最高(m)", min: 100, max: 1500, step: 50, value: 600 },
      { id: "speed", label: "速度", min: 0.1, max: 5, step: 0.1, value: 1.5 },
    ],
    build: (group) => {
      const N = 96;
      const baseGeo = new THREE.BoxGeometry(1, 1, 1);
      baseGeo.translate(0, 0, 0.5);
      const bars = [];
      for (let i = 0; i < N; i++) {
        const mat = new THREE.MeshBasicMaterial({
          color: 0x6cb8ff, transparent: true, opacity: 0.9, side: THREE.DoubleSide,
        });
        const m = new THREE.Mesh(baseGeo, mat);
        group.add(m);
        bars.push(m);
      }
      group.userData = { bars, N };
    },
    update: (group, dt, t, params, scale) => {
      const visible = Math.round(params.count);
      const w = params.width * scale;
      const spacing = w * 1.4;
      const maxH = params.maxH * scale;
      const speed = params.speed;
      group.userData.bars.forEach((m, i) => {
        if (i >= visible) { m.visible = false; return; }
        m.visible = true;
        const x = (i - (visible - 1) / 2) / visible;
        const h1 = Math.sin(x * 12 + t * speed * 3) * 0.5;
        const h2 = Math.sin(x * 30 + t * speed * 5) * 0.3;
        const h3 = Math.sin(x * 5 - t * speed * 2) * 0.2;
        const norm = Math.min(1, Math.abs(h1 + h2 + h3));
        const h = (0.05 + norm * 0.95) * maxH;
        m.scale.set(w * 0.7, w * 0.7, h);
        m.position.x = (i - (visible - 1) / 2) * spacing;
        m.material.color.setHSL(0.55 + norm * 0.25, 0.85, 0.55);
      });
    },
  },

  // ── 系統關係 / 水資源 ──

  {
    id: "tank",
    name: "儲水容器（Storage Tank）",
    loc: [120.5181, 23.2542], city: "曾文水庫",
    tech: "外圍 Wireframe Cylinder + 內部水位 Cylinder（scale.z = fillLevel）+ HSL 顏色",
    desc: "圓筒容器 + 內部水位柱 + 水位顏色（低紅高綠）。表達水庫蓄水量、油槽、電池容量、儲存槽進度。",
    prompt: "在 <b>[位置]</b> 立一個半徑 <b>[400m]</b> 高 <b>[600m]</b> 的儲水容器，水位自動由 0~100% 循環，低紅高綠。",
    params: [
      { id: "radius", label: "半徑(m)", min: 100, max: 1500, step: 25, value: 500 },
      { id: "height", label: "高(m)", min: 100, max: 1500, step: 25, value: 700 },
      { id: "fillLevel", label: "水位", min: 0, max: 1, step: 0.05, value: 0.6 },
      { id: "autoFill", label: "自動", min: 0, max: 1, step: 1, value: 1 },
    ],
    build: (group) => {
      const tankGeo = new THREE.CylinderGeometry(1, 1, 1, 24, 1, true);
      tankGeo.translate(0, 0.5, 0);
      tankGeo.rotateX(Math.PI / 2);
      const tank = new THREE.Mesh(tankGeo, new THREE.MeshBasicMaterial({
        color: 0x6cb8ff, transparent: true, opacity: 0.12,
        side: THREE.DoubleSide, depthWrite: false,
      }));
      group.add(tank);
      const wire = new THREE.LineSegments(
        new THREE.WireframeGeometry(tankGeo),
        new THREE.LineBasicMaterial({ color: 0x6cb8ff, transparent: true, opacity: 0.6 }),
      );
      group.add(wire);
      const waterGeo = new THREE.CylinderGeometry(0.96, 0.96, 1, 24, 1, false);
      waterGeo.translate(0, 0.5, 0);
      waterGeo.rotateX(Math.PI / 2);
      const water = new THREE.Mesh(waterGeo, new THREE.MeshBasicMaterial({
        color: 0x4cffa6, transparent: true, opacity: 0.7,
        side: THREE.DoubleSide, depthWrite: false,
      }));
      group.add(water);
      group.userData = { tank, wire, water };
    },
    update: (group, dt, t, params, scale) => {
      const r = params.radius * scale;
      const h = params.height * scale;
      const fill = params.autoFill > 0.5 ? (Math.sin(t * 0.3) + 1) / 2 : params.fillLevel;
      group.userData.tank.scale.set(r, r, h);
      group.userData.wire.scale.set(r, r, h);
      group.userData.water.scale.set(r * 0.96, r * 0.96, h * fill);
      group.userData.water.material.color.setHSL(fill * 0.4, 0.85, 0.55);
    },
  },

  {
    id: "vessels",
    name: "連通管（Connected Vessels）",
    loc: [121.1106, 24.9706], city: "新屋",
    tech: "3 個 Cylinder Tank 並排 + 底部連接管 + 各自水位 sin 連動但平均收斂",
    desc: "3 個容器底部連通，水位平均收斂但有擾動 = 連通器原理（達西定律）。表達系統平衡、跨區調水、能量重分配。",
    prompt: "在 <b>[位置]</b> 並排 <b>[3 個]</b> 半徑 <b>[300m]</b> 高 <b>[500m]</b> 的容器，底部連通管，水位連動但有擾動。",
    params: [
      { id: "radius", label: "半徑(m)", min: 80, max: 800, step: 10, value: 320 },
      { id: "height", label: "高(m)", min: 100, max: 1500, step: 25, value: 600 },
    ],
    build: (group) => {
      const N = 3;
      const tanks = [];
      for (let i = 0; i < N; i++) {
        const tankGeo = new THREE.CylinderGeometry(1, 1, 1, 24, 1, true);
        tankGeo.translate(0, 0.5, 0);
        tankGeo.rotateX(Math.PI / 2);
        const wire = new THREE.LineSegments(
          new THREE.WireframeGeometry(tankGeo),
          new THREE.LineBasicMaterial({ color: 0x6cb8ff, transparent: true, opacity: 0.5 }),
        );
        group.add(wire);
        const waterGeo = new THREE.CylinderGeometry(0.95, 0.95, 1, 24, 1, false);
        waterGeo.translate(0, 0.5, 0);
        waterGeo.rotateX(Math.PI / 2);
        const water = new THREE.Mesh(waterGeo, new THREE.MeshBasicMaterial({
          color: 0x4cffa6, transparent: true, opacity: 0.7,
          side: THREE.DoubleSide, depthWrite: false,
        }));
        group.add(water);
        let pipe = null;
        if (i < N - 1) {
          const pipeGeo = new THREE.CylinderGeometry(1, 1, 1, 12);
          pipeGeo.rotateZ(Math.PI / 2);
          pipe = new THREE.Mesh(pipeGeo, new THREE.MeshBasicMaterial({
            color: 0x6cb8ff, transparent: true, opacity: 0.5,
          }));
          group.add(pipe);
        }
        tanks.push({ wire, water, pipe });
      }
      group.userData = { tanks, N };
    },
    update: (group, dt, t, params, scale) => {
      const N = group.userData.N;
      const r = params.radius * scale;
      const h = params.height * scale;
      const spacing = r * 3;
      const mean = 0.5 + 0.3 * Math.sin(t * 0.4);
      const levels = [];
      for (let i = 0; i < N; i++) {
        const perturbation = Math.sin(t * 0.8 + i * 1.2) * 0.15;
        levels.push(Math.max(0.05, Math.min(1, mean + perturbation)));
      }
      for (let i = 0; i < N; i++) {
        const tank = group.userData.tanks[i];
        const x = (i - (N - 1) / 2) * spacing;
        tank.wire.position.set(x, 0, 0);
        tank.wire.scale.set(r, r, h);
        tank.water.position.set(x, 0, 0);
        tank.water.scale.set(r * 0.95, r * 0.95, h * levels[i]);
        if (tank.pipe) {
          const xNext = ((i + 1) - (N - 1) / 2) * spacing;
          const pipeMid = (x + xNext) / 2;
          tank.pipe.position.set(pipeMid, 0, h * 0.05);
          tank.pipe.scale.set(spacing - r * 2, r * 0.25, r * 0.25);
        }
      }
    },
  },

  {
    id: "capacityarray",
    name: "容器陣列（Capacity Array）",
    loc: [120.8567, 23.8094], city: "水里",
    tech: "N 個 Cylinder 並排 + 各自獨立水位 sin + HSL 顏色（低紅高綠）",
    desc: "並列 N 個容器各顯示獨立水位 + 顏色警示。表達多測站狀態（水庫群、油槽群、電池組、各營業據點 KPI）。",
    prompt: "在 <b>[位置]</b> 並排 <b>[8 個]</b> 容器，半徑 <b>[150m]</b> 高 <b>[500m]</b>，各自水位獨立波動，低紅高綠。",
    params: [
      { id: "count", label: "個數", min: 3, max: 16, step: 1, value: 8 },
      { id: "radius", label: "半徑(m)", min: 50, max: 400, step: 10, value: 180 },
      { id: "height", label: "高(m)", min: 100, max: 1200, step: 25, value: 550 },
    ],
    build: (group) => {
      const N = 16;
      const tanks = [];
      for (let i = 0; i < N; i++) {
        const wireGeo = new THREE.CylinderGeometry(1, 1, 1, 16, 1, true);
        wireGeo.translate(0, 0.5, 0);
        wireGeo.rotateX(Math.PI / 2);
        const wire = new THREE.LineSegments(
          new THREE.WireframeGeometry(wireGeo),
          new THREE.LineBasicMaterial({ color: 0x6cb8ff, transparent: true, opacity: 0.5 }),
        );
        group.add(wire);
        const waterGeo = new THREE.CylinderGeometry(0.92, 0.92, 1, 16, 1, false);
        waterGeo.translate(0, 0.5, 0);
        waterGeo.rotateX(Math.PI / 2);
        const water = new THREE.Mesh(waterGeo, new THREE.MeshBasicMaterial({
          color: 0xffffff, transparent: true, opacity: 0.85,
          side: THREE.DoubleSide, depthWrite: false,
        }));
        group.add(water);
        tanks.push({ wire, water });
      }
      group.userData = { tanks, N };
    },
    update: (group, dt, t, params, scale) => {
      const visible = Math.round(params.count);
      const N = group.userData.N;
      const r = params.radius * scale;
      const h = params.height * scale;
      const spacing = r * 2.5;
      for (let i = 0; i < N; i++) {
        const tank = group.userData.tanks[i];
        if (i >= visible) { tank.wire.visible = false; tank.water.visible = false; continue; }
        tank.wire.visible = true;
        tank.water.visible = true;
        const x = (i - (visible - 1) / 2) * spacing;
        const fill = (Math.sin(t * 0.5 + i * 0.7) + 1) / 2;
        tank.wire.position.set(x, 0, 0);
        tank.wire.scale.set(r, r, h);
        tank.water.position.set(x, 0, 0);
        tank.water.scale.set(r * 0.92, r * 0.92, h * fill);
        tank.water.material.color.setHSL(fill * 0.4, 0.85, 0.55);
      }
    },
  },
];
