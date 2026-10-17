#!/usr/bin/env python3
"""
Build the static `railRoutes` layer: all Taiwan rail route lines, no schedules.

Input : public/rail/<sys>/tracks/*.geojson   (trtc thsr krtc klrt tmrt)
        public/rail/tra/tracks_golden/*.geojson  (TRA, 37 golden ids; NOT tra/tracks 68 MB)
        public/rail/trtc/extensions/*.geojson    (curated extension LineStrings, e.g. 信義線東延段)
Output: public/rail/routes_static.geojson  (one Feature per route line, split into pieces in shared corridors)

Dedup rule (many overlapping service-pattern tracks exist per line):
  per system + line group, prefer direction-0 tracks (id suffix -0 / props.direction == 0),
  keep the longest one, then add any other track (direction 0 first, then 1) only for the
  part that is NOT within COVER_M of what is already kept (branches such as
  R-3 新北投, G-3 小碧潭, O-2 蘆洲). Added pieces are clipped to the uncovered run (+1
  connecting vertex each side) and must be >= MIN_BRANCH_M long. One direction only.
  貓空纜車 (MK-*) IS included here as its own route (trtc / MK, color from the track's
  own `color` prop #06b8e6) even though the realtime layer (railLoader.ts postProcess) excludes it.

Extensions: trtc extensions whose line_id matches a line are concatenated onto the kept
  main track (extension west end is pre-snapped to the R-1-0 象山 endpoint vertex), so the
  line stays one feature.

Shared corridors (offset_slot): where two route features run within CORRIDOR_M of each other and
  roughly parallel for >= CORRIDOR_MIN_M (e.g. 台鐵/高鐵 through 台北—板橋—南港), their
  geometries differ by a few metres and interleave at z13+. So:
  1. snap: the lower-priority line (SNAP_PRIORITY) takes the higher-priority line's geometry along
     the shared stretch (breaks < GAP_M bridged), blended over BLEND_M at each join (no notch);
  2. split: lines in a corridor are cut where the set of coincident lines changes; each corridor
     piece ("bundle") is a separate Feature, everything outside corridors keeps offset_slot 0;
  3. order: per bundle, pieces are oriented along a reference piece and ranked left->right by
     where each line comes from / goes to SIDE_PROBE_M outside the bundle (ties follow the
     adjacent longer bundle), slots centred: 2 lines -0.5/+0.5, 3 lines -1/0/+1.
  The overlay draws `line-offset = offset_slot * width`. Output therefore has several Features per
  route line (same properties, different offset_slot).

Usage: python3 scripts/preprocess/build-rail-routes.py
Deps : shapely
"""

import glob
import json
import math
import os
import re

import numpy as np
import shapely

from shapely.geometry import LineString, Point
from shapely.ops import substring, unary_union

BASE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RAIL = os.path.join(BASE, "public/rail")
OUT = os.path.join(RAIL, "routes_static.geojson")

COVER_M = 40.0        # a vertex within this distance of kept geometry counts as covered
MIN_BRANCH_M = 400.0  # uncovered run shorter than this is not a real branch
STEP_M = 25.0         # densify step for the coverage test
DECIMALS = 6

CORRIDOR_M = 30.0       # two routes within this distance (and parallel) share a corridor
CORRIDOR_MIN_M = 300.0  # shared parallel length below this is a junction/crossing, not a corridor
CORRIDOR_COS = 0.87     # parallel test: |cos(angle)| >= this (~30 deg)
BLEND_M = 40.0          # snap joins: merge into the partner's geometry over ~2x this, no notch
COINCIDE_M = 1.0        # after snapping, lines within this are the same corridor (bundle)
MIN_BUNDLE_M = 100.0    # shorter coincident runs (crossings, touch points) are not bundles
GAP_M = 800.0           # a shared run interrupted for less than this (e.g. station throats) ...
BRIDGE_MAX_M = 80.0     # ... and never farther apart than this is one corridor
SIDE_PROBE_M = 150.0    # (lateral clipped to +-100 m per end)
INHERIT_M = 20.0        # one slot of an adjacent bundle's order weighs like 20 m of lateral offset    # where a line comes from / goes to, measured this far outside its bundle

