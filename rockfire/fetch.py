#!/usr/bin/env python3
"""Fetch open-data records for the 2026 Rock Fire (Inyo County, CA) into data/.

Five independent public sources, no API keys, no third-party Python packages:

  1. NIFC WFIGS Daily Perimeters (ArcGIS FeatureServer, public domain)
     Official mapped fire perimeters. Each polygon record carries the reported
     incident size and containment percentage current at the time it was filed,
     so it doubles as the stats time series.

  2. NASA FIRMS active-fire detections (VIIRS, 375 m, 7-day public CSV archives)
     Satellite heat detections from three satellites. Several passes per day,
     so this covers the first ~42 hours of spread that predate any official
     perimeter.

  3. CAL FIRE incident API
     The current headline acreage / containment / location.

  4. NOAA Hazard Mapping System (HMS) smoke polygons (daily shapefiles)
     Analyst-drawn smoke plumes off geostationary satellite imagery, graded
     Light / Medium / Heavy, each stamped with the scan window it came from.

  5. AirNow hourly observation files (public, no key)
     Ground-truth PM2.5 and PM10 at monitoring stations, hour by hour.

Re-run any time; it overwrites data/. The FIRMS feeds only retain 7 days, so
detections older than a week are no longer retrievable from this endpoint.
AirNow hours already fetched are cached in data/airquality.json and not
re-downloaded, so repeat runs only pull the new hours.
"""

from __future__ import annotations

import csv
import datetime as dt
import io
import json
import math
import pathlib
import struct
import sys
import urllib.error
import urllib.parse
import urllib.request
import zipfile
import zoneinfo

# --- Incident identity -------------------------------------------------------

IRWIN_ID = "{4D14BE09-9B6D-4656-8CE9-F9145290CDA5}"  # NIFC/IRWIN incident key
CALFIRE_UNIQUE_ID = "f9a0e6c2-86d8-49f5-b58b-f112ba845ca8"
IGNITION_UTC = "2026-07-20T23:50:53Z"  # CAL FIRE reported start
INCIDENT_YEAR = 2026

# Search window for satellite detections. Wide enough to include the new
# lightning starts on the fire's north end, which sit outside the perimeter.
BBOX = {"south": 36.78, "north": 37.22, "west": -118.52, "east": -117.98}

PT = zoneinfo.ZoneInfo("America/Los_Angeles")
OUT = pathlib.Path(__file__).parent / "data"

WFIGS = (
    "https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services"
    "/WFIGS_Daily_Perimeters_Public/FeatureServer/0/query"
)
CALFIRE_LIST = "https://incidents.fire.ca.gov/umbraco/api/IncidentApi/List"
FIRMS = "https://firms.modaps.eosdis.nasa.gov/data/active_fire"
HMS = "https://satepsanone.nesdis.noaa.gov/pub/FIRE/web/HMS/Smoke_Polygons/Shapefile"
AIRNOW = "https://files.airnowtech.org/airnow"

# Smoke plumes are continental in scale, so they are clipped to the West rather
# than the fire's own bounding box -- otherwise you never see where it went.
SMOKE_REGION = {"south": 31.0, "north": 44.0, "west": -126.0, "east": -111.0}
# Air-quality monitors within this distance of the fire are kept.
MONITOR_RADIUS_MI = 70
# HMS mixes two very different things under one label: plumes a few tenths of a
# degree across that belong to a specific fire, and continental "light" layers
# 100-150 degrees wide -- smoke aloft that drifted in from fires thousands of
# miles away. The second kind covers this fire every daylight hour and says
# nothing about it, so plumes wider than this are counted but not mapped.
PLUME_MAX_DEGREES = 20

FIRMS_FEEDS = {
    "Suomi NPP": "suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_USA_contiguous_and_Hawaii_7d.csv",
    "NOAA-20": "noaa-20-viirs-c2/csv/J1_VIIRS_C2_USA_contiguous_and_Hawaii_7d.csv",
    "NOAA-21": "noaa-21-viirs-c2/csv/J2_VIIRS_C2_USA_contiguous_and_Hawaii_7d.csv",
}

