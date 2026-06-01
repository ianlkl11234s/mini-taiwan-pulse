import * as THREE from "three";

export default [
  {
    id: "particles",
    name: "粒子噴泉（Particle Fountain）",
    loc: [120.4866, 22.6700], city: "屏東",
    tech: "Points + BufferGeometry 動態更新位置 / 重生",
    desc: "每個粒子有自己的速度、生命週期，到頂或燒完就重生回底部。可改方向變成下雨、隨機向四周噴 = 煙火爆炸。",
    prompt: "在 <b>[位置]</b> 噴出 <b>[300 顆]</b> 向上的 <b>[黃綠色]</b> 光粒，最高 <b>[400m]</b>，到頂淡出後重生。",
    params: [
      { id: "count", label: "粒數", min: 50, max: 1000, step: 50, value: 300 },
      { id: "height", label: "高(m)", min: 100, max: 1500, step: 20, value: 500 },
      { id: "size", label: "粒徑", min: 1, max: 30, step: 1, value: 8 },
    ],
    build: (group) => {
      // 用 3 個 mesh sphere instances 不切實際，用 InstancedMesh 或 Points
      // Mapbox custom layer 內 Points 會走 GL 預設 1 像素，需用自訂 shader
      // 簡單版：用 InstancedMesh + small sphere
      const N = 1000;
      const sphereGeo = new THREE.IcosahedronGeometry(1, 0);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xb6ff5b, transparent: true, opacity: 1.0,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const inst = new THREE.InstancedMesh(sphereGeo, mat, N);
      inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

      // 隨機初始狀態
      const states = new Array(N).fill(0).map(() => ({
        life: Math.random(),         // 0~1（0=底，1=頂）
        speed: 0.3 + Math.random() * 0.7,
        offsetX: (Math.random() - 0.5) * 0.3,
        offsetY: (Math.random() - 0.5) * 0.3,
        spread: Math.random() * 0.15,
      }));

      group.add(inst);
      group.userData = { inst, states, N };
    },
    update: (group, dt, t, params, scale) => {
      const { inst, states } = group.userData;
      const visible = Math.round(params.count);
      const h = params.height * scale;
      const size = params.size * scale;
      const dummy = new THREE.Object3D();

      for (let i = 0; i < states.length; i++) {
        const s = states[i];
        if (i < visible) {
          s.life += dt * 0.4 * s.speed;
          if (s.life > 1) s.life -= 1;
          const z = s.life * h;
          // 上升時稍微向外散
          const spreadFactor = s.life * s.spread * h * 0.5;
          dummy.position.set(s.offsetX * h * 0.05 + Math.cos(i) * spreadFactor, s.offsetY * h * 0.05 + Math.sin(i) * spreadFactor, z);
          // 越高越小
          const ss = size * (1 - s.life * 0.5);
          dummy.scale.set(ss, ss, ss);
          dummy.updateMatrix();
          inst.setMatrixAt(i, dummy.matrix);
        } else {
          dummy.scale.set(0, 0, 0);
          dummy.updateMatrix();
          inst.setMatrixAt(i, dummy.matrix);
        }
      }
      inst.count = states.length;
      inst.instanceMatrix.needsUpdate = true;
    },
  },

  {
    id: "firework",
    name: "煙火爆炸（Firework Burst）",
    loc: [120.7964, 21.9466], city: "墾丁",
    tech: "InstancedMesh 粒子 + 球面隨機方向 + 重力 + 整批同步重生",
    desc: "粒子從一點同時爆出向四面八方噴 + 重力下拉。每隔幾秒整批重生 = 連續煙火。改色變不同節慶/警報效果。",
    prompt: "在 <b>[位置]</b> 高空 <b>[500m]</b> 每 <b>[2 秒]</b> 爆 <b>[150 顆]</b> 粒子，向四周噴 + 重力下落，1.5 秒內淡出，每次顏色隨機。",
    params: [
      { id: "count", label: "粒數", min: 30, max: 300, step: 10, value: 150 },
      { id: "speed", label: "速度", min: 100, max: 1000, step: 25, value: 350 },
      { id: "altitude", label: "中心(m)", min: 100, max: 2000, step: 50, value: 600 },
      { id: "interval", label: "間隔(s)", min: 0.5, max: 5, step: 0.1, value: 2.0 },
    ],
    build: (group) => {
      const N = 300;
      const geo = new THREE.IcosahedronGeometry(1, 0);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 1,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const inst = new THREE.InstancedMesh(geo, mat, N);
      inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const dirs = [];
      for (let i = 0; i < N; i++) {
        const theta = Math.acos(2 * Math.random() - 1);
        const phi = Math.random() * Math.PI * 2;
        dirs.push({
          x: Math.sin(theta) * Math.cos(phi),
          y: Math.sin(theta) * Math.sin(phi),
          z: Math.abs(Math.cos(theta)) * 0.6 + 0.4, // 偏向上
        });
      }
      group.add(inst);
      group.userData = { inst, mat, dirs, N, lastBurst: -10 };
    },
    update: (group, dt, t, params, scale) => {
      const { inst, mat, dirs, N } = group.userData;
      const visible = Math.round(params.count);
      const speed = params.speed * scale;
      const alt = params.altitude * scale;
      const interval = params.interval;
      const G = -200 * scale;
      const LIFETIME = 1.5;
      if (t - group.userData.lastBurst >= interval) {
        group.userData.lastBurst = t;
        mat.color.setHSL(Math.random(), 0.95, 0.6);
      }
      const life = t - group.userData.lastBurst;
      const fade = Math.max(0, 1 - life / LIFETIME);
      mat.opacity = fade;
      const dummy = new THREE.Object3D();
      for (let i = 0; i < N; i++) {
        if (i >= visible) {
          dummy.scale.set(0, 0, 0);
          dummy.updateMatrix();
          inst.setMatrixAt(i, dummy.matrix);
          continue;
        }
        const d = dirs[i];
        dummy.position.set(
          d.x * speed * life,
          d.y * speed * life,
          alt + d.z * speed * life + 0.5 * G * life * life,
        );
        const sz = scale * 60 * fade;
        dummy.scale.set(sz, sz, sz);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
      }
      inst.count = N;
      inst.instanceMatrix.needsUpdate = true;
    },
  },

  {
    id: "ballistic",
    name: "拋物運動（Ballistic）",
    loc: [121.9550, 24.8329], city: "龜山島",
    tech: "球體 + 物理積分 (v += g·dt; pos += v·dt) + 落地重生",
    desc: "多顆球以隨機初速拋出、受重力下拉描出拋物線。可表達噴泉水滴、彈道、投射、落葉。把重力反向變浮力效果。",
    prompt: "在 <b>[位置]</b> 噴出 <b>[20 顆]</b> 球，初速 <b>[350m/s]</b>、隨機水平方向、上仰角 30~45°，重力 <b>[200m/s²]</b>，落地重生。",
    params: [
      { id: "count", label: "球數", min: 5, max: 50, step: 1, value: 20 },
      { id: "speed", label: "初速", min: 100, max: 800, step: 25, value: 400 },
      { id: "size", label: "球徑(m)", min: 30, max: 300, step: 10, value: 100 },
    ],
    build: (group) => {
      const balls = [];
      for (let i = 0; i < 50; i++) {
        const og = new THREE.Group();
        const layers = [];
        const colors = [new THREE.Color(1,1,1), new THREE.Color(1, 0.85, 0.5)];
        for (let j = 0; j < 2; j++) {
          const geo = new THREE.IcosahedronGeometry(1, 1);
          const mat = new THREE.MeshBasicMaterial({
            color: colors[j], transparent: true, opacity: j === 0 ? 1 : 0.5,
            blending: THREE.AdditiveBlending, depthWrite: false,
          });
          const m = new THREE.Mesh(geo, mat);
          og.add(m);
          layers.push({ mesh: m, ratio: j === 0 ? 0.4 : 1.0 });
        }
        og.userData.layers = layers;
        group.add(og);
        balls.push({ orb: og, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, alive: false });
      }
      group.userData.balls = balls;
    },
    update: (group, dt, t, params, scale) => {
      const visible = Math.round(params.count);
      const initSpeed = params.speed * scale;
      const sz = params.size * scale * 0.5;
      const G = -200 * scale;
      group.userData.balls.forEach((b, i) => {
        if (i >= visible) { b.orb.visible = false; return; }
        b.orb.visible = true;
        if (!b.alive || b.z < 0) {
          b.alive = true;
          b.x = 0; b.y = 0; b.z = 0;
          const angle = Math.random() * Math.PI * 2;
          const elev = Math.PI * 0.30 + Math.random() * Math.PI * 0.18;
          const horiz = Math.cos(elev) * initSpeed;
          b.vx = Math.cos(angle) * horiz;
          b.vy = Math.sin(angle) * horiz;
          b.vz = Math.sin(elev) * initSpeed;
        }
        b.vz += G * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.z += b.vz * dt;
        b.orb.position.set(b.x, b.y, Math.max(0, b.z));
        for (const { mesh, ratio } of b.orb.userData.layers) {
          const s = sz * ratio;
          mesh.scale.set(s, s, s);
        }
      });
    },
  },

  {
    id: "tornado",
    name: "龍捲風（Tornado）",
    loc: [121.5394, 22.0556], city: "蘭嶼",
    tech: "InstancedMesh 粒子 + (cos, sin, z) 螺旋座標 + 半徑隨高度線性變",
    desc: "粒子分布在螺旋柱面上、繞中心快速旋轉、緩慢上升。半徑隨高度變化決定形狀（漏斗/紡錘/圓柱）。改密度變沙塵暴 / 颱風。",
    prompt: "在 <b>[位置]</b> 起一陣 <b>[250 顆]</b> 粒子的龍捲風，高 <b>[1000m]</b>，底徑 <b>[100m]</b> 頂徑 <b>[350m]</b>，每秒 <b>[1.2 圈]</b>。",
    params: [
      { id: "count", label: "粒數", min: 50, max: 500, step: 10, value: 250 },
      { id: "height", label: "高(m)", min: 200, max: 2000, step: 50, value: 1000 },
      { id: "rBottom", label: "底徑(m)", min: 30, max: 500, step: 10, value: 100 },
      { id: "rTop", label: "頂徑(m)", min: 30, max: 800, step: 10, value: 350 },
      { id: "spin", label: "圈/秒", min: 0.1, max: 4, step: 0.1, value: 1.2 },
    ],
    build: (group) => {
      const N = 500;
      const geo = new THREE.IcosahedronGeometry(1, 0);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xcccccc, transparent: true, opacity: 0.55, depthWrite: false,
      });
      const inst = new THREE.InstancedMesh(geo, mat, N);
      inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const states = [];
      for (let i = 0; i < N; i++) {
        states.push({
          u: i / N,
          phase: Math.random() * Math.PI * 2,
          rJitter: 0.7 + Math.random() * 0.6,
          zOffset: Math.random(),
        });
      }
      group.add(inst);
      group.userData = { inst, states, N };
    },
    update: (group, dt, t, params, scale) => {
      const { inst, states, N } = group.userData;
      const visible = Math.round(params.count);
      const h = params.height * scale;
      const rB = params.rBottom * scale;
      const rT = params.rTop * scale;
      const omega = params.spin * Math.PI * 2;
      const dummy = new THREE.Object3D();
      for (let i = 0; i < N; i++) {
        const s = states[i];
        if (i >= visible) {
          dummy.scale.set(0, 0, 0); dummy.updateMatrix();
          inst.setMatrixAt(i, dummy.matrix); continue;
        }
        const u = (s.u + s.zOffset + t * 0.04) % 1;
        const z = u * h;
        const r = (rB + (rT - rB) * u) * s.rJitter;
        const a = s.phase + omega * t * (1 - u * 0.3);
        dummy.position.set(Math.cos(a) * r, Math.sin(a) * r, z);
        const sz = scale * (15 + 12 * u);
        dummy.scale.set(sz, sz, sz);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
      }
      inst.count = N;
      inst.instanceMatrix.needsUpdate = true;
    },
  },

  {
    id: "meteor",
    name: "流星拖尾（Meteor Trail）",
    loc: [121.2700, 24.1333], city: "合歡山",
    tech: "頭部光球 + 後方多顆遞減大小光球做拖尾 + 拋物軌跡 + 落地重生",
    desc: "頭部斜飛 + 後方依歷史位置鋪光球。改重力為 0 變子彈 / 飛彈；改頭顏色變彗星。本專案船舶光點過去版也曾用近似結構。",
    prompt: "在 <b>[位置]</b> 從高 <b>[1500m]</b> 拋出 <b>[白色]</b> 流星，<b>[25 顆]</b> 拖尾遞減大小、漸淡，落地重生。",
    params: [
      { id: "speed", label: "初速", min: 100, max: 1500, step: 50, value: 700 },
      { id: "trailCount", label: "拖尾", min: 5, max: 40, step: 1, value: 25 },
      { id: "headSize", label: "頭徑(m)", min: 50, max: 500, step: 10, value: 180 },
    ],
    build: (group) => {
      const head = new THREE.Group();
      const layers = [];
      const colors = [new THREE.Color(1,1,1), new THREE.Color(1, 0.85, 0.55)];
      for (let j = 0; j < 2; j++) {
        const geo = new THREE.IcosahedronGeometry(1, 1);
        const mat = new THREE.MeshBasicMaterial({
          color: colors[j], transparent: true, opacity: j === 0 ? 1 : 0.5,
          blending: THREE.AdditiveBlending, depthWrite: false,
        });
        const m = new THREE.Mesh(geo, mat);
        head.add(m);
        layers.push({ mesh: m, ratio: j === 0 ? 0.4 : 1.0 });
      }
      head.userData.layers = layers;
      group.add(head);
      const trail = [];
      for (let i = 0; i < 40; i++) {
        const geo = new THREE.IcosahedronGeometry(1, 0);
        const mat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(1, 0.85, 0.55), transparent: true, opacity: 0.5,
          blending: THREE.AdditiveBlending, depthWrite: false,
        });
        const m = new THREE.Mesh(geo, mat);
        group.add(m);
        trail.push(m);
      }
      group.userData = { head, trail, history: [], x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, alive: false };
    },
    update: (group, dt, t, params, scale) => {
      const u = group.userData;
      const initSpeed = params.speed * scale;
      const G = -300 * scale;
      if (!u.alive || u.z < 0) {
        u.alive = true;
        u.x = -1500 * scale; u.y = 0; u.z = 1500 * scale;
        u.vx = initSpeed * 0.7; u.vy = 0; u.vz = -initSpeed * 0.3;
        u.history.length = 0;
      }
      u.vz += G * dt;
      u.x += u.vx * dt; u.y += u.vy * dt; u.z += u.vz * dt;
      u.history.unshift({ x: u.x, y: u.y, z: u.z });
      if (u.history.length > 40) u.history.length = 40;
      const headSize = params.headSize * scale * 0.5;
      u.head.position.set(u.x, u.y, Math.max(0, u.z));
      for (const { mesh, ratio } of u.head.userData.layers) {
        const s = headSize * ratio;
        mesh.scale.set(s, s, s);
      }
      const tailN = Math.round(params.trailCount);
      u.trail.forEach((m, i) => {
        if (i >= tailN || !u.history[i + 1]) { m.visible = false; return; }
        m.visible = true;
        const p = u.history[i + 1];
        m.position.set(p.x, p.y, Math.max(0, p.z));
        const fade = 1 - (i / tailN);
        const s = headSize * 0.6 * fade;
        m.scale.set(s, s, s);
        m.material.opacity = fade * 0.8;
      });
    },
  },

  {
    id: "galaxy",
    name: "螺旋星系（Spiral Galaxy）",
    loc: [120.4344, 24.0517], city: "鹿港",
    tech: "InstancedMesh 粒子分佈在 4 條對數螺旋臂 + 內快外慢差速旋轉",
    desc: "粒子分布在螺旋臂上、內側轉快外側轉慢 = 銀河漩渦。改臂數變不同星系（2、3、4 臂）。可加中心發光球 = 黑洞。",
    prompt: "在 <b>[位置]</b> 飄一個 <b>[2000m]</b> 範圍的 <b>[800 顆]</b> 粒子螺旋星系，<b>[4 條]</b> 旋臂，內快外慢差速旋轉。",
    params: [
      { id: "count", label: "粒數", min: 100, max: 1500, step: 50, value: 800 },
      { id: "radius", label: "範圍(m)", min: 500, max: 4000, step: 100, value: 2000 },
      { id: "spin", label: "轉速", min: 0, max: 2, step: 0.05, value: 0.5 },
      { id: "dotSize", label: "粒徑(m)", min: 5, max: 60, step: 1, value: 20 },
    ],
    build: (group) => {
      const N = 1500;
      const geo = new THREE.IcosahedronGeometry(1, 0);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0.85,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const inst = new THREE.InstancedMesh(geo, mat, N);
      inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const ARMS = 4;
      const parts = [];
      for (let i = 0; i < N; i++) {
        const arm = Math.floor(Math.random() * ARMS);
        const u = Math.random();
        const armOffset = (arm / ARMS) * Math.PI * 2;
        const angle = armOffset + u * 2.5;
        const r = 0.1 + u * 0.9;
        parts.push({
          r, angle,
          jitterX: (Math.random() - 0.5) * 0.06,
          jitterY: (Math.random() - 0.5) * 0.06,
          jitterZ: (Math.random() - 0.5) * 0.04,
          size: 0.4 + Math.random() * 1.5,
        });
      }
      group.add(inst);
      group.userData = { inst, parts, N };
    },
    update: (group, dt, t, params, scale) => {
      const { inst, parts, N } = group.userData;
      const visible = Math.round(params.count);
      const r = params.radius * scale;
      const dummy = new THREE.Object3D();
      for (let i = 0; i < N; i++) {
        if (i >= visible) {
          dummy.scale.set(0, 0, 0); dummy.updateMatrix();
          inst.setMatrixAt(i, dummy.matrix); continue;
        }
        const p = parts[i];
        const angle = p.angle + t * params.spin * (1 / (p.r + 0.3));
        const x = Math.cos(angle) * p.r * r + p.jitterX * r;
        const y = Math.sin(angle) * p.r * r + p.jitterY * r;
        const z = p.jitterZ * r + 100 * scale;
        dummy.position.set(x, y, z);
        const sz = p.size * params.dotSize * scale;
        dummy.scale.set(sz, sz, sz);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
      }
      inst.count = N;
      inst.instanceMatrix.needsUpdate = true;
    },
  },

  {
    id: "snow",
    name: "降雪 / 降雨（Falling Particles）",
    loc: [121.5430, 24.4970], city: "太平山",
    tech: "InstancedMesh 粒子持續下落 + 觸地後重生回頂部 + 風 sin 偏移",
    desc: "從上方持續下落的粒子，到底重生回頂。改顏色變雨、雪、灰、櫻花瓣、紙屑。風吹用 sin 函數做側向擺動。",
    prompt: "在 <b>[位置]</b> 高 <b>[1500m]</b> 範圍 <b>[2000m]</b> 內持續落下 <b>[600 顆]</b> 白色雪花，輕微側風搖擺，落地後重生。",
    params: [
      { id: "count", label: "粒數", min: 100, max: 1500, step: 50, value: 700 },
      { id: "spread", label: "範圍(m)", min: 500, max: 4000, step: 100, value: 2200 },
      { id: "altitude", label: "高度(m)", min: 500, max: 3500, step: 100, value: 1800 },
      { id: "speed", label: "落速", min: 0.05, max: 1.5, step: 0.05, value: 0.35 },
      { id: "wind", label: "風", min: 0, max: 1, step: 0.05, value: 0.25 },
    ],
    build: (group) => {
      const N = 1500;
      const geo = new THREE.IcosahedronGeometry(1, 0);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0.7,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const inst = new THREE.InstancedMesh(geo, mat, N);
      inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const states = [];
      for (let i = 0; i < N; i++) {
        states.push({
          x: (Math.random() - 0.5),
          y: (Math.random() - 0.5),
          z: Math.random(),
          phase: Math.random() * Math.PI * 2,
          speed: 0.5 + Math.random() * 0.7,
          size: 0.5 + Math.random() * 0.6,
        });
      }
      group.add(inst);
      group.userData = { inst, states, N };
    },
    update: (group, dt, t, params, scale) => {
      const { inst, states, N } = group.userData;
      const visible = Math.round(params.count);
      const spread = params.spread * scale;
      const altMax = params.altitude * scale;
      const fall = params.speed;
      const dummy = new THREE.Object3D();
      for (let i = 0; i < N; i++) {
        if (i >= visible) {
          dummy.scale.set(0, 0, 0); dummy.updateMatrix();
          inst.setMatrixAt(i, dummy.matrix); continue;
        }
        const s = states[i];
        s.z -= fall * s.speed * dt;
        if (s.z < 0) s.z = 1;
        const wind = Math.sin(t * 0.3 + s.phase) * params.wind * 0.3;
        const x = (s.x + wind) * spread;
        const y = s.y * spread;
        const z = s.z * altMax;
        dummy.position.set(x, y, z);
        const sz = scale * 25 * s.size;
        dummy.scale.set(sz, sz, sz);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
      }
      inst.count = N;
      inst.instanceMatrix.needsUpdate = true;
    },
  },

  {
    id: "confetti",
    name: "彩紙飄落（Confetti）",
    loc: [121.7733, 24.8237], city: "礁溪",
    tech: "多顆 PlaneGeometry 各自顏色 + 獨立旋轉軸 + 重力下落",
    desc: "彩色小平面飄落 + 自轉 = 派對彩紙。比降雪有更多『飄』感，因為平面有面積會被風影響。表達慶祝、獎勵、節慶。",
    prompt: "在 <b>[位置]</b> 高 <b>[1000m]</b> 範圍內飄落 <b>[120 片]</b> 彩色長方形彩紙，慢慢自轉 + 隨風飄移，落地重生。",
    params: [
      { id: "count", label: "片數", min: 30, max: 250, step: 10, value: 120 },
      { id: "spread", label: "範圍(m)", min: 300, max: 3000, step: 100, value: 1500 },
      { id: "altitude", label: "高度(m)", min: 300, max: 2500, step: 100, value: 1300 },
    ],
    build: (group) => {
      const N = 250;
      const geo = new THREE.PlaneGeometry(1, 0.6);
      const palette = [0xff5b8a, 0x6cb8ff, 0xffd54f, 0x4cffa6, 0xff7eb6, 0xa080ff, 0xffa86c];
      const pieces = [];
      for (let i = 0; i < N; i++) {
        const mat = new THREE.MeshBasicMaterial({
          color: palette[i % palette.length],
          transparent: true, opacity: 0.95, side: THREE.DoubleSide,
        });
        const m = new THREE.Mesh(geo, mat);
        group.add(m);
        pieces.push({
          mesh: m,
          x: (Math.random() - 0.5),
          y: (Math.random() - 0.5),
          z: Math.random(),
          speed: 0.3 + Math.random() * 0.4,
          wobblePhase: Math.random() * Math.PI * 2,
          rotSpeedX: 0.5 + Math.random() * 2,
          rotSpeedY: 0.5 + Math.random() * 2,
        });
      }
      group.userData = { pieces, N };
    },
    update: (group, dt, t, params, scale) => {
      const visible = Math.round(params.count);
      const spread = params.spread * scale;
      const altMax = params.altitude * scale;
      group.userData.pieces.forEach((p, i) => {
        if (i >= visible) { p.mesh.visible = false; return; }
        p.mesh.visible = true;
        p.z -= p.speed * 0.15 * dt;
        if (p.z < 0) p.z = 1;
        const wobble = Math.sin(t * 0.8 + p.wobblePhase) * 0.05;
        p.mesh.position.set((p.x + wobble) * spread, p.y * spread, p.z * altMax);
        const sz = scale * 60;
        p.mesh.scale.set(sz, sz, 1);
        p.mesh.rotation.x = t * p.rotSpeedX;
        p.mesh.rotation.y = t * p.rotSpeedY;
      });
    },
  },

  {
    id: "vortex",
    name: "黑洞漩渦（Black Hole Vortex）",
    loc: [119.5000, 23.3582], city: "望安",
    tech: "中心暗球 + 外圍粒子螺旋向內吸入 + 到中心後重生回外緣",
    desc: "粒子從外緣螺旋向內被吸到中心、消失後在外圍重生 = 黑洞 / 漩渦 / 排水孔。中心暗球 + 周圍粒子越靠越快。",
    prompt: "在 <b>[位置]</b> 蓋一個半徑 <b>[1500m]</b> 的黑洞，<b>[400 顆]</b> <b>[粉色]</b> 粒子螺旋吸入，中心暗核 <b>[200m]</b>。",
    params: [
      { id: "count", label: "粒數", min: 100, max: 800, step: 25, value: 450 },
      { id: "radius", label: "範圍(m)", min: 500, max: 4000, step: 100, value: 1800 },
      { id: "coreSize", label: "核(m)", min: 50, max: 600, step: 25, value: 250 },
      { id: "speed", label: "吸速", min: 0.05, max: 1.5, step: 0.05, value: 0.3 },
    ],
    build: (group) => {
      const blackGeo = new THREE.SphereGeometry(1, 24, 16);
      const black = new THREE.Mesh(blackGeo, new THREE.MeshBasicMaterial({ color: 0x000000 }));
      group.add(black);
      const N = 800;
      const geo = new THREE.IcosahedronGeometry(1, 0);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xff7eb6, transparent: true, opacity: 0.85,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const inst = new THREE.InstancedMesh(geo, mat, N);
      inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const parts = [];
      for (let i = 0; i < N; i++) {
        parts.push({
          r0: 0.7 + Math.random() * 0.5,
          angle: Math.random() * Math.PI * 2,
          life: Math.random(),
        });
      }
      group.add(inst);
      group.userData = { inst, parts, N, black };
    },
    update: (group, dt, t, params, scale) => {
      const { inst, parts, N, black } = group.userData;
      const visible = Math.round(params.count);
      const r = params.radius * scale;
      const cs = params.coreSize * scale;
      const speed = params.speed;
      black.scale.set(cs, cs, cs);
      black.position.z = cs;
      const dummy = new THREE.Object3D();
      for (let i = 0; i < N; i++) {
        if (i >= visible) {
          dummy.scale.set(0, 0, 0); dummy.updateMatrix();
          inst.setMatrixAt(i, dummy.matrix); continue;
        }
        const p = parts[i];
        p.life += dt * speed;
        if (p.life > 1) {
          p.life = 0;
          p.angle = Math.random() * Math.PI * 2;
          p.r0 = 0.7 + Math.random() * 0.5;
        }
        const currentR = p.r0 * (1 - p.life) * r;
        const currentAngle = p.angle + p.life * 8 + t * 0.5;
        dummy.position.set(Math.cos(currentAngle) * currentR, Math.sin(currentAngle) * currentR, cs * 0.5);
        const sz = scale * 35 * (1 - p.life * 0.4);
        dummy.scale.set(sz, sz, sz);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
      }
      inst.count = N;
      inst.instanceMatrix.needsUpdate = true;
    },
  },

  {
    id: "firework2",
    name: "多階段煙火（Rise + Burst）",
    loc: [120.2900, 22.6122], city: "旗津",
    tech: "Stage 1 火箭 + 拖尾上升；Stage 2 爆炸粒子 + 重力下墜",
    desc: "比單一爆炸更真實：火箭先升 → 到頂爆開 → 粒子下墜淡出 → 換顏色重新發射。完整生命週期 = 慶典煙火秀。",
    prompt: "在 <b>[位置]</b> 每 <b>[3 秒]</b> 一輪：火箭上升至 <b>[800m]</b>（含拖尾）→ 爆 <b>[150 顆]</b> 粒子 → 1.5 秒淡出，每次顏色隨機。",
    params: [
      { id: "count", label: "粒數", min: 30, max: 300, step: 10, value: 150 },
      { id: "speed", label: "爆速", min: 100, max: 800, step: 25, value: 350 },
      { id: "peak", label: "頂高(m)", min: 200, max: 2500, step: 50, value: 900 },
      { id: "period", label: "週期(s)", min: 1.5, max: 8, step: 0.2, value: 3.5 },
    ],
    build: (group) => {
      const rocket = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1, 1),
        new THREE.MeshBasicMaterial({
          color: 0xffffff, transparent: true, opacity: 1,
          blending: THREE.AdditiveBlending, depthWrite: false,
        }),
      );
      group.add(rocket);
      const trail = [];
      for (let i = 0; i < 15; i++) {
        const m = new THREE.Mesh(
          new THREE.IcosahedronGeometry(1, 0),
          new THREE.MeshBasicMaterial({
            color: 0xffaa44, transparent: true, opacity: 0.6,
            blending: THREE.AdditiveBlending, depthWrite: false,
          }),
        );
        group.add(m);
        trail.push(m);
      }
      const N = 300;
      const burstMat = new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 1,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const inst = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), burstMat, N);
      inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const dirs = [];
      for (let i = 0; i < N; i++) {
        const theta = Math.acos(2 * Math.random() - 1);
        const phi = Math.random() * Math.PI * 2;
        dirs.push({
          x: Math.sin(theta) * Math.cos(phi),
          y: Math.sin(theta) * Math.sin(phi),
          z: Math.abs(Math.cos(theta)) * 0.5 + 0.5,
        });
      }
      group.add(inst);
      group.userData = { rocket, trail, inst, mat: burstMat, dirs, N, history: [], cycleStart: -10 };
    },
    update: (group, dt, t, params, scale) => {
      const u = group.userData;
      const cycle = params.period;
      const riseTime = cycle * 0.4;
      const burstDur = cycle * 0.6;
      const peak = params.peak * scale;
      if (t - u.cycleStart >= cycle) {
        u.cycleStart = t;
        u.mat.color.setHSL(Math.random(), 0.95, 0.6);
        u.history.length = 0;
      }
      const phase = t - u.cycleStart;
      const dummy = new THREE.Object3D();
      if (phase < riseTime) {
        u.rocket.visible = true;
        const rp = phase / riseTime;
        const z = peak * rp;
        u.rocket.position.set(0, 0, z);
        const sz = 35 * scale;
        u.rocket.scale.set(sz, sz, sz);
        u.history.unshift({ z });
        if (u.history.length > 15) u.history.length = 15;
        u.trail.forEach((m, i) => {
          if (!u.history[i + 1]) { m.visible = false; return; }
          m.visible = true;
          m.position.set(0, 0, u.history[i + 1].z);
          const fade = 1 - i / 15;
          const s = 28 * scale * fade;
          m.scale.set(s, s, s);
          m.material.opacity = fade * 0.8;
        });
        for (let i = 0; i < u.N; i++) {
          dummy.scale.set(0, 0, 0); dummy.updateMatrix();
          u.inst.setMatrixAt(i, dummy.matrix);
        }
      } else {
        u.rocket.visible = false;
        u.trail.forEach((m) => (m.visible = false));
        const elapsed = phase - riseTime;
        const fade = Math.max(0, 1 - elapsed / burstDur);
        u.mat.opacity = fade;
        const speed = params.speed * scale;
        const G = -200 * scale;
        const visible = Math.round(params.count);
        for (let i = 0; i < u.N; i++) {
          if (i >= visible) {
            dummy.scale.set(0, 0, 0); dummy.updateMatrix();
            u.inst.setMatrixAt(i, dummy.matrix); continue;
          }
          const d = u.dirs[i];
          dummy.position.set(
            d.x * speed * elapsed,
            d.y * speed * elapsed,
            peak + d.z * speed * elapsed + 0.5 * G * elapsed * elapsed,
          );
          const sz = scale * 50 * fade;
          dummy.scale.set(sz, sz, sz);
          dummy.updateMatrix();
          u.inst.setMatrixAt(i, dummy.matrix);
        }
      }
      u.inst.count = u.N;
      u.inst.instanceMatrix.needsUpdate = true;
    },
  },

  {
    id: "waterfall",
    name: "瀑布粒子（Waterfall）",
    loc: [121.5512, 24.8625], city: "烏來",
    tech: "InstancedMesh 粒子 + 加速下落（life² 模擬重力）+ 越下越散",
    desc: "從上方窄區持續下落、加速 + 越下越散開 = 瀑布。改顏色變熔岩、礦物流。寬度 spread 控制水量大小。",
    prompt: "在 <b>[位置]</b> 從高 <b>[1500m]</b> 落下 <b>[500 顆]</b> 淺藍粒子，頂端窄底端散開到 <b>[600m]</b> 寬。",
    params: [
      { id: "count", label: "粒數", min: 100, max: 1000, step: 25, value: 600 },
      { id: "width", label: "寬(m)", min: 50, max: 800, step: 25, value: 250 },
      { id: "height", label: "高(m)", min: 300, max: 2500, step: 50, value: 1500 },
    ],
    build: (group) => {
      const N = 1000;
      const inst = new THREE.InstancedMesh(
        new THREE.IcosahedronGeometry(1, 0),
        new THREE.MeshBasicMaterial({
          color: 0x9cdcff, transparent: true, opacity: 0.7,
          blending: THREE.AdditiveBlending, depthWrite: false,
        }),
        N,
      );
      inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const states = [];
      for (let i = 0; i < N; i++) {
        states.push({
          x0: (Math.random() - 0.5) * 0.3,
          y0: (Math.random() - 0.5) * 0.05,
          life: Math.random(),
          speed: 0.4 + Math.random() * 0.5,
        });
      }
      group.add(inst);
      group.userData = { inst, states, N };
    },
    update: (group, dt, t, params, scale) => {
      const { inst, states, N } = group.userData;
      const visible = Math.round(params.count);
      const w = params.width * scale;
      const h = params.height * scale;
      const dummy = new THREE.Object3D();
      for (let i = 0; i < N; i++) {
        if (i >= visible) {
          dummy.scale.set(0, 0, 0); dummy.updateMatrix();
          inst.setMatrixAt(i, dummy.matrix); continue;
        }
        const s = states[i];
        s.life += dt * s.speed * 0.5;
        if (s.life > 1) s.life = 0;
        const fall = s.life * s.life;
        const x = s.x0 * w * (1 + fall * 4);
        const y = s.y0 * w * (1 + fall * 2);
        const z = h * (1 - s.life);
        dummy.position.set(x, y, z);
        const sz = scale * 28;
        dummy.scale.set(sz, sz, sz);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
      }
      inst.count = N;
      inst.instanceMatrix.needsUpdate = true;
    },
  },

  {
    id: "starfield",
    name: "星空背景（Star Field）",
    loc: [120.6829, 23.9760], city: "草屯",
    tech: "InstancedMesh 上半球面隨機 + 閃爍 sin 大小",
    desc: "覆蓋上空的隨機星點 + twinkle 閃爍。可加角度偏移看銀河帶。改成下半球 = 海中發光生物。",
    prompt: "在 <b>[位置]</b> 上空 <b>[半徑 3000m]</b> 半球面散佈 <b>[1200 顆]</b> 星點，各自閃爍。",
    params: [
      { id: "count", label: "星數", min: 200, max: 1500, step: 50, value: 1200 },
      { id: "radius", label: "半徑(m)", min: 500, max: 5000, step: 100, value: 3500 },
    ],
    build: (group) => {
      const N = 1500;
      const inst = new THREE.InstancedMesh(
        new THREE.IcosahedronGeometry(1, 0),
        new THREE.MeshBasicMaterial({
          color: 0xffffff, transparent: true, opacity: 0.8,
          blending: THREE.AdditiveBlending, depthWrite: false,
        }),
        N,
      );
      inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const stars = [];
      for (let i = 0; i < N; i++) {
        const theta = Math.acos(Math.random());
        const phi = Math.random() * Math.PI * 2;
        stars.push({
          x: Math.sin(theta) * Math.cos(phi),
          y: Math.sin(theta) * Math.sin(phi),
          z: Math.cos(theta),
          twinkle: Math.random() * Math.PI * 2,
          size: 0.3 + Math.random() * 1.4,
        });
      }
      group.add(inst);
      group.userData = { inst, stars, N };
    },
    update: (group, dt, t, params, scale) => {
      const { inst, stars, N } = group.userData;
      const visible = Math.round(params.count);
      const r = params.radius * scale;
      const dummy = new THREE.Object3D();
      for (let i = 0; i < N; i++) {
        if (i >= visible) {
          dummy.scale.set(0, 0, 0); dummy.updateMatrix();
          inst.setMatrixAt(i, dummy.matrix); continue;
        }
        const s = stars[i];
        dummy.position.set(s.x * r, s.y * r, s.z * r);
        const tw = 0.4 + 0.6 * Math.sin(t * 2 + s.twinkle);
        const sz = scale * 25 * s.size * tw;
        dummy.scale.set(sz, sz, sz);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
      }
      inst.count = N;
      inst.instanceMatrix.needsUpdate = true;
    },
  },

  // ── 系統關係 / 水資源 ──

  {
    id: "cascade",
    name: "階梯瀑布（Cascade Release）",
    loc: [121.0181, 23.8597], city: "武界",
    tech: "3 階圓盤平台 + 3 段 InstancedMesh 粒子流（每段帶微弧拋物）",
    desc: "3 階水庫上→下逐層釋放，粒子在每階間落下。表達串聯水庫、上下游關係、級聯處理、瀑布管線。",
    prompt: "在 <b>[位置]</b> 鋪 <b>[3 階]</b> 階梯瀑布，每階半徑 <b>[400m]</b>、階高 <b>[200m]</b>，粒子由上往下逐層落下。",
    params: [
      { id: "radius", label: "階徑(m)", min: 100, max: 1500, step: 25, value: 500 },
      { id: "tierHeight", label: "階高(m)", min: 50, max: 800, step: 25, value: 250 },
    ],
    build: (group) => {
      const TIERS = 3;
      const tiers = [];
      for (let i = 0; i < TIERS; i++) {
        const geo = new THREE.CylinderGeometry(1, 1, 0.05, 32);
        geo.translate(0, 0.025, 0);
        geo.rotateX(Math.PI / 2);
        const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
          color: 0x6cb8ff, transparent: true, opacity: 0.4,
          side: THREE.DoubleSide, depthWrite: false,
        }));
        group.add(m);
        tiers.push(m);
      }
      const streams = [];
      for (let i = 0; i < TIERS; i++) {
        const N = 60;
        const inst = new THREE.InstancedMesh(
          new THREE.IcosahedronGeometry(1, 0),
          new THREE.MeshBasicMaterial({
            color: 0x9cdcff, transparent: true, opacity: 0.7,
            blending: THREE.AdditiveBlending, depthWrite: false,
          }),
          N,
        );
        inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        const states = [];
        for (let j = 0; j < N; j++) {
          states.push({
            x0: (Math.random() - 0.5) * 0.2,
            y0: (Math.random() - 0.5) * 0.05,
            life: Math.random(),
          });
        }
        group.add(inst);
        streams.push({ inst, states, N });
      }
      group.userData = { tiers, streams };
    },
    update: (group, dt, t, params, scale) => {
      const r = params.radius * scale;
      const tierH = params.tierHeight * scale;
      const TIERS = 3;
      const offset = r * 0.7;
      for (let i = 0; i < TIERS; i++) {
        const tier = group.userData.tiers[i];
        const x = (i - 1) * offset;
        const z = (TIERS - 1 - i) * tierH;
        tier.position.set(x, 0, z);
        tier.scale.set(r * (1 - i * 0.15), r * (1 - i * 0.15), 1);
      }
      const dummy = new THREE.Object3D();
      for (let s = 0; s < group.userData.streams.length; s++) {
        const stream = group.userData.streams[s];
        const fromX = (s - 1) * offset;
        const fromZ = (TIERS - 1 - s) * tierH;
        const toX = s * offset;
        const toZ = (TIERS - 2 - s) * tierH;
        for (let i = 0; i < stream.N; i++) {
          const st = stream.states[i];
          st.life += dt * 0.7;
          if (st.life > 1) st.life = 0;
          const phase = st.life;
          const x = fromX + (toX - fromX) * phase + st.x0 * r * 0.2;
          const z = fromZ + (toZ - fromZ) * phase - phase * (1 - phase) * tierH * 0.4;
          const y = st.y0 * r * 0.2;
          dummy.position.set(x, y, Math.max(0, z));
          const sz = scale * 25;
          dummy.scale.set(sz, sz, sz);
          dummy.updateMatrix();
          stream.inst.setMatrixAt(i, dummy.matrix);
        }
        stream.inst.count = stream.N;
        stream.inst.instanceMatrix.needsUpdate = true;
      }
    },
  },

  {
    id: "evap",
    name: "蒸發升騰（Evaporation Rise）",
    loc: [120.8236, 24.4444], city: "鯉魚潭水庫",
    tech: "InstancedMesh 粒子從寬底面緩慢上升 + 微微側向漂移 + 越上越大",
    desc: "粒子從寬底基礎面緩慢上升、輕微飄動 = 水面蒸發 / 散熱 / 飄香。比降雪反向、比龍捲風散漫、比噴泉慢柔。",
    prompt: "在 <b>[位置]</b> 從 <b>[1500m]</b> 寬底面緩緩升起 <b>[200 顆]</b> 細小粒子到 <b>[800m]</b> 高，越上越淡越大。",
    params: [
      { id: "count", label: "粒數", min: 50, max: 400, step: 10, value: 200 },
      { id: "baseRadius", label: "底徑(m)", min: 200, max: 3000, step: 100, value: 1500 },
      { id: "maxHeight", label: "高(m)", min: 200, max: 2500, step: 50, value: 800 },
      { id: "rise", label: "升速", min: 0.1, max: 2, step: 0.1, value: 0.6 },
    ],
    build: (group) => {
      const N = 400;
      const inst = new THREE.InstancedMesh(
        new THREE.IcosahedronGeometry(1, 0),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(0.85, 0.92, 0.95),
          transparent: true, opacity: 0.5,
          blending: THREE.AdditiveBlending, depthWrite: false,
        }),
        N,
      );
      inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const states = [];
      for (let i = 0; i < N; i++) {
        states.push({
          x0: (Math.random() - 0.5) * 2,
          y0: (Math.random() - 0.5) * 2,
          life: Math.random(),
          speed: 0.3 + Math.random() * 0.4,
          driftPhase: Math.random() * Math.PI * 2,
        });
      }
      group.add(inst);
      group.userData = { inst, states, N };
    },
    update: (group, dt, t, params, scale) => {
      const { inst, states, N } = group.userData;
      const visible = Math.round(params.count);
      const baseR = params.baseRadius * scale;
      const maxH = params.maxHeight * scale;
      const dummy = new THREE.Object3D();
      for (let i = 0; i < N; i++) {
        if (i >= visible) {
          dummy.scale.set(0, 0, 0); dummy.updateMatrix();
          inst.setMatrixAt(i, dummy.matrix); continue;
        }
        const s = states[i];
        s.life += dt * params.rise * s.speed * 0.2;
        if (s.life > 1) s.life = 0;
        const drift = Math.sin(t * 0.3 + s.driftPhase) * 0.3;
        const x = s.x0 * baseR * (1 + s.life * 0.3) + drift * baseR * 0.1;
        const y = s.y0 * baseR * (1 + s.life * 0.3);
        const z = s.life * maxH;
        dummy.position.set(x, y, z);
        const sz = scale * 28 * (0.5 + s.life * 0.6);
        dummy.scale.set(sz, sz, sz);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
      }
      inst.count = N;
      inst.instanceMatrix.needsUpdate = true;
    },
  },
];
