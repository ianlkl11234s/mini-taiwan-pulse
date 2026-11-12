/**
 * City Sound Atlas 通用網格渲染器（W6-1；之後各聲源網格共用）。
 *
 * 輸入：gridSpec（src/sound/grid/gridSpec.json）＋一幀 Uint8Array（長度 cols×rows，cellIndex = row·cols + col）＋色階（256 色表）。
 * - 值 0–254：查 256×1 RGBA 色表（alpha 0 → 不畫）；之後連續值的家族（0 無、1–254 潛勢）用同一張表即可。
 * - 值 255：無法判斷 → 畫斜線（螢幕空間 8 px 週期，縮放不變），不畫成淺色或透明。
 * - 遮罩（縣市範圍外）：不畫。
 *
 * 做法選擇：自訂 WebGL 圖層（模仿 transitReachCustomLayer）。
 * - 一張 292×285 LUMINANCE_ALPHA 貼圖（L＝值、A＝遮罩），NEAREST 取樣；換幀＝一次 texSubImage2D（約 166 KB），量測 < 1 ms。
 * - feature-state／setData 換 3.8 萬格太慢（transitReach 原型實測 0.9 fps）；image source 換圖要經 canvas／data URL，
 *   斜線也不能保持固定螢幕寬度。
 * - 幾何：每一列網格一條四邊形（286 組頂點），頂點帶 (col, row) 網格座標 → 片段裡 floor() 就是格子；
 *   列界恰好落在頂點上，所以等經緯網格的南北非線性（Web Mercator）不會讓格子錯列。
 * - 自訂圖層不參與 queryRenderedFeatures：不擋住底下圖層的點選；本層的 popup 由 useMapInteraction 以 cellIndexOf 查格。
 * - 地球投影（本站 zoom < 6）：不畫（網格只有北北，低縮放看不出格子）。
 * - 換底圖時 Mapbox 會 onRemove／onAdd：幀、色表留在閉包，重掛時重新上傳。
 */
import type { CustomLayerInterface, Map as MapboxMap } from "mapbox-gl";
import { GRID_SPEC } from "../sound/grid/gridSpec";

const VS = `
precision highp float;
attribute vec2 a_merc;
attribute vec2 a_grid;
uniform mat4 u_matrix;
varying vec2 v_grid;
void main() {
  gl_Position = u_matrix * vec4(a_merc, 0.0, 1.0);
  v_grid = a_grid;
}`;

const FS = `
precision highp float;
uniform sampler2D u_vals;
uniform sampler2D u_pal;
uniform vec2 u_size;
uniform float u_opacity;
uniform vec4 u_hatch;
varying vec2 v_grid;
void main() {
  vec2 cell = clamp(floor(v_grid), vec2(0.0), u_size - 1.0);
  vec4 s = texture2D(u_vals, (cell + 0.5) / u_size);
  if (s.a < 0.5) discard;                       // 範圍外
  float v = floor(s.r * 255.0 + 0.5);
  if (v > 254.5) {                              // 255 無法判斷：斜線
    if (mod(gl_FragCoord.x + gl_FragCoord.y, 8.0) > 2.0) discard;
    float a = u_hatch.a * u_opacity;
    gl_FragColor = vec4(u_hatch.rgb * a, a);
    return;
  }
  vec4 c = texture2D(u_pal, vec2((v + 0.5) / 256.0, 0.5));
  float a = c.a * u_opacity;
  if (a <= 0.0) discard;
  gl_FragColor = vec4(c.rgb * a, a);
}`;

const mercX = (lng: number) => (lng + 180) / 360;
const mercY = (lat: number) => (1 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / Math.PI) / 2;

/** 「#rrggbb」＋ alpha → [r,g,b,a] 0–255 */
export function hexToRgba255(hex: string, alpha: number): [number, number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), Math.round(Math.max(0, Math.min(1, alpha)) * 255)];
}

/** 分級色階 → 256×4 色表（未定義的值 alpha 0，不畫） */
export function paletteFromClasses(colors: readonly string[], alphas: readonly number[]): Uint8Array {
  const out = new Uint8Array(256 * 4);
  colors.forEach((c, i) => out.set(hexToRgba255(c, alphas[i] ?? 1), i * 4));
  return out;
}