# Landmark coordinates resolved once from OpenStreetMap via Nominatim
# (e.g. q="Sawmill Pass Trailhead, Inyo County, California"). Baked in rather
# than re-queried on every run: they do not move, and Nominatim's usage policy
# discourages automated repeat lookups.
LANDMARKS = [
    ("Big Pine", "town", 37.16636, -118.29746),
    ("Aberdeen", "town", 36.97777, -118.25481),
    ("Independence", "town", 36.82199, -118.20513),
    ("Birch Lake Trailhead", "trailhead", 37.08745, -118.35546),
    ("Red Lake Trailhead", "trailhead", 37.03659, -118.36004),
    ("Taboose Pass Trailhead", "trailhead", 37.00955, -118.32736),
    ("Sawmill Pass Trailhead", "trailhead", 36.93891, -118.29025),
]


def get(url: str, params: dict | None = None, binary: bool = False):
    if params:
        url = f"{url}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(
        url, headers={"User-Agent": "rock-fire-viz/1.0 (open data client)"}
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        raw = resp.read()
    return raw if binary else raw.decode("utf-8")


def ms_to_pt(ms: int | None) -> str | None:
    """ArcGIS epoch milliseconds -> ISO 8601 in Pacific time."""
    if ms is None:
        return None
    return dt.datetime.fromtimestamp(ms / 1000, PT).isoformat()


# --- 1. Official perimeters --------------------------------------------------


def fetch_perimeters() -> dict:
    """Perimeter polygons ordered oldest to newest.

    poly_DateCurrent is the field that actually advances between records --
    poly_CreateDate and poly_PolygonDateTime are stamped once for the whole
    series and are identical across most rows. BurnPeriod is NIFC's own
    version counter and agrees with poly_DateCurrent ordering.
    """
    fields = [
        "OBJECTID",
        "poly_GISAcres",
        "poly_DateCurrent",
        "poly_MapMethod",
        "poly_IncidentName",
        "attr_IncidentSize",
        "attr_PercentContained",
        "attr_FireDiscoveryDateTime",
        "attr_DiscoveryAcres",
        "attr_IncidentName",
        "attr_POOCounty",
        "attr_TotalIncidentPersonnel",
        "attr_FireCause",
        "attr_PredominantFuelGroup",
        "BurnPeriod",
    ]
    fc = json.loads(
        get(
            WFIGS,
            {
                "where": f"poly_IRWINID='{IRWIN_ID}'",
                "outFields": ",".join(fields),
                "outSR": 4326,
                "f": "geojson",
            },
        )
    )
    feats = []
    for f in fc.get("features", []):
        p = f["properties"]
        feats.append(
            {
                "type": "Feature",
                "geometry": f["geometry"],
                "properties": {
                    "version": p.get("BurnPeriod"),
                    "as_of_ms": p.get("poly_DateCurrent"),
                    "as_of": ms_to_pt(p.get("poly_DateCurrent")),
                    "mapped_acres": round(p.get("poly_GISAcres") or 0, 1),
                    "reported_acres": p.get("attr_IncidentSize"),
                    "pct_contained": p.get("attr_PercentContained"),
                    "map_method": p.get("poly_MapMethod"),
                    "personnel": p.get("attr_TotalIncidentPersonnel"),
                    "discovery_acres": p.get("attr_DiscoveryAcres"),
                    "discovery_ms": p.get("attr_FireDiscoveryDateTime"),
                    "cause": p.get("attr_FireCause"),
                },
            }
        )
    feats.sort(key=lambda f: f["properties"]["as_of_ms"] or 0)
    for i, f in enumerate(feats):
        f["properties"]["seq"] = i  # 0-based index the timeline steps through
    return {"type": "FeatureCollection", "features": feats}


