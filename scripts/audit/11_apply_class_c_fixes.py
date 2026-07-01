#!/usr/bin/env python3
"""
Phase 3.8 — Class C: 10 new catalog .md were created; wire them to pulse layers.

New catalog datasets → pulse layers:
  cwa_satellite            → cwaCloudImagery, cwaRadarImagery
  celestrak_satellites     → satellitesTaiwan/USA/Japan/Russia/India/Korea/France/Germany/Italy/Israel/
                              Yaogan/Jilin/Gaofen/TJS/Beidou/Shiyan (16)
  ncdr_alerts              → lifelineAlerts, floodAlerts, weatherAlerts, transitAlerts, safetyAlerts
  bus_realtime             → busLive, busIntercityLive
  opensky_flights          → flights
  lightning_taipower       → lightning
  nuclear_radiation_taipower → nuclearRadiation
  farm_roads               → farmRoads
  geothermal_wells         → geothermalWells
  eco_network_zones        → ecoNetworkZones
"""
import csv
from pathlib import Path
from collections import Counter

SCRATCH = Path("/private/tmp/claude-501/-Users-migu-Desktop-----gen-ai-try-ichef-----GIS-mini-taiwan-pulse/6c00383b-969d-4fee-96d3-b7971926a182/scratchpad/audit")

SATELLITE_LAYERS = [
    "satellitesTaiwan","satellitesYaogan","satellitesJilin","satellitesGaofen",
    "satellitesTJS","satellitesBeidou","satellitesShiyan","satellitesUSA",
    "satellitesJapan","satellitesRussia","satellitesIndia","satellitesKorea",
    "satellitesFrance","satellitesGermany","satellitesItaly","satellitesIsrael",
]
ALERT_LAYERS = ["lifelineAlerts","floodAlerts","weatherAlerts","transitAlerts","safetyAlerts"]

MAPPING = {}
# cwa_satellite → 2 imagery layers
for k in ["cwaCloudImagery","cwaRadarImagery"]:
    MAPPING[k] = ("cwa_satellite", "HIGH", "CWA File API cwa_satellite.py collector")
# celestrak → 16 satellite layers
for k in SATELLITE_LAYERS:
    MAPPING[k] = ("celestrak_satellites", "HIGH", "Space-Track/CelesTrak satellite.py + satellite_passes_daily.py collectors")
# ncdr → 5 alert layers
for k in ALERT_LAYERS:
    MAPPING[k] = ("ncdr_alerts", "HIGH", "NCDR JSONAtomFeeds via ncdr_alerts.py collector (共用 dataset 分 5 群視圖)")
# TDX bus
for k in ["busLive","busIntercityLive"]:
    MAPPING[k] = ("bus_realtime", "HIGH", "TDX RealTime bus.py + bus_intercity.py collectors")
# OpenSky
MAPPING["flights"] = ("opensky_flights", "HIGH", "OpenSky Network flight_opensky.py collector")
# 台電 lightning + nuclear
MAPPING["lightning"] = ("lightning_taipower", "HIGH", "台電落雷 CSV lightning_events.py collector")
MAPPING["nuclearRadiation"] = ("nuclear_radiation_taipower", "HIGH", "台電核安輻射 CSV nuclear_radiation.py collector")
# Truly new
MAPPING["farmRoads"] = ("farm_roads", "HIGH", "ARDSWC 農路圖 data.gov.tw 71255 / data.moa a98")
MAPPING["geothermalWells"] = ("geothermal_wells", "HIGH", "經濟部地調所 GeoTEX 地熱探勘平臺")
MAPPING["ecoNetworkZones"] = ("eco_network_zones", "HIGH", "農業部林業及自然保育署 國土生態綠網 45 條軸帶")

csv_path = SCRATCH / "match_final.csv"
with csv_path.open() as f:
    rows = list(csv.DictReader(f))
    fieldnames = list(rows[0].keys())
with (SCRATCH / "catalog_datasets.csv").open() as f:
    cat_ids = {r["dataset_id"] for r in csv.DictReader(f)}

# Verify all target datasets exist
missing = [did for k,(did,c,r) in MAPPING.items() if did not in cat_ids]
if missing:
    print(f"❌ {len(missing)} target datasets missing:", set(missing))
    exit(1)

changes = []
for row in rows:
    if row["layer_key"] not in MAPPING:
        continue
    did, conf, reason = MAPPING[row["layer_key"]]
    old = (row["status"], row["dataset_id"])
    row["status"] = "verified"
    row["dataset_id"] = did
    row["confidence"] = conf
    row["rule"] = "class_c_new_catalog"
    row["notes"] = f"CLASS-C: {reason}"
    changes.append((row["layer_key"], old, ("verified", did)))

with csv_path.open("w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=fieldnames)
    w.writeheader()
    w.writerows(rows)

print(f"═══ Class C Fixes: {len(changes)} layers wired to 10 new catalog .md ═══\n")
by_dataset = {}
for k, old, new in changes:
    by_dataset.setdefault(new[1], []).append(k)
for ds, ls in sorted(by_dataset.items()):
    print(f"  {ds:32} {len(ls)}× : {', '.join(ls[:3])}{'...' if len(ls)>3 else ''}")
print()
print("Final distribution:")
for s, c in Counter(r["status"] for r in rows).most_common():
    print(f"  {s:24} {c}")
