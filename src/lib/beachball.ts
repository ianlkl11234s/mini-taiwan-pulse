/**
 * 震源機制解沙灘球（focal mechanism beachball）純函式模組。零依賴，純數學 + 字串組裝。
 *
 * 座標慣例：N（北）= x, E（東）= y, D（垂直向下）= z（NED，右手座標系）。
 * 繪圖慣例：北上東右（standard map view）。
 *
 * 演算法（double-couple 標準沙灘球）：
 * 1. 由 strike/dip/rake 求斷層面法向量 n̂ 與滑動向量 d̂（Aki & Richards 慣例）。
 * 2. Double-couple 的對偶性質：d̂ 同時是第二節面（auxiliary plane）的法向量，
 *    n̂ 同時是第二節面的滑動向量 —— 因此不需要另外求 strike2/dip2/rake2 也能畫圖，
 *    但仍提供 auxiliaryPlane() 供顯示 / 驗證用。
 * 3. 下半球等面積投影（Lower-hemisphere equal-area / Schmidt）：對投影圓盤上每一點，
 *    反推其在焦點球面上對應的方向向量 r̂，以 sign((n̂·r̂)(d̂·r̂)) 判斷該方向是壓縮（P 波初動
 *    離源，正）還是拉張（負）。正值＝壓縮象限＝填 fillColor；負值＝拉張＝留白（bgColor）。
 * 4. 以掃描 raster grid + 同列連續格 RLE 合併成矩形，組出壓縮區塊的 SVG path，
 *    再用 <clipPath> 裁成正圓，避免格線在圓周留下鋸齒。
 *
 * 此法對任何 strike/dip/rake 組合都是純數值運算（點積 + 反三角函數），不會因為
 * dip=90（垂直斷層）、rake=±90（純逆/正斷層）、rake=0/180（純走滑）而出現除以零或 NaN。
 */

/** 震源機制解輸入（單一節面的 strike/dip/rake，度） */
export interface FocalMechanism {
  /** 走向，度，0-360，由北順時針量起 */
  strike: number;
  /** 傾角，度，0-90 */
  dip: number;
  /** 滑動角，度，-180~180（Aki-Richards 慣例：0=左移、±180=右移、90=逆斷層、-90=正斷層） */
  rake: number;
}

/** 節面參數（strike/dip/rake），auxiliaryPlane() 回傳型別，與 FocalMechanism 同形狀 */
export type NodalPlane = FocalMechanism;

export interface BeachballOptions {
  /** SVG 邊長（正方形），預設 60 */
  size?: number;
  /** 壓縮象限填色，預設深灰藍 */
  fillColor?: string;
  /** 拉張象限（背景圓盤）填色，預設白色 */
  bgColor?: string;
  /** 外圍圓框線色，預設同 fillColor */
  strokeColor?: string;
  /** raster 網格解析度（越高越平滑但字串越長），預設 96 */
  resolution?: number;
}

/** NED 座標系下的 3D 單位向量 */
type Vec3 = readonly [number, number, number];

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/**
 * 由 strike/dip/rake 求斷層面法向量 n̂ 與滑動向量 d̂（NED 座標，單位向量）。
 *
 * 推導：走向向量 ŝ = (cosφ, sinφ, 0)；下傾向量 d̂dip = (-cosδ sinφ, cosδ cosφ, sinδ)
 * （水平方位角為走向+90°、再往下傾 δ 角）；兩者正交張出斷層面。
 * 法向量 n̂ 與滑動向量的公式為 Aki & Richards (1980) 標準式，已用 4 筆真實地震
 * moment tensor 資料（strike1/dip1/rake1 → 反推 strike2/dip2/rake2）數值驗證一致。
 */
