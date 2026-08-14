#!/usr/bin/env python3
"""Fetch live riding conditions for rickrothbart.com/bayrides.

Writes data/env.json. Everything here is keyless.

  1. National Weather Service  - hourly forecast per zone: temperature, wind
     speed and direction, chance of rain, sky cover
  2. NWS station observations  - measured rain over the last 4 days, which is
     what decides whether the gravel is rideable
  3. AirNow HourlyAQObs        - ground PM2.5 and US AQI
  4. NOAA HMS                  - analyst-drawn smoke plumes
  5. NIFC WFIGS                - active fire incidents in California

Stateful where it pays: NWS gridpoint lookups and the rain history are carried
forward from the previous env.json, so a normal run makes ~30 small requests.
"""
from __future__ import annotations

import csv, datetime as dt, io, json, math, pathlib, sys, time
import urllib.error, urllib.parse, urllib.request, zipfile

HERE = pathlib.Path(__file__).parent
OUT = HERE / "data"
OUT.mkdir(exist_ok=True)
ENV_PATH = OUT / "env.json"
ZONES = json.load(open(HERE / "zones.json"))

UA = "bayrides/1.0 (rickrothbart.com; pocolypz@gmail.com)"
BBOX = {"south": 36.6, "north": 39.3, "west": -123.9, "east": -121.0}

NWS = "https://api.weather.gov"
AIRNOW = "https://files.airnowtech.org/airnow"
HMS = "https://satepsanone.nesdis.noaa.gov/pub/FIRE/web/HMS/Smoke_Polygons/Shapefile"
WFIGS = ("https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services"
         "/WFIGS_Incident_Locations_Current/FeatureServer/0/query")

RAIN_DAYS = 4           # how far back the mud calculation looks
FORECAST_HOURS = 14     # "now and the rest of the ride"


