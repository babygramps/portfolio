#!/usr/bin/env python3
"""Fetch current smoke / air quality / wildfire data for rickrothbart.com/pnwhikes26.

Writes data/env.json. Stateful on the AirNow side: pass an existing env.json
and only the hours it lacks are downloaded (each hour is a ~1 MB nationwide
file). Smoke and fire feeds are small and re-fetched whole every run.

Sources, all keyless:
  1. AirNow HourlyAQObs files  - ground PM2.5 + US AQI, includes BC stations
  2. NOAA HMS smoke polygons   - analyst-drawn plumes, Light/Medium/Heavy
  3. BC Wildfire Service WFS   - active fire points
  4. NIFC WFIGS ArcGIS         - US incident points (WA)
"""
from __future__ import annotations

import csv, datetime as dt, io, json, math, pathlib, struct, sys, time, urllib.error, urllib.parse, urllib.request, zipfile

OUT = pathlib.Path(__file__).parent / "data"
OUT.mkdir(exist_ok=True)
ENV_PATH = OUT / "env.json"

BBOX = {"south": 46.7, "north": 51.3, "west": -129.3, "east": -120.7}
PLUME_MAX_DEGREES = 25   # continental light sheets are counted, not drawn
TREND_HOURS = 26         # rolling AQI window kept per station

AIRNOW = "https://files.airnowtech.org/airnow"
HMS = "https://satepsanone.nesdis.noaa.gov/pub/FIRE/web/HMS/Smoke_Polygons/Shapefile"
BC_WFS = "https://openmaps.gov.bc.ca/geo/pub/ows"
WFIGS_PTS = ("https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services"
             "/WFIGS_Incident_Locations_Current/FeatureServer/0/query")


def get(url, params=None, binary=False):
    if params:
        url = f"{url}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"User-Agent": "pnwhikes26/1.0 (open data client)"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        raw = resp.read()
    return raw if binary else raw.decode("utf-8")


def inbox(lat, lon):
    return BBOX["south"] <= lat <= BBOX["north"] and BBOX["west"] <= lon <= BBOX["east"]


# --- AirNow -------------------------------------------------------------------

def fetch_airnow(prev):
    """Rolling TREND_HOURS window of PM2.5 AQI per station in the region."""
    now = dt.datetime.now(dt.timezone.utc).replace(minute=0, second=0, microsecond=0)
    floor_ms = int((now - dt.timedelta(hours=TREND_HOURS)).timestamp() * 1000)

    sites: dict[str, dict] = {}
    obs: dict[str, dict] = {}
    have = set()
    for s in prev.get("aq", []):
        sites[s["id"]] = {"id": s["id"], "name": s["name"], "lat": s["lat"], "lon": s["lon"],
                          "agency": s.get("agency")}
        for ts, aqi, pm in s.get("obs", []):
            if ts >= floor_ms:
                obs[f"{s['id']}@{ts}"] = {"site": s["id"], "ts": ts, "aqi": aqi, "pm25": pm}
                have.add(ts)

    fetched = 0
    for k in range(TREND_HOURS):
        h = now - dt.timedelta(hours=k)
        ts = int(h.timestamp() * 1000)
        if ts in have:
            continue
        key = h.strftime("%Y%m%d%H")
        url = f"{AIRNOW}/{h:%Y/%Y%m%d}/HourlyAQObs_{key}.dat"
        try:
            body = get(url)
        except (urllib.error.HTTPError, urllib.error.URLError):
            continue
        fetched += 1
        for row in csv.DictReader(io.StringIO(body)):
            try:
                la, lo = float(row["Latitude"]), float(row["Longitude"])
            except (ValueError, KeyError):
                continue
            if not inbox(la, lo):
                continue
            pm25 = (row.get("PM25") or "").strip()
            aqi = (row.get("PM25_AQI") or "").strip()
            if not aqi and not pm25:
                continue
            sid = row["AQSID"]
            sites.setdefault(sid, {"id": sid, "name": row["SiteName"], "lat": la, "lon": lo,
                                   "agency": row.get("DataSource")})
            obs[f"{sid}@{ts}"] = {"site": sid, "ts": ts,
                                  "aqi": int(float(aqi)) if aqi else None,
                                  "pm25": float(pm25) if pm25 else None}
    print(f"  airnow: fetched {fetched} new hours")

    latest_ts = max((o["ts"] for o in obs.values()), default=None)
    out = []
    for sid, s in sites.items():
        rows = sorted((o for o in obs.values() if o["site"] == sid), key=lambda o: o["ts"])
        rows = [o for o in rows if o["ts"] >= floor_ms]
        if not rows:
            continue
        cur = rows[-1]
        if latest_ts and cur["ts"] < latest_ts - 3 * 3600_000:
            continue  # stale station
        out.append({**s, "aqi": cur["aqi"], "pm25": cur["pm25"], "ts": cur["ts"],
                    "obs": [[o["ts"], o["aqi"], o["pm25"]] for o in rows]})
    out.sort(key=lambda s: s["id"])
    return out, latest_ts


# --- HMS smoke (stdlib .shp/.dbf readers) --------------------------------------