# railLoader.ts RAIL_SYSTEMS default colors; TRA lightened from #7B7B7B to #A8A8A8 for dark basemaps
SYSTEMS = [
    # id, label, tracks dir, default color
    ("tra", "台鐵", "tracks_golden", "#A8A8A8"),
    ("thsr", "高鐵", "tracks", "#ee6c00"),
    ("trtc", "台北捷運", "tracks", "#d90023"),
    ("krtc", "高雄捷運", "tracks", "#f8961e"),
    ("klrt", "高雄輕軌", "tracks", "#43aa8b"),
    ("tmrt", "台中捷運", "tracks", "#577590"),
]

SOURCE = "mini-taipei-v3 軌道資料 (public/rail, scripts/export/export-rail-data.py)"

# trtc dir also holds 新北捷運 / 桃園機場捷運 lines; name them by line_id.
TRTC_LINE_NAMES = {
    "R": "淡水信義線", "BL": "板南線", "G": "松山新店線", "O": "中和新蘆線",
    "BR": "文湖線", "MK": "貓空纜車", "A": "桃園機場捷運", "Y": "環狀線", "K": "安坑輕軌",
    "V": "淡海輕軌", "LB": "三鶯線",
}
OTHER_LINE_NAMES = {
    ("thsr", None): "台灣高鐵",
    ("krtc", "R"): "高雄捷運紅線", ("krtc", "O"): "高雄捷運橘線",
    ("klrt", None): "高雄環狀輕軌",
    ("tmrt", "G"): "台中捷運綠線",
}

# golden TRA tracks without a name prop (SH-0 runs 臺南→中洲→沙崙; verified against stations.geojson)
TRA_NAME_OVERRIDES = {"SH-0": "沙崙線"}

# ── geometry helpers (local equirectangular projection, metres) ──
LAT0 = 23.7
KX = 111320.0 * math.cos(math.radians(LAT0))
KY = 110570.0


def proj(c):
    return (c[0] * KX, c[1] * KY)


def length_m(coords):
    return sum(math.hypot((b[0] - a[0]) * KX, (b[1] - a[1]) * KY) for a, b in zip(coords, coords[1:]))


def rnd(coords):
    out = []
    for c in coords:
        p = [round(c[0], DECIMALS), round(c[1], DECIMALS)]
        if not out or out[-1] != p:
            out.append(p)
    return out


