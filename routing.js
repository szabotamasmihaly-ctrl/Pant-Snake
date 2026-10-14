// Street routing for the collector app.
// One interface, several engines:
//   "ors"   openrouteservice (HeiGIT; free API key; walking and cycling on all OSM streets and paths)  ← recommended live
//   "osrm"  any OSRM server, e.g. your own, or FOSSGIS's public one for testing (max 1 request/second)
//   "graph" the built-in demo street network (main streets of Aarhus), computed in the browser
//   "straight" straight lines × 1.3, the last resort when nothing else answers
// matrix(points, mode)  → { dist[i][j] metres, dur[i][j] seconds, source }
// route(points, mode)   → { coords:[[lng,lat]…], legs:[{ dist, dur, coords, steps:[{ kind, mod, name, lat, lng, dist }] }], source }
import { haversine } from "./route.js";

const SPEED = { walk: 1.25, bike: 3.6, cargo: 3.05 };         // m/s (4.5, 13, 11 km/h, as in route.js), used by "graph" and "straight"
const CARGO_SLOWER = 1.15;                                     // cargo bike vs. normal bike timing from a bike profile
// openrouteservice moved to api.heigit.org in 2026 (the old api.openrouteservice.org address is being switched off)
const ORS = cfg => (cfg.orsBase || "https://api.heigit.org/openrouteservice").replace(/\/$/, "");

