"""City Sound Atlas W6-2 道路網格預處理的純函式（單元測試 test_road_grid_lib.py）。

只做「來源資料準備」：國道 VD 品質規則、國道路段依里程配 VD、臺北市區 VD 沿路延伸。
**不算潛勢**：距離 kernel、流量換算、分級都只在前端 TS（src/sound/grid/roadNetwork.ts）。

國道 VD 的 total_volume 時距（W6-2 查證）：
  - 上游 tisvcloud VDLive.xml（TDX 國道 VD Live 的來源）根節點 UpdateInterval=60、DataCollectTime 對齊整分；
    data.gov.tw 37662「VD 動態資訊(v2.0)」：「1 分鐘定時更新及統整單一車輛偵測器的動態偵測值」。
  - 收集器每 10 分抓一次即時值 → 每 10 分只有「一個 1 分鐘樣本」，不是 10 分鐘累計。
  - 量級驗算（11-09 北北主線 398 支）：Σ(144 樣本)×10 ≈ 單向日流量，中位 42,555、最大 129,300 輛/日，合理；
    若是 5 分鐘量會變成 2 倍（最大 26 萬輛/日/單向）不合理。
  → 輛/時 = 樣本 × 60（前端換算；這裡只存原值）。
"""
from __future__ import annotations

import heapq
import math
import re
from dataclasses import dataclass, field

# ── 國道 VD 品質規則 ─────────────────────────────────────────────

#: 每車道每分鐘超過這個值視為不合理（3,000 輛/時/車道，高於國道單車道容量約 2,200）
MAX_VEH_PER_MIN_PER_LANE = 50
#: 單筆全零（量、速、佔有率皆 0）且前後兩筆都 ≥ 這個值 → 視為偵測器瞬斷（收集器把 -99 壓成 0）
GLITCH_NEIGHBOR_MIN = 10

REASON_STATUS = "status_nonzero"
REASON_LANE = "implausible_per_lane"
REASON_DAY_ZERO = "day_all_zero"
REASON_GLITCH = "isolated_zero_glitch"


@dataclass
class VdRow:
    slot: int
    total: int
    speed: float
    occ: float
    lanes: int
    status: int


def clean_vd_day(rows: list[VdRow]) -> tuple[list[int | None], dict[str, int], str]:
    """一支 VD 一天的列（可亂序、可同槽重複）→ 144 槽值（每分鐘輛數；None＝無法判斷）、各原因筆數、整日狀態。

    規則（依序）：
      1. status ≠ 0 → None（status 1 的列量速佔全為 0，是收集器把 -99 壓成 0，不是沒車）
      2. 每車道每分鐘 > MAX_VEH_PER_MIN_PER_LANE → None
      3. 整日 status 0 的列量全為 0 → 整日 None（故障偵測器；主線不可能整天沒車）
      4. 全零列且時間上前後兩筆有效值都 ≥ GLITCH_NEIGHBOR_MIN → None（瞬斷）
      其餘全零列保留為 0（夜間 1 分鐘內真的可能沒車）。同槽多筆取有效值的最大。
    """
    reasons: dict[str, int] = {}
    def bump(k: str) -> None:
        reasons[k] = reasons.get(k, 0) + 1

    ok0 = [r for r in rows if r.status == 0]
    if ok0 and max(r.total for r in ok0) == 0:
        reasons[REASON_DAY_ZERO] = len(rows)
        return [None] * 144, reasons, REASON_DAY_ZERO
    rows = sorted(rows, key=lambda r: r.slot)
    vals: list[int | None] = []
    for r in rows:
        if r.status != 0:
            bump(REASON_STATUS); vals.append(None); continue
        if r.lanes > 0 and r.total / r.lanes > MAX_VEH_PER_MIN_PER_LANE:
            bump(REASON_LANE); vals.append(None); continue
        vals.append(r.total)
    # 瞬斷：只看全零列，鄰居取時間上前／後最近的有效值
    for i, r in enumerate(rows):
        if vals[i] != 0 or not (r.speed == 0 and r.occ == 0):
            continue
        prev = next((vals[j] for j in range(i - 1, -1, -1) if vals[j] is not None), None)
        nxt = next((vals[j] for j in range(i + 1, len(rows)) if vals[j] is not None), None)
        if prev is not None and nxt is not None and prev >= GLITCH_NEIGHBOR_MIN and nxt >= GLITCH_NEIGHBOR_MIN:
            vals[i] = None; bump(REASON_GLITCH)
    out: list[int | None] = [None] * 144
    for r, v in zip(rows, vals):
        if not 0 <= r.slot < 144 or v is None:
            continue
        cur = out[r.slot]
        out[r.slot] = v if cur is None else max(cur, v)
    return out, reasons, "ok"