def densify(coords):
    """Insert vertices so no segment is longer than STEP_M (analysis only)."""
    out = [coords[0]]
    for a, b in zip(coords, coords[1:]):
        d = math.hypot((b[0] - a[0]) * KX, (b[1] - a[1]) * KY)
        n = max(1, int(d // STEP_M) + (1 if d % STEP_M else 0))
        for i in range(1, n + 1):
            t = i / n
            out.append([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
    return out


def uncovered_runs(coords, kept_union):
    """Contiguous runs of densified vertices farther than COVER_M from kept geometry."""
    from shapely.geometry import Point
    pts = densify(coords)
    far = [kept_union.distance(Point(proj(c))) > COVER_M for c in pts]
    runs, i = [], 0
    while i < len(pts):
        if far[i]:
            j = i
            while j + 1 < len(pts) and far[j + 1]:
                j += 1
            lo, hi = max(0, i - 1), min(len(pts) - 1, j + 1)  # +1 connecting vertex
            runs.append(pts[lo:hi + 1])
            i = j + 1
        else:
            i += 1
    return runs


# ── loading ──
def direction_of(track_id, props):
    d = props.get("direction")
    if d in (0, 1):
        return d
    m = re.search(r"-(0|1)$", track_id)
    return int(m.group(1)) if m else 0


def load_tracks(sys_id, sub):
    tracks = []
    for path in sorted(glob.glob(os.path.join(RAIL, sys_id, sub, "*.geojson"))):
        tid = os.path.basename(path)[:-len(".geojson")]
        with open(path, encoding="utf-8") as f:
            j = json.load(f)
        ft = j["features"][0] if j.get("type") == "FeatureCollection" else j
        props = ft.get("properties") or {}
        coords = ft["geometry"]["coordinates"]
        tracks.append({
            "id": tid, "props": props, "coords": coords,
            "dir": direction_of(tid, props), "len": length_m(coords),
        })
    return tracks


def group_key(sys_id, t):
    """trtc: per metro line (line_id or id prefix). krtc: per line_id. others: one pool."""
    if sys_id == "trtc":
        m = re.match(r"^([A-Z]+)-", t["id"])
        return t["props"].get("line_id") or (m.group(1) if m else t["id"])
    if sys_id in ("krtc", "tmrt"):
        return t["props"].get("line_id") or "_"
    return "_"


def dedup(tracks):
    """Return [(track, coords_or_None_for_whole, uncovered_m)] kept pieces, main first."""
    order = sorted(tracks, key=lambda t: (t["dir"], -t["len"]))
    main = order[0]
    kept = [(main, rnd(main["coords"]), 0.0)]
    union = LineString([proj(c) for c in main["coords"]])
    for t in order[1:]:
        runs = [r for r in uncovered_runs(t["coords"], union) if length_m(r) >= MIN_BRANCH_M]
        if not runs:
            continue
        for r in runs:
            kept.append((t, rnd(r), length_m(r)))
            union = unary_union([union, LineString([proj(c) for c in r])])
    return kept


def line_name(sys_id, line_id, main):
    if sys_id == "trtc":
        return TRTC_LINE_NAMES.get(line_id, line_id)
    named = OTHER_LINE_NAMES.get((sys_id, line_id if line_id != "_" else None))
    if named:
        return named
    nm = TRA_NAME_OVERRIDES.get(main["id"]) or main["props"].get("name") or main["id"]
    return re.sub(r"\s*[（(].*?[）)]\s*$", "", nm)  # strip "(A→B)" direction suffix


def load_extensions():
    ext = {}
    for path in sorted(glob.glob(os.path.join(RAIL, "*/extensions/*.geojson"))):
        sys_id = os.path.normpath(path).split(os.sep)[-3]
        with open(path, encoding="utf-8") as f:
            for ft in json.load(f)["features"]:
                if ft["geometry"]["type"] == "LineString":
                    ext.setdefault((sys_id, ft["properties"]["line_id"]), []).append(ft)
    return ext


# ── shared corridors → offset_slot ──
def _parts(feature):
    g = feature["geometry"]
    cs = [g["coordinates"]] if g["type"] == "LineString" else g["coordinates"]
    return [LineString([proj(c) for c in part]) for part in cs if len(part) >= 2]


def _tangent(ls, d, h=10.0):
    a, b = ls.interpolate(max(0.0, d - h)), ls.interpolate(min(ls.length, d + h))
    return b.x - a.x, b.y - a.y


def corridor_pairs(features, step=20.0):
    """{(i, k, sigma): [shared_m, lateral_sum, n, sx, sy]} for i < k.
    sigma +1 = same drawing direction, -1 = opposite. lateral > 0 = k lies to the LEFT of i."""
    parts = [(i, ls) for i, f in enumerate(features) for ls in _parts(f)]
    out = {}
    for ai, (i, A) in enumerate(parts):
        for k, B in parts[ai + 1:]:
            if i == k or A.distance(B) > CORRIDOR_M:
                continue
            near = A.intersection(B.buffer(CORRIDOR_M))
            for seg in getattr(near, "geoms", [near]):
                if seg.geom_type != "LineString" or seg.length < step:
                    continue
                for n in range(int(seg.length // step)):
                    p = seg.interpolate(n * step + step / 2)
                    da = A.project(p)
                    t = _tangent(A, da)
                    db = B.project(p)
                    q = B.interpolate(db)
                    u = _tangent(B, db)
                    nt, nu = math.hypot(*t), math.hypot(*u)
                    if nt == 0 or nu == 0 or p.distance(q) > CORRIDOR_M:
                        continue
                    c = (t[0] * u[0] + t[1] * u[1]) / nt / nu
                    if abs(c) < CORRIDOR_COS:
                        continue
                    lat = (t[0] * (q.y - p.y) - t[1] * (q.x - p.x)) / nt  # cross(t, q-p): + = left
                    key = (i, k, 1 if c > 0 else -1)
                    acc = out.setdefault(key, [0.0, 0.0, 0, 0.0, 0.0])
                    acc[0] += step
                    acc[1] += lat  # parts are in feature order, so i < k here
                    acc[2] += 1
                    acc[3] += p.x
                    acc[4] += p.y
    return out


def unproj(xy):
    return [xy[0] / KX, xy[1] / KY]


def densify_xy(pts, step=10.0):
    """Projected-metre densify (no segment longer than step)."""
    out = [tuple(pts[0])]
    for a, b in zip(pts, pts[1:]):
        d = math.hypot(b[0] - a[0], b[1] - a[1])
        n = max(1, math.ceil(d / step))
        for i in range(1, n + 1):
            out.append((a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n))
    return out


def cumdist(pts):
    cum = [0.0]
    for a, b in zip(pts, pts[1:]):
        cum.append(cum[-1] + math.hypot(b[0] - a[0], b[1] - a[1]))
    return cum


def snap_corridor(sec_f, ref_f):
    """Replace the stretches of sec_f that run along ref_f (within CORRIDOR_M, parallel, >= CORRIDOR_MIN_M)
    with ref_f's own geometry, so the pair is geometrically identical there and line-offset alone decides
    the spacing (otherwise metre-level jitter still makes them cross at z15). Joins are blended: sec
    vertices within BLEND_M outside the run are dropped and the ref substring starts BLEND_M inside it,
    so the line merges over ~2*BLEND_M instead of a notch. Returns snapped metres."""
    refs = _parts(ref_f)
    g = sec_f["geometry"]
    multi = g["type"] == "MultiLineString"
    out_parts, snapped = [], 0.0
    for part in (g["coordinates"] if multi else [g["coordinates"]]):
        pts = densify_xy([proj(c) for c in part])
        S = LineString(pts)
        cum = cumdist(pts)
        hit = [None] * len(pts)  # index of ref part this vertex runs along
        for ri, R in enumerate(refs):
            for vi, xy in enumerate(pts):
                if hit[vi] is not None:
                    continue
                pt = Point(xy)
                if R.distance(pt) > CORRIDOR_M:
                    continue
                t, u = _tangent(S, cum[vi]), _tangent(R, R.project(pt))
                nt, nu = math.hypot(*t), math.hypot(*u)
                if nt and nu and abs((t[0] * u[0] + t[1] * u[1]) / nt / nu) >= CORRIDOR_COS:
                    hit[vi] = ri
        raw, vi = [], 0
        while vi < len(pts):
            vj = vi
            while vj + 1 < len(pts) and hit[vj + 1] == hit[vi]:
                vj += 1
            if hit[vi] is not None:
                if (raw and raw[-1][2] == hit[vi] and cum[vi] - cum[raw[-1][1]] < GAP_M
                        and all(refs[hit[vi]].distance(Point(pts[k])) <= BRIDGE_MAX_M
                                for k in range(raw[-1][1], vi))):
                    raw[-1] = (raw[-1][0], vj, hit[vi])  # bridge short breaks (curves, brief divergence)
                else:
                    raw.append((vi, vj, hit[vi]))
            vi = vj + 1
        runs = [r for r in raw if cum[r[1]] - cum[r[0]] >= CORRIDOR_MIN_M]
        new, prev = [], 0
        for n, (vi, vj, ri) in enumerate(runs):
            R = refs[ri]
            d0, d1 = R.project(Point(pts[vi])), R.project(Point(pts[vj]))
            sgn = 1 if d1 >= d0 else -1
            d0i, d1i = d0 + sgn * BLEND_M, d1 - sgn * BLEND_M
            if (d1i - d0i) * sgn < BLEND_M:
                continue
            lo_lim = runs[n - 1][1] if n else 0
            hi_lim = runs[n + 1][0] if n + 1 < len(runs) else len(pts) - 1
            a = vi
            while a > max(prev, lo_lim) and cum[vi] - cum[a - 1] <= BLEND_M:
                a -= 1
            b = vj
            while b < hi_lim and cum[b + 1] - cum[vj] <= BLEND_M:
                b += 1
            a = max(a - 1, prev)  # last kept own vertex before the connector
            sub = substring(R, d0i, d1i)
            new.extend(pts[prev:a + 1])
            new.extend(sub.coords if sub.geom_type == "LineString" else [])
            prev = min(b + 1, len(pts) - 1)
            snapped += cum[vj] - cum[vi]
        new.extend(pts[prev:])
        simp = LineString(new).simplify(0.5, preserve_topology=False)  # drop densify vertices
        out_parts.append(rnd([unproj(xy) for xy in simp.coords]))
    sec_f["geometry"]["coordinates"] = out_parts if multi else out_parts[0]
    return snapped


SNAP_PRIORITY = {"thsr": 0, "tra": 1, "trtc": 2, "krtc": 2, "tmrt": 2, "klrt": 3}


def _lateral(R, p):
    """Signed distance of p from line R (+ = left of R's direction); beyond R's ends uses the end tangent."""
    d = R.project(Point(p))
    q = R.interpolate(d)
    t = _tangent(R, d)
    nt = math.hypot(*t) or 1.0
    return (t[0] * (p[1] - q.y) - t[1] * (p[0] - q.x)) / nt


def split_bundles(features, members, rank):
    """Split member features into pieces where the set of coincident (snapped) lines is constant.
    Returns (pieces, bundles): piece = dict(f, pts(xy), label, part_pts, i0, i1)."""
    bufs = {}
    for i in members:
        geom = unary_union(_parts(features[i])).buffer(COINCIDE_M)
        shapely.prepare(geom)
        bufs[i] = geom
    pieces = []
    for i in sorted(members):
        g = features[i]["geometry"]
        for part in (g["coordinates"] if g["type"] == "MultiLineString" else [g["coordinates"]]):
            pts = densify_xy([proj(c) for c in part])
            cum = cumdist(pts)
            xs = np.array([p[0] for p in pts])
            ys = np.array([p[1] for p in pts])
            lab = [set() for _ in pts]
            for j in members:
                if j != i:
                    for idx in np.nonzero(shapely.contains_xy(bufs[j], xs, ys))[0]:
                        lab[idx].add(j)
            lab = [frozenset(s) for s in lab]
            # runs; coincident runs shorter than MIN_BUNDLE_M (crossings, touch points) become unshared
            def runs_of(lab):
                out, a = [], 0
                while a < len(lab):
                    b = a
                    while b + 1 < len(lab) and lab[b + 1] == lab[a]:
                        b += 1
                    out.append([a, b, lab[a]])
                    a = b + 1
                return out
            for r in runs_of(lab):
                if r[2] and cum[r[1]] - cum[r[0]] < MIN_BUNDLE_M:
                    for k in range(r[0], r[1] + 1):
                        lab[k] = frozenset()
            rs = runs_of(lab)
            for n in range(1, len(rs) - 1):  # short unshared gap between the same bundle -> bundle
                a, b, l = rs[n]
                if not l and rs[n - 1][2] and rs[n - 1][2] == rs[n + 1][2] and cum[b] - cum[a] < GAP_M:
                    for k in range(a, b + 1):
                        lab[k] = rs[n - 1][2]
            for a, b, l in runs_of(lab):
                lo, hi = max(0, a - 1) if a else 0, b  # share the boundary vertex with the previous piece
                if hi - lo < 1:
                    continue
                pieces.append({"f": i, "pts": pts[lo:hi + 1], "label": l, "part": pts, "cum": cum,
                               "i0": lo, "i1": hi})
    # group coincident pieces into bundles (same member set + same place)
    shared = [p for p in pieces if p["label"]]
    parent = list(range(len(shared)))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x
    for a in range(len(shared)):
        pa = shared[a]
        ma = pa["label"] | {pa["f"]}
        La = LineString(pa["pts"])
        mid = La.interpolate(0.5, normalized=True)
        for b in range(len(shared)):
            pb = shared[b]
            if b == a or pb["f"] == pa["f"] or pb["label"] | {pb["f"]} != ma:
                continue
            if LineString(pb["pts"]).distance(mid) <= 2 * COINCIDE_M:
                parent[find(a)] = find(b)
    bundles = {}
    for a, p in enumerate(shared):
        bundles.setdefault(find(a), []).append(p)
    return pieces, list(bundles.values())


def _inherited(bundle, R, done):
    """Slot of each line in already-ordered bundles that touch this one end-to-end, expressed in
    this bundle's drawing direction (+ = right). Lines that stay bundled past our end have no
    lateral signal at the probe, so they keep the neighbour's order instead of crossing."""
    pos = {}
    for other in done:
        common = {p["f"] for p in other} & {p["f"] for p in bundle}
        if len(common) < 2:
            continue
        for q in other:
            for end in (0, -1):
                e = Point(q["pts"][end])
                if R.distance(e) > 30.0:
                    continue
                Q = LineString(q["pts"])
                t, u = _tangent(Q, Q.project(e)), _tangent(R, R.project(e))
                sgn = 1 if t[0] * u[0] + t[1] * u[1] >= 0 else -1
                for p2 in other:
                    if p2["f"] in common:
                        pos.setdefault(p2["f"], p2["slot"] * sgn)
    return pos


def order_bundle(bundle, rank, done):
    """Orient pieces along the reference piece and assign slots left->right from where each line
    comes from / goes to just outside the bundle (SIDE_PROBE_M), so lines don't cross at the ends;
    ties (lines still together at the probe) follow the adjacent, longer bundle's order."""
    ref = min(bundle, key=lambda p: rank(p["f"]))
    R = LineString(ref["pts"])
    inherit = _inherited(bundle, R, done)
    scored = []
    for p in bundle:
        L = LineString(p["pts"])
        mid = L.interpolate(0.5, normalized=True)
        t = _tangent(L, L.length / 2)
        u = _tangent(R, R.project(mid))
        rev = (t[0] * u[0] + t[1] * u[1]) < 0
        part, cum, i0, i1 = p["part"], p["cum"], p["i0"], p["i1"]
        before = after = None
        if cum[i0] > 0:  # own geometry just before the piece (in the part's direction)
            k = i0
            while k > 0 and cum[i0] - cum[k] < SIDE_PROBE_M:
                k -= 1
            before = part[k]
        if cum[i1] < cum[-1]:
            k = i1
            while k < len(part) - 1 and cum[k] - cum[i1] < SIDE_PROBE_M:
                k += 1
            after = part[k]
        if rev:
            before, after = after, before
        score = sum(max(-100.0, min(100.0, _lateral(R, q))) for q in (before, after) if q is not None)
        scored.append((score, p, rev))
        if rev:
            p["pts"] = list(reversed(p["pts"]))
    # one slot per line in the bundle (a line may contribute several coincident pieces)
    by_f = {}
    for score, p, _ in scored:
        by_f.setdefault(p["f"], []).append(score)
    left = {f: sum(v) / len(v) - INHERIT_M * inherit.get(f, 0.0) for f, v in by_f.items()}
    order = sorted(by_f, key=lambda f: (-left[f], rank(f)))  # most-left first
    n = len(order)
    slot = {f: idx - (n - 1) / 2 for idx, f in enumerate(order)}  # line-offset > 0 = right of direction
    for _, p, _ in scored:
        p["slot"] = slot[p["f"]]
    return [(f, slot[f]) for f in order]


def assign_offset_slots(features):
    """Snap shared corridors, split route features at corridor boundaries and give each corridor
    piece its own offset_slot (0 elsewhere). Returns the new feature list."""
    pairs = corridor_pairs(features)
    qual = sorted({(i, k) for (i, k, _), v in pairs.items() if v[0] >= CORRIDOR_MIN_M})
    rank = lambda i: (SNAP_PRIORITY.get(features[i]["properties"]["system"], 9),
                      -sum(p.length for p in _parts(features[i])), i)
    print("corridor snapping (secondary <- reference):")
    for i, k in sorted(qual, key=lambda ik: min(rank(ik[0]), rank(ik[1]))):
        ref, sec = (i, k) if rank(i) <= rank(k) else (k, i)
        m = snap_corridor(features[sec], features[ref])
        print(f"  {features[sec]['properties']['name']:10} <- {features[ref]['properties']['name']:10} {m / 1000:5.2f} km")
    members = {i for ik in qual for i in ik}
    pieces, bundles = split_bundles(features, members, rank)
    print("corridor bundles (slot: line, left -> right of drawing direction):")
    done = []
    for b in sorted(bundles, key=lambda b: -LineString(b[0]["pts"]).length):
        order = order_bundle(b, rank, done)
        done.append(b)
        L = LineString(b[0]["pts"])
        a, z = unproj(L.coords[0]), unproj(L.coords[-1])
        print(f"  {L.length / 1000:5.2f} km  {a[0]:.4f},{a[1]:.4f} -> {z[0]:.4f},{z[1]:.4f}  "
              + "  ".join(f"{s:+.1f} {features[f]['properties']['name']}" for f, s in order))
    out = []
    for i, f in enumerate(features):
        if i not in members:
            f["properties"]["offset_slot"] = 0
            out.append(f)
            continue
        for p in (p for p in pieces if p["f"] == i):
            coords = LineString(p["pts"]).simplify(0.5, preserve_topology=False).coords
            out.append({"type": "Feature",
                        "properties": {**f["properties"], "offset_slot": p.get("slot", 0)},
                        "geometry": {"type": "LineString", "coordinates": rnd([unproj(xy) for xy in coords])}})
    return out


def main():
    extensions = load_extensions()
    features, report = [], []
    for sys_id, label, sub, default_color in SYSTEMS:
        tracks = load_tracks(sys_id, sub)
        groups = {}
        for t in tracks:
            groups.setdefault(group_key(sys_id, t), []).append(t)
        # tra: one pool (dedup across all lines); each kept track becomes its own named feature.
        for gk in sorted(groups):
            g = groups[gk]
            kept = dedup(g)
            main_t = kept[0][0]
            line_id = main_t["props"].get("line_id") if sys_id != "trtc" else gk
            color = main_t["props"].get("color") or default_color
            if sys_id == "trtc" and not main_t["props"].get("color"):
                color = default_color

            def make(pieces, tids, name, lid, extra=None):
                geoms = [p for p in pieces if len(p) >= 2]
                props = {"system": sys_id, "system_name": label, "line_id": lid, "name": name,
                         "color": color, "source": SOURCE, "track_ids": ",".join(tids)}
                if extra:
                    props.update(extra)
                geom = ({"type": "LineString", "coordinates": geoms[0]} if len(geoms) == 1
                        else {"type": "MultiLineString", "coordinates": geoms})
                return {"type": "Feature", "properties": props, "geometry": geom}

            if sys_id == "tra":
                # one feature per kept main track; branches (clipped) attach to the main they extend
                by_track = {}
                for t, coords, unc in kept:
                    by_track.setdefault(t["id"], (t, []))[1].append(coords)
                for tid, (t, pieces) in by_track.items():
                    name = line_name(sys_id, t["props"].get("line_id") or t["props"].get("route_id"), t)
                    features.append(make(pieces, [tid], name, t["props"].get("route_id") or t["props"].get("line_id") or tid,
                                         {"color": t["props"].get("color") or default_color}))
                    report.append((sys_id, name, [tid], sum(length_m(p) for p in pieces) / 1000))
                continue

            pieces = [c for _, c, _ in kept]
            tids = [t["id"] for t, _, _ in kept]
            extra = None
            ext_ids = []
            for ft in extensions.get((sys_id, line_id), []):
                ec = ft["geometry"]["coordinates"]
                mc = pieces[0]
                # extension west end is pre-snapped to the main track's end vertex; the main
                # track starts at that vertex, so reverse the extension and prepend it.
                if rnd([ec[0]])[0] != mc[0]:
                    raise SystemExit(f"extension {ft['properties'].get('track_id')} not snapped to {tids[0]} start")
                pieces[0] = rnd(list(reversed(ec)) + mc)
                ext_ids.append(ft["properties"].get("track_id", "ext"))
                extra = {
                    "source": f"{SOURCE}; 東延段: {ft['properties']['source']}",
                    "license": ft["properties"]["license"],
                }
                tids = tids + ["ext:" + ext_ids[-1]]
            name = line_name(sys_id, line_id, main_t)
            features.append(make(pieces, tids, name, line_id, extra))
            report.append((sys_id, name, tids, sum(length_m(p) for p in pieces) / 1000))

    features = assign_offset_slots(features)
    fc = {"type": "FeatureCollection", "features": features}
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(fc, f, ensure_ascii=False, separators=(",", ":"))

    print(f"{'system':6} {'line':16} {'km':>7}  kept tracks")
    for sys_id, name, tids, km in report:
        print(f"{sys_id:6} {name:16} {km:7.1f}  {' '.join(tids)}")
    print(f"\n{len(features)} features -> {OUT} ({os.path.getsize(OUT) / 1e6:.2f} MB)")


if __name__ == "__main__":
    main()
