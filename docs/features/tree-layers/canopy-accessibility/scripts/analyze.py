#!/usr/bin/env python3
"""Core proof: does canopy height rise with distance-to-nearest-access,
and does it survive controlling for elevation?
Consumes aligned rasters: canopy (m), dist (3857 m), dem (m)."""
import numpy as np
from osgeo import gdal
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import csv, os

gdal.UseExceptions()
S = "/private/tmp/claude-501/-Users-migu-Desktop-----gen-ai-try-ichef-----GIS-mini-taiwan-pulse/2541260e-8e2a-441b-bd0c-0f77ba47a733/scratchpad"
CANOPY = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/forestry/canopy_height_meta/canopy_height_taiwan_10m.tif"
DIST = os.path.join(S, "dist.tif")
DEM  = os.path.join(S, "dem_aligned.tif")

GROUND = 0.9157        # 3857 -> ground meters (cos 23.7N), see notes
HMAX = 85              # ceiling: >85m are model artifacts (only 3 px >90 in all TW)

dist_edges = np.array([0,25,50,100,200,350,500,750,1000,1500,2000,3000,5000,1e9])
elev_edges = np.array([0,250,500,1000,1500,2000,2500,3000,4000])
nD, nE, nH = len(dist_edges)-1, len(elev_edges)-1, HMAX+1
counts = np.zeros((nD, nE, nH), dtype=np.int64)

c_ds = gdal.Open(CANOPY); cd = c_ds.GetRasterBand(1)
d_ds = gdal.Open(DIST);   dd = d_ds.GetRasterBand(1)
e_ds = gdal.Open(DEM);    ed = e_ds.GetRasterBand(1)
W, H = c_ds.RasterXSize, c_ds.RasterYSize
assert (d_ds.RasterXSize, d_ds.RasterYSize) == (W, H), "dist grid mismatch"
assert (e_ds.RasterXSize, e_ds.RasterYSize) == (W, H), "dem grid mismatch"
STRIP = 4096
for y0 in range(0, H, STRIP):
    ys = min(STRIP, H - y0)
    c = cd.ReadAsArray(0, y0, W, ys).astype(np.int32)
    d = dd.ReadAsArray(0, y0, W, ys).astype(np.float32) * GROUND
    e = ed.ReadAsArray(0, y0, W, ys).astype(np.int32)
    m = (c >= 1) & (c <= HMAX) & (e > -30000)
    if not m.any():
        continue
    cv, dv, ev = c[m], d[m], e[m]
    db = np.clip(np.digitize(dv, dist_edges) - 1, 0, nD-1)
    eb = np.clip(np.digitize(ev, elev_edges) - 1, 0, nE-1)
    flat = (db * nE + eb) * nH + cv
    counts += np.bincount(flat, minlength=nD*nE*nH).reshape(nD, nE, nH)
    print(f"  strip y0={y0} done", flush=True)

def stats(hist1d):
    c = hist1d.copy(); c[0] = 0
    tot = c.sum()
    if tot == 0:
        return dict(n=0, mean=np.nan, p50=np.nan, p90=np.nan, p95=np.nan, p99=np.nan)
    hs = np.arange(nH)
    mean = (hs * c).sum() / tot
    cum = np.cumsum(c)
    def q(p): return int(np.searchsorted(cum, p/100*tot))
    return dict(n=int(tot), mean=round(float(mean),2), p50=q(50), p90=q(90), p95=q(95), p99=q(99))

# ---- marginal over elevation: the headline table ----
dist_labels = [f"{int(dist_edges[i])}-{int(dist_edges[i+1]) if dist_edges[i+1]<1e8 else '+'}" for i in range(nD)]
by_dist = counts.sum(axis=1)  # (nD, nH)
rows = []
print("\n=== CORE: canopy height vs distance-to-access (all elevations) ===")
print(f"{'dist(m,ground)':>16} {'n_px':>13} {'mean':>6} {'p50':>4} {'p90':>4} {'p95':>4} {'p99':>4}")
for i in range(nD):
    s = stats(by_dist[i]); s['dist'] = dist_labels[i]; rows.append(s)
    print(f"{dist_labels[i]:>16} {s['n']:>13,} {s['mean']:>6} {s['p50']:>4} {s['p90']:>4} {s['p95']:>4} {s['p99']:>4}")

with open(os.path.join(S,"result_by_distance.csv"),"w",newline="") as f:
    w = csv.DictWriter(f, fieldnames=["dist","n","mean","p50","p90","p95","p99"]); w.writeheader()
    for r in rows: w.writerow(r)

# ---- chart 1: percentiles vs distance ----
x = np.arange(nD)
fig, ax = plt.subplots(figsize=(10,6))
for key,lab,col in [("p50","median","#4c9f70"),("p90","p90","#2f7d4f"),
                    ("p95","p95","#e08a1e"),("p99","p99","#c0392b")]:
    ax.plot(x, [r[key] for r in rows], marker="o", label=lab, color=col, lw=2)
ax.plot(x, [r["mean"] for r in rows], marker="s", ls="--", color="#888", label="mean")
ax.set_xticks(x); ax.set_xticklabels(dist_labels, rotation=45, ha="right", fontsize=8)
ax.set_xlabel("distance to nearest road / trail / forest-road (ground m)")
ax.set_ylabel("canopy height (m)")
ax.set_title("Taiwan canopy height rises with remoteness from the access network")
ax.legend(); ax.grid(alpha=.3)
fig.tight_layout(); fig.savefig(os.path.join(S,"chart_distance_height.png"), dpi=130)

# ---- chart 2: elevation-stratified robustness (p95 vs distance per elev band) ----
elev_labels = [f"{int(elev_edges[i])}-{int(elev_edges[i+1])}m" for i in range(nE)]
fig2, ax2 = plt.subplots(figsize=(10,6))
print("\n=== ROBUSTNESS: p95 canopy height by distance, WITHIN elevation band ===")
print(f"{'elev band':>12} | " + " ".join(f"{l.split('-')[0]:>5}" for l in dist_labels))
cmap = plt.cm.viridis(np.linspace(0,1,nE))
for j in range(nE):
    p95s = [stats(counts[i,j])["p95"] for i in range(nD)]
    ns   = [stats(counts[i,j])["n"] for i in range(nD)]
    # only plot bands with enough data
    if sum(ns) < 100000:
        continue
    ax2.plot(x, p95s, marker="o", color=cmap[j], label=f"{elev_labels[j]} (n={sum(ns):,})")
    print(f"{elev_labels[j]:>12} | " + " ".join(f"{v:>5}" for v in p95s))
ax2.set_xticks(x); ax2.set_xticklabels(dist_labels, rotation=45, ha="right", fontsize=8)
ax2.set_xlabel("distance to nearest access (ground m)")
ax2.set_ylabel("p95 canopy height (m)")
ax2.set_title("Within each elevation band, tall trees still cluster far from access")
ax2.legend(fontsize=8); ax2.grid(alpha=.3)
fig2.tight_layout(); fig2.savefig(os.path.join(S,"chart_elev_stratified.png"), dpi=130)

print("\nwrote: result_by_distance.csv, chart_distance_height.png, chart_elev_stratified.png")
