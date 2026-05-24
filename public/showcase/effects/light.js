import * as THREE from "three";

export default [
  {
    id: "beam",
    name: "光柱 / 雷射（Light Beam）",
    loc: [120.3014, 22.6273], city: "高雄",
    tech: "Cylinder + 自製 fragment shader 做垂直漸層 + 加性混合",
    desc: "薄圓柱 + 由下到上漸隱的漸層 + AdditiveBlending = 賽博龐克光柱。可疊兩層（細核 + 外暈）增加質感。",
    prompt: "在 <b>[位置]</b> 射出一根高 <b>[800m]</b> 半徑 <b>[15m]</b> 的 <b>[青色]</b> 光柱，由下而上由濃變淡，加性混合，外圍再加一層更寬更淡的暈。",
    params: [
      { id: "height", label: "高(m)", min: 200, max: 3000, step: 50, value: 1200 },
      { id: "radius", label: "半徑(m)", min: 5, max: 100, step: 1, value: 25 },
      { id: "intensity", label: "亮度", min: 0.1, max: 3.0, step: 0.1, value: 1.5 },
    ],
    build: (group) => {
      const beamShader = (intensity, ringMult) => new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color(0x6cf6ff) },
          uIntensity: { value: intensity },
          uRing: { value: ringMult },
        },
        vertexShader: `
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          uniform float uIntensity;
          uniform float uRing;
          varying vec2 vUv;
          void main() {
            float topFade = pow(1.0 - vUv.y, 1.5);            // 上淡下濃
            float edgeFade = pow(1.0 - abs(vUv.x - 0.5) * 2.0, 2.0); // 邊緣淡
            float a = topFade * edgeFade * uIntensity * uRing;
            gl_FragColor = vec4(uColor, a);
          }
        `,
        transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      });

      // 內核：細
      const coreGeo = new THREE.CylinderGeometry(1, 1, 1, 24, 1, true);
      coreGeo.translate(0, 0.5, 0);
      coreGeo.rotateX(Math.PI / 2);
      const core = new THREE.Mesh(coreGeo, beamShader(1.0, 1.0));
      group.add(core);

      // 外暈：寬
      const haloGeo = new THREE.CylinderGeometry(1, 1, 1, 24, 1, true);
      haloGeo.translate(0, 0.5, 0);
      haloGeo.rotateX(Math.PI / 2);
      const halo = new THREE.Mesh(haloGeo, beamShader(0.4, 0.6));
      group.add(halo);

      group.userData.core = core;
      group.userData.halo = halo;
    },
    update: (group, dt, t, params, scale) => {
      const { core, halo } = group.userData;
      core.scale.set(params.radius * scale, params.radius * scale, params.height * scale);
      halo.scale.set(params.radius * 3 * scale, params.radius * 3 * scale, params.height * scale);
      core.material.uniforms.uIntensity.value = params.intensity;
      halo.material.uniforms.uIntensity.value = params.intensity * 0.4;
    },
  },

  {
    id: "lightcone",
    name: "體積光柱 / God Rays",
    loc: [121.2900, 24.8800], city: "大溪",
    tech: "頂點到底圓的 LineSegments 多條光線 + 半透明圓錐外殼",
    desc: "從天上一點射下無數光線到地面 + 半透明圓錐殼 = 神之光、聚光燈、UFO 光束。光線可旋轉 + 脈動。",
    prompt: "在 <b>[位置]</b> 從高 <b>[1200m]</b> 一點射下 <b>[20 條]</b> <b>[淡黃色]</b> 光線到地面圓周 <b>[600m]</b> 半徑，整體緩慢旋轉。",
    params: [
      { id: "radius", label: "底徑(m)", min: 100, max: 2000, step: 50, value: 700 },
      { id: "height", label: "高(m)", min: 200, max: 3000, step: 100, value: 1200 },
      { id: "spin", label: "旋轉", min: 0, max: 3, step: 0.1, value: 0.4 },
    ],
    build: (group) => {
      const positions = [];
      const N = 24;
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2;
        positions.push(0, 0, 1);
        positions.push(Math.cos(a), Math.sin(a), 0);
      }
      const lineGeo = new THREE.BufferGeometry();
      lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      const lineMat = new THREE.LineBasicMaterial({
        color: 0xfff0a0, transparent: true, opacity: 0.55,
        blending: THREE.AdditiveBlending,
      });
      const lines = new THREE.LineSegments(lineGeo, lineMat);
      group.add(lines);

      const coneGeo = new THREE.ConeGeometry(1, 1, 32, 1, true);
      coneGeo.rotateX(-Math.PI / 2);
      coneGeo.translate(0, 0, 0.5);
      const coneMat = new THREE.MeshBasicMaterial({
        color: 0xfff0a0, transparent: true, opacity: 0.18,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      });
      const cone = new THREE.Mesh(coneGeo, coneMat);
      group.add(cone);
      group.userData = { lines, cone };
    },
    update: (group, dt, t, params, scale) => {
      const r = params.radius * scale;
      const h = params.height * scale;
      group.userData.lines.scale.set(r, r, h);
      group.userData.cone.scale.set(r, r, h);
      group.userData.lines.rotation.z = t * params.spin;
      const pulse = 0.5 + 0.4 * Math.sin(t * 2);
      group.userData.lines.material.opacity = 0.4 + 0.4 * pulse;
    },
  },

  {
    id: "neon",
    name: "霓虹線條（Neon Path）",
    loc: [121.8714, 24.5839], city: "南方澳",
    tech: "TubeGeometry 沿 CatmullRom curve + 內細外粗雙層 AdditiveBlending + 呼吸",
    desc: "彎曲管道 = 霓虹招牌、發光導線、光束軌跡。內白核 + 外粉暈兩層疊加 = 強烈發光感。改 curve 路徑變不同形狀。",
    prompt: "在 <b>[位置]</b> 畫一條 <b>[粉色]</b> 霓虹彎管 <b>[1500m]</b> 範圍，內白核外粉暈，<b>[每 0.3 秒]</b> 脈動一次。",
    params: [
      { id: "size", label: "範圍(m)", min: 200, max: 3000, step: 100, value: 1500 },
      { id: "haloR", label: "暈半徑", min: 0.02, max: 0.15, step: 0.005, value: 0.06 },
    ],
    build: (group) => {
      const points = [
        new THREE.Vector3(-1, 0, 0.1),
        new THREE.Vector3(-0.5, 0.7, 0.4),
        new THREE.Vector3(0.5, -0.5, 0.5),
        new THREE.Vector3(1, 0.3, 0.2),
      ];
      const curve = new THREE.CatmullRomCurve3(points);
      const coreGeo = new THREE.TubeGeometry(curve, 64, 0.012, 8, false);
      const core = new THREE.Mesh(coreGeo, new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 1,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      group.add(core);
      const haloGeo = new THREE.TubeGeometry(curve, 64, 0.06, 8, false);
      const halo = new THREE.Mesh(haloGeo, new THREE.MeshBasicMaterial({
        color: 0xff5b9e, transparent: true, opacity: 0.45,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      group.add(halo);
      group.userData = { core, halo, curve, lastHaloR: -1 };
    },
    update: (group, dt, t, params, scale) => {
      const sz = params.size * scale;
      group.userData.core.scale.set(sz, sz, sz);
      group.userData.halo.scale.set(sz, sz, sz);
      if (Math.abs(params.haloR - group.userData.lastHaloR) > 1e-4) {
        group.userData.lastHaloR = params.haloR;
        group.userData.halo.geometry.dispose();
        group.userData.halo.geometry = new THREE.TubeGeometry(group.userData.curve, 64, params.haloR, 8, false);
      }
      const pulse = 0.6 + 0.4 * Math.sin(t * 3);
      group.userData.core.material.opacity = pulse;
      group.userData.halo.material.opacity = pulse * 0.5;
    },
  },
];