# --- 2. Satellite heat detections -------------------------------------------


def fetch_hotspots(after_ms: int) -> dict:
    """VIIRS detections inside BBOX at or after the ignition timestamp.

    Each VIIRS pixel is ~375 m across, so a detection means "this cell was
    radiating heat at this moment", not a precise flame location. Detections
    before ignition are dropped -- they would be other fires or false alarms.

    The FIRMS feeds only reach back seven days. Anything already written to
    hotspots.geojson is kept, so a job running hourly accumulates the whole
    history instead of losing the fire's opening days once they age out.
    """
    keep: dict[tuple, dict] = {}
    path = OUT / "hotspots.geojson"
    if path.exists():
        try:
            for f in json.loads(path.read_text()).get("features", []):
                keep[hotspot_key(f)] = f
        except (json.JSONDecodeError, KeyError):
            pass
    if keep:
        print(f"  {len(keep)} detections already on record")
    feats = []
    for sat, path in FIRMS_FEEDS.items():
        try:
            body = get(f"{FIRMS}/{path}")
        except urllib.error.URLError as exc:
            print(f"  ! {sat} feed unavailable ({exc}) -- skipped", file=sys.stderr)
            continue
        n = 0
        for r in csv.DictReader(io.StringIO(body)):
            lat, lon = float(r["latitude"]), float(r["longitude"])
            if not (BBOX["south"] <= lat <= BBOX["north"]):
                continue
            if not (BBOX["west"] <= lon <= BBOX["east"]):
                continue
            hhmm = r["acq_time"].zfill(4)
            when = dt.datetime.strptime(
                f"{r['acq_date']} {hhmm}", "%Y-%m-%d %H%M"
            ).replace(tzinfo=dt.timezone.utc)
            ts_ms = int(when.timestamp() * 1000)
            if ts_ms < after_ms:
                continue
            feat = (
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [lon, lat]},
                    "properties": {
                        "ts_ms": ts_ms,
                        "at": when.astimezone(PT).isoformat(),
                        "satellite": sat,
                        # Fire radiative power, megawatts: how much energy the
                        # pixel was radiating. Higher = more intense burning.
                        "frp": float(r["frp"]) if r.get("frp") else None,
                        "confidence": r.get("confidence"),
                        "daynight": r.get("daynight"),
                    },
                }
            )
            keep[hotspot_key(feat)] = feat
            n += 1
        print(f"  {sat}: {n} detections in this feed")
    feats = sorted(keep.values(), key=lambda f: f["properties"]["ts_ms"])
    print(f"  {len(feats)} detections total after merging")
    return {"type": "FeatureCollection", "features": feats}


def hotspot_key(f: dict) -> tuple:
    """Identity of a detection: one satellite pass over one pixel."""
    lon, lat = f["geometry"]["coordinates"]
    p = f["properties"]
    return (p["ts_ms"], p.get("satellite"), round(lon, 4), round(lat, 4))


# --- 3. CAL FIRE current snapshot -------------------------------------------


def fetch_calfire() -> dict | None:
    for params in ({"year": INCIDENT_YEAR}, {"year": INCIDENT_YEAR, "inactive": "true"}):
        try:
            rows = json.loads(get(CALFIRE_LIST, params))
        except (urllib.error.URLError, json.JSONDecodeError) as exc:
            print(f"  ! CAL FIRE list failed ({exc})", file=sys.stderr)
            return None
        for r in rows:
            if r.get("UniqueId") == CALFIRE_UNIQUE_ID:
                return r
    print("  ! incident not found in CAL FIRE list", file=sys.stderr)
    return None


# --- 4. Smoke plumes ---------------------------------------------------------
#
# HMS ships as shapefiles. Rather than pull in a GIS stack for four days of
# polygons, these two readers cover exactly the subset of the format HMS uses:
# 2D polygons in a .shp, character fields in a .dbf.