def read_dbf(buf):
    count, header_len, rec_len = struct.unpack("<IHH", buf[4:12])
    fields, off = [], 32
    while buf[off] != 0x0D:
        name = buf[off:off + 11].split(b"\0")[0].decode("latin-1")
        fields.append((name, buf[off + 16]))
        off += 32
    rows = []
    for r in range(count):
        rec = buf[header_len + r * rec_len: header_len + (r + 1) * rec_len]
        pos, row = 1, {}
        for name, length in fields:
            row[name] = rec[pos:pos + length].decode("latin-1").strip()
            pos += length
        rows.append(row)
    return rows


def ring_area(ring):
    return sum((ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1])
               for i in range(len(ring) - 1)) / 2


def read_shp_polygons(buf):
    geoms, pos = [], 100
    while pos < len(buf):
        _, words = struct.unpack(">II", buf[pos:pos + 8])
        body = buf[pos + 8: pos + 8 + words * 2]
        pos += 8 + words * 2
        (shape_type,) = struct.unpack("<i", body[0:4])
        if shape_type != 5:
            geoms.append(None)
            continue
        n_parts, n_points = struct.unpack("<ii", body[36:44])
        starts = list(struct.unpack(f"<{n_parts}i", body[44:44 + 4 * n_parts]))
        pts_at = 44 + 4 * n_parts
        flat = struct.unpack(f"<{2 * n_points}d", body[pts_at:pts_at + 16 * n_points])
        pts = [[round(flat[i], 3), round(flat[i + 1], 3)] for i in range(0, len(flat), 2)]
        bounds = starts + [n_points]
        rings = [pts[bounds[i]:bounds[i + 1]] for i in range(n_parts)]
        polys = []
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


def hms_time(s):
    try:
        ymd, hhmm = s.split()
        when = dt.datetime(int(ymd[:4]), 1, 1, tzinfo=dt.timezone.utc) + dt.timedelta(
            days=int(ymd[4:]) - 1, hours=int(hhmm[:2]), minutes=int(hhmm[2:]))
        return int(when.timestamp() * 1000)
    except (ValueError, IndexError):
        return None


def geom_bbox(geom):
    xs, ys = [], []

    def walk(c):
        if isinstance(c[0], (int, float)):
            xs.append(c[0]); ys.append(c[1])
        else:
            for x in c:
                walk(x)
    walk(geom["coordinates"])
    return min(xs), min(ys), max(xs), max(ys)


def fetch_smoke():
    """Most recent HMS analysis day that has plumes over the region.

    The current day's file appears early UTC with nothing drawn yet, so an
    empty today falls back to yesterday; only if both days are empty do we
    report a genuinely clear region."""
    today = dt.datetime.now(dt.timezone.utc).date()
    empty = None
    for day in (today, today - dt.timedelta(days=1)):
        stamp = day.strftime("%Y%m%d")
        url = f"{HMS}/{day:%Y/%m}/hms_smoke{stamp}.zip"
        try:
            z = zipfile.ZipFile(io.BytesIO(get(url, binary=True)))
        except Exception as e:
            print(f"  hms {stamp}: unavailable ({e})")
            continue
        base = f"hms_smoke{stamp}"
        geoms = read_shp_polygons(z.read(f"{base}.shp"))
        attrs = read_dbf(z.read(f"{base}.dbf"))
        feats, continental = [], []
        for geom, a in zip(geoms, attrs):
            if geom is None:
                continue
            w, s_, e, n = geom_bbox(geom)
            if not (e >= BBOX["west"] and w <= BBOX["east"] and n >= BBOX["south"] and s_ <= BBOX["north"]):
                continue
            span = max(e - w, n - s_)
            st = hms_time(a.get("Start", ""))
            if st is None:
                continue
            rec = {"density": a.get("Density") or "Unknown", "start_ms": st,
                   "end_ms": hms_time(a.get("End", "")) or st + 3600_000,
                   "satellite": a.get("Satellite"), "span_deg": round(span, 1)}
            if span > PLUME_MAX_DEGREES:
                continental.append(rec)
                continue
            feats.append({"type": "Feature", "geometry": geom, "properties": rec})
        print(f"  hms {stamp}: {len(feats)} plumes, {len(continental)} continental layers")
        result = {"type": "FeatureCollection", "features": feats,
                  "continental": continental, "analysis_day": stamp}
        if feats or continental:
            return result
        if empty is None:
            empty = result
    return empty or {"type": "FeatureCollection", "features": [], "continental": [],
                     "analysis_day": None}


# --- Fires ---------------------------------------------------------------------

