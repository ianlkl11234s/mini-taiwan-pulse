// 光軌頂點 shader
// progress: 0.0 = 軌跡尾端（最早的點），1.0 = 軌跡前端（最新的點）
attribute float progress;
varying float vProgress;

void main() {
  vProgress = progress;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
