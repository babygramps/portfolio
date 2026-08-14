/* ============================================================ live layer
   Only the deployed page at rickrothbart.com/bayrides runs this. It fetches
   data/env.json — refreshed hourly by GitHub Actions — and folds today's
   conditions into the same cards and panel the offline version renders.
   If the fetch fails the page simply stays as it was. */
(function live(){
  const AQ_BANDS = [
    [50,  'Good',            'var(--ok)'],
    [100, 'Moderate',        'var(--warn)'],
    [150, 'Poor for some',   'var(--hard)'],
    [200, 'Unhealthy',       'var(--max)'],
    [300, 'Very unhealthy',  'var(--max)'],
    [9999,'Hazardous',       'var(--max)'],
  ];
  const band = a => AQ_BANDS.find(b => a <= b[0]) || AQ_BANDS[AQ_BANDS.length - 1];

  function km(a, b){
    const R = 6371, r = Math.PI / 180;
    const p1 = a[0] * r, p2 = b[0] * r, dl = (b[1] - a[1]) * r;
    const h = Math.sin((p2 - p1) / 2) ** 2
            + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  const cache = new Map();

  function zoneNear(pt){
    let best = null, bd = 1e9;
    LIVE.zones.forEach(z => {
      const d = km(pt, [z.lat, z.lon]);
      if (d < bd){ bd = d; best = z; }
    });
    return best;
  }

  /* Conditions for one route: at the start, and at whichever zone is nearest
     the far end of the ride. On a Marin loop those two are 20 degrees apart. */
  function cond(r){
    if (cache.has(r.id)) return cache.get(r.id);
    const s = r.line[0];
    let far = s, fd = 0;
    for (let i = 0; i < r.line.length; i += 4){
      const d = km(s, r.line[i]);
      if (d > fd){ fd = d; far = r.line[i]; }
    }
    const zs = zoneNear(s), zf = zoneNear(far);
    const hs = zs && zs.hours[0], hf = zf && zf.hours[0];
    const next = (zs ? zs.hours : []).slice(0, 12);
    const rainMax = next.reduce((m, h) => Math.max(m, h.rain || 0), 0);
    const temps = next.map(h => h.temp).filter(t => t != null)
      .concat((zf ? zf.hours.slice(0, 12) : []).map(h => h.temp).filter(t => t != null));

    const aq = (zs && zs.aq) || (zf && zf.aq) || null;
    const rain = (zs && zs.rain) || {};
    const wet = (rain.mm || 0) >= 5 && rain.dry_hours != null && rain.dry_hours < 60;
    const mud = wet && (r.bike === 'gravel' || r.bike === 'mixed');

    const smoke = (LIVE.smoke.features || []).some(f =>
      pointNearPolygon(far, f.geometry.coordinates) ||
      pointNearPolygon(s, f.geometry.coordinates));
    const fires = (LIVE.fires.features || []).filter(f =>
      km(s, [f.geometry.coordinates[1], f.geometry.coordinates[0]]) < 40 ||
      km(far, [f.geometry.coordinates[1], f.geometry.coordinates[0]]) < 40);

    const c = {zs, zf, hs, hf, rainMax, aq, rain, mud, smoke, fires,
               tmin: temps.length ? Math.min(...temps) : null,
               tmax: temps.length ? Math.max(...temps) : null,
               spread: (hs && hf && hs.temp != null && hf.temp != null)
                       ? Math.abs(hs.temp - hf.temp) : 0};
    cache.set(r.id, c);
    return c;
  }

  function pointNearPolygon(pt, rings){
    // cheap: bounding box of the outer ring, padded a little
    if (!rings || !rings[0]) return false;
    const xs = rings[0].map(p => p[0]), ys = rings[0].map(p => p[1]);
    return pt[1] > Math.min(...xs) - 0.15 && pt[1] < Math.max(...xs) + 0.15
        && pt[0] > Math.min(...ys) - 0.15 && pt[0] < Math.max(...ys) + 0.15;
  }

  /* Lower is better. Nothing here is a hard veto — it only reorders the list. */
  liveScore = function(r){
    const c = cond(r);
    let s = 0;
    const t = c.hs && c.hs.temp;
    if (t != null){ s += Math.max(0, t - 82) * 2.2 + Math.max(0, 52 - t) * 1.4; }
    if (c.hs) s += Math.max(0, (c.hs.wind || 0) - 12) * 1.6;
    s += (c.rainMax || 0) * 0.55;
    if (c.aq) s += Math.max(0, c.aq.aqi - 60) * 0.9;
    if (c.mud) s += 45;
    if (c.smoke) s += 30;
    if (c.fires.length) s += 20;
    if (!(r.seasonal.best_months || []).includes(new Date().getMonth() + 1)) s += 8;
    return s;
  };

  liveChip = function(r){
    const c = cond(r);
    if (!c.hs) return '';
    const bits = [];
    bits.push('<span class="lv-t">' + c.hs.temp + '&deg;</span>');
    bits.push('<span>' + (c.hs.wind || 0) + ' mph ' + (c.hs.dir || '') + '</span>');
    if (c.rainMax >= 15) bits.push('<span>' + c.rainMax + '% rain</span>');
    if (c.aq && c.aq.aqi > 60)
      bits.push('<span style="color:' + band(c.aq.aqi)[2] + '">AQI ' + c.aq.aqi + '</span>');
    if (c.mud) bits.push('<span style="color:var(--hard)">mud</span>');
    if (c.smoke) bits.push('<span style="color:var(--hard)">smoke</span>');
    return '<div class="livechip">' + bits.join('<i>&middot;</i>') + '</div>';
  };

  liveSection = function(r){
    const c = cond(r);
    if (!c.hs) return '';
    const cell = (label, z, h) => !h ? '' :
      '<div class="lvcell"><div class="lvk">' + esc(label) + '</div>' +
      '<div class="lvv num">' + h.temp + '&deg;F</div>' +
      '<div class="lvs">' + (h.wind || 0) + ' mph ' + esc(h.dir || '') + '</div>' +
      '<div class="lvs">' + esc(h.sky || '') + '</div></div>';

    const warn = [];
    if (c.mud) warn.push('Rained ' + c.rain.mm + ' mm in the last four days and ' +
      'stopped ' + c.rain.dry_hours + ' h ago — this one is dirt, so expect mud, ' +
      'and some preserves close their trails when wet.');
    if (c.smoke) warn.push('A smoke plume is drawn over this area today.');
    if (c.fires.length) warn.push(c.fires.length + ' active fire' +
      (c.fires.length > 1 ? 's' : '') + ' within 25 miles: ' +
      c.fires.slice(0, 3).map(f => esc(f.properties.name) + ' (' +
        f.properties.acres.toLocaleString('en-US') + ' acres)').join(', ') + '.');
    if (c.spread >= 12) warn.push('About ' + c.spread + '&deg;F between the start and ' +
      esc(c.zf.name) + ' right now — dress for both.');

    return `
  <div class="sect lvsect">
    <h4>Right now <span class="lvago" data-updated="${esc(LIVE.meta.updated)}"></span></h4>
    <div class="lvgrid">
      ${cell(c.zs.name, c.zs, c.hs)}
      ${c.zf && c.zf.id !== c.zs.id ? cell(c.zf.name, c.zf, c.hf) : ''}
    </div>
    <p class="lvline">Next 12 hours: ${c.tmin}&ndash;${c.tmax}&deg;F,
      ${c.rainMax}% chance of rain${c.aq ? ', air quality ' +
        '<b style="color:' + band(c.aq.aqi)[2] + '">' + c.aq.aqi + ' ' +
        band(c.aq.aqi)[1].toLowerCase() + '</b> at ' + esc(c.aq.site) : ''}.</p>
    ${warn.map(w => '<p class="lvwarn">' + w + '</p>').join('')}
  </div>`;
  };

  function ago(iso){
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 2) return 'just now';
    if (mins < 90) return mins + ' min ago';
    return Math.round(mins / 60) + ' h ago';
  }

  function stamp(){
    document.querySelectorAll('.lvago').forEach(n => {
      n.textContent = ago(n.dataset.updated);
    });
    const h = document.getElementById('lvhead');
    if (h) h.textContent = 'Conditions ' + ago(LIVE.meta.updated);
  }

  /* smoke plumes and fires drawn under the routes */
  function drawEnvLayers(){
    const gEnv = el('g', {});
    gRoot.insertBefore(gEnv, gRoute);
    (LIVE.smoke.features || []).forEach(f => {
      const rings = f.geometry.coordinates;
      let d = '';
      rings.forEach(ring => {
        ring.forEach((pt, i) => {
          d += (i ? 'L' : 'M') + mx(pt[0]).toFixed(6) + ' ' + (-my(pt[1])).toFixed(6);
        });
        d += 'Z';
      });
      const dens = (f.properties.density || '').toLowerCase();
      gEnv.appendChild(el('path', {d, fill:'var(--hard)',
        opacity: dens.includes('heavy') ? .3 : dens.includes('medium') ? .2 : .12,
        stroke:'none'}));
    });
    (LIVE.fires.features || []).forEach(f => {
      const [lon, lat] = f.geometry.coordinates;
      const g = el('g', {});
      g.appendChild(el('path', {d:'M0,-7 L6,5 L-6,5 Z', fill:'var(--max)',
        stroke:'var(--paper)', 'stroke-width':1.5}));
      const t = el('title', {});
      t.textContent = f.properties.name + ' fire — ' +
        f.properties.acres.toLocaleString('en-US') + ' acres' +
        (f.properties.contained != null ? ', ' + f.properties.contained + '% contained' : '');
      g.appendChild(t);
      gPins.appendChild(g);
      pinEls.push({g, x:mx(lon), y:-my(lat)});
    });
  }

  fetch('data/env.json?t=' + Math.floor(Date.now() / 300000))
    .then(r => r.ok ? r.json() : Promise.reject(r.status))
    .then(env => {
      if (!env || !env.zones || !env.zones.some(z => z.hours && z.hours.length)) return;
      LIVE = env;
      const sel = document.getElementById('sort');
      const opt = document.createElement('option');
      opt.value = 'conditions'; opt.textContent = 'Conditions';
      sel.insertBefore(opt, sel.firstChild.nextSibling);
      const head = document.createElement('span');
      head.id = 'lvhead'; head.className = 'lvhead';
      document.getElementById('count').before(head);
      document.body.classList.add('haslive');
      drawEnvLayers();
      render(); apply();
      if (S.sel) select(S.sel);
      // the panel is rebuilt on every route change, so re-stamp it then too
      const origSelect = select;
      select = function(id){ origSelect(id); stamp(); };
      stamp();
      setInterval(stamp, 60000);
      // the data is refreshed hourly; pick it up without a reload
      setInterval(() => location.reload(), 30 * 60 * 1000);
    })
    .catch(() => {});
})();