# ── 國道 VD 編號 ────────────────────────────────────────────────

VD_ID_RE = re.compile(r"^VD-(N\d+[A-Z]?)-([NSEW])-([\d.]+)-([A-Z])-")


def parse_vd_id(vd_id: str) -> tuple[str, str, float, str] | None:
    """VD-N1-S-34.000-M-RS → ('N1','S',34.0,'M')；格式不符 → None"""
    m = VD_ID_RE.match(vd_id)
    if not m:
        return None
    return m.group(1), m.group(2), float(m.group(3)), m.group(4)


# ── 國道路段依里程配 VD ──────────────────────────────────────────

def _seg_len_m(a, b) -> float:
    kx = 111_195 * math.cos(math.radians((a[1] + b[1]) / 2))
    return math.hypot((b[0] - a[0]) * kx, (b[1] - a[1]) * 111_195)


def vertex_km(coords: list[list[float]], start_km: float, end_km: float) -> list[float]:
    """依幾何長度比例內插每個頂點的里程（路段幾何從 StartKM 畫到 EndKM）"""
    cum = [0.0]
    for a, b in zip(coords, coords[1:]):
        cum.append(cum[-1] + _seg_len_m(a, b))
    total = cum[-1] or 1.0
    return [start_km + (end_km - start_km) * c / total for c in cum]


def _cut_at_km(coords, kms, cut_km):
    """回傳里程 cut_km 處的內插點（kms 單調，可遞增或遞減）"""
    for i in range(len(kms) - 1):
        k0, k1 = kms[i], kms[i + 1]
        if (k0 - cut_km) * (k1 - cut_km) <= 0 and k0 != k1:
            f = (cut_km - k0) / (k1 - k0)
            a, b = coords[i], coords[i + 1]
            return i, [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]
    return None


def assign_section_pieces(
    coords: list[list[float]], start_km: float, end_km: float, vds: list[tuple[float, str]], max_gap_km: float,
) -> list[tuple[list[list[float]], str | None, float, float]]:
    """一段同國道同方向的路段 → [(子線段座標, 配到的 VD id 或 None, 起里程, 迄里程)]。

    規則「依里程最近」：同國道同方向的主線 VD 依里程排序，在相鄰兩支的里程中點切開，每段配里程最近的那支；
    與最近 VD 的里程差 > max_gap_km 的部分 → None（無法判斷，不外推）。該 VD 當日故障時前端一樣無法判斷，
    不改用次近（不在這裡判斷每日有效性）。
    """
    kms = vertex_km(coords, start_km, end_km)
    lo, hi = min(start_km, end_km), max(start_km, end_km)
    vds = sorted(vds)
    # 每支 VD 的勢力範圍 [a, b]（中點切），再與 ±max_gap 相交
    cuts: list[tuple[float, float, str | None]] = []
    for i, (km, vid) in enumerate(vds):
        a = (vds[i - 1][0] + km) / 2 if i > 0 else -math.inf
        b = (vds[i + 1][0] + km) / 2 if i + 1 < len(vds) else math.inf
        a, b = max(a, km - max_gap_km), min(b, km + max_gap_km)
        if b > lo and a < hi and b > a:
            cuts.append((max(a, lo), min(b, hi), vid))
    # 補上沒被涵蓋的空檔（None）
    spans: list[tuple[float, float, str | None]] = []
    pos = lo
    for a, b, vid in sorted(cuts):
        if a > pos + 1e-9:
            spans.append((pos, a, None))
        spans.append((a, b, vid))
        pos = b
    if pos < hi - 1e-9:
        spans.append((pos, hi, None))
    out = []
    for a, b, vid in spans:
        piece = _extract_km_range(coords, kms, a, b)
        if piece and len(piece) >= 2:
            out.append((piece, vid, a, b))
    return out


