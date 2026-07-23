#!/bin/bash
set -e
cd "/private/tmp/claude-501/-Users-migu-Desktop-----gen-ai-try-ichef-----GIS-mini-taiwan-pulse/2541260e-8e2a-441b-bd0c-0f77ba47a733/scratchpad"

R="/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/transportation/osm_road_drive/osm_road_drive_20260626.geojson"
T="/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/mini-taiwan-pulse/public/forestry/hiking_trails.geojson"
F="/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/mini-taiwan-pulse/public/forestry/forest_roads.geojson"
DEM="/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/raw/base_map/dtm_20m/不分幅_台灣20MDEM(2024).tif"

# canopy grid (EPSG:3857): origin(13358338.895192828, 2918795.851229954) 10m 22820x42527
XMIN=13358338.895192828 ; YMAX=2918795.851229954
XMAX=13586538.895192828 ; YMIN=2493525.851229954

ts(){ date +%H:%M:%S; }
echo "[$(ts)] START prep"

echo "[$(ts)] reproject roads -> 3857 (big, ~few min)"
ogr2ogr -t_srs EPSG:3857 -f GPKG -nln access -nlt PROMOTE_TO_MULTI road_3857.gpkg "$R"
echo "[$(ts)] reproject trails -> 3857"
ogr2ogr -t_srs EPSG:3857 -f GPKG -nln access -nlt PROMOTE_TO_MULTI trail_3857.gpkg "$T"
echo "[$(ts)] reproject forest_roads -> 3857"
ogr2ogr -t_srs EPSG:3857 -f GPKG -nln access -nlt PROMOTE_TO_MULTI froad_3857.gpkg "$F"

echo "[$(ts)] create aligned empty grid"
gdal_create -outsize 22820 42527 -bands 1 -burn 0 -ot Byte \
  -a_srs EPSG:3857 -a_ullr $XMIN $YMAX $XMAX $YMIN \
  -co COMPRESS=DEFLATE -co TILED=YES access_grid.tif

echo "[$(ts)] burn roads"
gdal_rasterize -burn 1 -l access road_3857.gpkg access_grid.tif
echo "[$(ts)] burn trails"
gdal_rasterize -burn 1 -l access trail_3857.gpkg access_grid.tif
echo "[$(ts)] burn forest_roads"
gdal_rasterize -burn 1 -l access froad_3857.gpkg access_grid.tif

echo "[$(ts)] proximity (distance to nearest access, meters in 3857, cap 20km)"
gdal_proximity.py access_grid.tif dist.tif -values 1 -distunits GEO \
  -maxdist 20000 -ot UInt16 -co COMPRESS=DEFLATE -co TILED=YES

echo "[$(ts)] warp DEM -> canopy grid (bilinear)"
gdalwarp -t_srs EPSG:3857 -tr 10 10 -te $XMIN $YMIN $XMAX $YMAX -r bilinear \
  -ot Int16 -dstnodata -32768 -co COMPRESS=DEFLATE -co TILED=YES \
  -overwrite "$DEM" dem_aligned.tif

echo "[$(ts)] DONE prep"
ls -la access_grid.tif dist.tif dem_aligned.tif
