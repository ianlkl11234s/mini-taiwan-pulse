/** Fixed-camera, manually drafted image geometry, reviewed against 2026-09-28 frames.
 * Quad order: far left/right, near right/left. Dimensions are visual assumptions.
 * These are neither surveyed ground coordinates nor verified speed calibration.
 */
export const CAMERA_CONFIGS = {
  T000354: {
    assumedViewDirection: 'N', viewDirectionBasis: '使用者確認朝北；畫面右為東，地面尺度未校正',
    crossStreetName: '敦化南路',
    label: '南北交叉道路與路口・人工初設', roi: [[.29,.21],[.63,.21],[.95,.53],[1,1],[0,1],[0,.49]],
    countLine: [[.08,.62],[.85,.62]],
    perspectiveQuad: [[.30,.23],[.62,.23],[.97,.96],[.02,.96]],
    approximateWidthMeters: 24, approximateLengthMeters: 85,
    calibration: {verified:false, status:'manual-perspective-approximation'},
    notes: '固定前景設備另有遮罩；A/B為影像線兩側，此線主要計數南北交叉道路，不是信義路東向流量。',
  },
  T000330: {
    assumedViewDirection: 'N', viewDirectionBasis: '使用者確認朝北；畫面右為東，地面尺度未校正',
    crossStreetName: '交叉道路（名稱待確認）',
    label: '南北交叉道路與路口・人工初設', roi: [[.57,.23],[.73,.23],[.82,.5],[1,.58],[1,1],[.03,1],[.12,.58],[.44,.44]],
    countLine: [[.15,.70],[.97,.70]],
    perspectiveQuad: [[.58,.25],[.72,.25],[.97,.96],[.12,.96]],
    approximateWidthMeters: 22, approximateLengthMeters: 85,
    calibration: {verified:false, status:'manual-perspective-approximation'},
    notes: '排除左側站體，路口橫向車仍可能入ROI；跨線量主要為交叉道路，非信義路東向量或轉向量。',
  },
  T000283: {
    assumedViewDirection: 'N', viewDirectionBasis: '使用者確認朝北；畫面右為東，地面尺度未校正',
    crossStreetName: '交叉道路（名稱待確認）',
    label: '路口至近端道路・人工初設', roi: [[.29,.22],[.67,.22],[1,.48],[1,1],[.02,1],[.02,.48]],
    countLine: [[.08,.61],[.96,.61]],
    perspectiveQuad: [[.30,.24],[.66,.24],[.99,.96],[.04,.96]],
    approximateWidthMeters: 24, approximateLengthMeters: 85,
    calibration: {verified:false, status:'manual-perspective-approximation'},
    notes: '包含路口可見區；橫向／轉彎尚未按入口出口分類，不宣稱完整路口流量。',
  },
};