def _extract_km_range(coords, kms, a, b):
    """取里程 [a,b] 之間的子線（沿原幾何方向）"""
    inside = lambda k: a - 1e-9 <= k <= b + 1e-9  # noqa: E731
    pts = []
    for i in range(len(coords)):
        if inside(kms[i]):
            pts.append((i, list(coords[i])))
    res: list[list[float]] = []
    # 起點與終點以內插補齊：沿方向第一個/最後一個在範圍內的頂點之外，再補切點
    forward = kms[-1] >= kms[0]
    first_km, last_km = (a, b) if forward else (b, a)
    p0 = _cut_at_km(coords, kms, first_km)
    p1 = _cut_at_km(coords, kms, last_km)
    if p0:
        res.append(p0[1])
    for _, c in pts:
        if not res or _seg_len_m(res[-1], c) > 0.01:
            res.append(c)
    if p1 and (not res or _seg_len_m(res[-1], p1[1]) > 0.01):
        res.append(p1[1])
    return res


# ── 臺北市區 VD 沿路延伸 ──────────────────────────────────────────

_SECTION_RE = re.compile(r"[一二三四五六七八九十]+段$")


def base_road_name(name: str | None) -> str | None:
    """路名正規化：去掉「X段」與空白；None／空 → None"""
    if not name:
        return None
    s = re.sub(r"\s+", "", str(name).split(";")[0])
    s = _SECTION_RE.sub("", s)
    return s or None


@dataclass
class RoadGraph:
    """同一路名的路網圖（已加密到每段 ≤ 約 25 m）：節點整數 id，邊無向。"""
    edges: dict[int, list[tuple[int, float]]] = field(default_factory=dict)  # node → [(node, 長度 m)]
    intersections: set[int] = field(default_factory=set)

    def add_edge(self, u: int, v: int, length_m: float) -> None:
        if u == v:
            return
        self.edges.setdefault(u, []).append((v, length_m))
        self.edges.setdefault(v, []).append((u, length_m))


def extend_vds(graph: RoadGraph, seeds: list[tuple[str, int]], max_extend_m: float) -> dict[tuple[int, int], str]:
    """多源 Dijkstra。seeds＝[(vd_id, VD 吸附到的節點)]；回傳 {(u, v) u<v: vd_id}（被延伸涵蓋的邊）。

    規則「沿同一條路延伸到下一支 VD 或路口為止」：
      - graph 只含同路名的邊 → 只沿同一條路走；
      - 每個節點歸沿路距離最近的 VD → 兩支 VD 之間在中點分界（＝延伸到下一支 VD 為止）；
      - 路口節點（與其他主要道路、不同路名交會）可以到達但不再往外走；VD 吸附的節點本身例外；
      - 沿路距離 > max_extend_m 不再延伸。
    邊 (u, v) 被涵蓋的條件：某一端已到達且可往外走（非路口或為 VD 節點），且該端距離＋邊長 ≤ max_extend_m；
    兩端都符合時歸距離較小那端的 VD。
    """
    dist: dict[int, tuple[float, str]] = {}
    heap: list[tuple[float, int, str]] = []
    seed_nodes = {n for _, n in seeds}
    for vid, n in seeds:
        if n not in dist or dist[n][0] > 0 or vid < dist[n][1]:
            dist[n] = (0.0, vid)
    for n, (d, vid) in dist.items():
        heapq.heappush(heap, (d, n, vid))
    done: set[int] = set()
    while heap:
        d, n, vid = heapq.heappop(heap)
        if n in done or dist[n] != (d, vid):
            continue
        done.add(n)
        if n in graph.intersections and n not in seed_nodes:
            continue
        for w, L in graph.edges.get(n, []):
            nd = d + L
            if nd <= max_extend_m and (w not in dist or dist[w][0] > nd):
                dist[w] = (nd, vid)
                heapq.heappush(heap, (nd, w, vid))

    def expandable(n: int) -> bool:
        return n in dist and (n not in graph.intersections or n in seed_nodes)

    out: dict[tuple[int, int], str] = {}
    for u, nbrs in graph.edges.items():
        for v, L in nbrs:
            if u >= v:
                continue
            cand = [dist[x] for x in (u, v) if expandable(x) and dist[x][0] + L <= max_extend_m + 1e-6]
            if cand:
                out[(u, v)] = min(cand)[1]
    return out
