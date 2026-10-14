// Collection route planner. Pure functions, no DOM, so it runs the same in the app and in tests.
//
// The problem: from where the collector stands, pick which snakes to visit and in what order so the trip
// brings in as many cans as possible without overfilling the bag or running past the time the collector has.
// (In the textbook this is a "prize-collecting travelling salesman" or "orienteering" problem.)
// Method: start with an empty route, keep inserting the stop that adds the most cans per extra minute at
// its cheapest position, as long as the bag and the time budget allow; then untangle the order with 2-opt,
// and try once more to squeeze in stops the shorter route now has room for.
// Distances and times: from a street router when one is given (matrix = real walking/cycling times on the streets),
// otherwise straight line × a street detour factor. The order is optimised on TIME. With 25–100 snakes this runs in a few ms.

export const CANS_AT_LEVEL = [0, 5, 10, 16, 21];       // fill level 0..4 → cans in a 120 mm snake (holds ≈ 21 × 33 cl)
export const TRANSPORT = {
  walk:  { kmh: 4.5, bag: 60,  label: { da: "Til fods", en: "On foot" } },
  bike:  { kmh: 13,  bag: 90,  label: { da: "Cykel", en: "Bike" } },
  cargo: { kmh: 11,  bag: 200, label: { da: "Ladcykel", en: "Cargo bike" } },
};
const DETOUR = 1.3;          // streets are on average ~30 % longer than the straight line in a city centre
const SERVICE_MIN = 3;       // minutes at each snake: open the trapdoor, empty, check, close

export function haversine(a, b) {            // metres between {lat,lng} points
  const R = 6371000, toR = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}
export const streetMetres = (a, b) => haversine(a, b) * DETOUR;

export function expectedCans(fill) {         // fill may be fractional (predicted); interpolate
  if (fill == null || fill <= 0) return 0;
  const f = Math.min(4, fill), i = Math.floor(f), t = f - i;
  return Math.round(CANS_AT_LEVEL[i] + (CANS_AT_LEVEL[Math.min(4, i + 1)] - CANS_AT_LEVEL[i]) * t);
}

/** The snakes worth considering, in the order planRoute uses them: matrix rows/columns are [start, ...these, end?]. */
export function routeCandidates({ snakes, minFill = 2, mustInclude = [] }) {
  return snakes.filter(s => s.lat != null && !s.blocked && (mustInclude.includes(s.id) || (s.fill ?? 0) >= minFill))
    .map(s => ({ ...s, cans: Math.max(expectedCans(s.fill), mustInclude.includes(s.id) ? 1 : 0) }))
    .filter(s => s.cans > 0);
}

/**
 * planRoute({ start, end?, snakes, mode, bag, minutes, minFill, mustInclude?, matrix? })
 *  matrix: optional { dist[i][j] metres, dur[i][j] seconds } over [start, ...routeCandidates(...), end?]
 *  start: {lat,lng}; end: optional {lat,lng} where the trip should finish (a deposit machine, home)
 *  snakes: [{id, lat, lng, fill (0..4, may be fractional), blocked? (claimed by someone else / skipped)}]
 * returns { stops:[{id, cans, legM, legMin, arriveMin}], km, minutes, cans, left:[ids worth collecting but left out], streets: bool }
 */
