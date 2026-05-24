import * as THREE from "three";

export default [
  {
    id: "text",
    name: "3D 文字標籤（Canvas Texture）",
    loc: [120.9131, 23.8569], city: "日月潭",
    tech: "Canvas 畫文字 → CanvasTexture → Plane（地面標籤）",
    desc: "瀏覽器 canvas 畫任何文字 → 當紋理貼 plane → 變地圖標籤。可換字、改色、加底色、加 emoji。比 TextGeometry 簡單且字體任選。",
    prompt: "在 <b>[位置]</b> 鋪一塊長 <b>[800m]</b> 的標籤，內容 <b>[『日月潭』]</b>，<b>[白字深底]</b> + 粉紅外框，地面平行從上方可見。",
    params: [
      { id: "size", label: "大小(m)", min: 100, max: 3000, step: 50, value: 1000 },
      { id: "lift", label: "抬升(m)", min: 0, max: 800, step: 10, value: 80 },
    ],
    build: (group) => {
      const canvas = document.createElement("canvas");
      canvas.width = 1024; canvas.height = 256;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "rgba(15, 20, 28, 0.85)";
      ctx.fillRect(0, 0, 1024, 256);
      ctx.fillStyle = "#6cb8ff";
      ctx.font = "bold 130px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("✨ 日月潭 ✨", 512, 128);
      ctx.strokeStyle = "#ff7eb6";
      ctx.lineWidth = 6;
      ctx.strokeRect(8, 8, 1008, 240);
      const tex = new THREE.CanvasTexture(canvas);
      tex.minFilter = THREE.LinearFilter;
      const geo = new THREE.PlaneGeometry(1, 0.25);
      const mat = new THREE.MeshBasicMaterial({
        map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      group.add(mesh);
      group.userData.mesh = mesh;
    },
    update: (group, dt, t, params, scale) => {
      const m = group.userData.mesh;
      const sz = params.size * scale;
      m.scale.set(sz, sz, sz);
      m.position.z = params.lift * scale;
    },
  },

  {
    id: "dna",
    name: "DNA 雙螺旋（Helix）",
    loc: [118.3171, 24.4321], city: "金門",
    tech: "TubeGeometry 沿 CatmullRomCurve3 螺旋 + 中間 base pair 短線",
    desc: "兩條對稱螺旋 + 中間 base pair。表達遺傳、纏繞、雙股結構。降到 1 股變彈簧、改螺距變樓梯、改半徑變纜繩。",
    prompt: "在 <b>[位置]</b> 立一個高 <b>[1000m]</b> 半徑 <b>[200m]</b> 的雙螺旋，<b>[5 圈]</b>，base pair 每 0.25 圈一條，整體緩慢繞 Z 軸。",
    params: [
      { id: "height", label: "高(m)", min: 200, max: 2500, step: 50, value: 1200 },
      { id: "radius", label: "半徑(m)", min: 50, max: 500, step: 10, value: 250 },
      { id: "turns", label: "圈數", min: 2, max: 10, step: 0.5, value: 5 },
    ],
    build: (group) => {
      const inner = new THREE.Group();
      group.add(inner);
      const rebuild = (h, r, turns) => {
        while (inner.children.length) {
          const c = inner.children[0];
          inner.remove(c);
          c.geometry?.dispose();
          c.material?.dispose();
        }
        const SEGMENTS = Math.floor(turns * 32);
        for (let strand = 0; strand < 2; strand++) {
          const phase = strand * Math.PI;
          const points = [];
          for (let i = 0; i <= SEGMENTS; i++) {
            const u = i / SEGMENTS;
            const a = u * turns * Math.PI * 2 + phase;
            points.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, u * h));
          }
          const curve = new THREE.CatmullRomCurve3(points);
          const tubeGeo = new THREE.TubeGeometry(curve, SEGMENTS, r * 0.06, 8, false);
          const tubeMat = new THREE.MeshBasicMaterial({
            color: strand === 0 ? 0x6cb8ff : 0xff7eb6,
            transparent: true, opacity: 0.92,
          });
          inner.add(new THREE.Mesh(tubeGeo, tubeMat));
        }
        const pairCount = Math.floor(turns * 4);
        for (let i = 0; i <= pairCount; i++) {
          const u = i / pairCount;
          const a = u * turns * Math.PI * 2;
          const p1 = new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, u * h);
          const p2 = new THREE.Vector3(Math.cos(a + Math.PI) * r, Math.sin(a + Math.PI) * r, u * h);
          const lineGeo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
          const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 });
          inner.add(new THREE.Line(lineGeo, lineMat));
        }
      };
      group.userData = { inner, rebuild, lastH: -1, lastR: -1, lastT: -1 };
    },
    update: (group, dt, t, params, scale) => {
      const h = params.height * scale;
      const r = params.radius * scale;
      const turns = params.turns;
      const u = group.userData;
      if (Math.abs(h - u.lastH) > scale * 30 ||
          Math.abs(r - u.lastR) > scale * 5 ||
          Math.abs(turns - u.lastT) > 0.3) {
        u.lastH = h; u.lastR = r; u.lastT = turns;
        u.rebuild(h, r, turns);
      }
      u.inner.rotation.z = t * 0.4;
    },
  },

  {
    id: "scangrid",
    name: "地面掃描網格（Scan Grid）",
    loc: [120.0867, 23.1481], city: "七股",
    tech: "Wireframe Plane LineSegments 網格 + 一條動態掃描 LineSegments",
    desc: "賽博風基底：地面網格 + 一條光線從一邊掃到另一邊。可加多條同向不同 phase。表達區域監測、AI 掃描、地圖建構、戰術圖層。",
    prompt: "在 <b>[位置]</b> 鋪 <b>[2500m]</b> 方形網格（<b>[12×12 格]</b>），一條 <b>[青色]</b> 光線每 <b>[3 秒]</b> 從南掃到北。",
    params: [
      { id: "size", label: "邊長(m)", min: 500, max: 5000, step: 100, value: 2500 },
      { id: "divisions", label: "格數", min: 5, max: 30, step: 1, value: 12 },
      { id: "period", label: "週期(s)", min: 1, max: 8, step: 0.5, value: 3 },
    ],
    build: (group) => {
      const inner = new THREE.Group();
      group.add(inner);
      const sweepGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-0.5, 0, 0.001), new THREE.Vector3(0.5, 0, 0.001),
      ]);
      const sweepMat = new THREE.LineBasicMaterial({
        color: 0x6cf6ff, transparent: true, opacity: 1, blending: THREE.AdditiveBlending,
      });
      const sweep = new THREE.Line(sweepGeo, sweepMat);
      inner.add(sweep);
      group.userData = { inner, sweep, lastDiv: -1 };
    },
    update: (group, dt, t, params, scale) => {
      const sz = params.size * scale;
      const div = Math.round(params.divisions);
      const inner = group.userData.inner;
      const sweep = group.userData.sweep;
      if (div !== group.userData.lastDiv) {
        group.userData.lastDiv = div;
        for (let i = inner.children.length - 1; i >= 0; i--) {
          const c = inner.children[i];
          if (c === sweep) continue;
          inner.remove(c);
          c.geometry.dispose();
          c.material.dispose();
        }
        const positions = [];
        for (let i = 0; i <= div; i++) {
          const u = i / div - 0.5;
          positions.push(-0.5, u, 0); positions.push(0.5, u, 0);
          positions.push(u, -0.5, 0); positions.push(u, 0.5, 0);
        }
        const gridGeo = new THREE.BufferGeometry();
        gridGeo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
        const gridMat = new THREE.LineBasicMaterial({
          color: 0x6cf6ff, transparent: true, opacity: 0.25, depthWrite: false,
        });
        const grid = new THREE.LineSegments(gridGeo, gridMat);
        inner.add(grid);
      }
      inner.scale.set(sz, sz, 1);
      const phase = (t % params.period) / params.period;
      sweep.position.y = phase - 0.5;
      sweep.material.opacity = 1 - Math.abs(phase - 0.5) * 0.6;
    },
  },

  {
    id: "shield",
    name: "能量罩（Energy Shield）",
    loc: [121.2300, 24.3833], city: "雪山",
    tech: "IcosahedronGeometry detail=2 + 半透明 fill + Wireframe 線框疊加",
    desc: "三角面網格的球體 = 能量護盾 / 衛星天線 / 抽象幾何雕塑。線框脈動 + 旋轉 = sci-fi。改 detail 變更密的網。",
    prompt: "在 <b>[位置]</b> 罩一個半徑 <b>[600m]</b> 的 <b>[綠色]</b> 能量罩，三角網線框 + 半透明 fill，繞 Z 軸慢轉 + 線框脈動。",
    params: [
      { id: "radius", label: "半徑(m)", min: 200, max: 2500, step: 50, value: 800 },
      { id: "spin", label: "旋轉", min: 0, max: 2, step: 0.05, value: 0.3 },
    ],
    build: (group) => {
      const geo = new THREE.IcosahedronGeometry(1, 2);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x4cffa6, transparent: true, opacity: 0.12, side: THREE.DoubleSide,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      group.add(mesh);
      const wireGeo = new THREE.WireframeGeometry(geo);
      const wire = new THREE.LineSegments(wireGeo, new THREE.LineBasicMaterial({
        color: 0x4cffa6, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending,
      }));
      group.add(wire);
      group.userData = { mesh, wire };
    },
    update: (group, dt, t, params, scale) => {
      const r = params.radius * scale;
      [group.userData.mesh, group.userData.wire].forEach((m) => {
        m.scale.set(r, r, r);
        m.position.z = r * 0.7;
        m.rotation.z = t * params.spin;
      });
      const pulse = 0.5 + 0.4 * Math.sin(t * 2);
      group.userData.wire.material.opacity = 0.35 + 0.45 * pulse;
    },
  },

  {
    id: "hexgrid",
    name: "蜂巢格地面（Hex Grid Wave）",
    loc: [121.1303, 22.9133], city: "鹿野",
    tech: "六邊形 LineLoop × N 鋪滿圓盤 + 距離+時間決定每格 opacity 波",
    desc: "六角格陣列鋪在地面，opacity 從中心向外依 sin(distance - time) 波動 = 一波波擴散。表達區域分析、感應網絡、能量場。",
    prompt: "在 <b>[位置]</b> 鋪 <b>[2500m]</b> 範圍蜂巢格陣列，opacity 由中心往外波浪式漣漪，<b>[每秒 1 波]</b>。",
    params: [
      { id: "size", label: "範圍(m)", min: 500, max: 5000, step: 100, value: 2800 },
      { id: "speed", label: "波速", min: 0.5, max: 5, step: 0.1, value: 2.0 },
    ],
    build: (group) => {
      const SIZE = 6;
      const HEX_R = 1.0;
      const points = [];
      for (let i = 0; i <= 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        points.push(new THREE.Vector3(Math.cos(a) * HEX_R, Math.sin(a) * HEX_R, 0));
      }
      const cells = [];
      for (let q = -SIZE; q <= SIZE; q++) {
        for (let r = -SIZE; r <= SIZE; r++) {
          const cx = HEX_R * Math.sqrt(3) * (q + r / 2);
          const cy = HEX_R * 1.5 * r;
          const dist = Math.sqrt(cx * cx + cy * cy);
          if (dist > SIZE * HEX_R * 1.5) continue;
          const geo = new THREE.BufferGeometry().setFromPoints(points);
          const mat = new THREE.LineBasicMaterial({
            color: 0x6cf6ff, transparent: true, opacity: 0.3,
            blending: THREE.AdditiveBlending,
          });
          const line = new THREE.Line(geo, mat);
          line.position.set(cx, cy, 0.001);
          group.add(line);
          cells.push({ line, dist, baseX: cx, baseY: cy });
        }
      }
      group.userData = { cells };
    },
    update: (group, dt, t, params, scale) => {
      const sz = params.size * scale / 9; // SIZE*HEX_R*sqrt(3) ≈ 9
      for (const c of group.userData.cells) {
        c.line.position.set(c.baseX * sz, c.baseY * sz, 0.001);
        c.line.scale.set(sz, sz, sz);
        const wave = Math.sin(c.dist * 0.7 - t * params.speed) * 0.5 + 0.5;
        c.line.material.opacity = 0.1 + wave * 0.7;
      }
    },
  },

  {
    id: "glitch",
    name: "Glitch 故障藝術",
    loc: [121.5611, 25.1872], city: "七星山",
    tech: "切片 BoxGeometry × N 堆疊 + 週期性隨機 XY 偏移 + 多色",
    desc: "把方塊切成 12 片橫向堆疊，每片週期性隨機偏移 = VHS 故障 / 訊號干擾。Cyber/synthwave/vaporwave 風格必備。",
    prompt: "在 <b>[位置]</b> 立一個 <b>[400m]</b> 方塊，切 <b>[12 片]</b> 橫片，每秒 8 次 burst 隨機偏移強度 <b>[2]</b>，三色交替。",
    params: [
      { id: "size", label: "邊長(m)", min: 100, max: 1500, step: 25, value: 500 },
      { id: "intensity", label: "偏移", min: 0.5, max: 5, step: 0.1, value: 2.0 },
    ],
    build: (group) => {
      const SLICES = 12;
      const slices = [];
      const colors = [0xff7eb6, 0x6cb8ff, 0xffd87a];
      for (let i = 0; i < SLICES; i++) {
        const geo = new THREE.BoxGeometry(1, 1, 1 / SLICES);
        const mat = new THREE.MeshBasicMaterial({
          color: colors[i % colors.length], transparent: true, opacity: 0.8,
          side: THREE.DoubleSide,
        });
        const m = new THREE.Mesh(geo, mat);
        group.add(m);
        slices.push(m);
      }
      group.userData = { slices, SLICES };
    },
    update: (group, dt, t, params, scale) => {
      const sz = params.size * scale;
      const SLICES = group.userData.SLICES;
      const burst = Math.sin(t * 8) > 0.5 ? params.intensity : 0;
      for (let i = 0; i < SLICES; i++) {
        const m = group.userData.slices[i];
        m.scale.set(sz, sz, sz);
        const offsetX = (Math.random() - 0.5) * burst * sz * 0.1;
        const offsetY = (Math.random() - 0.5) * burst * sz * 0.1;
        const baseZ = (i / SLICES + 0.5 / SLICES) * sz;
        m.position.set(offsetX, offsetY, baseZ);
      }
    },
  },

  {
    id: "checker",
    name: "棋盤格漂浮（Floating Tiles）",
    loc: [120.5414, 22.8997], city: "美濃",
    tech: "8×8 PlaneGeometry 黑白格 + Z 高度由 sin(r+c+t) 波動",
    desc: "棋盤格地面，每塊瓦片 Z 隨時間 sin 上下 = 有節奏的浮動陣列。表達同步律動、矩陣資料、節拍視覺化。",
    prompt: "在 <b>[位置]</b> 鋪 <b>[8×8 棋盤格]</b>（總邊 <b>[2000m]</b>），每塊瓦片 Z 隨 sin 浮動，最高 <b>[300m]</b>。",
    params: [
      { id: "size", label: "邊長(m)", min: 500, max: 4000, step: 100, value: 2000 },
      { id: "maxLift", label: "浮高(m)", min: 50, max: 800, step: 25, value: 300 },
    ],
    build: (group) => {
      const N = 8;
      const tiles = [];
      const geo = new THREE.PlaneGeometry(1, 1);
      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          const isBlack = (r + c) % 2 === 0;
          const mat = new THREE.MeshBasicMaterial({
            color: isBlack ? 0x222831 : 0xffffff,
            transparent: true, opacity: 0.85, side: THREE.DoubleSide,
          });
          const m = new THREE.Mesh(geo, mat);
          group.add(m);
          tiles.push({ mesh: m, r, c });
        }
      }
      group.userData = { tiles, N };
    },
    update: (group, dt, t, params, scale) => {
      const N = group.userData.N;
      const sz = params.size * scale / N;
      const maxLift = params.maxLift * scale;
      for (const item of group.userData.tiles) {
        const x = (item.c - (N - 1) / 2) * sz * 1.05;
        const y = (item.r - (N - 1) / 2) * sz * 1.05;
        const z = Math.sin(t * 1.5 + item.r * 0.5 + item.c * 0.5) * maxLift;
        item.mesh.position.set(x, y, z);
        item.mesh.scale.set(sz, sz, 1);
      }
    },
  },

  {
    id: "orbit",
    name: "軌道衛星（Orbiting Satellites）",
    loc: [121.6817, 25.2050], city: "萬里",
    tech: "中心球 + 5 顆衛星各自 tilted orbit + 軌道線可視",
    desc: "中心主體 + 多顆衛星沿不同傾角的軌道環繞 = 行星系、衛星群、原子模型。改速度比變角動量。",
    prompt: "在 <b>[位置]</b> 放一個 <b>[1000m]</b> 範圍的衛星系：中心 <b>[300m]</b> 藍色主體 + <b>[5 顆]</b> 黃色衛星不同傾角環繞。",
    params: [
      { id: "radius", label: "範圍(m)", min: 300, max: 3000, step: 50, value: 1200 },
      { id: "coreSize", label: "核(m)", min: 50, max: 600, step: 10, value: 300 },
      { id: "satSize", label: "衛星(m)", min: 20, max: 300, step: 5, value: 100 },
    ],
    build: (group) => {
      const center = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1, 2),
        new THREE.MeshBasicMaterial({
          color: 0x6cb8ff, transparent: true, opacity: 0.92,
          blending: THREE.AdditiveBlending, depthWrite: false,
        }),
      );
      group.add(center);
      const SATS = 5;
      const sats = [];
      for (let i = 0; i < SATS; i++) {
        const sat = new THREE.Mesh(
          new THREE.IcosahedronGeometry(1, 1),
          new THREE.MeshBasicMaterial({
            color: 0xffd87a, transparent: true, opacity: 1,
            blending: THREE.AdditiveBlending, depthWrite: false,
          }),
        );
        group.add(sat);
        const ringPoints = [];
        const segs = 64;
        for (let s = 0; s <= segs; s++) {
          const a = (s / segs) * Math.PI * 2;
          ringPoints.push(new THREE.Vector3(Math.cos(a), Math.sin(a), 0));
        }
        const ring = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(ringPoints),
          new THREE.LineBasicMaterial({ color: 0xffd87a, transparent: true, opacity: 0.25 }),
        );
        const tiltX = (i / SATS) * Math.PI * 0.7;
        const tiltY = i * 0.7;
        ring.rotation.x = tiltX;
        ring.rotation.y = tiltY;
        group.add(ring);
        sats.push({
          sat, ring,
          orbitRadius: 0.4 + i * 0.13,
          speed: 1 + i * 0.4,
          phase: Math.random() * Math.PI * 2,
          tiltX, tiltY,
        });
      }
      group.userData = { center, sats };
    },
    update: (group, dt, t, params, scale) => {
      const r = params.radius * scale;
      const cs = params.coreSize * scale;
      const ss = params.satSize * scale * 0.5;
      group.userData.center.scale.set(cs, cs, cs);
      group.userData.center.position.z = r * 0.6;
      for (const s of group.userData.sats) {
        const orbitR = r * s.orbitRadius;
        s.ring.scale.set(orbitR, orbitR, orbitR);
        s.ring.position.z = r * 0.6;
        const a = t * s.speed + s.phase;
        let x = Math.cos(a) * orbitR, y = Math.sin(a) * orbitR, z = 0;
        // tiltX (rotate around X)
        const cy = y * Math.cos(s.tiltX) - z * Math.sin(s.tiltX);
        const cz = y * Math.sin(s.tiltX) + z * Math.cos(s.tiltX);
        y = cy; z = cz;
        // tiltY (rotate around Y)
        const dx = x * Math.cos(s.tiltY) + z * Math.sin(s.tiltY);
        const dz = -x * Math.sin(s.tiltY) + z * Math.cos(s.tiltY);
        x = dx; z = dz;
        s.sat.position.set(x, y, z + r * 0.6);
        s.sat.scale.set(ss, ss, ss);
      }
    },
  },

  // ── 系統關係 / 水資源 ──

  {
    id: "drought",
    name: "龜裂警示（Drought Cracks）",
    loc: [121.0044, 24.7322], city: "寶山水庫",
    tech: "從中心 random walk 放射裂痕線（含分支）+ 中心警示環脈動 + severity HSL",
    desc: "從中心放射的不規則裂痕（有分支），中心紅環脈動。表達乾旱、龜裂、警告區域、影響範圍正在惡化。",
    prompt: "在 <b>[位置]</b> 鋪 <b>[1500m]</b> 範圍的龜裂警示（中心放射 8 條主裂 + 隨機分支），中心紅環脈動，severity 0~1 控嚴重度。",
    params: [
      { id: "size", label: "範圍(m)", min: 300, max: 4000, step: 100, value: 1800 },
      { id: "severity", label: "嚴重度", min: 0, max: 1, step: 0.05, value: 0.7 },
    ],
    build: (group) => {
      const cracks = [];
      for (let i = 0; i < 8; i++) {
        const points = [];
        const startA = (i / 8) * Math.PI * 2;
        let x = 0, y = 0;
        points.push(new THREE.Vector3(0, 0, 0.001));
        let angle = startA;
        for (let s = 0; s < 12; s++) {
          const stepLen = 0.1;
          angle += (Math.random() - 0.5) * 0.5;
          x += Math.cos(angle) * stepLen;
          y += Math.sin(angle) * stepLen;
          points.push(new THREE.Vector3(x, y, 0.001));
          if (Math.random() < 0.3) {
            let bx = x, by = y;
            let ba = angle + (Math.random() - 0.5) * 1.5;
            const bp = [new THREE.Vector3(x, y, 0.001)];
            for (let bs = 0; bs < 4; bs++) {
              ba += (Math.random() - 0.5) * 0.5;
              bx += Math.cos(ba) * stepLen * 0.7;
              by += Math.sin(ba) * stepLen * 0.7;
              bp.push(new THREE.Vector3(bx, by, 0.001));
            }
            cracks.push(bp);
          }
        }
        cracks.push(points);
      }
      const meshes = [];
      for (const path of cracks) {
        const geo = new THREE.BufferGeometry().setFromPoints(path);
        const mat = new THREE.LineBasicMaterial({
          color: 0xffd87a, transparent: true, opacity: 0.6,
          blending: THREE.AdditiveBlending,
        });
        const line = new THREE.Line(geo, mat);
        group.add(line);
        meshes.push(line);
      }
      const center = new THREE.Mesh(
        new THREE.RingGeometry(0.05, 0.06, 32),
        new THREE.MeshBasicMaterial({
          color: 0xff7e6c, transparent: true, opacity: 1,
          side: THREE.DoubleSide, depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      group.add(center);
      group.userData = { meshes, center };
    },
    update: (group, dt, t, params, scale) => {
      const r = params.size * scale;
      for (const m of group.userData.meshes) {
        m.scale.set(r, r, 1);
      }
      const pulse = (Math.sin(t * 4) + 1) / 2;
      const cs = r * (0.5 + pulse * 1.0);
      group.userData.center.scale.set(cs, cs, 1);
      group.userData.center.material.opacity = 0.3 + 0.7 * pulse;
      const sev = params.severity;
      group.userData.center.material.color.setHSL(0.05 - sev * 0.05, 0.9, 0.55);
      for (const m of group.userData.meshes) {
        m.material.color.setHSL(0.12 - sev * 0.1, 0.85, 0.55);
      }
    },
  },
];
