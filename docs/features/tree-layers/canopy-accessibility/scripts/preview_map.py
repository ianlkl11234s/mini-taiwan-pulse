#!/usr/bin/env python3
"""Static preview of what the app layer would show:
giant-tree points sitting in the roadless interior."""
import numpy as np
from osgeo import gdal, osr
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
import json, os

gdal.UseExceptions()
S = "/private/tmp/claude-501/-Users-migu-Desktop-----gen-ai-try-ichef-----GIS-mini-taiwan-pulse/2541260e-8e2a-441b-bd0c-0f77ba47a733/scratchpad"
CANOPY = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/forestry/canopy_height_meta/canopy_height_taiwan_10m.tif"
DIST = os.path.join(S, "dist.tif")
GROUND = 0.9157
xmin, xmax = 13358338.895192828, 13586538.895192828
ymin, ymax = 2493525.851229954, 2918795.851229954

# downsampled context
OW, OH = 620, 1150
cds = gdal.Open(CANOPY); can = cds.GetRasterBand(1).ReadAsArray(buf_xsize=OW, buf_ysize=OH)
dds = gdal.Open(DIST);  dst = dds.GetRasterBand(1).ReadAsArray(buf_xsize=OW, buf_ysize=OH).astype(float)*GROUND
land = can >= 1
remote = np.where(land, dst, np.nan)

# giants -> 3857
feats = json.load(open(os.path.join(S,"giant_trees.geojson")))["features"]
lon = np.array([f["geometry"]["coordinates"][0] for f in feats])
lat = np.array([f["geometry"]["coordinates"][1] for f in feats])
dm  = np.array([f["properties"]["dist_access_m"] for f in feats])
s3857 = osr.SpatialReference(); s3857.ImportFromEPSG(3857); s3857.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
s4326 = osr.SpatialReference(); s4326.ImportFromEPSG(4326); s4326.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
ct = osr.CoordinateTransformation(s4326, s3857)
gx = np.array([ct.TransformPoint(float(lo), float(la))[0] for lo, la in zip(lon, lat)])
gy = np.array([ct.TransformPoint(float(lo), float(la))[1] for lo, la in zip(lon, lat)])

fig, ax = plt.subplots(figsize=(7.5, 12))
# background: land in pale grey, remoteness shaded
ax.imshow(np.where(land, 1, np.nan), extent=[xmin,xmax,ymin,ymax], origin="upper",
          cmap="Greys", vmin=0, vmax=6, interpolation="nearest")
im = ax.imshow(remote, extent=[xmin,xmax,ymin,ymax], origin="upper",
               cmap="Blues", vmin=0, vmax=4000, alpha=0.75, interpolation="nearest")
# giants
sc = ax.scatter(gx, gy, c=dm, cmap="autumn_r", s=6, vmin=0, vmax=6000,
                edgecolors="k", linewidths=0.15, zorder=5)
ax.set_title("Taiwan's tallest trees (>=45m, n=7,823) vs remoteness from any road/trail/forest-road",
             fontsize=10)
ax.set_xlabel("EPSG:3857 X"); ax.set_ylabel("EPSG:3857 Y")
cb1 = fig.colorbar(im, ax=ax, fraction=0.035, pad=0.01); cb1.set_label("distance to access (m) — background")
cb2 = fig.colorbar(sc, ax=ax, fraction=0.035, pad=0.06); cb2.set_label("giant's distance to access (m)")
ax.set_aspect("equal")
fig.tight_layout(); fig.savefig(os.path.join(S,"preview_giants_map.png"), dpi=140)
print("wrote preview_giants_map.png")
print(f"giants plotted: {len(feats):,}  | dist range {int(dm.min())}-{int(dm.max())}m")