def get(url, params=None, binary=False, timeout=60, tries=3):
    if params:
        url = f"{url}?{urllib.parse.urlencode(params)}"
    last = None
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": UA, "Accept": "application/geo+json, application/json, */*"})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                raw = r.read()
            return raw if binary else raw.decode("utf-8")
        except Exception as e:
            last = e
            time.sleep(2 + 3 * attempt)
    raise last


def getj(url, params=None, **kw):
    return json.loads(get(url, params, **kw))


def now_utc():
    return dt.datetime.now(dt.timezone.utc)


def iso(t):
    return t.strftime("%Y-%m-%dT%H:%M:%SZ")


def c_to_f(c):
    return None if c is None else c * 9 / 5 + 32


def inbox(lat, lon):
    return (BBOX["south"] <= lat <= BBOX["north"]
            and BBOX["west"] <= lon <= BBOX["east"])


def haversine(a, b):
    R = 6371.0
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dl = math.radians(b[1] - a[1])
    h = (math.sin((p2 - p1) / 2) ** 2
         + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2)
    return 2 * R * math.asin(math.sqrt(h))


# --- 1. NWS hourly forecast ---------------------------------------------------

def grid_for(zone, cache):
    """Map a zone to its NWS gridpoint. Grids never move, so cache forever."""
    if zone["id"] in cache:
        return cache[zone["id"]]
    d = getj(f"{NWS}/points/{zone['lat']:.4f},{zone['lon']:.4f}")
    p = d["properties"]
    g = {"office": p["gridId"], "x": p["gridX"], "y": p["gridY"],
         "tz": p.get("timeZone", "America/Los_Angeles")}
    cache[zone["id"]] = g
    return g


def fetch_forecast(prev):
    grids = dict(prev.get("grids") or {})
    out, failed = {}, []
    for z in ZONES:
        try:
            g = grid_for(z, grids)
            d = getj(f"{NWS}/gridpoints/{g['office']}/{g['x']},{g['y']}/forecast/hourly")
            periods = d["properties"]["periods"][:FORECAST_HOURS]
            hours = []
            for p in periods:
                ws = p.get("windSpeed") or ""
                mph = 0
                nums = [int(s) for s in ws.replace("to", " ").split() if s.isdigit()]
                if nums:
                    mph = max(nums)
                hours.append({
                    "t": p["startTime"][:16],
                    "temp": p.get("temperature"),
                    "wind": mph,
                    "dir": p.get("windDirection") or "",
                    "rain": (p.get("probabilityOfPrecipitation") or {}).get("value") or 0,
                    "sky": p.get("shortForecast", ""),
                })
            if hours:
                out[z["id"]] = hours
        except Exception as e:
            failed.append(f"{z['id']}: {e}")
        time.sleep(0.35)          # be a good citizen with a public API
    return out, grids, failed


# --- 2. measured rain, for the mud flag ---------------------------------------

def fetch_rain(prev):
    """Rolling record of measured precipitation per reporting station.

    Carries the previous run's observations forward and only asks for the
    window it is missing, so the hourly job stays small.
    """
    prev_rain = {k: dict(v) for k, v in (prev.get("rain") or {}).items()}
    floor = now_utc() - dt.timedelta(days=RAIN_DAYS)
    stations = sorted({z["station"] for z in ZONES})
    out, failed = {}, []

    for sid in stations:
        have = prev_rain.get(sid, {})
        have = {t: v for t, v in have.items() if t >= iso(floor)[:13]}
        newest = max(have) if have else None
        start = (dt.datetime.strptime(newest, "%Y-%m-%dT%H").replace(tzinfo=dt.timezone.utc)
                 if newest else floor)
        try:
            d = getj(f"{NWS}/stations/{sid}/observations",
                     {"start": iso(start), "limit": 500})
            for f in d.get("features", []):
                p = f.get("properties") or {}
                ts = (p.get("timestamp") or "")[:13]
                if not ts:
                    continue
                mm = None
                for key in ("precipitationLastHour", "precipitationLast3Hours",
                            "precipitationLast6Hours"):
                    v = (p.get(key) or {}).get("value")
                    if v is not None:
                        mm = max(mm or 0, float(v))
                if mm is not None:
                    have[ts] = round(mm, 2)
        except Exception as e:
            failed.append(f"{sid}: {e}")
        out[sid] = have
        time.sleep(0.35)
    return out, failed


def rain_summary(rain):
    """Per station: total mm in the window and hours since it last rained."""
    now = now_utc()
    summary = {}
    for sid, obs in rain.items():
        total = 0.0
        last_wet = None
        for ts, mm in obs.items():
            if mm and mm > 0.2:
                total += mm
                t = dt.datetime.strptime(ts, "%Y-%m-%dT%H").replace(tzinfo=dt.timezone.utc)
                if last_wet is None or t > last_wet:
                    last_wet = t
        summary[sid] = {
            "mm": round(total, 1),
            "dry_hours": None if last_wet is None
                         else int((now - last_wet).total_seconds() // 3600),
            "obs": len(obs),
        }
    return summary


# --- 3. AirNow ----------------------------------------------------------------

def fetch_aqi():
    """Newest nationwide hourly observation file, clipped to the Bay Area."""
    now = now_utc().replace(minute=0, second=0, microsecond=0)
    for back in range(0, 6):
        h = now - dt.timedelta(hours=back)
        key = h.strftime("%Y%m%d%H")
        url = f"{AIRNOW}/{h:%Y}/{h:%Y%m%d}/HourlyAQObs_{key}.dat"
        try:
            raw = get(url, timeout=90)
        except Exception:
            continue
        sites = []
        for row in csv.DictReader(io.StringIO(raw)):
            try:
                lat = float(row.get("Latitude") or "nan")
                lon = float(row.get("Longitude") or "nan")
            except ValueError:
                continue
            if not inbox(lat, lon):
                continue
            aqi = row.get("AQI") or row.get("PM25_AQI") or ""
            try:
                aqi = int(float(aqi))
            except ValueError:
                continue
            if aqi <= 0:
                continue          # AirNow writes 0 / -1 for "no reading"

            sites.append({"name": (row.get("SiteName") or "").strip(),
                          "lat": round(lat, 4), "lon": round(lon, 4), "aqi": aqi})
        if sites:
            return {"hour": key, "sites": sites}
    return {"hour": None, "sites": []}


# --- 4. HMS smoke plumes (shapefile in a zip, parsed by hand) -----------------

def _shp_polygons(shp_bytes):
    import struct
    out = []
    pos, n = 100, len(shp_bytes)
    while pos + 8 <= n:
        _, clen = struct.unpack(">ii", shp_bytes[pos:pos + 8])
        rec = shp_bytes[pos + 8: pos + 8 + clen * 2]
        pos += 8 + clen * 2
        if len(rec) < 4:
            continue
        if struct.unpack("<i", rec[:4])[0] != 5:      # polygon only
            continue
        nparts, npoints = struct.unpack("<ii", rec[36:44])
        parts = struct.unpack(f"<{nparts}i", rec[44:44 + 4 * nparts])
        pxy = 44 + 4 * nparts
        pts = struct.unpack(f"<{2 * npoints}d", rec[pxy:pxy + 16 * npoints])
        rings = []
        for i in range(nparts):
            a = parts[i]
            b = parts[i + 1] if i + 1 < nparts else npoints
            ring = [[round(pts[2 * j], 3), round(pts[2 * j + 1], 3)] for j in range(a, b)]
            if len(ring) >= 4:
                rings.append(ring)
        if rings:
            out.append(rings)
    return out


def _dbf_field(dbf_bytes, field):
    import struct
    nrec, hlen, rlen = struct.unpack("<IHH", dbf_bytes[4:12])
    fields, pos = [], 32
    while dbf_bytes[pos] != 0x0D:
        name = dbf_bytes[pos:pos + 11].split(b"\0")[0].decode("latin-1")
        flen = dbf_bytes[pos + 16]
        fields.append((name, flen))
        pos += 32
    idx = {n: i for i, (n, _) in enumerate(fields)}
    if field not in idx:
        return [""] * nrec
    offs, out = 1, []
    for i, (n, flen) in enumerate(fields):
        if n == field:
            break
        offs += flen
    flen = fields[idx[field]][1]
    for r in range(nrec):
        base = hlen + r * rlen
        out.append(dbf_bytes[base + offs: base + offs + flen].decode("latin-1").strip())
    return out


def fetch_smoke():
    day = now_utc()
    for back in range(0, 3):
        d = day - dt.timedelta(days=back)
        url = f"{HMS}/{d:%Y}/{d:%m}/hms_smoke{d:%Y%m%d}.zip"
        try:
            raw = get(url, binary=True, timeout=90)
            z = zipfile.ZipFile(io.BytesIO(raw))
        except Exception:
            continue
        shp = dbf = None
        for n in z.namelist():
            if n.lower().endswith(".shp"):
                shp = z.read(n)
            if n.lower().endswith(".dbf"):
                dbf = z.read(n)
        if not shp:
            continue
        polys = _shp_polygons(shp)
        dens = _dbf_field(dbf, "Density") if dbf else [""] * len(polys)
        feats = []
        for i, rings in enumerate(polys):
            xs = [p[0] for r in rings for p in r]
            ys = [p[1] for r in rings for p in r]
            if (max(xs) < BBOX["west"] or min(xs) > BBOX["east"]
                    or max(ys) < BBOX["south"] or min(ys) > BBOX["north"]):
                continue
            if (max(xs) - min(xs)) > 25:      # continental sheets: counted, not drawn
                continue
            feats.append({"type": "Feature",
                          "properties": {"density": (dens[i] if i < len(dens) else "").strip()},
                          "geometry": {"type": "Polygon", "coordinates": rings}})
        return {"day": f"{d:%Y%m%d}", "type": "FeatureCollection", "features": feats}
    return {"day": None, "type": "FeatureCollection", "features": []}


# --- 5. active fires ----------------------------------------------------------

def fetch_fires():
    try:
        d = getj(WFIGS, {
            "where": "POOState='US-CA'", "outFields": "*", "f": "geojson",
            "resultRecordCount": 2000, "returnGeometry": "true"}, timeout=120)
    except Exception:
        return {"type": "FeatureCollection", "features": []}
    feats = []
    for f in d.get("features", []):
        g = f.get("geometry") or {}
        c = g.get("coordinates") or []
        if len(c) != 2 or not inbox(c[1], c[0]):
            continue
        p = f.get("properties") or {}
        acres = p.get("DailyAcres") or p.get("IncidentSize") or 0
        try:
            acres = float(acres or 0)
        except (TypeError, ValueError):
            acres = 0
        if acres < 10:
            continue
        feats.append({"type": "Feature", "geometry": g, "properties": {
            "name": p.get("IncidentName") or "Fire",
            "acres": round(acres),
            "contained": p.get("PercentContained"),
            "discovered": p.get("FireDiscoveryDateTime"),
        }})
    feats.sort(key=lambda f: -f["properties"]["acres"])
    return {"type": "FeatureCollection", "features": feats[:60]}


# --- assemble -----------------------------------------------------------------

def nearest_aqi(zone, sites):
    if not sites:
        return None
    s = min(sites, key=lambda x: haversine((zone["lat"], zone["lon"]), (x["lat"], x["lon"])))
    d = haversine((zone["lat"], zone["lon"]), (s["lat"], s["lon"]))
    return {"aqi": s["aqi"], "site": s["name"], "km": round(d)} if d < 60 else None


def main():
    prev = {}
    if ENV_PATH.exists():
        try:
            prev = json.load(open(ENV_PATH))
        except Exception:
            prev = {}

    problems = []
    fc, grids, wfail = fetch_forecast(prev)
    problems += wfail
    rain, rfail = fetch_rain(prev)
    problems += rfail
    aq = fetch_aqi()
    smoke = fetch_smoke()
    fires = fetch_fires()
    rsum = rain_summary(rain)

    zones = []
    for z in ZONES:
        hours = fc.get(z["id"]) or (prev.get("zones") and next(
            (p["hours"] for p in prev["zones"] if p["id"] == z["id"]), None)) or []
        zones.append({
            "id": z["id"], "name": z["name"], "lat": z["lat"], "lon": z["lon"],
            "hours": hours,
            "aq": nearest_aqi(z, aq["sites"]),
            "rain": rsum.get(z["station"], {}),
        })

    env = {
        "meta": {
            "updated": iso(now_utc()),
            "aq_hour": aq["hour"],
            "smoke_day": smoke.get("day"),
            "zones_with_forecast": sum(1 for z in zones if z["hours"]),
            "problems": problems[:20],
        },
        "zones": zones,
        "grids": grids,
        "rain": rain,
        "smoke": smoke,
        "fires": fires,
    }
    json.dump(env, open(ENV_PATH, "w"), separators=(",", ":"))
    print(f"{env['meta']['zones_with_forecast']}/{len(ZONES)} zones forecast, "
          f"{len(aq['sites'])} AQ sites, {len(smoke['features'])} plumes, "
          f"{len(fires['features'])} fires, {ENV_PATH.stat().st_size // 1024} KB")
    if problems:
        print("problems:", "; ".join(problems[:5]), file=sys.stderr)


if __name__ == "__main__":
    main()
