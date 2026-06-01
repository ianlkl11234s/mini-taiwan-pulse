import * as THREE from "three";

export default [
  {
    id: "skirt",
    name: "裙擺搖擺（Vertex Wave）",
    loc: [120.8214, 24.5602], city: "苗栗",
    tech: "Cylinder + vertex shader 用 sin(z + time) 做水平位移",
    desc: "在 vertex shader 把每個頂點依「高度 + 時間」加水平偏移 → 整體像水母 / 海葵 / 風中布幕擺動。位移幅度可調。",
    prompt: "在 <b>[位置]</b> 立一個 <b>[粉紅色]</b> 圓筒（高 400m 半徑 100m），頂端不動底端最大擺動 30m，像水母擺動。",
    params: [
      { id: "height", label: "高(m)", min: 100, max: 1200, step: 20, value: 500 },
      { id: "radius", label: "半徑(m)", min: 30, max: 400, step: 10, value: 120 },
      { id: "amp", label: "擺幅(m)", min: 0, max: 100, step: 1, value: 40 },
    ],
    build: (group) => {
      const geo = new THREE.CylinderGeometry(1, 1, 1, 32, 32, true);
      geo.translate(0, 0.5, 0);
      geo.rotateX(Math.PI / 2);
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uAmp: { value: 0.05 },
          uColor: { value: new THREE.Color(0xff7eb6) },
        },
        vertexShader: `
          uniform float uTime;
          uniform float uAmp;
          varying float vH;
          void main() {
            vH = position.z; // 0 底 → 1 頂
            // 底端不動（vH=0），頂端最大（vH=1）反過來：要「裙擺」就是頂不動底搖
            float wave = (1.0 - vH) * uAmp;
            float dx = sin(uTime * 2.0 + vH * 6.0) * wave;
            float dy = cos(uTime * 2.0 + vH * 6.0) * wave;
            vec3 p = position + vec3(dx, dy, 0.0);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          varying float vH;
          void main() {
            float a = mix(0.7, 0.15, vH); // 上淡下濃
            gl_FragColor = vec4(uColor, a);
          }
        `,
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      group.add(mesh);
      group.userData.mesh = mesh;
    },
    update: (group, dt, t, params, scale) => {
      const m = group.userData.mesh;
      m.scale.set(params.radius * scale, params.radius * scale, params.height * scale);
      m.material.uniforms.uTime.value = t;
      // 擺幅以「半徑佔比」傳入（shader 內 wave 是相對於 unit cylinder）
      m.material.uniforms.uAmp.value = params.amp / Math.max(params.radius, 1);
    },
  },

  {
    id: "flow",
    name: "流動漸層（Flowing Gradient）",
    loc: [120.5300, 23.7000], city: "雲林",
    tech: "圓柱 + fragment shader uv.y - time 做向上流動的色帶",
    desc: "fragment 內用 sin/sawtooth 做色帶，uv 隨時間偏移 → 看起來像能量在流。同樣技巧可水平流動表示「資料傳輸」。",
    prompt: "在 <b>[位置]</b> 立一根高 <b>[600m]</b> 的圓柱，內部有 <b>[3 條]</b> 向上流動的 <b>[藍紫漸層]</b> 色帶，每秒移動一個身位。",
    params: [
      { id: "height", label: "高(m)", min: 200, max: 1500, step: 50, value: 700 },
      { id: "radius", label: "半徑(m)", min: 30, max: 300, step: 5, value: 80 },
      { id: "speed", label: "流速", min: 0, max: 3, step: 0.1, value: 0.6 },
      { id: "bands", label: "色帶", min: 1, max: 8, step: 1, value: 3 },
    ],
    build: (group) => {
      const geo = new THREE.CylinderGeometry(1, 1, 1, 32, 1, true);
      geo.translate(0, 0.5, 0);
      geo.rotateX(Math.PI / 2);
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 }, uSpeed: { value: 0.6 }, uBands: { value: 3 },
          uColorA: { value: new THREE.Color(0x4366ff) },
          uColorB: { value: new THREE.Color(0xc44dff) },
        },
        vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `
          uniform float uTime;
          uniform float uSpeed;
          uniform float uBands;
          uniform vec3 uColorA;
          uniform vec3 uColorB;
          varying vec2 vUv;
          void main() {
            float y = vUv.y - uTime * uSpeed;
            float wave = sin(y * uBands * 6.2831);
            float band = smoothstep(0.0, 1.0, wave);
            vec3 col = mix(uColorA, uColorB, band);
            float a = (0.3 + 0.5 * band) * (1.0 - vUv.y * 0.6); // 越高越淡
            gl_FragColor = vec4(col, a);
          }
        `,
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(geo, mat);
      group.add(mesh);
      group.userData.mesh = mesh;
    },
    update: (group, dt, t, params, scale) => {
      const m = group.userData.mesh;
      m.scale.set(params.radius * scale, params.radius * scale, params.height * scale);
      m.material.uniforms.uTime.value = t;
      m.material.uniforms.uSpeed.value = params.speed;
      m.material.uniforms.uBands.value = params.bands;
    },
  },

  {
    id: "aurora",
    name: "極光飄帶（Aurora Ribbon）",
    loc: [120.9577, 23.4727], city: "玉山",
    tech: "高空 PlaneGeometry + vertex shader sin 波 + UV 滾動色帶",
    desc: "一張長平面浮在高空，vertex shader 讓它像布幕飄、fragment 內漸層色 + UV 滾動 = 極光。改顏色可變雲層、霧霾鋒面、聲波。",
    prompt: "在 <b>[位置]</b> 高空 <b>[2200m]</b> 鋪一條長 <b>[3500m]</b> 高 <b>[700m]</b> 的 <b>[綠紫]</b> 飄帶，左右波動 + 顏色上下滾動，加性混合。",
    params: [
      { id: "altitude", label: "高度(m)", min: 500, max: 5000, step: 100, value: 2200 },
      { id: "length", label: "長(m)", min: 500, max: 8000, step: 100, value: 3500 },
      { id: "height", label: "幕高(m)", min: 100, max: 2000, step: 50, value: 700 },
      { id: "amp", label: "波幅", min: 0, max: 0.5, step: 0.01, value: 0.18 },
    ],
    build: (group) => {
      const geo = new THREE.PlaneGeometry(1, 1, 64, 16);
      geo.rotateX(Math.PI / 2); // 立起來：原 +Y → +Z
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 }, uAmp: { value: 0.18 },
          uColorA: { value: new THREE.Color(0x4cffa6) },
          uColorB: { value: new THREE.Color(0xa080ff) },
        },
        vertexShader: `
          uniform float uTime; uniform float uAmp;
          varying vec2 vUv;
          void main() {
            vUv = uv;
            vec3 p = position;
            // 沿 X (uv.x) 方向波動 Y（朝南北飄）
            p.y += sin(uv.x * 6.2831 * 2.0 + uTime * 1.5) * uAmp;
            p.y += cos(uv.x * 6.2831 * 3.5 + uTime * 0.8) * uAmp * 0.4;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform vec3 uColorA;
          uniform vec3 uColorB;
          varying vec2 vUv;
          void main() {
            float scroll = vUv.y + uTime * 0.25;
            float band = sin(scroll * 6.2831) * 0.5 + 0.5;
            vec3 col = mix(uColorA, uColorB, band);
            float edgeFade = pow(sin(vUv.x * 3.14159), 0.5) * pow(1.0 - vUv.y, 0.5);
            gl_FragColor = vec4(col, edgeFade * 0.75);
          }
        `,
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(geo, mat);
      group.add(mesh);
      group.userData.mesh = mesh;
    },
    update: (group, dt, t, params, scale) => {
      const m = group.userData.mesh;
      m.scale.set(params.length * scale, 1, params.height * scale);
      m.position.z = params.altitude * scale + (params.height * scale) / 2;
      m.material.uniforms.uTime.value = t;
      m.material.uniforms.uAmp.value = params.amp;
    },
  },

  {
    id: "flag",
    name: "旗幟飄揚（Flag Wave）",
    loc: [120.3956, 23.1244], city: "二寮",
    tech: "Cylinder 旗桿 + PlaneGeometry 旗布 + vertex shader sin 隨 uv.x 漸強位移",
    desc: "桿 + 隨風波動的旗布。Vertex shader 讓 uv.x=0（接桿端）不動、uv.x=1（自由端）擺最大 = 真實飄旗動感。",
    prompt: "在 <b>[位置]</b> 立 <b>[400m]</b> 高旗桿 + <b>[300m×200m]</b> <b>[紅色]</b> 旗布，自由端隨風大幅擺動。",
    params: [
      { id: "poleHeight", label: "桿高(m)", min: 100, max: 1500, step: 25, value: 500 },
      { id: "flagW", label: "旗寬(m)", min: 100, max: 800, step: 25, value: 350 },
      { id: "flagH", label: "旗高(m)", min: 50, max: 500, step: 10, value: 220 },
      { id: "wind", label: "風", min: 0, max: 0.5, step: 0.02, value: 0.18 },
    ],
    build: (group) => {
      const poleGeo = new THREE.CylinderGeometry(1, 1, 1, 12, 1, true);
      poleGeo.translate(0, 0.5, 0);
      poleGeo.rotateX(Math.PI / 2);
      const pole = new THREE.Mesh(poleGeo, new THREE.MeshBasicMaterial({
        color: 0xaaaaaa, transparent: true, opacity: 0.95, side: THREE.DoubleSide,
      }));
      group.add(pole);

      const flagGeo = new THREE.PlaneGeometry(1, 1, 32, 16);
      flagGeo.rotateX(Math.PI / 2);
      const flagMat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 }, uWind: { value: 0.15 },
          uColor: { value: new THREE.Color(0xff5b6e) },
        },
        vertexShader: `
          uniform float uTime;
          uniform float uWind;
          varying vec2 vUv;
          void main() {
            vUv = uv;
            vec3 p = position;
            float wave = uv.x * uWind;
            p.y += sin(uTime * 4.0 + uv.x * 6.0) * wave;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          varying vec2 vUv;
          void main() { gl_FragColor = vec4(uColor, 0.92); }
        `,
        transparent: true, side: THREE.DoubleSide,
      });
      const flag = new THREE.Mesh(flagGeo, flagMat);
      group.add(flag);
      group.userData = { pole, flag };
    },
    update: (group, dt, t, params, scale) => {
      const ph = params.poleHeight * scale;
      const fw = params.flagW * scale;
      const fh = params.flagH * scale;
      group.userData.pole.scale.set(scale * 8, scale * 8, ph);
      group.userData.flag.position.set(fw / 2, 0, ph - fh / 2);
      group.userData.flag.scale.set(fw, 1, fh);
      group.userData.flag.material.uniforms.uTime.value = t;
      group.userData.flag.material.uniforms.uWind.value = params.wind;
    },
  },
];