export interface SoundGridLayerOptions {
  id: string;
  getOpacity: () => number;
  /** 長度 cols×rows：1＝範圍內（畫）、0＝範圍外（不畫） */
  mask: Uint8Array;
  /** 斜線色與不透明度 */
  hatch: { color: string; alpha: number };
  /** 每次換幀上傳貼圖的 CPU 時間（量測用） */
  onUploadMs?: (ms: number) => void;
}

export interface SoundGridLayer extends CustomLayerInterface {
  /** 一幀網格值；null＝不畫 */
  setFrame(values: Uint8Array | null): void;
  /** 256×4 RGBA */
  setPalette(rgba: Uint8Array): void;
}

export function createSoundGridLayer(opts: SoundGridLayerOptions): SoundGridLayer {
  const { cols, rows } = GRID_SPEC;
  const cells = cols * rows;
  let map: MapboxMap | null = null;
  let gl: WebGLRenderingContext | null = null;
  let prog: WebGLProgram | null = null;
  let vbuf: WebGLBuffer | null = null, ibuf: WebGLBuffer | null = null;
  let valTex: WebGLTexture | null = null, palTex: WebGLTexture | null = null;
  const loc: Record<string, WebGLUniformLocation | number | null> = {};
  let nIdx = 0;
  let frame: Uint8Array | null = null;
  let palette: Uint8Array = new Uint8Array(256 * 4);
  const staging = new Uint8Array(cells * 2);
  for (let i = 0; i < cells; i++) staging[i * 2 + 1] = opts.mask[i] ? 255 : 0;
  const hatch = hexToRgba255(opts.hatch.color, opts.hatch.alpha).map((x) => x / 255);

  const uploadFrame = () => {
    if (!gl || !valTex) return;
    const t0 = performance.now();
    if (frame) for (let i = 0; i < cells; i++) staging[i * 2] = frame[i]!;
    gl.bindTexture(gl.TEXTURE_2D, valTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, cols, rows, gl.LUMINANCE_ALPHA, gl.UNSIGNED_BYTE, staging);
    opts.onUploadMs?.(performance.now() - t0);
    map?.triggerRepaint();
  };
  const uploadPalette = () => {
    if (!gl || !palTex) return;
    gl.bindTexture(gl.TEXTURE_2D, palTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, palette);
    map?.triggerRepaint();
  };
  const makeTex = (c: WebGLRenderingContext) => {
    const t = c.createTexture()!;
    c.bindTexture(c.TEXTURE_2D, t);
    for (const [k, v] of [[c.TEXTURE_MIN_FILTER, c.NEAREST], [c.TEXTURE_MAG_FILTER, c.NEAREST], [c.TEXTURE_WRAP_S, c.CLAMP_TO_EDGE], [c.TEXTURE_WRAP_T, c.CLAMP_TO_EDGE]] as const) c.texParameteri(c.TEXTURE_2D, k, v);
    return t;
  };

  return {
    id: opts.id,
    type: "custom" as const,
    renderingMode: "2d" as const,

    onAdd(m: MapboxMap, context: WebGLRenderingContext) {
      map = m; gl = context;
      const mk = (type: number, src: string) => {
        const sh = context.createShader(type)!;
        context.shaderSource(sh, src); context.compileShader(sh);
        if (!context.getShaderParameter(sh, context.COMPILE_STATUS)) throw new Error(context.getShaderInfoLog(sh) ?? "shader compile failed");
        return sh;
      };
      prog = context.createProgram()!;
      context.attachShader(prog, mk(context.VERTEX_SHADER, VS)); context.attachShader(prog, mk(context.FRAGMENT_SHADER, FS));
      context.linkProgram(prog);
      if (!context.getProgramParameter(prog, context.LINK_STATUS)) throw new Error(context.getProgramInfoLog(prog) ?? "program link failed");
      for (const n of ["a_merc", "a_grid"]) loc[n] = context.getAttribLocation(prog, n);
      for (const n of ["u_matrix", "u_vals", "u_pal", "u_size", "u_opacity", "u_hatch"]) loc[n] = context.getUniformLocation(prog, n);
      // 每列一條四邊形：頂點 (merc x, merc y, col, row)
      const verts = new Float32Array((rows + 1) * 2 * 4);
      const east = GRID_SPEC.west + cols * GRID_SPEC.dLon;
      for (let r = 0; r <= rows; r++) {
        const lat = GRID_SPEC.north - r * GRID_SPEC.dLat;
        const y = mercY(lat);
        verts.set([mercX(GRID_SPEC.west), y, 0, r, mercX(east), y, cols, r], r * 8);
      }
      const idx = new Uint16Array(rows * 6);
      for (let r = 0; r < rows; r++) {
        const a = r * 2, b = a + 1, c = a + 2, d = a + 3;
        idx.set([a, b, c, b, d, c], r * 6);
      }
      nIdx = idx.length;
      vbuf = context.createBuffer(); context.bindBuffer(context.ARRAY_BUFFER, vbuf); context.bufferData(context.ARRAY_BUFFER, verts, context.STATIC_DRAW);
      ibuf = context.createBuffer(); context.bindBuffer(context.ELEMENT_ARRAY_BUFFER, ibuf); context.bufferData(context.ELEMENT_ARRAY_BUFFER, idx, context.STATIC_DRAW);
      valTex = makeTex(context);
      context.pixelStorei(context.UNPACK_ALIGNMENT, 1);
      context.texImage2D(context.TEXTURE_2D, 0, context.LUMINANCE_ALPHA, cols, rows, 0, context.LUMINANCE_ALPHA, context.UNSIGNED_BYTE, staging);
      palTex = makeTex(context);
      uploadPalette();
      uploadFrame();
    },

    render(context: WebGLRenderingContext, matrix: number[], projection?: { name?: string }, _globeToMerc?: number[], transition?: number) {
      if (!prog || !frame || !valTex || !palTex) return;
      if (projection?.name === "globe" && (transition ?? 0) < 1) return;
      const g = context;
      g.useProgram(prog);
      g.uniformMatrix4fv(loc.u_matrix as WebGLUniformLocation, false, matrix);
      g.uniform2f(loc.u_size as WebGLUniformLocation, cols, rows);
      g.uniform1f(loc.u_opacity as WebGLUniformLocation, Math.max(0, Math.min(1, opts.getOpacity())));
      g.uniform4f(loc.u_hatch as WebGLUniformLocation, hatch[0]!, hatch[1]!, hatch[2]!, hatch[3]!);
      g.activeTexture(g.TEXTURE0); g.bindTexture(g.TEXTURE_2D, valTex); g.uniform1i(loc.u_vals as WebGLUniformLocation, 0);
      g.activeTexture(g.TEXTURE1); g.bindTexture(g.TEXTURE_2D, palTex); g.uniform1i(loc.u_pal as WebGLUniformLocation, 1);
      const aM = loc.a_merc as number, aG = loc.a_grid as number;
      g.bindBuffer(g.ARRAY_BUFFER, vbuf);
      g.enableVertexAttribArray(aM); g.vertexAttribPointer(aM, 2, g.FLOAT, false, 16, 0);
      g.enableVertexAttribArray(aG); g.vertexAttribPointer(aG, 2, g.FLOAT, false, 16, 8);
      g.bindBuffer(g.ELEMENT_ARRAY_BUFFER, ibuf);
      g.enable(g.BLEND); g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA); g.disable(g.DEPTH_TEST);
      g.drawElements(g.TRIANGLES, nIdx, g.UNSIGNED_SHORT, 0);
      g.disableVertexAttribArray(aM); g.disableVertexAttribArray(aG);
      g.activeTexture(g.TEXTURE0);
    },

    onRemove(_m: MapboxMap, context: WebGLRenderingContext) {
      for (const b of [vbuf, ibuf]) if (b) context.deleteBuffer(b);
      for (const t of [valTex, palTex]) if (t) context.deleteTexture(t);
      if (prog) context.deleteProgram(prog);
      vbuf = ibuf = null; valTex = palTex = null; prog = null; gl = null; map = null;
    },

    setFrame(values) {
      frame = values;
      if (values) uploadFrame();
      else map?.triggerRepaint();
    },
    setPalette(rgba) {
      palette = rgba;
      uploadPalette();
    },
  };
}
