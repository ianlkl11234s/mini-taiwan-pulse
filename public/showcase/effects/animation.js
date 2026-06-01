import * as THREE from "three";

export default [
  {
    id: "ripple",
    name: "漣漪擴散（Ripple）",
    loc: [121.6044, 23.9871], city: "花蓮",
    tech: "多層 RingGeometry，半徑隨時間遞增，opacity 遞減",
    desc: "用 4 個圓環錯開時間擴散，每個環從小變大、從亮變透明，模擬水波或雷達脈衝。表達「事件發生」極好用。",
    prompt: "在 <b>[位置]</b> 每 <b>[1.5 秒]</b> 發出一圈 <b>[黃色]</b> 漣漪，最大擴散半徑 <b>[800m]</b>，邊擴散邊變淡。",
    params: [
      { id: "maxR", label: "最大(m)", min: 200, max: 3000, step: 50, value: 1000 },
      { id: "period", label: "週期(s)", min: 0.5, max: 5, step: 0.1, value: 1.8 },
      { id: "rings", label: "環數", min: 1, max: 8, step: 1, value: 4 },
    ],
    build: (group) => {
      // 預先建 8 個環，根據 params 顯示前 N 個
      const rings = [];
      for (let i = 0; i < 8; i++) {
        const geo = new THREE.RingGeometry(0.99, 1.0, 64);
        const mat = new THREE.MeshBasicMaterial({
          color: 0xffd56c, transparent: true, opacity: 0.8,
          side: THREE.DoubleSide, depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        const mesh = new THREE.Mesh(geo, mat);
        group.add(mesh);
        rings.push(mesh);
      }
      group.userData.rings = rings;
    },
    update: (group, dt, t, params, scale) => {
      const max = params.maxR * scale;
      const N = Math.round(params.rings);
      const period = params.period;
      group.userData.rings.forEach((m, i) => {
        if (i >= N) { m.visible = false; return; }
        m.visible = true;
        const phase = ((t / period) + i / N) % 1;
        const r = max * phase;
        const w = max * 0.04 * (1 + phase * 4); // 越大環越粗
        m.scale.set(r, r, 1);
        // 線寬透過 scale 模擬：用 ring outer 1, inner 0.99 → 寬 = 0.01 * scale
        m.material.opacity = 1.0 - phase;
      });
    },
  },

  {
    id: "radar",
    name: "雷達掃描（Radar Sweep）",
    loc: [121.7572, 24.7042], city: "宜蘭",
    tech: "扇形 ShapeGeometry + 旋轉 + 漸層 alpha",
    desc: "用 Shape API 畫出扇形，旋轉模擬雷達掃描臂。可加圓圈刻度做完整雷達 UI。表達「監視中」「掃瞄中」。",
    prompt: "在 <b>[位置]</b> 放一個半徑 <b>[600m]</b> 的 <b>[綠色]</b> 雷達，掃描臂寬 <b>[30°]</b>，每 <b>[3 秒]</b> 掃一圈，含三圈刻度線。",
    params: [
      { id: "radius", label: "半徑(m)", min: 200, max: 2000, step: 50, value: 800 },
      { id: "speed", label: "速度", min: 0.1, max: 3, step: 0.1, value: 1.0 },
      { id: "angle", label: "扇角°", min: 10, max: 90, step: 5, value: 30 },
    ],
    build: (group) => {
      // 三圈刻度
      const ringMat = new THREE.LineBasicMaterial({ color: 0x4cffa6, transparent: true, opacity: 0.4 });
      const rings = [];
      for (let i = 1; i <= 3; i++) {
        const pts = [];
        const segments = 64;
        for (let s = 0; s <= segments; s++) {
          const a = (s / segments) * Math.PI * 2;
          pts.push(new THREE.Vector3(Math.cos(a) * (i / 3), Math.sin(a) * (i / 3), 0));
        }
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const line = new THREE.Line(geo, ringMat);
        group.add(line);
        rings.push(line);
      }
      // 十字
      const crossMat = new THREE.LineBasicMaterial({ color: 0x4cffa6, transparent: true, opacity: 0.4 });
      const crossGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-1, 0, 0), new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 1, 0),
      ]);
      const cross = new THREE.LineSegments(crossGeo, crossMat);
      group.add(cross);

      // 掃描臂 (Shape with linear gradient via vertex colors)
      const sweepMat = new THREE.MeshBasicMaterial({
        vertexColors: true, transparent: true, opacity: 1.0,
        side: THREE.DoubleSide, depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const sweepMesh = new THREE.Mesh(new THREE.BufferGeometry(), sweepMat);
      group.add(sweepMesh);

      group.userData = { rings, cross, sweepMesh };
    },
    update: (group, dt, t, params, scale) => {
      const r = params.radius * scale;
      for (const ring of group.userData.rings) ring.scale.set(r, r, r);
      group.userData.cross.scale.set(r, r, r);

      // 重建 sweep geometry（簡單做：每幀重建小三角扇）
      const angleDeg = params.angle;
      const angleRad = (angleDeg * Math.PI) / 180;
      const baseAngle = (t * params.speed) % (Math.PI * 2);
      const segments = 16;

      const positions = [];
      const colors = [];
      // 中心點
      positions.push(0, 0, 0); colors.push(0.3, 1.0, 0.65, 0.8);
      // 弧上的點（從 baseAngle 到 baseAngle + angleRad）
      for (let i = 0; i <= segments; i++) {
        const a = baseAngle + (i / segments) * angleRad;
        positions.push(Math.cos(a), Math.sin(a), 0);
        const fade = 1 - (i / segments);
        colors.push(0.3, 1.0, 0.65, fade * 0.8);
      }
      const indices = [];
      for (let i = 1; i <= segments; i++) indices.push(0, i, i + 1);

      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 4));
      geo.setIndex(indices);
      group.userData.sweepMesh.geometry.dispose();
      group.userData.sweepMesh.geometry = geo;
      group.userData.sweepMesh.scale.set(r, r, r);
    },
  },

  {
    id: "ring",
    name: "旋轉光環（Rotating Ring）",
    loc: [120.2127, 23.0011], city: "台南",
    tech: "TorusGeometry + 持續旋轉 + 多層疊加",
    desc: "Torus 是甜甜圈幾何。傾斜 + 旋轉 = 行星環、能量場、土星環。三個不同軸向旋轉的環疊起來特別有 sci-fi 感。",
    prompt: "在 <b>[位置]</b> 放三個半徑 <b>[400m]</b> 的 <b>[金色]</b> 光環，三個不同軸向同時旋轉，加性混合。",
    params: [
      { id: "radius", label: "半徑(m)", min: 100, max: 1500, step: 25, value: 500 },
      { id: "thickness", label: "粗細", min: 0.005, max: 0.1, step: 0.005, value: 0.025 },
      { id: "speed", label: "轉速", min: 0, max: 5, step: 0.1, value: 1.5 },
    ],
    build: (group) => {
      const colors = [0xffd87a, 0xff9966, 0xa8e0ff];
      const rings = [];
      for (let i = 0; i < 3; i++) {
        const geo = new THREE.TorusGeometry(1, 0.025, 12, 64);
        const mat = new THREE.MeshBasicMaterial({
          color: colors[i], transparent: true, opacity: 0.7,
          blending: THREE.AdditiveBlending, depthWrite: false,
        });
        const mesh = new THREE.Mesh(geo, mat);
        group.add(mesh);
        rings.push(mesh);
      }
      group.userData.rings = rings;
    },
    update: (group, dt, t, params, scale) => {
      const r = params.radius * scale;
      group.userData.rings.forEach((m, i) => {
        m.scale.set(r, r, r);
        m.geometry.dispose();
        m.geometry = new THREE.TorusGeometry(1, params.thickness, 12, 64);
        // 三個不同軸向旋轉
        if (i === 0) { m.rotation.x = t * params.speed; m.rotation.y = 0.3; }
        if (i === 1) { m.rotation.y = t * params.speed * 0.7; m.rotation.x = 0.6; }
        if (i === 2) { m.rotation.z = t * params.speed * 0.5; m.rotation.x = 1.2; }
        // 抬離地面一點
        m.position.z = r * 0.5;
      });
    },
  },

  {
    id: "lightning",
    name: "閃電（Lightning Strike）",
    loc: [120.8005, 23.5083], city: "阿里山",
    tech: "動態 zigzag Line + 隨機重生 + 短暫 alpha 衰減",
    desc: "從天到地的鋸齒折線，每段 random 偏移；亮度突然出現後快速淡出，間隔隨機重打。表達雷擊、突發事件、警告、攻擊。",
    prompt: "在 <b>[位置]</b> 從高空 <b>[1500m]</b> 到地面打 <b>[白色]</b> 閃電，平均每 <b>[1.5 秒]</b> 一次（隨機抖動），鋸齒幅度 <b>[120m]</b>。",
    params: [
      { id: "altitude", label: "起點(m)", min: 500, max: 3000, step: 100, value: 1500 },
      { id: "interval", label: "間隔(s)", min: 0.3, max: 5, step: 0.1, value: 1.5 },
      { id: "jitter", label: "鋸齒(m)", min: 20, max: 500, step: 10, value: 150 },
    ],
    build: (group) => {
      const N = 5;
      const bolts = [];
      for (let i = 0; i < N; i++) {
        const positions = new Float32Array(40 * 3);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        const mat = new THREE.LineBasicMaterial({
          color: 0xffffff, transparent: true, opacity: 0,
          blending: THREE.AdditiveBlending, depthWrite: false,
        });
        const line = new THREE.Line(geo, mat);
        group.add(line);
        bolts.push({ line, nextStrike: 0, endTime: 0, active: false });
      }
      group.userData.bolts = bolts;
    },
    update: (group, dt, t, params, scale) => {
      const altMC = params.altitude * scale;
      const jitterMC = params.jitter * scale;
      const interval = params.interval;
      const FLASH_DUR = 0.18;
      group.userData.bolts.forEach((b, i) => {
        if (b.nextStrike === 0) b.nextStrike = t + Math.random() * interval + i * 0.13;
        if (t >= b.nextStrike && !b.active) {
          b.active = true;
          b.endTime = t + FLASH_DUR;
          b.nextStrike = t + interval * (0.5 + Math.random());
          const segments = 10 + Math.floor(Math.random() * 6);
          const positions = b.line.geometry.attributes.position.array;
          let idx = 0;
          for (let s = 0; s <= segments; s++) {
            const ratio = s / segments;
            const z = altMC * (1 - ratio);
            const x = (ratio < 1 && ratio > 0 ? (Math.random() - 0.5) * jitterMC : 0);
            const y = (ratio < 1 && ratio > 0 ? (Math.random() - 0.5) * jitterMC : 0);
            positions[idx++] = x;
            positions[idx++] = y;
            positions[idx++] = z;
          }
          b.line.geometry.setDrawRange(0, segments + 1);
          b.line.geometry.attributes.position.needsUpdate = true;
          b.line.material.opacity = 1;
        }
        if (b.active) {
          const remain = (b.endTime - t) / FLASH_DUR;
          b.line.material.opacity = Math.max(0, remain);
          if (t > b.endTime) { b.active = false; b.line.material.opacity = 0; }
        }
      });
    },
  },

  {
    id: "countdown",
    name: "倒數計時環（Countdown Ring）",
    loc: [121.1444, 22.7583], city: "台東",
    tech: "TorusGeometry + thetaLength 動態裁切 + HSL 顏色由綠轉紅",
    desc: "Torus 從 360° 連續減少到 0°，看起來像進度環倒退。表達倒數、剩餘容量、冷卻時間、進度。配色梯變更直觀。",
    prompt: "在 <b>[位置]</b> 放一個半徑 <b>[500m]</b> 厚 <b>[60m]</b> 的倒數環，<b>[10 秒]</b> 一個循環從滿到空，顏色從綠經黃到紅。",
    params: [
      { id: "radius", label: "半徑(m)", min: 100, max: 1500, step: 25, value: 600 },
      { id: "thickness", label: "厚(m)", min: 10, max: 300, step: 5, value: 80 },
      { id: "period", label: "週期(s)", min: 2, max: 30, step: 1, value: 10 },
    ],
    build: (group) => {
      const geo = new THREE.TorusGeometry(1, 0.05, 16, 96);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x4cffa6, transparent: true, opacity: 0.9, side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      group.add(mesh);
      group.userData = { mesh, lastTheta: -1, lastT: -1 };
    },
    update: (group, dt, t, params, scale) => {
      const period = params.period;
      const phase = (t % period) / period;
      const remaining = 1 - phase;
      const thetaLen = Math.max(0.001, remaining * Math.PI * 2);
      const thicknessRatio = params.thickness / params.radius;

      // 重建 geometry：thetaLength 變化超過 0.03 rad 或 thickness 變
      if (Math.abs(thetaLen - group.userData.lastTheta) > 0.03 ||
          Math.abs(thicknessRatio - group.userData.lastT) > 1e-4) {
        group.userData.lastTheta = thetaLen;
        group.userData.lastT = thicknessRatio;
        group.userData.mesh.geometry.dispose();
        group.userData.mesh.geometry = new THREE.TorusGeometry(1, thicknessRatio, 16, 96, thetaLen);
      }
      const r = params.radius * scale;
      group.userData.mesh.scale.set(r, r, r);
      // 抬離地面一點
      group.userData.mesh.position.z = params.thickness * scale;
      const hue = remaining * 0.35; // 0 紅 → 0.35 綠
      group.userData.mesh.material.color.setHSL(hue, 0.85, 0.55);
    },
  },

  {
    id: "shockwave",
    name: "衝擊波（Shockwave）",
    loc: [121.3700, 24.9300], city: "三峽",
    tech: "中心垂直爆柱 + 地面擴散環，按週期同步重生",
    desc: "比漣漪更戲劇：先有一根柱子瞬間升起，然後從底部射出一圈擴散環。表達爆炸、警告、能量釋放、震源。",
    prompt: "在 <b>[位置]</b> 每 <b>[3 秒]</b> 爆一次：中心射出 <b>[500m]</b> 高粉柱 + 同步擴散 <b>[1500m]</b> 半徑光環。",
    params: [
      { id: "period", label: "週期(s)", min: 1, max: 8, step: 0.5, value: 3 },
      { id: "radius", label: "環徑(m)", min: 300, max: 4000, step: 100, value: 1800 },
      { id: "height", label: "柱高(m)", min: 100, max: 2000, step: 50, value: 700 },
    ],
    build: (group) => {
      const pillarGeo = new THREE.CylinderGeometry(1, 1, 1, 32, 1, true);
      pillarGeo.translate(0, 0.5, 0);
      pillarGeo.rotateX(Math.PI / 2);
      const pillar = new THREE.Mesh(pillarGeo, new THREE.MeshBasicMaterial({
        color: 0xff7eb6, transparent: true, opacity: 1, side: THREE.DoubleSide,
        depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      group.add(pillar);
      const ringGeo = new THREE.RingGeometry(0.97, 1.0, 64);
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
        color: 0xff7eb6, transparent: true, opacity: 1, side: THREE.DoubleSide,
        depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      group.add(ring);
      group.userData = { pillar, ring, lastBurst: -10 };
    },
    update: (group, dt, t, params, scale) => {
      if (t - group.userData.lastBurst >= params.period) {
        group.userData.lastBurst = t;
      }
      const phase = (t - group.userData.lastBurst) / params.period;
      const maxR = params.radius * scale;
      const maxH = params.height * scale;
      const pillarP = Math.min(1, phase / 0.25);
      const pw = maxR * 0.18 * (1 - pillarP * 0.4);
      group.userData.pillar.scale.set(pw, pw, maxH * pillarP);
      group.userData.pillar.material.opacity = (1 - pillarP) * 0.95;
      const r = maxR * phase;
      group.userData.ring.scale.set(r, r, 1);
      group.userData.ring.material.opacity = (1 - phase) * 0.95;
    },
  },

  {
    id: "contour",
    name: "流動等高線（Contour Lines）",
    loc: [121.0734, 25.0367], city: "觀音",
    tech: "多層同心 Line + 半徑隨時間擴散 + Z 軸抬升 + HSL 隨高度梯變",
    desc: "8 個錯時擴散的圓圈，每圈邊擴邊抬升 + 顏色由黃轉綠。等高線地圖、聲波擴散、無線電覆蓋的視覺。",
    prompt: "在 <b>[位置]</b> 持續發出 <b>[8 圈]</b> 等高線，最大半徑 <b>[1500m]</b>，每圈邊擴散邊上升至 <b>[300m]</b>，顏色由黃漸綠。",
    params: [
      { id: "maxR", label: "最大(m)", min: 200, max: 4000, step: 100, value: 1800 },
      { id: "maxH", label: "抬升(m)", min: 0, max: 1000, step: 25, value: 350 },
      { id: "period", label: "週期(s)", min: 1, max: 8, step: 0.2, value: 3.0 },
    ],
    build: (group) => {
      const N = 8;
      const rings = [];
      for (let i = 0; i < N; i++) {
        const points = [];
        const segs = 64;
        for (let s = 0; s <= segs; s++) {
          const a = (s / segs) * Math.PI * 2;
          points.push(new THREE.Vector3(Math.cos(a), Math.sin(a), 0));
        }
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        const mat = new THREE.LineBasicMaterial({
          color: 0xffd87a, transparent: true, opacity: 0.7,
          blending: THREE.AdditiveBlending,
        });
        const line = new THREE.Line(geo, mat);
        group.add(line);
        rings.push(line);
      }
      group.userData = { rings, N };
    },
    update: (group, dt, t, params, scale) => {
      const max = params.maxR * scale;
      const maxH = params.maxH * scale;
      const period = params.period;
      const N = group.userData.N;
      group.userData.rings.forEach((line, i) => {
        const phase = ((t / period) + i / N) % 1;
        const r = max * phase;
        line.scale.set(r, r, 1);
        line.position.z = phase * maxH;
        line.material.color.setHSL(0.15 + phase * 0.25, 0.85, 0.55);
        line.material.opacity = 0.85 * (1 - phase * 0.5);
      });
    },
  },

  {
    id: "highlight",
    name: "選中 Highlight（Selection Ring）",
    loc: [120.7858, 23.8294], city: "集集",
    tech: "中心目標脈動球 + 3 圈不對稱 RingGeometry 反向旋轉",
    desc: "中心一顆呼吸光球 + 三圈缺口環反向旋轉 = 「我在這！」標記。表達目標選中、警告、追蹤鎖定、重點高亮。",
    prompt: "在 <b>[位置]</b> 放一個 <b>[300m]</b> 半徑的選中標記：中心 <b>[白色]</b> 脈動球 + 三圈 <b>[粉色]</b> 缺口環反向旋轉。",
    params: [
      { id: "radius", label: "半徑(m)", min: 100, max: 2000, step: 25, value: 400 },
      { id: "targetSize", label: "目標", min: 50, max: 500, step: 10, value: 150 },
    ],
    build: (group) => {
      const target = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1, 1),
        new THREE.MeshBasicMaterial({
          color: 0xffffff, transparent: true, opacity: 1,
          blending: THREE.AdditiveBlending, depthWrite: false,
        }),
      );
      group.add(target);
      const rings = [];
      for (let i = 0; i < 3; i++) {
        const geo = new THREE.RingGeometry(0.99 - i * 0.005, 1.0 + i * 0.01, 32, 1, 0, Math.PI * 1.5);
        const mat = new THREE.MeshBasicMaterial({
          color: 0xff7eb6, transparent: true, opacity: 0.75,
          side: THREE.DoubleSide, depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        const mesh = new THREE.Mesh(geo, mat);
        group.add(mesh);
        rings.push(mesh);
      }
      group.userData = { target, rings };
    },
    update: (group, dt, t, params, scale) => {
      const r = params.radius * scale;
      const ts = params.targetSize * scale * 0.5;
      const pulse = 1 + 0.25 * Math.sin(t * 4);
      const tsP = ts * pulse;
      group.userData.target.scale.set(tsP, tsP, tsP);
      group.userData.target.position.z = ts;
      group.userData.rings.forEach((m, i) => {
        const ringR = r * (1 + i * 0.12);
        m.scale.set(ringR, ringR, ringR);
        m.position.z = ts * 0.1;
        m.rotation.z = t * (i % 2 === 0 ? 1.5 : -1.0) * (1 + i * 0.3);
      });
    },
  },

  {
    id: "rainbow",
    name: "彩虹拱橋（Rainbow Arch）",
    loc: [120.3712, 22.3402], city: "小琉球",
    tech: "TorusGeometry thetaLength=π 半圓 + 多層不同顏色不同半徑疊加",
    desc: "半圓環 = 拱形。6 層不同顏色不同半徑 = 彩虹拱橋。可變單色、加粗、加動畫飛過 = 起飛軌跡 / 鵲橋 / 彩帶。",
    prompt: "在 <b>[位置]</b> 立一個半徑 <b>[1500m]</b> 的彩虹拱橋（紅橙黃綠藍紫六層），半圓朝上跨過地面。",
    params: [
      { id: "radius", label: "半徑(m)", min: 300, max: 4000, step: 100, value: 1800 },
      { id: "thickness", label: "粗細", min: 0.005, max: 0.06, step: 0.005, value: 0.02 },
    ],
    build: (group) => {
      const colors = [0xff5b6e, 0xffa86c, 0xffd54f, 0x4cffa6, 0x6cb8ff, 0xa080ff];
      const tori = [];
      for (let i = 0; i < colors.length; i++) {
        const ratio = 1 - (i / colors.length) * 0.06;
        const geo = new THREE.TorusGeometry(ratio, 0.02, 8, 64, Math.PI);
        geo.rotateX(Math.PI / 2);
        const mat = new THREE.MeshBasicMaterial({
          color: colors[i], transparent: true, opacity: 0.92,
        });
        const mesh = new THREE.Mesh(geo, mat);
        group.add(mesh);
        tori.push({ mesh, ratio });
      }
      group.userData = { tori, lastT: -1 };
    },
    update: (group, dt, t, params, scale) => {
      const r = params.radius * scale;
      const thick = params.thickness;
      if (Math.abs(thick - group.userData.lastT) > 1e-4) {
        group.userData.lastT = thick;
        for (const item of group.userData.tori) {
          item.mesh.geometry.dispose();
          const newGeo = new THREE.TorusGeometry(item.ratio, thick, 8, 64, Math.PI);
          newGeo.rotateX(Math.PI / 2);
          item.mesh.geometry = newGeo;
        }
      }
      for (const item of group.userData.tori) {
        item.mesh.scale.set(r, r, r);
      }
    },
  },

  // ── 系統關係 / 水資源 ──

  {
    id: "hydrocycle",
    name: "水循環閉環（Hydro Cycle）",
    loc: [120.4072, 23.2186], city: "烏山頭水庫",
    tech: "4 個節點（雲/雨/湖/蒸發）+ 連線 + 沿線繞行的光點（loop）",
    desc: "雲→雨→湖→蒸發→雲，光點繞 4 階段循環。表達自然循環、生命週期、製程閉環、訂閱續約。",
    prompt: "在 <b>[位置]</b> 鋪一個 <b>[1500m]</b> 範圍的水循環：雲（頂）→雨（右）→湖（底）→蒸發（左），<b>[8 顆]</b> 光點繞行。",
    params: [
      { id: "size", label: "範圍(m)", min: 300, max: 4000, step: 100, value: 1800 },
      { id: "nodeSize", label: "節點(m)", min: 50, max: 500, step: 25, value: 250 },
      { id: "speed", label: "流速", min: 0.05, max: 2, step: 0.05, value: 0.5 },
    ],
    build: (group) => {
      const nodes = [
        { pos: new THREE.Vector3(0, 0, 1), color: 0xffffff },        // 雲（頂）
        { pos: new THREE.Vector3(0.7, 0, 0.05), color: 0x6cb8ff },   // 雨（右下）
        { pos: new THREE.Vector3(0, 0, 0.05), color: 0x4cffa6 },     // 湖（底中）
        { pos: new THREE.Vector3(-0.7, 0, 0.5), color: 0xa080ff },   // 蒸發（左）
      ];
      const nodeMeshes = [];
      for (const n of nodes) {
        const m = new THREE.Mesh(
          new THREE.IcosahedronGeometry(1, 1),
          new THREE.MeshBasicMaterial({
            color: n.color, transparent: true, opacity: 0.9,
            blending: THREE.AdditiveBlending, depthWrite: false,
          }),
        );
        group.add(m);
        nodeMeshes.push(m);
      }
      const conns = [];
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i].pos;
        const b = nodes[(i + 1) % nodes.length].pos;
        const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
        const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
          color: 0x6cf6ff, transparent: true, opacity: 0.4,
        }));
        group.add(line);
        conns.push({ line, a, b });
      }
      const PARTICLES = 8;
      const flows = [];
      for (let i = 0; i < PARTICLES; i++) {
        const m = new THREE.Mesh(
          new THREE.IcosahedronGeometry(1, 0),
          new THREE.MeshBasicMaterial({
            color: 0xffffff, transparent: true, opacity: 1,
            blending: THREE.AdditiveBlending, depthWrite: false,
          }),
        );
        group.add(m);
        flows.push({ mesh: m, offset: i / PARTICLES });
      }
      group.userData = { nodes, nodeMeshes, conns, flows };
    },
    update: (group, dt, t, params, scale) => {
      const sz = params.size * scale;
      const ns = params.nodeSize * scale * 0.5;
      const ds = params.nodeSize * scale * 0.25;
      group.userData.nodeMeshes.forEach((m, i) => {
        const n = group.userData.nodes[i];
        m.position.set(n.pos.x * sz, n.pos.y * sz, n.pos.z * sz);
        m.scale.set(ns, ns, ns);
      });
      for (const c of group.userData.conns) {
        const arr = c.line.geometry.attributes.position.array;
        arr[0] = c.a.x * sz; arr[1] = c.a.y * sz; arr[2] = c.a.z * sz;
        arr[3] = c.b.x * sz; arr[4] = c.b.y * sz; arr[5] = c.b.z * sz;
        c.line.geometry.attributes.position.needsUpdate = true;
      }
      const N = group.userData.nodes.length;
      for (const f of group.userData.flows) {
        const phase = ((t * params.speed * 0.2) + f.offset) % 1;
        const segIdx = Math.floor(phase * N);
        const segPhase = (phase * N) % 1;
        const a = group.userData.nodes[segIdx].pos;
        const b = group.userData.nodes[(segIdx + 1) % N].pos;
        f.mesh.position.set(
          (a.x + (b.x - a.x) * segPhase) * sz,
          (a.y + (b.y - a.y) * segPhase) * sz,
          (a.z + (b.z - a.z) * segPhase) * sz,
        );
        f.mesh.scale.set(ds, ds, ds);
      }
    },
  },

  {
    id: "flood",
    name: "漫淹擴散（Flood Spread）",
    loc: [120.4250, 23.4181], city: "八掌溪",
    tech: "Disc 半徑擴張 + Z 軸抬升 + 邊緣亮環，按週期重生",
    desc: "圓盤水面同時往外擴 + 往上漲 + 邊緣亮環。表達淹水範圍、影響擴散、感染傳播、覆蓋率成長。",
    prompt: "在 <b>[位置]</b> 每 <b>[5 秒]</b> 漫淹一次：水面從 0 擴到 <b>[2000m]</b>，水位同步從 0 漲到 <b>[200m]</b>，邊緣亮環。",
    params: [
      { id: "maxR", label: "最大(m)", min: 300, max: 5000, step: 100, value: 2500 },
      { id: "maxRise", label: "水位(m)", min: 50, max: 800, step: 25, value: 250 },
      { id: "period", label: "週期(s)", min: 2, max: 12, step: 0.5, value: 5 },
    ],
    build: (group) => {
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(1, 64),
        new THREE.MeshBasicMaterial({
          color: 0x6cb8ff, transparent: true, opacity: 0.4,
          side: THREE.DoubleSide, depthWrite: false,
        }),
      );
      group.add(disc);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.98, 1.0, 64),
        new THREE.MeshBasicMaterial({
          color: 0x6cb8ff, transparent: true, opacity: 1,
          side: THREE.DoubleSide, depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      group.add(ring);
      group.userData = { disc, ring, lastBurst: -10 };
    },
    update: (group, dt, t, params, scale) => {
      if (t - group.userData.lastBurst >= params.period) {
        group.userData.lastBurst = t;
      }
      const phase = (t - group.userData.lastBurst) / params.period;
      const r = params.maxR * scale * phase;
      const z = params.maxRise * scale * phase;
      group.userData.disc.scale.set(r, r, 1);
      group.userData.disc.position.z = z;
      group.userData.disc.material.opacity = 0.45 * (1 - phase * 0.5);
      group.userData.ring.scale.set(r, r, 1);
      group.userData.ring.position.z = z;
      group.userData.ring.material.opacity = 0.95 * (1 - phase * 0.6);
    },
  },

  {
    id: "feedback",
    name: "回饋迴路（Feedback Loop）",
    loc: [120.7794, 22.1989], city: "牡丹水庫",
    tech: "5 節點圍成圓圈 + 微彎 TubeGeometry 連線 + 光點繞行 loop",
    desc: "5 個節點環狀連結，光點繞行表達正/負回饋、依賴循環、訂閱續約、製程回流。改節點數變不同關係階數。",
    prompt: "在 <b>[位置]</b> 鋪一個 <b>[1200m]</b> 範圍的回饋迴路，<b>[5 個]</b> 節點環狀，<b>[6 顆]</b> 光點順時針繞行。",
    params: [
      { id: "radius", label: "範圍(m)", min: 300, max: 3000, step: 50, value: 1300 },
      { id: "nodeSize", label: "節點(m)", min: 50, max: 400, step: 10, value: 180 },
      { id: "speed", label: "流速", min: 0.05, max: 2, step: 0.05, value: 0.6 },
    ],
    build: (group) => {
      const N = 5;
      const nodes = [];
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2 - Math.PI / 2;
        nodes.push(new THREE.Vector3(Math.cos(a), Math.sin(a), 0));
      }
      const colors = [0x6cb8ff, 0xff7eb6, 0x4cffa6, 0xffd87a, 0xa080ff];
      const nodeMeshes = [];
      for (let i = 0; i < N; i++) {
        const m = new THREE.Mesh(
          new THREE.IcosahedronGeometry(1, 1),
          new THREE.MeshBasicMaterial({
            color: colors[i], transparent: true, opacity: 0.92,
            blending: THREE.AdditiveBlending, depthWrite: false,
          }),
        );
        group.add(m);
        nodeMeshes.push(m);
      }
      const conns = [];
      for (let i = 0; i < N; i++) {
        const a = nodes[i];
        const b = nodes[(i + 1) % N];
        const midOut = new THREE.Vector3((a.x + b.x) / 2, (a.y + b.y) / 2, 0);
        midOut.multiplyScalar(1.25);
        const curve = new THREE.QuadraticBezierCurve3(a, midOut, b);
        const tubeGeo = new THREE.TubeGeometry(curve, 24, 0.015, 8, false);
        const mesh = new THREE.Mesh(tubeGeo, new THREE.MeshBasicMaterial({
          color: 0x6cf6ff, transparent: true, opacity: 0.55,
          blending: THREE.AdditiveBlending, depthWrite: false,
        }));
        group.add(mesh);
        conns.push({ mesh, curve });
      }
      const PARTICLES = 6;
      const flows = [];
      for (let i = 0; i < PARTICLES; i++) {
        const m = new THREE.Mesh(
          new THREE.IcosahedronGeometry(1, 0),
          new THREE.MeshBasicMaterial({
            color: 0xffffff, transparent: true, opacity: 1,
            blending: THREE.AdditiveBlending, depthWrite: false,
          }),
        );
        group.add(m);
        flows.push({ mesh: m, offset: i / PARTICLES });
      }
      group.userData = { nodes, nodeMeshes, conns, flows, N };
    },
    update: (group, dt, t, params, scale) => {
      const r = params.radius * scale;
      const ns = params.nodeSize * scale * 0.5;
      const ds = params.nodeSize * scale * 0.25;
      const N = group.userData.N;
      for (let i = 0; i < N; i++) {
        const n = group.userData.nodes[i];
        const m = group.userData.nodeMeshes[i];
        m.position.set(n.x * r, n.y * r, ns);
        m.scale.set(ns, ns, ns);
      }
      for (const c of group.userData.conns) {
        c.mesh.scale.set(r, r, r);
        c.mesh.position.z = ns;
      }
      for (const f of group.userData.flows) {
        const phase = ((t * params.speed * 0.15) + f.offset) % 1;
        const segIdx = Math.floor(phase * N);
        const segPhase = (phase * N) % 1;
        const c = group.userData.conns[segIdx];
        const pt = c.curve.getPointAt(segPhase);
        f.mesh.position.set(pt.x * r, pt.y * r, ns);
        f.mesh.scale.set(ds, ds, ds);
      }
    },
  },
];