export function nodalVectors(mechanism: FocalMechanism): { normal: Vec3; slip: Vec3 } {
  const phi = toRad(mechanism.strike);
  const delta = toRad(mechanism.dip);
  const lambda = toRad(mechanism.rake);

  const sinD = Math.sin(delta);
  const cosD = Math.cos(delta);
  const sinP = Math.sin(phi);
  const cosP = Math.cos(phi);
  const sinL = Math.sin(lambda);
  const cosL = Math.cos(lambda);

  const normal: Vec3 = [-sinD * sinP, sinD * cosP, -cosD];
  const slip: Vec3 = [
    cosL * cosP + cosD * sinL * sinP,
    cosL * sinP - cosD * sinL * cosP,
    -sinL * sinD,
  ];
  return { normal, slip };
}

/**
 * 由節面 1 的法向量反推 strike/dip（供 auxiliaryPlane 重用）。
 * n 的 D 分量須 ≤ 0（對應 dip ∈ [0,90]）；若給的向量 D 分量 > 0，呼叫端需自行先取反。
 */
function strikeDipFromNormal(n: Vec3): { strike: number; dip: number } {
  const cosDip = clamp(-n[2], -1, 1);
  const dip = Math.acos(cosDip);
  const strike = Math.atan2(-n[0], n[1]);
  return { strike: toDeg(strike), dip: toDeg(dip) };
}

/**
 * 求第二節面（auxiliary plane）。
 *
 * Double-couple 對偶性質：節面 1 的滑動向量 d̂ 即為節面 2 的法向量；節面 1 的法向量 n̂
 * 即為節面 2 的滑動向量。法向量方向本身有正負號自由度（同一平面兩個法向量互為反向），
 * 為符合 dip ∈ [0,90] 的慣例，若 d̂ 的垂直分量 > 0 則整組（法向量＋對應滑動向量）一起
 * 取反，維持兩者相對關係不變。
 */
export function auxiliaryPlane(mechanism: FocalMechanism): NodalPlane {
  const { normal, slip } = nodalVectors(mechanism);

  let n2 = slip;
  let slip2 = normal;
  if (n2[2] > 0) {
    n2 = [-n2[0], -n2[1], -n2[2]];
    slip2 = [-slip2[0], -slip2[1], -slip2[2]];
  }

  const { strike: strike2, dip: dip2 } = strikeDipFromNormal(n2);
  const phi2 = toRad(strike2);
  const delta2 = toRad(dip2);

  // 節面 2 自己的走向向量、下傾向量，用來把 slip2 分解出 rake2
  const s2: Vec3 = [Math.cos(phi2), Math.sin(phi2), 0];
  const dDip2: Vec3 = [-Math.cos(delta2) * Math.sin(phi2), Math.cos(delta2) * Math.cos(phi2), Math.sin(delta2)];

  const cosLam2 = dot(slip2, s2);
  const sinLam2 = -dot(slip2, dDip2);
  const rake2 = toDeg(Math.atan2(sinLam2, cosLam2));

  return { strike: (strike2 + 360) % 360, dip: dip2, rake: rake2 };
}

/** 一個壓縮象限的矩形（normalized 座標，u=東, v=北, 皆為 [-1,1]） */
interface FillRect {
  u0: number;
  u1: number;
  v0: number;
  v1: number;
}

/**
 * 下半球等面積（Schmidt）投影：把圓盤內 normalized 座標 (u,v)（u=東, v=北, 半徑 ≤1）
 * 反推成焦點球面下半球方向向量 r̂ = (N,E,D)。
 *
 * r(ψ) = √2 · sin(ψ/2)，ψ 為與正下方（nadir）的夾角，ψ=0 對應圓心（正下方），
 * ψ=90° 對應圓周（水平方向）。方位角 θ 為北順時針量起的羅盤方位。
 */
function unprojectLowerHemisphere(u: number, v: number): Vec3 {
  const r = Math.min(1, Math.hypot(u, v)); // clamp 避免浮點誤差略超過 1
  const psi = 2 * Math.asin(r / Math.SQRT2);
  const theta = Math.atan2(u, v); // 北=0，順時針往東增加
  const sinPsi = Math.sin(psi);
  const cosPsi = Math.cos(psi);
  return [sinPsi * Math.cos(theta), sinPsi * Math.sin(theta), cosPsi];
}

/**
 * 掃描 raster grid，判斷圓盤內每格屬於壓縮還是拉張象限，同列連續格合併成矩形（RLE），
 * 回傳壓縮象限的矩形清單（normalized -1..1 座標）。
 */
