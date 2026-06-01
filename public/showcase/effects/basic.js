import * as THREE from "three";

export default [
  {
    id: "orb",
    name: "光球（Glow Orb）",
    loc: [121.5654, 25.0330], city: "台北",
    tech: "多層 IcosahedronGeometry + AdditiveBlending + 呼吸脈動",
    desc: "三層球體疊加，內層白核、外層帶顏色，opacity 隨時間 sin 變化。Mini Taiwan Pulse 的船舶/航班/列車光點都用這個 pattern。",
    prompt: "在 <b>[位置]</b> 放一顆直徑 <b>[200m]</b> 的 <b>[#6cb8ff]</b> 光球，內白外藍三層疊加，每 <b>[2 秒]</b> 呼吸脈動一次。",
    params: [
      { id: "size", label: "直徑(m)", min: 50, max: 800, step: 10, value: 250 },
      { id: "speed", label: "脈動", min: 0, max: 5, step: 0.1, value: 2.0 },
    ],
    build: (group, params) => {
      const layers = [];
      const colors = [new THREE.Color(1,1,1), new THREE.Color(0.42, 0.72, 1), new THREE.Color(0.42, 0.72, 1)];
      const ratios = [0.4, 1.0, 2.0];
      const opacities = [1.0, 0.5, 0.15];
      for (let i = 0; i < 3; i++) {
        const geo = new THREE.IcosahedronGeometry(1, 2);
        const mat = new THREE.MeshBasicMaterial({
          color: colors[i], transparent: true, opacity: opacities[i],
          blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
        });
        mat.userData.baseOpacity = opacities[i];
        const mesh = new THREE.Mesh(geo, mat);
        mesh.userData.ratio = ratios[i];
        group.add(mesh);
        layers.push(mesh);
      }
      group.userData.layers = layers;
    },
    update: (group, dt, t, params, scale) => {
      const half = (params.size * 0.5) * scale;
      for (const m of group.userData.layers) {
        const s = half * m.userData.ratio;
        m.scale.set(s, s, s);
        const pulse = 1 + Math.sin(t * params.speed) * 0.18;
        m.material.opacity = m.material.userData.baseOpacity * pulse;
      }
    },
  },

  {
    id: "cylinder",
    name: "圓柱（Cylinder）",
    loc: [121.4628, 25.0125], city: "新北",
    tech: "CylinderGeometry + 半透明 MeshBasicMaterial",
    desc: "最基本的 3D 圓柱。等高一致 = 信號塔；上窄下寬 = 燈塔；只有底面 = 圓盤。topRadius 設 0 就變圓錐。",
    prompt: "在 <b>[位置]</b> 立一根高 <b>[400m]</b> 半徑 <b>[60m]</b> 的 <b>[淡綠色]</b> 圓柱，半透明 <b>[opacity 0.5]</b>，靜止不動。",
    params: [
      { id: "height", label: "高(m)", min: 50, max: 1500, step: 10, value: 500 },
      { id: "radius", label: "半徑(m)", min: 10, max: 300, step: 5, value: 80 },
      { id: "opacity", label: "透明度", min: 0.05, max: 1.0, step: 0.05, value: 0.5 },
    ],
    build: (group) => {
      const geo = new THREE.CylinderGeometry(1, 1, 1, 32);
      geo.translate(0, 0.5, 0); // 底部對齊原點
      geo.rotateX(Math.PI / 2); // Y軸 → Z軸（Mapbox up）
      const mat = new THREE.MeshBasicMaterial({
        color: 0x7fffa8, transparent: true, opacity: 0.5,
        side: THREE.DoubleSide, depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      group.add(mesh);
      group.userData.mesh = mesh;
    },
    update: (group, dt, t, params, scale) => {
      const m = group.userData.mesh;
      m.scale.set(params.radius * scale, params.radius * scale, params.height * scale);
      m.material.opacity = params.opacity;
    },
  },

  {
    id: "cone",
    name: "圓錐 / 信號塔（Cone）",
    loc: [121.3010, 24.9930], city: "桃園",
    tech: "ConeGeometry，倒立 = 漏斗 / 雷達覆蓋範圍",
    desc: "ConeGeometry 是 CylinderGeometry topRadius=0 的特例。可表達：信號塔（尖朝上）、雷達覆蓋（尖朝下）、傘形範圍。",
    prompt: "在 <b>[位置]</b> 放一個高 <b>[300m]</b> 底徑 <b>[400m]</b> 的 <b>[橘紅色]</b> 倒圓錐（尖朝下），表示雷達覆蓋範圍，半透明 0.3。",
    params: [
      { id: "height", label: "高(m)", min: 100, max: 1500, step: 20, value: 500 },
      { id: "radius", label: "底徑(m)", min: 50, max: 800, step: 10, value: 300 },
      { id: "flip", label: "尖朝下", min: 0, max: 1, step: 1, value: 0 },
    ],
    build: (group) => {
      const geo = new THREE.ConeGeometry(1, 1, 32, 1, true);
      geo.translate(0, 0.5, 0);
      geo.rotateX(Math.PI / 2);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xff8866, transparent: true, opacity: 0.45,
        side: THREE.DoubleSide, depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      group.add(mesh);
      group.userData.mesh = mesh;
    },
    update: (group, dt, t, params, scale) => {
      const m = group.userData.mesh;
      m.scale.set(params.radius * scale, params.radius * scale, params.height * scale);
      if (params.flip > 0.5) {
        m.rotation.x = Math.PI;
        m.position.z = params.height * scale;
      } else {
        m.rotation.x = 0;
        m.position.z = 0;
      }
    },
  },

  {
    id: "dome",
    name: "半球 / 巨蛋（Dome）",
    loc: [120.6736, 24.1477], city: "台中",
    tech: "SphereGeometry + phiStart/phiLength 切半",
    desc: "用 SphereGeometry 的角度範圍裁出半球，可做巨蛋、保護罩、勢力範圍。內側上色 (BackSide) 可做天頂效果。",
    prompt: "在 <b>[位置]</b> 蓋一個半徑 <b>[600m]</b> 的 <b>[紫色]</b> 半圓巨蛋，半透明 0.25，雙面渲染，可看到內側結構。",
    params: [
      { id: "radius", label: "半徑(m)", min: 100, max: 2000, step: 50, value: 700 },
      { id: "opacity", label: "透明度", min: 0.05, max: 1.0, step: 0.05, value: 0.3 },
      { id: "wire", label: "線框", min: 0, max: 1, step: 1, value: 1 },
    ],
    build: (group) => {
      const geo = new THREE.SphereGeometry(1, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2);
      geo.rotateX(-Math.PI / 2); // 開口朝下，圓頂朝 +Z
      const mat = new THREE.MeshBasicMaterial({
        color: 0xb087ff, transparent: true, opacity: 0.3,
        side: THREE.DoubleSide, depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      group.add(mesh);

      const wireGeo = new THREE.WireframeGeometry(geo);
      const wireMat = new THREE.LineBasicMaterial({ color: 0xb087ff, transparent: true, opacity: 0.5 });
      const wire = new THREE.LineSegments(wireGeo, wireMat);
      group.add(wire);

      group.userData.mesh = mesh;
      group.userData.wire = wire;
    },
    update: (group, dt, t, params, scale) => {
      const r = params.radius * scale;
      group.userData.mesh.scale.set(r, r, r);
      group.userData.wire.scale.set(r, r, r);
      group.userData.mesh.material.opacity = params.opacity;
      group.userData.wire.visible = params.wire > 0.5;
    },
  },

  {
    id: "heart",
    name: "心形（Custom Shape Extrude）",
    loc: [120.4540, 23.4793], city: "嘉義",
    tech: "THREE.Shape + bezierCurveTo 畫 2D 心 → ExtrudeGeometry 推 3D",
    desc: "Shape API 可以畫任何 2D 圖形（心、星、Logo、行政區外形），再 ExtrudeGeometry 推出厚度變 3D。地圖上適合特殊地點、節慶、品牌標記。",
    prompt: "在 <b>[位置]</b> 飄 <b>[600m]</b> 高放一顆 <b>[紅色]</b> 心形（Shape + Extrude 厚度 80m），緩慢繞 Z 軸旋轉 + 呼吸脈動。",
    params: [
      { id: "size", label: "大小(m)", min: 100, max: 1500, step: 50, value: 600 },
      { id: "altitude", label: "高度(m)", min: 0, max: 2000, step: 50, value: 700 },
      { id: "spin", label: "旋轉", min: 0, max: 3, step: 0.1, value: 0.6 },
    ],
    build: (group) => {
      const shape = new THREE.Shape();
      const x = 0, y = 0;
      shape.moveTo(x + 0.25, y + 0.25);
      shape.bezierCurveTo(x + 0.25, y + 0.25, x + 0.20, y, x, y);
      shape.bezierCurveTo(x - 0.30, y, x - 0.30, y + 0.35, x - 0.30, y + 0.35);
      shape.bezierCurveTo(x - 0.30, y + 0.55, x - 0.10, y + 0.77, x + 0.25, y + 0.95);
      shape.bezierCurveTo(x + 0.60, y + 0.77, x + 0.80, y + 0.55, x + 0.80, y + 0.35);
      shape.bezierCurveTo(x + 0.80, y + 0.35, x + 0.80, y, x + 0.50, y);
      shape.bezierCurveTo(x + 0.35, y, x + 0.25, y + 0.25, x + 0.25, y + 0.25);
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: 0.18, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.025, bevelSegments: 2,
      });
      geo.center();
      geo.rotateX(Math.PI / 2); // 立起來
      const mat = new THREE.MeshBasicMaterial({
        color: 0xff5b8a, transparent: true, opacity: 0.9, side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      group.add(mesh);
      group.userData.mesh = mesh;
    },
    update: (group, dt, t, params, scale) => {
      const m = group.userData.mesh;
      const sz = params.size * scale;
      const pulse = 1 + 0.08 * Math.sin(t * 2);
      m.scale.set(sz * pulse, sz * pulse, sz * pulse);
      m.position.z = params.altitude * scale + sz * 0.5;
      m.rotation.z = t * params.spin;
    },
  },

  {
    id: "star",
    name: "五角星 Extrude",
    loc: [119.9525, 26.1496], city: "馬祖",
    tech: "10 個 Vector2 點構成五角星 Shape + ExtrudeGeometry",
    desc: "外/內交替的 10 個點 = 五角星。改點數可變八角星、十二角；改外/內半徑比變星芒粗細。可表達評分、收藏、熱門 POI。",
    prompt: "在 <b>[位置]</b> 飄一顆 <b>[黃色]</b> 五角星（外徑 700m 內徑 280m），慢轉 + 呼吸脈動。",
    params: [
      { id: "size", label: "外徑(m)", min: 100, max: 1500, step: 50, value: 700 },
      { id: "altitude", label: "高度(m)", min: 0, max: 2000, step: 50, value: 600 },
      { id: "spin", label: "旋轉", min: 0, max: 3, step: 0.1, value: 0.5 },
    ],
    build: (group) => {
      const shape = new THREE.Shape();
      const points = 5, outer = 1.0, inner = 0.4;
      for (let i = 0; i < points * 2; i++) {
        const r = i % 2 === 0 ? outer : inner;
        const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
        const x = Math.cos(a) * r, y = Math.sin(a) * r;
        if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
      }
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: 0.2, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2,
      });
      geo.center();
      geo.rotateX(Math.PI / 2);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffd54f, transparent: true, opacity: 0.95, side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      group.add(mesh);
      group.userData.mesh = mesh;
    },
    update: (group, dt, t, params, scale) => {
      const m = group.userData.mesh;
      const sz = params.size * scale;
      const pulse = 1 + 0.06 * Math.sin(t * 2.5);
      m.scale.set(sz * pulse, sz * pulse, sz * pulse);
      m.position.z = params.altitude * scale + sz * 0.5;
      m.rotation.z = t * params.spin;
    },
  },

  {
    id: "pin",
    name: "3D Pin Marker（Google 地圖風）",
    loc: [121.4406, 25.1699], city: "淡水",
    tech: "Cone（倒立）+ Sphere（頂部）+ 內白點，整體可彈跳",
    desc: "經典地圖標記：頂端球 + 底部尖錐 + 中央白點。Google Maps、Apple Maps 一看就懂。可加 bounce 表達『新通知』。",
    prompt: "在 <b>[位置]</b> 立一個 <b>[紅色]</b> Pin（高 <b>[300m]</b>），底尖朝下接地、頂端球 + 內部白點，每秒上下彈一次。",
    params: [
      { id: "size", label: "大小(m)", min: 50, max: 1000, step: 10, value: 250 },
      { id: "bounce", label: "彈跳", min: 0, max: 1, step: 1, value: 1 },
    ],
    build: (group) => {
      const matRed = new THREE.MeshBasicMaterial({ color: 0xff5b6e, transparent: true, opacity: 0.92, side: THREE.DoubleSide });
      const coneGeo = new THREE.ConeGeometry(0.45, 0.7, 24, 1, true);
      coneGeo.rotateX(-Math.PI / 2);
      coneGeo.translate(0, 0, 0.35);
      const cone = new THREE.Mesh(coneGeo, matRed);
      const sphereGeo = new THREE.SphereGeometry(0.5, 24, 16);
      sphereGeo.translate(0, 0, 0.95);
      const sphere = new THREE.Mesh(sphereGeo, matRed);
      const dotGeo = new THREE.SphereGeometry(0.18, 12, 8);
      dotGeo.translate(0, 0, 0.95);
      const dot = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
      group.add(cone); group.add(sphere); group.add(dot);
      group.userData.meshes = [cone, sphere, dot];
    },
    update: (group, dt, t, params, scale) => {
      const sz = params.size * scale;
      const lift = params.bounce > 0.5 ? Math.abs(Math.sin(t * 2.5)) * sz * 0.4 : 0;
      for (const m of group.userData.meshes) {
        m.scale.set(sz, sz, sz);
        m.position.z = lift;
      }
    },
  },

  {
    id: "crystal",
    name: "晶體（Crystal Polyhedron）",
    loc: [120.7500, 24.3833], city: "三義",
    tech: "Octahedron / Dodecahedron / Icosahedron + Wireframe overlay + 多軸旋轉",
    desc: "用內建多面體 + wireframe 線框 = 晶體 / 寶石 / 抽象 logo。改 shape 切換不同面數。3D 旋轉看每一面。",
    prompt: "在 <b>[位置]</b> 高 <b>[400m]</b> 飄一顆半徑 <b>[300m]</b> 的 <b>[淡藍]</b> 八面體，內透白線框，X/Y 雙軸慢轉。",
    params: [
      { id: "size", label: "半徑(m)", min: 100, max: 1500, step: 25, value: 400 },
      { id: "altitude", label: "高度(m)", min: 0, max: 2000, step: 50, value: 500 },
      { id: "shape", label: "形狀", min: 0, max: 3, step: 1, value: 0 },
      { id: "spinX", label: "X轉", min: 0, max: 2, step: 0.1, value: 0.5 },
      { id: "spinY", label: "Y轉", min: 0, max: 2, step: 0.1, value: 0.3 },
    ],
    build: (group) => {
      const geo = new THREE.OctahedronGeometry(1, 0);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x6cb8ff, transparent: true, opacity: 0.4, side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      group.add(mesh);
      const wireGeo = new THREE.WireframeGeometry(geo);
      const wire = new THREE.LineSegments(wireGeo, new THREE.LineBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0.85,
      }));
      group.add(wire);
      group.userData = { mesh, wire, lastShape: 0 };
    },
    update: (group, dt, t, params, scale) => {
      const sz = params.size * scale;
      const z = params.altitude * scale + sz;
      [group.userData.mesh, group.userData.wire].forEach((m) => {
        m.scale.set(sz, sz, sz);
        m.position.z = z;
        m.rotation.x = t * params.spinX;
        m.rotation.y = t * params.spinY;
      });
      const shape = Math.round(params.shape);
      if (shape !== group.userData.lastShape) {
        group.userData.lastShape = shape;
        const newGeo = shape === 0 ? new THREE.OctahedronGeometry(1, 0) :
                       shape === 1 ? new THREE.DodecahedronGeometry(1, 0) :
                       shape === 2 ? new THREE.IcosahedronGeometry(1, 0) :
                       new THREE.TetrahedronGeometry(1, 0);
        group.userData.mesh.geometry.dispose();
        group.userData.mesh.geometry = newGeo;
        group.userData.wire.geometry.dispose();
        group.userData.wire.geometry = new THREE.WireframeGeometry(newGeo);
      }
    },
  },
];