def read_dbf(buf: bytes) -> list[dict]:
    count, header_len, rec_len = struct.unpack("<IHH", buf[4:12])
    fields, off = [], 32
    while buf[off] != 0x0D:
        name = buf[off : off + 11].split(b"\0")[0].decode("latin-1")
        fields.append((name, buf[off + 16]))
        off += 32
    rows = []
    for r in range(count):
        rec = buf[header_len + r * rec_len : header_len + (r + 1) * rec_len]
        pos, row = 1, {}  # byte 0 is the deletion flag
        for name, length in fields:
            row[name] = rec[pos : pos + length].decode("latin-1").strip()
            pos += length
        rows.append(row)
    return rows


def ring_area(ring: list[list[float]]) -> float:
    """Signed area. Shapefile outer rings run clockwise (negative here)."""
    return sum(
        (ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1])
        for i in range(len(ring) - 1)
    ) / 2


def read_shp_polygons(buf: bytes) -> list[dict | None]:
    """One GeoJSON Polygon/MultiPolygon geometry per shapefile record."""
    geoms: list[dict | None] = []
    pos = 100  # file header
    while pos < len(buf):
        _, words = struct.unpack(">II", buf[pos : pos + 8])
        body = buf[pos + 8 : pos + 8 + words * 2]
        pos += 8 + words * 2
        (shape_type,) = struct.unpack("<i", body[0:4])
        if shape_type != 5:  # 0 = null; anything else is not a polygon
            geoms.append(None)
            continue
        n_parts, n_points = struct.unpack("<ii", body[36:44])
        starts = list(struct.unpack(f"<{n_parts}i", body[44 : 44 + 4 * n_parts]))
        pts_at = 44 + 4 * n_parts
        flat = struct.unpack(f"<{2 * n_points}d", body[pts_at : pts_at + 16 * n_points])
        pts = [[round(flat[i], 4), round(flat[i + 1], 4)] for i in range(0, len(flat), 2)]
        bounds = starts + [n_points]
        rings = [pts[bounds[i] : bounds[i + 1]] for i in range(n_parts)]

        # Negative signed area = outer ring, positive = hole in the ring above it.
        polys: list[list[list[list[float]]]] = []
        for ring in rings:
            if len(ring) < 4:
                continue
            if ring_area(ring) < 0 or not polys:
                polys.append([ring])
            else:
                polys[-1].append(ring)
        if not polys:
            geoms.append(None)
        elif len(polys) == 1:
            geoms.append({"type": "Polygon", "coordinates": polys[0]})
        else:
            geoms.append({"type": "MultiPolygon", "coordinates": polys})
    return geoms


def hms_time(s: str) -> int | None:
    """HMS stamps times as 'YYYYDDD HHMM' in UTC, DDD being day-of-year."""
    try:
        ymd, hhmm = s.split()
        when = dt.datetime(int(ymd[:4]), 1, 1, tzinfo=dt.timezone.utc) + dt.timedelta(
            days=int(ymd[4:]) - 1, hours=int(hhmm[:2]), minutes=int(hhmm[2:])
        )
        return int(when.timestamp() * 1000)
    except (ValueError, IndexError):
        return None


def geom_bbox(geom: dict) -> tuple[float, float, float, float]:
    xs: list[float] = []
    ys: list[float] = []

    def walk(c):
        if isinstance(c[0], (int, float)):
            xs.append(c[0])
            ys.append(c[1])
        else:
            for x in c:
                walk(x)

    walk(geom["coordinates"])
    return min(xs), min(ys), max(xs), max(ys)


def intersects_region(bbox) -> bool:
    w, s_, e, n = bbox
    r = SMOKE_REGION
    return e >= r["west"] and w <= r["east"] and n >= r["south"] and s_ <= r["north"]