function computeCompressionRects(mechanism: FocalMechanism, resolution: number): FillRect[] {
  const { normal, slip } = nodalVectors(mechanism);
  const rects: FillRect[] = [];
  const step = 2 / resolution;

  for (let row = 0; row < resolution; row++) {
    // v: 由上（北, +1）掃到下（南, -1）
    const v = 1 - (row + 0.5) * step;
    const vTop = 1 - row * step;
    const vBottom = vTop - step;

    let runStart: number | null = null;
    for (let col = 0; col < resolution; col++) {
      const u = -1 + (col + 0.5) * step;
      const inDisk = u * u + v * v <= 1;
      let compressional = false;
      if (inDisk) {
        const r = unprojectLowerHemisphere(u, v);
        const fn = dot(normal, r);
        const fd = dot(slip, r);
        compressional = fn * fd > 0;
      }

      if (compressional && runStart === null) {
        runStart = col;
      } else if (!compressional && runStart !== null) {
        rects.push({ u0: -1 + runStart * step, u1: -1 + col * step, v0: vBottom, v1: vTop });
        runStart = null;
      }
    }
    if (runStart !== null) {
      rects.push({ u0: -1 + runStart * step, u1: 1, v0: vBottom, v1: vTop });
    }
  }
  return rects;
}

/**
 * 判斷投影圓盤內某 normalized 座標 (u=東, v=北, 皆為 [-1,1]) 是否落在壓縮象限。
 * 供測試 / 除錯使用，核心繪圖邏輯（computeCompressionRects）內部也是靠同一判斷式掃描。
 */
export function isCompressional(mechanism: FocalMechanism, u: number, v: number): boolean {
  const { normal, slip } = nodalVectors(mechanism);
  const r = unprojectLowerHemisphere(u, v);
  return dot(normal, r) * dot(slip, r) > 0;
}

let uidCounter = 0;

/** 組出完整 `<svg>...</svg>` 字串。可直接用於 `<img src="data:image/svg+xml;utf8,...">` 或 dangerouslySetInnerHTML。 */
export function beachballSvg(mechanism: FocalMechanism, options: BeachballOptions = {}): string {
  const size = options.size ?? 60;
  const fillColor = options.fillColor ?? "#1e293b";
  const bgColor = options.bgColor ?? "#ffffff";
  const strokeColor = options.strokeColor ?? fillColor;
  const resolution = options.resolution ?? 96;

  const cx = size / 2;
  const cy = size / 2;
  const strokeWidth = Math.max(1, size * 0.03);
  const R = size / 2 - strokeWidth / 2;

  const rects = computeCompressionRects(mechanism, resolution);
  // normalized (u,v) -> SVG 座標：x 右移、y 反向（SVG y 往下為正，v=北=上）
  const toX = (u: number) => cx + u * R;
  const toY = (v: number) => cy - v * R;

  const fillPathD = rects
    .map((r) => {
      const x0 = toX(r.u0).toFixed(3);
      const x1 = toX(r.u1).toFixed(3);
      const y0 = toY(r.v1).toFixed(3); // v1（較大）對應較小的 svg y
      const y1 = toY(r.v0).toFixed(3);
      return `M${x0} ${y0}H${x1}V${y1}H${x0}Z`;
    })
    .join("");

  const uid = `bb${uidCounter++}`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`,
    `<defs><clipPath id="${uid}-clip"><circle cx="${cx}" cy="${cy}" r="${R}"/></clipPath></defs>`,
    `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${bgColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>`,
    fillPathD ? `<path d="${fillPathD}" fill="${fillColor}" clip-path="url(#${uid}-clip)"/>` : "",
    `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>`,
    `</svg>`,
  ].join("");
}

/** 包成 `data:image/svg+xml` URI，供 `<img src>` 或 Mapbox marker element 直接使用 */
export function beachballDataUri(mechanism: FocalMechanism, options: BeachballOptions = {}): string {
  const svg = beachballSvg(mechanism, options);
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
