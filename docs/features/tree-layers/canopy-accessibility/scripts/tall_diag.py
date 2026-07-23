#!/usr/bin/env python3
"""Diagnose the tall-value tail of the canopy height raster.
Q: are >90m pixels real 巨木群 (clustered, surrounded by tall canopy)
   or noise (isolated spikes surrounded by low/nodata)?
"""
import numpy as np
from osgeo import gdal, osr
import json, os

gdal.UseExceptions()
SCRATCH = "/private/tmp/claude-501/-Users-migu-Desktop-----gen-ai-try-ichef-----GIS-mini-taiwan-pulse/2541260e-8e2a-441b-bd0c-0f77ba47a733/scratchpad"
CANOPY = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/forestry/canopy_height_meta/canopy_height_taiwan_10m.tif"

ds = gdal.Open(CANOPY)
band = ds.GetRasterBand(1)
W, H = ds.RasterXSize, ds.RasterYSize
gt = ds.GetGeoTransform()
print(f"raster {W}x{H}  gt={gt}")

# 3857 -> 4326 transform
src_srs = osr.SpatialReference(); src_srs.ImportFromEPSG(3857)
dst_srs = osr.SpatialReference(); dst_srs.ImportFromEPSG(4326)
dst_srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)  # lon,lat
src_srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
ct = osr.CoordinateTransformation(src_srs, dst_srs)

hist = np.zeros(256, dtype=np.int64)
tall = []  # (row, col, val) for val >= 90
TALL_T = 90
STRIP = 4096
for y0 in range(0, H, STRIP):
    ys = min(STRIP, H - y0)
    a = band.ReadAsArray(0, y0, W, ys)
    hist += np.bincount(a.ravel(), minlength=256)[:256]
    rr, cc = np.where(a >= TALL_T)
    for r, c in zip(rr, cc):
        tall.append((int(r + y0), int(c), int(a[r, c])))
    print(f"  strip y0={y0} done, tall so far={len(tall)}", flush=True)

valid = hist[1:].sum()
print("\n=== height distribution (valid pixels, value=meters) ===")
print(f"total valid (>=1m): {valid:,}")
bands = [(1,5),(5,15),(15,30),(30,45),(45,60),(60,75),(75,90),(90,150)]
for lo, hi in bands:
    c = hist[lo:hi].sum()
    print(f"  {lo:3d}-{hi-1:3d} m : {c:>13,}  ({100*c/valid:5.2f}%)")
print(f"  >= 90 m       : {hist[90:].sum():>13,}  ({100*hist[90:].sum()/valid:.4f}%)")
print(f"  >= 100 m      : {hist[100:].sum():>13,}")
print(f"  == 149 m (max): {hist[149]:>13,}")

# neighbor support for tall pixels: read 5x5 window, look at surrounding canopy
print(f"\n=== neighbor support for {len(tall)} pixels >= {TALL_T}m ===")
feats = []
iso = 0; supported = 0
sample = tall if len(tall) <= 30000 else tall[::max(1,len(tall)//30000)]
for r, c, v in sample:
    x0 = max(0, c-2); y0 = max(0, r-2)
    xs = min(5, W-x0); ys = min(5, H-y0)
    win = band.ReadAsArray(x0, y0, xs, ys).astype(np.int32)
    ctr = win.copy()
    # exclude center
    cr, cc2 = r-y0, c-x0
    neigh = np.delete(win.ravel(), cr*xs+cc2)
    frac_tall = float((neigh >= 45).mean())        # neighbors that are also tall canopy
    frac_nodata = float((neigh == 0).mean())
    med = float(np.median(neigh))
    is_iso = (frac_tall < 0.3) or (frac_nodata > 0.5)
    if is_iso: iso += 1
    else: supported += 1
    lon, lat, _ = ct.TransformPoint(gt[0]+(c+0.5)*gt[1], gt[3]+(r+0.5)*gt[5])
    feats.append({"type":"Feature",
        "geometry":{"type":"Point","coordinates":[round(lon,5),round(lat,5)]},
        "properties":{"height_m":v,"neigh_median":med,"frac_neigh_tall":round(frac_tall,2),
                      "frac_nodata":round(frac_nodata,2),"isolated":is_iso}})
print(f"  isolated/noise-like : {iso}   ({100*iso/max(1,len(sample)):.1f}%)")
print(f"  cluster-supported   : {supported} ({100*supported/max(1,len(sample)):.1f}%)")

with open(os.path.join(SCRATCH,"tall_pixels_ge90.geojson"),"w") as f:
    json.dump({"type":"FeatureCollection","features":feats}, f)
print(f"\nwrote {len(feats)} tall-pixel points -> tall_pixels_ge90.geojson")

# show the very tallest, sorted
top = sorted(tall, key=lambda t:-t[2])[:20]
print("\n=== 20 tallest pixels (row,col -> lon,lat, height) ===")
for r,c,v in top:
    lon,lat,_ = ct.TransformPoint(gt[0]+(c+0.5)*gt[1], gt[3]+(r+0.5)*gt[5])
    print(f"  {v:3d}m  ({lon:.4f},{lat:.4f})")
