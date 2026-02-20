// 發光球體片段 shader
// 從中心到邊緣的放射狀漸層衰減
uniform vec3 uColor;
uniform float uOpacity;
uniform float uTime;

varying vec2 vUv;

void main() {
  // 從中心到邊緣的距離
  vec2 center = vUv - 0.5;
  float dist = length(center) * 2.0;

  // 高斯式衰減
  float glow = exp(-dist * dist * 3.0) * uOpacity;

  // 呼吸效果：輕微亮度脈動
  float pulse = 1.0 + sin(uTime * 2.0) * 0.1;

  gl_FragColor = vec4(uColor * pulse, glow);
}