def fetch_smoke(start_ms: int, end_ms: int) -> dict:
    feats: list[dict] = []
    continental: list[dict] = []
    day = dt.datetime.fromtimestamp(start_ms / 1000, dt.timezone.utc).date()
    last = dt.datetime.fromtimestamp(end_ms / 1000, dt.timezone.utc).date()
    while day <= last:
        stamp = day.strftime("%Y%m%d")
        url = f"{HMS}/{day:%Y/%m}/hms_smoke{stamp}.zip"
        try:
            z = zipfile.ZipFile(io.BytesIO(get(url, binary=True)))
        except (urllib.error.HTTPError, urllib.error.URLError, zipfile.BadZipFile) as e:
            print(f"  {stamp}: unavailable ({e})")
            day += dt.timedelta(days=1)
            continue
        base = f"hms_smoke{stamp}"
        geoms = read_shp_polygons(z.read(f"{base}.shp"))
        attrs = read_dbf(z.read(f"{base}.dbf"))
        kept = 0
        for geom, a in zip(geoms, attrs):
            if geom is None:
                continue
            bbox = geom_bbox(geom)
            if not intersects_region(bbox):
                continue
            span = max(bbox[2] - bbox[0], bbox[3] - bbox[1])
            s, e = hms_time(a.get("Start", "")), hms_time(a.get("End", ""))
            if s is None:
                continue
            if span > PLUME_MAX_DEGREES:
                continental.append({"start_ms": s, "end_ms": e or s + 3600_000,
                                    "density": a.get("Density") or "Unknown",
                                    "span_deg": round(span, 1)})
                continue
            feats.append(
                {
                    "type": "Feature",
                    "geometry": geom,
                    "properties": {
                        "start_ms": s,
                        "end_ms": e or s + 3600_000,
                        "density": a.get("Density") or "Unknown",
                        "satellite": a.get("Satellite"),
                        "day": stamp,
                        "span_deg": round(span, 2),
                    },
                }
            )
            kept += 1
        print(f"  {stamp}: {kept} local plumes over the West (of {len(attrs)} nationwide)")
        day += dt.timedelta(days=1)
    feats.sort(key=lambda f: f["properties"]["start_ms"])
    continental.sort(key=lambda c: c["start_ms"])
    print(f"  {len(continental)} continental-scale layers set aside "
          f"(wider than {PLUME_MAX_DEGREES} degrees)")
    return {
        "type": "FeatureCollection",
        "features": feats,
        "continental": continental,
    }


# --- 5. Ground-level air quality --------------------------------------------


def miles_between(lat1, lon1, lat2, lon2) -> float:
    r = 3958.8
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def compass(lat1, lon1, lat2, lon2) -> str:
    y = math.sin(math.radians(lon2 - lon1)) * math.cos(math.radians(lat2))
    x = math.cos(math.radians(lat1)) * math.sin(math.radians(lat2)) - math.sin(
        math.radians(lat1)
    ) * math.cos(math.radians(lat2)) * math.cos(math.radians(lon2 - lon1))
    deg = (math.degrees(math.atan2(y, x)) + 360) % 360
    return ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW",
            "WSW", "W", "WNW", "NW", "NNW"][round(deg / 22.5) % 16]