// demoStreets: the built-in street network (GeoJSON), or an async function that loads it the first time it is needed
export function createRouter(cfg = {}, demoStreets = null) {
  const provider = cfg.provider || (demoStreets ? "graph" : "straight");
  let graphP = null;
  const getGraph = () => graphP ||= Promise.resolve(typeof demoStreets === "function" ? demoStreets() : demoStreets).then(buildGraph);
  const engines = {
    ors: {
      async matrix(pts, mode) {
        const prof = mode === "walk" ? "foot-walking" : "cycling-regular";
        const r = await fetch(`${ORS(cfg)}/v2/matrix/${prof}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: cfg.orsKey },
          body: JSON.stringify({ locations: pts.map(p => [p.lng, p.lat]), metrics: ["distance", "duration"] }) });
        if (!r.ok) throw new Error("ors_matrix_" + r.status);
        const j = await r.json(); return { dist: j.distances, dur: scaleDur(j.durations, mode) };
      },
      async route(pts, mode) {
        const prof = mode === "walk" ? "foot-walking" : "cycling-regular";
        const r = await fetch(`${ORS(cfg)}/v2/directions/${prof}/geojson`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: cfg.orsKey },
          body: JSON.stringify({ coordinates: pts.map(p => [p.lng, p.lat]), instructions: true, geometry_simplify: false }) });
        if (!r.ok) throw new Error("ors_route_" + r.status);
        const f = (await r.json()).features[0], coords = f.geometry.coordinates;
        const ORS_KIND = { 0: ["turn", "left"], 1: ["turn", "right"], 2: ["turn", "sharp left"], 3: ["turn", "sharp right"], 4: ["turn", "slight left"], 5: ["turn", "slight right"], 6: ["continue", "straight"], 7: ["roundabout", ""], 8: ["roundabout", ""], 9: ["uturn", ""], 10: ["arrive", ""], 11: ["depart", ""], 12: ["keep", "left"], 13: ["keep", "right"] };
        const legs = f.properties.segments.map(sg => {
          const steps = sg.steps.map(s => { const c = coords[s.way_points[0]], [kind, mod] = ORS_KIND[s.type] || ["continue", ""]; return { kind, mod, name: s.name === "-" ? "" : s.name, lng: c[0], lat: c[1], dist: s.distance, exit: s.exit_number }; });
          const a = sg.steps[0].way_points[0], b = sg.steps.at(-1).way_points[1];
          return { dist: sg.distance, dur: sg.duration * (mode === "cargo" ? CARGO_SLOWER : 1), coords: coords.slice(a, b + 1), steps };
        });
        return { coords, legs };
      },
    },
    osrm: {
      base(mode) { return mode === "walk" ? cfg.osrmFoot : cfg.osrmBike; },
      async matrix(pts, mode) {
        const r = await fetch(`${this.base(mode)}/table/v1/driving/${pts.map(p => `${p.lng},${p.lat}`).join(";")}?annotations=duration,distance`);
        if (!r.ok) throw new Error("osrm_table_" + r.status);
        const j = await r.json(); if (j.code !== "Ok") throw new Error("osrm_" + j.code);
        return { dist: j.distances, dur: scaleDur(j.durations, mode) };
      },
      async route(pts, mode) {
        const r = await fetch(`${this.base(mode)}/route/v1/driving/${pts.map(p => `${p.lng},${p.lat}`).join(";")}?overview=full&geometries=geojson&steps=true`);
        if (!r.ok) throw new Error("osrm_route_" + r.status);
        const j = await r.json(); if (j.code !== "Ok") throw new Error("osrm_" + j.code);
        const rt = j.routes[0];
        const legs = rt.legs.map(l => {
          const coords = l.steps.flatMap((s, i) => i ? s.geometry.coordinates.slice(1) : s.geometry.coordinates);
          const steps = l.steps.map(s => ({ kind: s.maneuver.type, mod: s.maneuver.modifier || "", name: s.name || "", lng: s.maneuver.location[0], lat: s.maneuver.location[1], dist: s.distance, exit: s.maneuver.exit }));
          return { dist: l.distance, dur: l.duration * (mode === "cargo" ? CARGO_SLOWER : 1), coords, steps };
        });
        return { coords: rt.geometry.coordinates, legs };
      },
    },
    graph: {
      async matrix(pts, mode) { const g = await getGraph(); const s = pts.map(p => g.snap(p)); const dist = s.map(a => { const d = g.dijkstra(a); return s.map(b => g.costTo(d, a, b)); }); return { dist, dur: dist.map(r => r.map(m => m / SPEED[mode])) }; },
      async route(pts, mode) {
        const g = await getGraph(), sn = pts.map(p => g.snap(p)), legs = [];
        for (let i = 0; i + 1 < pts.length; i++) {
          const d = g.dijkstra(sn[i]), path = g.pathTo(d, sn[i], sn[i + 1]);
          const coords = [[pts[i].lng, pts[i].lat], ...path.coords, [pts[i + 1].lng, pts[i + 1].lat]];
          const dist = lineLen(coords);
          legs.push({ dist, dur: dist / SPEED[mode], coords, steps: stepsFromNames(path.names, coords), connectors: [[[pts[i].lng, pts[i].lat], path.coords[0] || [pts[i + 1].lng, pts[i + 1].lat]], [path.coords.at(-1) || [pts[i].lng, pts[i].lat], [pts[i + 1].lng, pts[i + 1].lat]]] });
        }
        return { coords: legs.flatMap((l, i) => i ? l.coords.slice(1) : l.coords), legs };
      },
    },
    straight: {
      async matrix(pts, mode) { const dist = pts.map(a => pts.map(b => haversine(a, b) * 1.3)); return { dist, dur: dist.map(r => r.map(m => m / SPEED[mode])) }; },
      async route(pts, mode) {
        const legs = [];
        for (let i = 0; i + 1 < pts.length; i++) { const d = haversine(pts[i], pts[i + 1]) * 1.3; legs.push({ dist: d, dur: d / SPEED[mode], coords: [[pts[i].lng, pts[i].lat], [pts[i + 1].lng, pts[i + 1].lat]], steps: [], straight: true }); }
        return { coords: legs.flatMap((l, i) => i ? l.coords.slice(1) : l.coords), legs };
      },
    },
  };
  function scaleDur(m, mode) { return mode === "cargo" ? m.map(r => r.map(v => v == null ? null : v * CARGO_SLOWER)) : m; }
  const chain = [provider, ...(provider !== "graph" && demoStreets ? ["graph"] : []), "straight"].filter((v, i, a) => engines[v] && a.indexOf(v) === i);
  let lastSource = provider;
  async function run(kind, pts, mode) {
    let err;
    for (const name of chain) {
      if (name === "ors" && !cfg.orsKey) continue;
      if (name === "osrm" && !(cfg.osrmFoot && cfg.osrmBike)) continue;
      try { const res = await engines[name][kind](pts, mode); res.source = name; lastSource = name; return fillNulls(res, pts, mode); }
      catch (e) { err = e; console.warn("routing", name, kind, e); }
    }
    throw err || new Error("no_router");
  }
  function fillNulls(res, pts, mode) {        // unreachable pairs from a real router → straight-line estimate
    if (res.dist) for (let i = 0; i < pts.length; i++) for (let j = 0; j < pts.length; j++) {
      if (res.dist[i][j] == null || res.dur[i][j] == null) { const d = haversine(pts[i], pts[j]) * 1.6; res.dist[i][j] = d; res.dur[i][j] = d / SPEED[mode]; }
    }
    return res;
  }
  // name of the nearest street in the built-in network (used to suggest a label when placing a snake)
  async function nearestStreet(p) { if (!demoStreets) return null; const s = (await getGraph()).snap(p); return s && s.d < 250 ? { name: s.name, metres: Math.round(s.d) } : null; }
  return { matrix: (p, m) => run("matrix", p, m), route: (p, m) => run("route", p, m), nearestStreet, get source() { return lastSource; }, provider };
}

function lineLen(c) { let m = 0; for (let i = 1; i < c.length; i++) m += haversine({ lng: c[i - 1][0], lat: c[i - 1][1] }, { lng: c[i][0], lat: c[i][1] }); return m; }
const bearing = (a, b) => { const y = Math.sin((b[0] - a[0]) * Math.PI / 180) * Math.cos(b[1] * Math.PI / 180), x = Math.cos(a[1] * Math.PI / 180) * Math.sin(b[1] * Math.PI / 180) - Math.sin(a[1] * Math.PI / 180) * Math.cos(b[1] * Math.PI / 180) * Math.cos((b[0] - a[0]) * Math.PI / 180); return Math.atan2(y, x) * 180 / Math.PI; };

// build turn instructions for the demo graph: a new step wherever the street name changes
function stepsFromNames(names, coords) {
  const steps = [{ kind: "depart", mod: "", name: names[0] || "", lng: coords[0][0], lat: coords[0][1], dist: 0 }];
  let acc = 0;
  for (let i = 1; i < coords.length - 1; i++) {
    acc += haversine({ lng: coords[i - 1][0], lat: coords[i - 1][1] }, { lng: coords[i][0], lat: coords[i][1] });
    const n = names[Math.min(i, names.length - 1)] || "";
    if (n && n !== steps.at(-1).name) {
      const before = coords[Math.max(0, i - 2)], after = coords[Math.min(coords.length - 1, i + 2)];
      let turn = ((bearing(coords[i], after) - bearing(before, coords[i]) + 540) % 360) - 180;
      const mod = Math.abs(turn) < 25 ? "straight" : Math.abs(turn) < 60 ? (turn < 0 ? "slight left" : "slight right") : Math.abs(turn) < 140 ? (turn < 0 ? "left" : "right") : (turn < 0 ? "sharp left" : "sharp right");
      steps.at(-1).dist = acc; acc = 0;
      steps.push({ kind: mod === "straight" ? "continue" : "turn", mod, name: n, lng: coords[i][0], lat: coords[i][1], dist: 0 });
    }
  }
  steps.at(-1).dist = acc;
  steps.push({ kind: "arrive", mod: "", name: "", lng: coords.at(-1)[0], lat: coords.at(-1)[1], dist: 0 });
  return steps;
}

// ---------- demo graph: nodes = street vertices, edges = segments; snapping projects onto the nearest segment ----------
function buildGraph(fc) {
  const key = c => c[0].toFixed(6) + "," + c[1].toFixed(6);
  const id = new Map(), xy = [], adj = [], segs = [];
  const node = c => { const k = key(c); let i = id.get(k); if (i == null) { i = xy.length; id.set(k, i); xy.push(c); adj.push([]); } return i; };
  const kx = 111320 * Math.cos(56.15 * Math.PI / 180), ky = 110574;
  for (const f of fc.features) {
    const c = f.geometry.coordinates, name = f.properties.name || "";
    for (let i = 1; i < c.length; i++) {
      const a = node(c[i - 1]), b = node(c[i]); if (a === b) continue;
      const w = Math.hypot((c[i][0] - c[i - 1][0]) * kx, (c[i][1] - c[i - 1][1]) * ky);
      adj[a].push([b, w, name]); adj[b].push([a, w, name]); segs.push([a, b, name]);
    }
  }
  // grid index of segments for snapping
  const G = 0.004, grid = new Map();
  segs.forEach((s, si) => { const [ax, ay] = xy[s[0]], [bx, by] = xy[s[1]];
    for (let gx = Math.floor(Math.min(ax, bx) / G); gx <= Math.floor(Math.max(ax, bx) / G); gx++) for (let gy = Math.floor(Math.min(ay, by) / G); gy <= Math.floor(Math.max(ay, by) / G); gy++) { const k = gx + ":" + gy; if (!grid.has(k)) grid.set(k, []); grid.get(k).push(si); } });
  function snap(p) {
    let best = null;
    for (let r = 0; r <= 6 && !best; r++) {
      const gx0 = Math.floor(p.lng / G), gy0 = Math.floor(p.lat / G);
      for (let gx = gx0 - r; gx <= gx0 + r; gx++) for (let gy = gy0 - r; gy <= gy0 + r; gy++) for (const si of grid.get(gx + ":" + gy) || []) {
        const [a, b] = segs[si], [ax, ay] = xy[a], [bx, by] = xy[b];
        const dx = (bx - ax) * kx, dy = (by - ay) * ky, px = (p.lng - ax) * kx, py = (p.lat - ay) * ky, L = dx * dx + dy * dy;
        const t = L ? Math.max(0, Math.min(1, (px * dx + py * dy) / L)) : 0, d = Math.hypot(px - t * dx, py - t * dy);
        if (!best || d < best.d) best = { d, a, b, t, segLen: Math.sqrt(L), pt: [ax + (bx - ax) * t, ay + (by - ay) * t], name: segs[si][2] };
      }
      if (best && r >= 1) break;
    }
    return best;
  }
  function dijkstra(s) {                      // multi-source from the snapped point's two segment ends
    const dist = new Float64Array(xy.length).fill(Infinity), prev = new Int32Array(xy.length).fill(-1), heap = [];
    const push = (d, i) => { heap.push([d, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    const da = s.t * s.segLen, db = (1 - s.t) * s.segLen;
    dist[s.a] = da; push(da, s.a); if (db < dist[s.b]) { dist[s.b] = db; push(db, s.b); }
    while (heap.length) { const [d, i] = pop(); if (d > dist[i]) continue; for (const [j, w] of adj[i]) { const nd = d + w; if (nd < dist[j]) { dist[j] = nd; prev[j] = i; push(nd, j); } } }
    return { dist, prev };
  }
  function costTo(D, s, e) {
    if (s.a === e.a && s.b === e.b) return Math.abs(s.t - e.t) * s.segLen + s.d + e.d;
    return Math.min(D.dist[e.a] + e.t * e.segLen, D.dist[e.b] + (1 - e.t) * e.segLen) + s.d + e.d;
  }
  function pathTo(D, s, e) {
    if (s.a === e.a && s.b === e.b) return { coords: [s.pt, e.pt], names: [s.name, s.name] };
    const viaA = D.dist[e.a] + e.t * e.segLen, viaB = D.dist[e.b] + (1 - e.t) * e.segLen;
    let n = viaA <= viaB ? e.a : e.b; const nodes = [];
    while (n >= 0) { nodes.push(n); n = D.prev[n]; }
    nodes.reverse();
    const nameOf = (i, j) => (adj[i].find(x => x[0] === j) || [, , ""])[2];
    const coords = [s.pt, ...nodes.map(i => xy[i]), e.pt], names = [s.name];
    for (let i = 1; i < nodes.length; i++) names.push(nameOf(nodes[i - 1], nodes[i]));
    names.push(e.name, e.name);
    return { coords, names };
  }
  return { snap, dijkstra, costTo, pathTo, nodes: xy.length };
}

/** Human instruction for a step, in Danish or English. */
export function stepText(s, lang = "da") {
  const da = lang === "da";
  const turn = { left: da ? "Drej til venstre" : "Turn left", right: da ? "Drej til højre" : "Turn right", "slight left": da ? "Hold svagt til venstre" : "Bear left", "slight right": da ? "Hold svagt til højre" : "Bear right",
    "sharp left": da ? "Drej skarpt til venstre" : "Turn sharp left", "sharp right": da ? "Drej skarpt til højre" : "Turn sharp right", straight: da ? "Fortsæt ligeud" : "Continue straight", uturn: da ? "Vend om" : "Make a U-turn" };
  const onto = s.name ? (da ? ` ad ${s.name}` : ` onto ${s.name}`) : "";
  switch (s.kind) {
    case "depart": return (da ? "Gå mod" : "Head along") + (s.name ? ` ${s.name}` : (da ? " ruten" : " the route"));
    case "arrive": return da ? "Slangen ligger forude" : "The snake is just ahead";
    case "roundabout": case "rotary": case "exit roundabout": return (da ? `Tag ${s.exit ? s.exit + ". " : ""}afkørsel i rundkørslen` : `At the roundabout take the ${s.exit ? ordinal(s.exit) + " " : ""}exit`) + onto;
    case "uturn": return turn.uturn;
    case "keep": case "fork": return (s.mod.includes("left") ? (da ? "Hold til venstre" : "Keep left") : (da ? "Hold til højre" : "Keep right")) + onto;
    case "continue": case "new name": return (da ? "Fortsæt" : "Continue") + onto;
    default: return (turn[s.mod] || (da ? "Fortsæt" : "Continue")) + onto;
  }
}
const ordinal = n => n + (["th", "st", "nd", "rd"][(n % 100 - 20) % 10] || ["th", "st", "nd", "rd"][n % 100] || "th");
export const ARROW = { left: "↰", right: "↱", "slight left": "↖", "slight right": "↗", "sharp left": "↰", "sharp right": "↱", straight: "↑", uturn: "↶" };
