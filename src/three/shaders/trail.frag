// 光軌片段 shader
// 從尾端（透明）到前端（明亮）的漸層效果
uniform vec3 uColor;
uniform float uOpacity;

varying float vProgress;

void main() {
  // 非線性衰減：前端明亮，尾端快速衰減
  float alpha = pow(vProgress, 2.0) * uOpacity;

  // 前端附近增加亮度（模擬發光核心）
  float glow = smoothstep(0.85, 1.0, vProgress) * 0.5;

  vec3 color = uColor + vec3(glow);

  gl_FragColor = vec4(color, alpha);
}