def fetch_air_quality(start_ms: int, end_ms: int, lat: float, lon: float) -> dict:
    """Hourly PM2.5 / PM10 at every monitor within MONITOR_RADIUS_MI.

    AirNow publishes one nationwide file per UTC hour. Each is about a megabyte,
    so hours already stored are reused instead of re-downloaded.
    """
    prev = {}
    path = OUT / "airquality.json"
    if path.exists():
        try:
            prev = json.loads(path.read_text())
        except json.JSONDecodeError:
            prev = {}
    sites: dict[str, dict] = {s["id"]: s for s in prev.get("sites", [])}
    obs: dict[str, dict] = {f"{o['site']}@{o['ts_ms']}": o for o in prev.get("obs", [])}
    have_hours = set(prev.get("hours_fetched", []))

    hour = dt.datetime.fromtimestamp(start_ms / 1000, dt.timezone.utc).replace(
        minute=0, second=0, microsecond=0
    )
    stop = dt.datetime.fromtimestamp(end_ms / 1000, dt.timezone.utc)
    todo, reused = [], 0
    while hour <= stop:
        key = hour.strftime("%Y%m%d%H")
        (todo.append(hour) if key not in have_hours else None)
        reused += key in have_hours
        hour += dt.timedelta(hours=1)
    print(f"  {len(todo)} hours to fetch, {reused} already cached")

    for i, h in enumerate(todo, 1):
        key = h.strftime("%Y%m%d%H")
        url = f"{AIRNOW}/{h:%Y/%Y%m%d}/HourlyAQObs_{key}.dat"
        try:
            body = get(url)
        except (urllib.error.HTTPError, urllib.error.URLError):
            have_hours.add(key)  # a missing hour stays missing; don't retry forever
            continue
        ts_ms = int(h.timestamp() * 1000)
        n = 0
        for row in csv.DictReader(io.StringIO(body)):
            try:
                la, lo = float(row["Latitude"]), float(row["Longitude"])
            except (ValueError, KeyError):
                continue
            pm25 = row.get("PM25", "").strip()
            pm10 = row.get("PM10", "").strip()
            if not pm25 and not pm10:
                continue
            miles = miles_between(lat, lon, la, lo)
            if miles > MONITOR_RADIUS_MI:
                continue
            sid = row["AQSID"]
            if sid not in sites:
                sites[sid] = {
                    "id": sid,
                    "name": row["SiteName"],
                    "lat": la,
                    "lon": lo,
                    "agency": row.get("DataSource"),
                    "miles": round(miles, 1),
                    "bearing": compass(lat, lon, la, lo),
                }
            obs[f"{sid}@{ts_ms}"] = {
                "site": sid,
                "ts_ms": ts_ms,
                "pm25": float(pm25) if pm25 else None,
                "pm10": float(pm10) if pm10 else None,
            }
            n += 1
        have_hours.add(key)
        if i % 12 == 0 or i == len(todo):
            print(f"    {i}/{len(todo)} hours ({key}, {n} nearby readings)")

    site_list = sorted(sites.values(), key=lambda s: s["miles"])
    for s in site_list:
        vals = [o["pm25"] for o in obs.values() if o["site"] == s["id"] and o["pm25"] is not None]
        s["pm25_readings"] = len(vals)
        s["pm25_peak"] = max(vals) if vals else None
    return {
        "sites": site_list,
        "obs": sorted(obs.values(), key=lambda o: (o["ts_ms"], o["site"])),
        "hours_fetched": sorted(have_hours),
    }


def landmark_geojson() -> dict:
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [lon, lat]},
                "properties": {"name": name, "kind": kind},
            }
            for name, kind, lat, lon in LANDMARKS
        ],
    }


def air_summary(air: dict) -> dict:
    """Where and when the worst PM2.5 hour landed, and who was reporting."""
    peak = None
    by_site: dict[str, dict] = {}
    for o in air["obs"]:
        if o["pm25"] is None:
            continue
        if peak is None or o["pm25"] > peak["pm25"]:
            peak = o
        cur = by_site.get(o["site"])
        if cur is None or o["ts_ms"] > cur["ts_ms"]:
            by_site[o["site"]] = o
    names = {s["id"]: s for s in air["sites"]}
    return {
        "monitor_count": len(air["sites"]),
        "reporting_pm25": sum(1 for s in air["sites"] if s["pm25_readings"]),
        "peak_pm25": None if peak is None else {
            "value": peak["pm25"],
            "at": ms_to_pt(peak["ts_ms"]),
            "at_ms": peak["ts_ms"],
            "site": names[peak["site"]]["name"],
            "miles": names[peak["site"]]["miles"],
            "bearing": names[peak["site"]]["bearing"],
        },
        "latest": [
            {
                "site": names[sid]["name"],
                "miles": names[sid]["miles"],
                "bearing": names[sid]["bearing"],
                "pm25": o["pm25"],
                "at": ms_to_pt(o["ts_ms"]),
            }
            for sid, o in sorted(by_site.items(), key=lambda kv: names[kv[0]]["miles"])
        ],
    }