export function planRoute({ start, end = null, snakes, mode = "walk", bag, minutes = 60, minFill = 2, mustInclude = [], matrix = null }) {
  const tr = TRANSPORT[mode] || TRANSPORT.walk;
  const cap = bag ?? tr.bag;
  const mPerMin = tr.kmh * 1000 / 60;
  const cand = routeCandidates({ snakes, minFill, mustInclude });
  const pts = [start, ...cand, ...(end ? [end] : [])];
  const n = pts.length, useM = matrix && matrix.dist?.length === n && matrix.dur?.length === n;
  const D = Array.from({ length: n }, () => new Float64Array(n)), T = Array.from({ length: n }, () => new Float64Array(n));   // metres, minutes
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    if (i === j) continue;
    if (useM) { D[i][j] = matrix.dist[i][j]; T[i][j] = matrix.dur[i][j] / 60; }
    else { D[i][j] = streetMetres(pts[i], pts[j]); T[i][j] = D[i][j] / mPerMin; }
  }
  const endIdx = end ? n - 1 : -1;

  const tourLen = t => { let m = 0; for (let k = 0; k + 1 < t.length; k++) m += T[t[k]][t[k + 1]]; return m; };   // travel minutes
  const tourMetres = t => { let m = 0; for (let k = 0; k + 1 < t.length; k++) m += D[t[k]][t[k + 1]]; return m; };
  const tourMin = t => tourLen(t) + (t.length - (end ? 2 : 1)) * SERVICE_MIN;
  const load = t => t.reduce((s, k) => s + (k > 0 && k !== endIdx ? cand[k - 1].cans : 0), 0);

  let tour = end ? [0, endIdx] : [0];
  const inTour = new Set(tour);

  function cheapestInsert(k, t) {             // best position to insert point k into tour t
    let best = Infinity, pos = -1;
    const last = end ? t.length - 1 : t.length;
    for (let p = 1; p <= last; p++) {
      const a = t[p - 1], b = p < t.length ? t[p] : -1;
      const add = T[a][k] + (b >= 0 ? T[k][b] - T[a][b] : 0);
      if (add < best) { best = add; pos = p; }
    }
    return [best, pos];
  }
  let noise = 0, seed = 12345;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  function greedyFill() {
    for (;;) {
      let bestScore = -1, bestK = -1, bestPos = -1;
      const curMin = tourMin(tour), curLoad = load(tour);
      for (let k = 1; k <= cand.length; k++) {
        if (inTour.has(k)) continue;
        const c = cand[k - 1];
        const forced = mustInclude.includes(c.id);
        if (!forced && curLoad >= cap) continue;
        const [add, pos] = cheapestInsert(k, tour);
        const extraMin = add + SERVICE_MIN;
        if (!forced && curMin + extraMin > minutes) continue;
        const gain = Math.min(c.cans, Math.max(0, cap - curLoad)) || (forced ? 1 : 0);
        const score = (forced ? 1e9 : 0) + gain / (extraMin + 0.5) * (1 + noise * (rnd() - 0.5));
        if (score > bestScore) { bestScore = score; bestK = k; bestPos = pos; }
      }
      if (bestK < 0) return;
      tour.splice(bestPos, 0, bestK); inTour.add(bestK);
    }
  }
  function twoOpt() {
    let improved = true, guard = 0;
    const fixedEnd = end ? 1 : 0;
    while (improved && guard++ < 200) {
      improved = false;
      for (let i = 1; i < tour.length - 1 - fixedEnd; i++) {
        for (let j = i + 1; j < tour.length - fixedEnd; j++) {
          const a = tour[i - 1], b = tour[i], c = tour[j], d = j + 1 < tour.length ? tour[j + 1] : -1;
          const rev = tour.slice(0, i).concat(tour.slice(i, j + 1).reverse(), tour.slice(j + 1));   // full re-cost: real street times are not symmetric
          if (tourLen(rev) + 1e-6 < tourLen(tour)) { tour = rev; improved = true; }
        }
      }
    }
  }
  function orOpt() {                          // move runs of 1–3 stops to a better place
    let improved = true, guard = 0;
    const fixedEnd = end ? 1 : 0;
    while (improved && guard++ < 100) {
      improved = false;
      for (let len = 1; len <= 3; len++) {
        for (let i = 1; i + len - 1 < tour.length - fixedEnd; i++) {
          const seg = tour.slice(i, i + len), rest = tour.slice(0, i).concat(tour.slice(i + len));
          const base = tourLen(tour);
          for (let p = 1; p <= rest.length - fixedEnd; p++) {
            if (p === i) continue;
            for (const s of [seg, seg.slice().reverse()]) {
              const cand2 = rest.slice(0, p).concat(s, rest.slice(p));
              if (tourLen(cand2) + 1e-6 < base) { tour = cand2; improved = true; break; }
            }
            if (improved) break;
          }
          if (improved) break;
        }
        if (improved) break;
      }
    }
  }
  function exactOrder() {                     // Held–Karp: optimal order when there are few stops
    const mid = tour.slice(1, end ? -1 : undefined), m = mid.length;
    if (m < 3 || m > 12) return;
    const full = (1 << m) - 1, dp = new Float64Array((1 << m) * m).fill(Infinity), par = new Int8Array((1 << m) * m).fill(-1);
    for (let j = 0; j < m; j++) dp[(1 << j) * m + j] = T[0][mid[j]];
    for (let S = 1; S <= full; S++) for (let j = 0; j < m; j++) {
      const v = dp[S * m + j]; if (!(S & (1 << j)) || v === Infinity) continue;
      for (let k = 0; k < m; k++) { if (S & (1 << k)) continue; const U = S | (1 << k), w = v + T[mid[j]][mid[k]]; if (w < dp[U * m + k]) { dp[U * m + k] = w; par[U * m + k] = j; } }
    }
    let bestJ = -1, best = Infinity;
    for (let j = 0; j < m; j++) { const w = dp[full * m + j] + (end ? T[mid[j]][endIdx] : 0); if (w < best) { best = w; bestJ = j; } }
    const order = []; let S = full, j = bestJ;
    while (j >= 0) { order.push(mid[j]); const pj = par[S * m + j]; S &= ~(1 << j); j = pj; }
    order.reverse();
    tour = [0, ...order, ...(end ? [endIdx] : [])];
  }
  greedyFill(); twoOpt(); orOpt(); greedyFill(); twoOpt(); orOpt(); exactOrder(); greedyFill(); exactOrder();

  // Improvement search (iterated local search): the greedy pass picks stops by cans per extra minute, which can leave
  // a better set of stops on the table. Repeatedly drop 1-3 random stops, refill with noisy greedy choices, tidy the
  // order, and keep the result only if it collects more cans in the same time (or the same cans in less time).
  const collected = t => { let room = cap, v = 0; for (const k of t) if (k > 0 && k !== endIdx) { const take = Math.min(cand[k - 1].cans, Math.max(0, room)); room -= take; v += take; } return v; };
  const forcedIdx = new Set(cand.map((c, i) => mustInclude.includes(c.id) ? i + 1 : -1));
  if (cand.length > 3) {
    let best = tour.slice(), bestV = collected(best), bestT = tourMin(best);
    const limit = Math.max(minutes, bestT), t0 = Date.now();
    for (let it = 0; it < 400 && Date.now() - t0 < 120; it++) {
      const movable = best.map((k, i) => i).filter(i => i > 0 && best[i] !== endIdx && !forcedIdx.has(best[i]));
      if (!movable.length) break;
      const drop = new Set(); const nDrop = Math.min(movable.length, 1 + Math.floor(rnd() * 3));
      while (drop.size < nDrop) drop.add(movable[Math.floor(rnd() * movable.length)]);
      tour = best.filter((k, i) => !drop.has(i)); inTour.clear(); tour.forEach(k => inTour.add(k));
      noise = 0.6; greedyFill(); noise = 0;
      twoOpt(); orOpt(); greedyFill();
      const v = collected(tour), tm = tourMin(tour);
      if (tm <= limit + 1e-9 && (v > bestV || (v === bestV && tm < bestT - 1e-6))) { best = tour.slice(); bestV = v; bestT = tm; }
    }
    tour = best; inTour.clear(); tour.forEach(k => inTour.add(k));
    exactOrder(); greedyFill(); exactOrder();
  }

  // describe the result
  const stops = []; let t = 0, acc = 0, room = cap;
  for (let k = 1; k < tour.length; k++) {
    const leg = D[tour[k - 1]][tour[k]], legMin = T[tour[k - 1]][tour[k]];
    t += legMin;
    if (tour[k] === endIdx) { stops.push({ id: "__end", legM: Math.round(leg), legMin, arriveMin: Math.round(t) }); break; }
    const c = cand[tour[k] - 1], take = Math.min(c.cans, Math.max(0, room)); room -= take; acc += take;
    stops.push({ id: c.id, cans: take, expected: c.cans, legM: Math.round(leg), legMin, arriveMin: Math.round(t) });
    t += SERVICE_MIN;
  }
  const chosen = new Set(stops.map(s => s.id));
  const left = cand.filter(c => !chosen.has(c.id) && (c.fill ?? 0) >= 3).map(c => c.id);
  return { stops, km: tourMetres(tour) / 1000, minutes: Math.round(t), cans: acc, bag: cap, left, streets: !!useM };
}

/** Rough fill prediction: last reported level plus the snake's own average filling speed since then. */
export function predictFill(lastFill, lastAt, ratePerHour, now = Date.now(), maxAgeH = 72) {
  if (lastFill == null) return null;
  const h = Math.max(0, (now - new Date(lastAt).getTime()) / 3.6e6);
  if (!ratePerHour || h < 1) return lastFill;
  return Math.min(4, lastFill + ratePerHour * Math.min(h, maxAgeH));
}
