#!/usr/bin/env python3
"""The direct test of the user's question:
are the TALLEST trees (>=45m emergent giants) systematically farther
from the access network than forest in general?"""
import numpy as np
from osgeo import gdal, osr
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
import json, os

gdal.UseExceptions()
S = "/private/tmp/claude-501/-Users-migu-Desktop-----gen-ai-try-ichef-----GIS-mini-taiwan-pulse/2541260e-8e2a-441b-bd0c-0f77ba47a733/scratchpad"
CANOPY = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/forestry/canopy_height_meta/canopy_height_taiwan_10m.tif"
DIST = os.path.join(S, "dist.tif")
DEM  = os.path.join(S, "dem_aligned.tif")
GROUND = 0.9157
GIANT_LO, GIANT_HI = 45, 85   # emergent giants, artifact ceiling

c_ds = gdal.Open(CANOPY); cd = c_ds.GetRasterBand(1)
d_ds = gdal.Open(DIST);   dd = d_ds.GetRasterBand(1)
e_ds = gdal.Open(DEM);    ed = e_ds.GetRasterBand(1)
W, H = c_ds.RasterXSize, c_ds.RasterYSize
gt = c_ds.GetGeoTransform()

FB = 25  # fine distance bin (m) for medians
NF = 400  # up to 10 km
base_hist = np.zeros(NF+1, dtype=np.int64)
giants = []  # (r,c,h)

STRIP = 4096
for y0 in range(0, H, STRIP):
    ys = min(STRIP, H - y0)
    c = cd.ReadAsArray(0, y0, W, ys).astype(np.int32)
    d = dd.ReadAsArray(0, y0, W, ys).astype(np.float32) * GROUND
    m = (c >= 1) & (c <= GIANT_HI)
    db = np.clip((d[m] / FB).astype(np.int32), 0, NF)
    base_hist += np.bincount(db, minlength=NF+1)
    gm = (c >= GIANT_LO) & (c <= GIANT_HI)
    rr, cc = np.where(gm)
    for r, cx in zip(rr, cc):
        giants.append((int(r+y0), int(cx), int(c[r, cx])))
    print(f"  strip {y0} done, giants={len(giants)}", flush=True)

def median_from_hist(h):
    tot = h.sum(); cum = np.cumsum(h)
    return int(np.searchsorted(cum, 0.5*tot)) * FB
def frac_beyond(h, m):
    return h[int(m/FB):].sum() / h.sum()

print(f"\nforest pixels (1..{GIANT_HI}m): {base_hist.sum():,}")
print(f"forest median distance-to-access: {median_from_hist(base_hist)} m")

# neighbor-support filter on giants (remove isolated spikes)
src=osr.SpatialReference(); src.ImportFromEPSG(3857); src.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
dst=osr.SpatialReference(); dst.ImportFromEPSG(4326); dst.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
ct=osr.CoordinateTransformation(src,dst)
kept=[]; feats=[]
for r, cx, h in giants:
    x0=max(0,cx-2); y0=max(0,r-2); xs=min(5,W-x0); ys2=min(5,H-y0)
    win=cd.ReadAsArray(x0,y0,xs,ys2).astype(np.int32)
    neigh=np.delete(win.ravel(), (r-y0)*xs+(cx-x0))
    if (neigh>=30).mean() < 0.3:      # emergent tree sits in tall canopy
        continue
    dv=float(dd.ReadAsArray(cx,r,1,1)[0,0])*GROUND
    ev=int(ed.ReadAsArray(cx,r,1,1)[0,0])
    lon,lat,_=ct.TransformPoint(gt[0]+(cx+0.5)*gt[1], gt[3]+(r+0.5)*gt[5])
    kept.append((dv,h,ev,lon,lat))
    feats.append({"type":"Feature","geometry":{"type":"Point","coordinates":[round(lon,5),round(lat,5)]},
        "properties":{"height_m":h,"dist_access_m":round(dv),"elev_m":ev}})

gd=np.array([k[0] for k in kept])
print(f"\n=== TALLEST TREES ({GIANT_LO}-{GIANT_HI}m, cluster-validated) ===")
print(f"raw giant pixels: {len(giants):,}  ->  after removing isolated spikes: {len(kept):,}")
print(f"giant median distance-to-access: {int(np.median(gd))} m   (forest median: {median_from_hist(base_hist)} m)")
print(f"giant mean distance:             {int(gd.mean())} m")
for thr in (250,500,1000,2000):
    print(f"  giants > {thr:>4}m from any access: {100*(gd>thr).mean():5.1f}%   (forest baseline: {100*frac_beyond(base_hist,thr):5.1f}%)")

# chart: normalized distance distribution, giants vs forest
edges=np.array([0,100,250,500,1000,1500,2000,3000,5000,10000])
gh,_=np.histogram(gd,bins=edges); gh=gh/gh.sum()
bb=np.array([base_hist[int(edges[i]/FB):int(edges[i+1]/FB)].sum() for i in range(len(edges)-1)],dtype=float); bb/=bb.sum()
x=np.arange(len(edges)-1); w=0.4
fig,ax=plt.subplots(figsize=(10,6))
ax.bar(x-w/2,bb,w,label="all forest",color="#9cc6a6")
ax.bar(x+w/2,gh,w,label=f"tallest trees ({GIANT_LO}-{GIANT_HI}m)",color="#c0392b")
ax.set_xticks(x); ax.set_xticklabels([f"{int(edges[i])}-{int(edges[i+1])}" for i in range(len(edges)-1)],rotation=45,ha="right",fontsize=8)
ax.set_xlabel("distance to nearest access (ground m)"); ax.set_ylabel("share of pixels")
ax.set_title(f"The tallest trees sit far from access — median {int(np.median(gd))}m vs {median_from_hist(base_hist)}m for forest overall")
ax.legend(); ax.grid(alpha=.3,axis="y")
fig.tight_layout(); fig.savefig(os.path.join(S,"chart_giants_distance.png"),dpi=130)

with open(os.path.join(S,"giant_trees.geojson"),"w") as f:
    json.dump({"type":"FeatureCollection","features":feats},f)
print(f"\nwrote chart_giants_distance.png + giant_trees.geojson ({len(feats)} pts)")
# top 15 most remote giants
kept.sort(key=lambda k:-k[0])
print("\n=== 15 most REMOTE giants (dist, height, elev, lon, lat) ===")
for dv,h,ev,lon,lat in kept[:15]:
    print(f"  {int(dv):>5}m from access | {h}m tall | {ev}m elev | ({lon:.4f},{lat:.4f})")