def bc_fires():
    feats = []
    layer = "pub:WHSE_LAND_AND_NATURAL_RESOURCE.PROT_CURRENT_FIRE_PNTS_SP"
    raw = json.loads(get(BC_WFS, {"service": "WFS", "version": "2.0.0", "request": "GetFeature",
                                  "typeNames": layer, "outputFormat": "application/json",
                                  "srsName": "EPSG:4326"}))
    for f in raw.get("features", []):
        p, g = f.get("properties", {}), f.get("geometry")
        if not g or g["type"] != "Point":
            continue
        lon, lat = g["coordinates"][:2]
        if not inbox(lat, lon) or (p.get("FIRE_STATUS") or "").strip().lower() == "out":
            continue
        feats.append({"type": "Feature",
                      "geometry": {"type": "Point", "coordinates": [round(lon, 4), round(lat, 4)]},
                      "properties": {"name": p.get("INCIDENT_NAME") or p.get("FIRE_NUMBER"),
                                     "status": p.get("FIRE_STATUS"), "size_ha": p.get("CURRENT_SIZE"),
                                     "where": p.get("GEOGRAPHIC_DESCRIPTION"),
                                     "discovered": p.get("IGNITION_DATE"),
                                     "url": p.get("FIRE_URL"), "src": "BC Wildfire Service"}})
    print(f"  bc: {len(feats)} active fires in region")
    return feats


def us_fires():
    feats = []
    # NB: invalid outFields fail silently as an empty result on this layer, so
    # this list must only name fields that exist; bbox filtering is client-side.
    raw = json.loads(get(WFIGS_PTS, {
        "where": "POOState='US-WA'",
        "outFields": "IncidentName,IncidentSize,PercentContained,IncidentTypeCategory,FireDiscoveryDateTime",
        "f": "geojson"}))
    for f in raw.get("features", []):
        p, g = f.get("properties", {}), f.get("geometry")
        if not g:
            continue
        lon, lat = g["coordinates"][:2]
        if not inbox(lat, lon):
            continue
        if p.get("IncidentName") and "border 2" in p["IncidentName"].lower():
            continue  # cross-border fire already in the BC feed
        pc = p.get("PercentContained")
        feats.append({"type": "Feature",
                      "geometry": {"type": "Point", "coordinates": [round(lon, 4), round(lat, 4)]},
                      "properties": {"name": p.get("IncidentName"),
                                     "status": f"{pc:.0f}% contained" if pc is not None else None,
                                     "size_acres": p.get("IncidentSize"),
                                     "type": p.get("IncidentTypeCategory"),
                                     "discovered_ms": p.get("FireDiscoveryDateTime"),
                                     "src": "NIFC WFIGS"}})
    print(f"  wfigs: {len(feats)} US incidents in region")
    return feats


def main():
    prev = {}
    if ENV_PATH.exists():
        try:
            prev = json.loads(ENV_PATH.read_text())
            print(f"restored previous env.json ({len(prev.get('aq', []))} stations)")
        except json.JSONDecodeError:
            prev = {}

    print("AirNow...")
    aq, latest_ts = fetch_airnow(prev)
    print("NOAA HMS smoke...")
    smoke = fetch_smoke()
    if smoke["analysis_day"] is None and prev.get("meta", {}).get("smoke_day"):
        # HMS unreachable: keep the last good analysis rather than publishing
        # a falsely clear map.
        print("  hms unreachable — carrying forward previous analysis "
              f"({prev['meta']['smoke_day']})")
        smoke = {**prev["smoke"], "analysis_day": prev["meta"]["smoke_day"],
                 "continental": prev["meta"].get("continental_smoke", [])}
    print("Fires...")
    # The fire feeds (openmaps.gov.bc.ca especially) time out intermittently in
    # fire season. A dead feed shouldn't kill the whole refresh: retry once,
    # then carry that feed's previous features forward. The sanity gate in the
    # workflow still fails the run if the air-quality data itself goes stale.
    def try_feed(fn, label):
        for attempt in (1, 2):
            try:
                return fn()
            except Exception as e:
                print(f"  {label}: attempt {attempt} failed ({e})")
                if attempt == 1:
                    time.sleep(20)
        return None

    prev_fires = prev.get("fires", {}).get("features", [])
    stale_feeds = []
    bc = try_feed(bc_fires, "bc wfs")
    if bc is None:
        bc = [f for f in prev_fires if f.get("properties", {}).get("src") == "BC Wildfire Service"]
        stale_feeds.append("bc_fires")
        print(f"  bc: carrying forward {len(bc)} previous fires")
    us = try_feed(us_fires, "wfigs")
    if us is None:
        us = [f for f in prev_fires if f.get("properties", {}).get("src") == "NIFC WFIGS"]
        stale_feeds.append("us_fires")
        print(f"  wfigs: carrying forward {len(us)} previous incidents")
    fires = bc + us

    env = {
        "meta": {
            "aq_latest_ms": latest_ts,
            "smoke_day": smoke.pop("analysis_day"),
            "continental_smoke": smoke.pop("continental"),
            "fetched": dt.datetime.now(dt.timezone.utc).isoformat(timespec="minutes"),
            "stale_feeds": stale_feeds,
        },
        "aq": aq,
        "smoke": smoke,
        "fires": {"type": "FeatureCollection", "features": fires},
    }
    txt = json.dumps(env, separators=(",", ":"))
    ENV_PATH.write_text(txt)
    print(f"env.json {len(txt) // 1024} KB | {len(aq)} stations, "
          f"{len(smoke['features'])} plumes, {len(fires)} fires")
    return 0


if __name__ == "__main__":
    sys.exit(main())
