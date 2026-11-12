"""City Sound Atlas W6-1：雷達回波 → 雨勢分級的純函式（無 I/O，供 build-sound-radar-rain.py 與單元測試共用）。

雨勢門檻、Z-R 係數讀 src/sound/grid/rainClasses.json（前端 src/sound/grid/rainClass.ts 讀同一份）。

dBZ 碼（uint8）：0 = 無回波（透明）、1–66 = 色塊 0–65 dBZ 再加 1、255 = 無法判斷（缺幀、雜波、表外顏色）。

時間一致性雜波濾波（假設，常數見下）：
  某格在第 i 幀回波 ≥ CLUTTER_MIN_DBZ，且「前一幀」與「後一幀」在該格周圍 ±CLUTTER_NEIGHBOR_CELLS 格內的最大回波
  都比它低 CLUTTER_JUMP_DB 以上 → 只出現一幀的孤立強回波，判定疑似雜波／異常傳播，該格該幀標 255（無法判斷，不當 0）。
  - 用「周圍範圍內最大值」而不是同一格：真實雨帶 10 分鐘會移動數公里，同格比較會把移動中的雨帶前緣誤判成雜波。
  - 前一幀或後一幀缺（含當日第一、最後一幀）→ 無法驗證，不標（保留原值）。
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[3]
RAIN_CLASSES = json.loads((ROOT / "src/sound/grid/rainClasses.json").read_text(encoding="utf-8"))

UNKNOWN = 255
ZR_A = float(RAIN_CLASSES["zr"]["a"])
ZR_B = float(RAIN_CLASSES["zr"]["b"])
RAIN_CLASS_EDGES_MM_H = tuple(float(x) for x in RAIN_CLASSES["edgesMmPerHour"])
RAIN_CLASS_NAMES = tuple(RAIN_CLASSES["names"]["zh"])
DBZ_BIN_OFFSET = 0.5  # 色塊 k 代表 [k, k+1) dBZ，換雨率取中點

# ── 雜波濾波常數（假設；改了要同步 docs/features/city-sound-atlas/MODEL_DECISIONS.md）──
CLUTTER_MIN_DBZ = 45.0       # 只檢查強回波（≈ Marshall-Palmer 23.7 mm/h，大雨級）；弱回波誤差對分級影響小
CLUTTER_JUMP_DB = 20.0       # 前後幀周圍最大值都比它低 20 dB 以上才算孤立
CLUTTER_NEIGHBOR_CELLS = 8   # 前後幀比對範圍：±8 格（約 ±2 km）
CLUTTER_RULE_VERSION = "clutter-v1"


def dbz_to_rate(dbz: np.ndarray) -> np.ndarray:
    z = np.power(10.0, dbz / 10.0)
    return np.power(z / ZR_A, 1.0 / ZR_B)


def rate_to_class(rate: np.ndarray) -> np.ndarray:
    return np.searchsorted(np.asarray(RAIN_CLASS_EDGES_MM_H), rate, side="right").astype(np.uint8)


def codes_to_class(codes: np.ndarray) -> np.ndarray:
    """dBZ 碼 → 分級碼（0–4、255）"""
    codes = np.asarray(codes)
    rate = np.where((codes == 0) | (codes == UNKNOWN), 0.0, dbz_to_rate(codes.astype(float) - 1 + DBZ_BIN_OFFSET))
    cls = rate_to_class(rate)
    cls[codes == UNKNOWN] = UNKNOWN
    return cls


def _neighborhood_max(a: np.ndarray, r: int) -> np.ndarray:
    """(rows, cols) 浮點陣列的 (2r+1)² 方窗最大值（邊界外視為 -inf）；可分離：先列後行"""
    if r <= 0:
        return a.copy()
    out = a.copy()
    for k in range(1, r + 1):
        out[:, k:] = np.maximum(out[:, k:], a[:, :-k])
        out[:, :-k] = np.maximum(out[:, :-k], a[:, k:])
    tmp = out.copy()
    for k in range(1, r + 1):
        out[k:, :] = np.maximum(out[k:, :], tmp[:-k, :])
        out[:-k, :] = np.maximum(out[:-k, :], tmp[k:, :])
    return out


def clutter_mask(codes: np.ndarray, frame_ok: np.ndarray, rows: int, cols: int,
                 min_dbz: float = CLUTTER_MIN_DBZ, jump_db: float = CLUTTER_JUMP_DB,
                 radius: int = CLUTTER_NEIGHBOR_CELLS) -> np.ndarray:
    """codes: (n, rows*cols) dBZ 碼；frame_ok: (n,) bool。回 (n, rows*cols) bool：True = 疑似雜波"""
    n = codes.shape[0]
    dbz = np.where((codes == 0) | (codes == UNKNOWN), -np.inf, codes.astype(float) - 1).reshape(n, rows, cols)
    nbmax = np.full_like(dbz, -np.inf)
    for i in range(n):
        if frame_ok[i]:
            nbmax[i] = _neighborhood_max(dbz[i], radius)
    flag = np.zeros((n, rows, cols), dtype=bool)
    for i in range(1, n - 1):
        if not (frame_ok[i] and frame_ok[i - 1] and frame_ok[i + 1]):
            continue
        cur = dbz[i]
        flag[i] = (cur >= min_dbz) & (nbmax[i - 1] <= cur - jump_db) & (nbmax[i + 1] <= cur - jump_db)
    return flag.reshape(n, rows * cols)