def build_stats(
    perims: dict, hotspots: dict, calfire: dict | None,
    smoke: dict | None = None, air: dict | None = None,
) -> dict:
    """Acreage / containment time series, plus per-day detection counts."""
    series = []
    prev = None
    for f in perims["features"]:
        p = f["properties"]
        series.append(
            {
                "as_of": p["as_of"],
                "as_of_ms": p["as_of_ms"],
                "mapped_acres": p["mapped_acres"],
                "reported_acres": p["reported_acres"],
                "pct_contained": p["pct_contained"],
                "map_method": p["map_method"],
                "mapped_acres_delta": (
                    None if prev is None else round(p["mapped_acres"] - prev, 1)
                ),
                "source": "NIFC WFIGS daily perimeter",
            }
        )
        prev = p["mapped_acres"]

    if calfire:
        # CAL FIRE updates more often than NIFC republishes perimeters, so its
        # snapshot is usually the newest point on the containment curve.
        upd = dt.datetime.fromisoformat(calfire["Updated"].replace("Z", "+00:00"))
        series.append(
            {
                "as_of": upd.astimezone(PT).isoformat(),
                "as_of_ms": int(upd.timestamp() * 1000),
                "mapped_acres": None,
                "reported_acres": calfire.get("AcresBurned"),
                "pct_contained": calfire.get("PercentContained"),
                "map_method": None,
                "mapped_acres_delta": None,
                "source": "CAL FIRE incident API",
            }
        )
    series.sort(key=lambda s: s["as_of_ms"])

    by_day: dict[str, int] = {}
    for f in hotspots["features"]:
        day = f["properties"]["at"][:10]
        by_day[day] = by_day.get(day, 0) + 1

    ignition = dt.datetime.fromisoformat(IGNITION_UTC.replace("Z", "+00:00"))
    newest = perims["features"][-1]["properties"]
    # Discovery is the one hard data point before the first perimeter: the fire
    # was 0.01 acres when found, ~42 hours before anyone mapped its edge.
    discovery_ms = newest.get("discovery_ms")
    return {
        "incident": {
            "name": "Rock Fire",
            "county": "Inyo County, California",
            "cause": newest.get("cause"),
            "personnel": newest.get("personnel"),
            "discovery_acres": newest.get("discovery_acres"),
            "discovery": ms_to_pt(discovery_ms),
            "discovery_ms": discovery_ms,
            "location": (calfire or {}).get(
                "Location", "Black Rock Springs Road and Hwy 395, Poverty Hills"
            ),
            "admin_unit": (calfire or {}).get("AdminUnit"),
            "ignition": ignition.astimezone(PT).isoformat(),
            "ignition_ms": int(ignition.timestamp() * 1000),
            "lat": (calfire or {}).get("Latitude", 36.97819),
            "lon": (calfire or {}).get("Longitude", -118.24765),
            "irwin_id": IRWIN_ID,
            "calfire_url": (calfire or {}).get("Url"),
        },
        "current": {
            "acres": (calfire or {}).get("AcresBurned"),
            "pct_contained": (calfire or {}).get("PercentContained"),
            "as_of": series[-1]["as_of"] if series else None,
            "final": (calfire or {}).get("Final"),
        },
        "series": series,
        "hotspots_per_day": by_day,
        "hotspot_count": len(hotspots["features"]),
        "perimeter_count": len(perims["features"]),
        "smoke": None if smoke is None else {
            "plume_count": len(smoke["features"]),
            "continental_count": len(smoke.get("continental", [])),
            "analysed_hours": sorted({
                (f["properties"]["start_ms"] // 3600_000) * 3600_000
                for f in smoke["features"]
            }),
            "by_density": {
                d: sum(1 for f in smoke["features"] if f["properties"]["density"] == d)
                for d in ("Light", "Medium", "Heavy")
            },
        },
        "air": None if air is None else air_summary(air),
        "timeline": {
            "start_ms": min(int(ignition.timestamp() * 1000), discovery_ms or 1 << 62),
            "end_ms": max(
                [s["as_of_ms"] for s in series]
                + [f["properties"]["ts_ms"] for f in hotspots["features"]]
                + [int(ignition.timestamp() * 1000)]
            ),
        },
        "meta": {
            "fetched_at": dt.datetime.now(PT).isoformat(),
            "bbox": BBOX,
            "sources": [
                {
                    "name": "NIFC WFIGS Daily Perimeters (public domain)",
                    "url": WFIGS.replace("/query", ""),
                },
                {
                    "name": "NASA FIRMS VIIRS 375 m active fire, 7-day archive",
                    "url": f"{FIRMS}/",
                },
                {"name": "CAL FIRE incident API", "url": CALFIRE_LIST},
                {
                    "name": "NOAA HMS smoke polygons (public domain)",
                    "url": "https://www.ospo.noaa.gov/products/land/hms.html",
                },
                {
                    "name": "AirNow hourly observations (EPA / Great Basin Unified APCD)",
                    "url": "https://files.airnowtech.org/",
                },
                {
                    "name": "Landmark coordinates: OpenStreetMap via Nominatim (ODbL)",
                    "url": "https://nominatim.openstreetmap.org/",
                },
            ],
        },
    }


def write(name: str, obj) -> None:
    path = OUT / name
    path.write_text(json.dumps(obj, indent=1))
    print(f"  wrote {path.relative_to(path.parent.parent)} ({path.stat().st_size:,} bytes)")


def main() -> int:
    OUT.mkdir(exist_ok=True)
    ignition_ms = int(
        dt.datetime.fromisoformat(IGNITION_UTC.replace("Z", "+00:00")).timestamp() * 1000
    )

    print("NIFC WFIGS daily perimeters...")
    perims = fetch_perimeters()
    if not perims["features"]:
        print("! no perimeters returned -- aborting", file=sys.stderr)
        return 1
    print(f"  {len(perims['features'])} perimeter snapshots")

    print("NASA FIRMS satellite detections...")
    hotspots = fetch_hotspots(ignition_ms)

    print("CAL FIRE incident API...")
    calfire = fetch_calfire()
    if calfire:
        print(f"  {calfire['AcresBurned']:,.0f} acres, {calfire['PercentContained']}% contained")

    now_ms = int(dt.datetime.now(dt.timezone.utc).timestamp() * 1000)
    lat = (calfire or {}).get("Latitude", 36.97819)
    lon = (calfire or {}).get("Longitude", -118.24765)

    print("NOAA HMS smoke plumes...")
    smoke = fetch_smoke(ignition_ms, now_ms)

    print("AirNow hourly PM2.5 / PM10...")
    air = fetch_air_quality(ignition_ms, now_ms, lat, lon)
    peak = air_summary(air)["peak_pm25"]
    if peak:
        print(f"  peak PM2.5 {peak['value']} ug/m3 at {peak['site']} "
              f"({peak['miles']} mi {peak['bearing']}) on {peak['at'][:16]}")

    print("writing data/")
    write("perimeters.geojson", perims)
    write("hotspots.geojson", hotspots)
    write("landmarks.geojson", landmark_geojson())
    write("smoke.geojson", smoke)
    write("airquality.json", air)
    write("stats.json", build_stats(perims, hotspots, calfire, smoke, air))
    return 0


if __name__ == "__main__":
    sys.exit(main())
