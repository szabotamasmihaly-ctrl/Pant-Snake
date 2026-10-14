// Data layer of the collector app and the operator dashboard (the pedestrian page only loads public-data.js).
// Live mode talks to Supabase; demo mode keeps everything in this browser's localStorage.
import { CFG, LIVE, client, SNAKES, snakeById, BUCKET, DEMO_KEY, demoAll, demoSave, blobToDataURL, preparePhoto, submitReport, publicStatus } from "./public-data.js";
export { LIVE, SNAKES, snakeById, preparePhoto, submitReport, publicStatus };
// the designs as shipped in designs.js (one per livery / QR code), before any placement changes made in the app
const DESIGNS = SNAKES.map(s => ({ ...s }));
export const designById = id => DESIGNS.find(d => d.id === id) || null;
export const DESIGN_LIST = DESIGNS;

// ---------- operators ----------
export async function session() {
  if (!LIVE) return { demo: true, email: "demo" };
  const db = await client(); const { data } = await db.auth.getSession();
  if (!data.session) return null;
  const { data: role } = await db.rpc("my_role");          // only "operator" may use the dashboard; the database enforces it too
  return { email: data.session.user.email, uid: data.session.user.id, role };
}
export async function signIn(email, password) {
  const db = await client(); const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) throw error;
}
export async function signUp(email, password) {
  const db = await client(); const { data, error } = await db.auth.signUp({ email, password, options: { emailRedirectTo: location.href.replace(/#.*$/, "") } });
  if (error) throw error; return data;
}
export async function signOut() { if (LIVE) { const db = await client(); await db.auth.signOut(); } }

export async function listReports({ snake_id = null, sinceDays = 60 } = {}) {
  if (!LIVE) {
    return demoAll().filter(r => !snake_id || r.snake_id === snake_id).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  const db = await client();
  let q = db.from("reports").select("*").gte("created_at", new Date(Date.now() - sinceDays * 864e5).toISOString()).order("created_at", { ascending: false }).limit(2000);
  if (snake_id) q = q.eq("snake_id", snake_id);
  const { data, error } = await q; if (error) throw error; return data;
}
export async function photoURL(report) {
  if (!LIVE) return report.photo_data || null;
  if (!report.photo_path) return null;
  const db = await client();
  const { data } = await db.storage.from(BUCKET).createSignedUrl(report.photo_path, 3600);
  return data ? data.signedUrl : null;
}
export async function resolveReport(id) {
  if (!LIVE) { const rows = demoAll(); const r = rows.find(x => x.id === id); if (r) { r.status = "resolved"; r.resolved_at = new Date().toISOString(); } demoSave(rows); return; }
  const db = await client(); const s = await session();
  const { error } = await db.from("reports").update({ status: "resolved", resolved_at: new Date().toISOString(), resolved_by: s?.uid || null }).eq("id", id);
  if (error) throw error;
}
export async function markEmptied(snake_id) {
  const row = { id: crypto.randomUUID(), snake_id, fill_level: 0, message: "Emptied by operator", source: "operator", status: "resolved", created_at: new Date().toISOString() };
  if (!LIVE) { const rows = demoAll(); rows.push(row); demoSave(rows); return; }
  const db = await client(); const s = await session();
  const { error } = await db.from("reports").insert({ ...row, resolved_at: row.created_at, resolved_by: s?.uid || null });
  if (error) throw error;
}
export async function onNewReport(cb) {
  if (!LIVE) { window.addEventListener("storage", e => { if (e.key === DEMO_KEY) cb(); }); return; }
  const db = await client();
  db.channel("reports-live").on("postgres_changes", { event: "*", schema: "public", table: "reports" }, () => cb()).subscribe();
}
export function clearDemo() { if (!LIVE) localStorage.removeItem(DEMO_KEY); }
export function publicLink(id) {
  if (CFG.LINK_TEMPLATE) return CFG.LINK_TEMPLATE.replace("{id}", encodeURIComponent(id));
  const base = (CFG.PUBLIC_BASE_URL || location.href.replace(/[#?].*$/, "").replace(/[^/]*$/, "")).replace(/\/$/, "");
  return `${base}/?s=${encodeURIComponent(id)}`;
}

// ---------- the owner's snake register: where each snake stands, in or out of service ----------
// A design (designs.js) is a livery with its own QR code. A snake is one physical snake on a street; its id is what
// its QR code carries. The first snake of a design uses the design's id; more snakes with the same design get
// "-b", "-c", … (their QR codes are printed from the owner's map).
// Live: the snakes table (operators may change it). Demo: changes are kept in this browser and merged into SNAKES.
const DEMO_SNAKES = "snake-demo-snakes";
function demoOverrides() { try { return JSON.parse(localStorage.getItem(DEMO_SNAKES) || "{}"); } catch { return {}; } }
function applyOverrides() {
  if (LIVE) return;
  for (const [id, v] of Object.entries(demoOverrides())) {
    const i = SNAKES.findIndex(s => s.id === id);
    if (v.deleted) { if (i >= 0) SNAKES.splice(i, 1); continue; }
    if (i >= 0) Object.assign(SNAKES[i], v); else SNAKES.push({ ...(designById(v.design) || {}), ...v });
  }
}
applyOverrides();
const fromRow = r => { const d = designById(r.design || r.id) || {};
  return { id: r.id, city: r.city, n: r.number, name: r.design_name, place: r.place ?? d.place ?? "", colors: d.colors || ["#4B5563", "#9CA3AF", "#E5E7EB"],
    lat: r.lat, lng: r.lng, location: r.location_label || "", design: r.design || r.id, active: r.active !== false }; };

/** Every snake the owner manages (placed or not, in service or not). */
export async function allSnakes() {
  if (!LIVE) return SNAKES.map(s => ({ design: s.id, active: true, ...s }));
  const db = await client();
  const { data, error } = await db.from("snakes").select("*").order("city").order("number").order("id");
  if (error) throw error; return data.map(fromRow);
}
/** Insert or update one snake: { id, design, city, n, name, place, lat, lng, location, active } */
export async function saveSnake(s) {
  if (!LIVE) {
    const o = demoOverrides(), prev = o[s.id] && !o[s.id].deleted ? o[s.id] : {};
    o[s.id] = { ...prev, id: s.id, design: s.design || s.id, city: s.city, n: s.n, name: s.name, place: s.place, colors: s.colors || designById(s.design || s.id)?.colors,
      lat: s.lat ?? null, lng: s.lng ?? null, location: s.location || "", active: s.active !== false, edited_at: new Date().toISOString() };
    try { localStorage.setItem(DEMO_SNAKES, JSON.stringify(o)); } catch { throw new Error("storage_full"); }
    applyOverrides(); return;
  }
  const db = await client();
  const { error } = await db.from("snakes").upsert({ id: s.id, design: s.design || s.id, city: s.city, number: s.n, design_name: s.name, place: s.place || null,
    location_label: s.location || null, lat: s.lat ?? null, lng: s.lng ?? null, active: s.active !== false });
  if (error) throw error;
}
/** Delete a snake for good. Its reports and visits go with it (the database cascades). */
export async function deleteSnake(id) {
  if (!LIVE) {
    const o = demoOverrides(); o[id] = { deleted: true };
    try { localStorage.setItem(DEMO_SNAKES, JSON.stringify(o)); } catch {}
    applyOverrides(); demoSave(demoAll().filter(r => r.snake_id !== id)); return;
  }
  const db = await client(); const { error } = await db.from("snakes").delete().eq("id", id); if (error) throw error;
}
export function resetDemoSnakes() { if (!LIVE) { try { localStorage.removeItem(DEMO_SNAKES); } catch {} } }
/** The id for a new snake with this design: the design's own id while that is unused or unplaced, else design-b, -c, … */
export function newSnakeId(design, existing) {
  const taken = new Map(existing.map(s => [s.id, s]));
  const own = taken.get(design);
  if (!own || own.lat == null) return design;
  for (const c of "bcdefghijklmnopqrstuvwxyz") if (!taken.has(`${design}-${c}`)) return `${design}-${c}`;
  return `${design}-${Date.now().toString(36)}`;
}
/** The snake a QR code points at; also finds snakes added in the app that designs.js doesn't know (live). */
export async function findSnake(id) {
  const s = snakeById(id); if (s || !LIVE || !id) return s;
  try { const db = await client(); const { data } = await db.from("snakes").select("*").eq("id", id).maybeSingle(); if (data) { const x = fromRow(data); SNAKES.push(x); return x; } } catch {}
  return null;
}

// ---------- collectors (collector.html) ----------
// Live: everything goes through the database functions in supabase/collector.sql.
// Demo: same shapes, kept in this browser next to the demo reports, so a report sent from the
// pedestrian page shows up on the collector's map.
const DEMO_VISITS = "snake-demo-collections", DEMO_CLAIMS = "snake-demo-claims", DEMO_ME = "demo-collector";
const demoGet = k => { try { return JSON.parse(localStorage.getItem(k) || "[]"); } catch { return []; } };
const demoPut = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

export async function collectorSession() {
  if (!LIVE) return { demo: true, id: DEMO_ME, email: "", role: "collector" };
  const db = await client(); const { data } = await db.auth.getSession();
  if (!data.session) return null;
  const { data: role } = await db.rpc("my_role");
  return { id: data.session.user.id, email: data.session.user.email, role };
}

function fillRate(rows) {                       // average rise in fill level per hour, from consecutive reports
  const f = rows.filter(r => r.fill_level != null && Date.now() - new Date(r.created_at) < 30 * 864e5)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  let d = 0, h = 0;
  for (let i = 1; i < f.length; i++) {
    const dd = f[i].fill_level - f[i - 1].fill_level, hh = (new Date(f[i].created_at) - new Date(f[i - 1].created_at)) / 3.6e6;
    if (dd > 0 && hh >= 0.25 && hh <= 96) { d += dd; h += hh; }
  }
  return h ? d / h : null;
}

/** All placed snakes with what a collector needs: fill, when, problems, claim state, filling speed. */
export async function collectorMap() {
  if (LIVE) { const db = await client(); const { data, error } = await db.rpc("collector_map"); if (error) throw error; return data; }
  const reps = demoAll(), now = Date.now(), claims = demoGet(DEMO_CLAIMS).filter(c => new Date(c.expires_at) > now), sponsors = demoSponsors();
  demoSponsorAlerts(reps, sponsors);
  return SNAKES.filter(s => s.lat != null && s.active !== false).map(s => {
    const rs = reps.filter(r => r.snake_id === s.id).sort((a, b) => b.created_at.localeCompare(a.created_at));
    const lf = rs.find(r => r.fill_level != null), em = rs.find(r => r.fill_level === 0 && (r.source === "collector" || r.source === "operator"));
    const open = rs.filter(r => r.status === "open" && r.problem), cl = claims.find(c => c.snake_id === s.id);
    const sp = sponsors[s.id], full = rs.find(r => r.fill_level != null && r.fill_level >= 3 && r.source === "public");
    const turn = sp && sp.user !== DEMO_ME && sp.notify_first && full && lf === full ? new Date(new Date(full.created_at).getTime() + SPONSOR_HEAD_START_MIN * 6e4) : null;
    return { id: s.id, city: s.city, design: s.design || s.id, design_name: s.name, location_label: s.location || "", lat: s.lat, lng: s.lng,
      fill_level: lf ? lf.fill_level : null, fill_at: lf ? lf.created_at : null, fill_source: lf ? lf.source : null,
      last_emptied_at: em ? em.created_at : null, open_problems: open.length, problem_types: [...new Set(open.map(r => r.problem))],
      fill_rate_per_hour: fillRate(rs), claimed_by_me: !!cl && cl.collector_id === DEMO_ME, claimed_by_other: !!cl && cl.collector_id !== DEMO_ME,
      claim_expires_at: cl ? cl.expires_at : null,
      other_nearby: DEMO_NEARBY.includes(s.id), sponsor_nick: sp && sp.show_name ? sp.nick : null, i_sponsor: !!sp && sp.user === DEMO_ME,
      sponsor_turn_until: turn && turn > now ? turn.toISOString() : null };
  });
}

export async function claimSnakes(ids, minutes = 45) {
  if (LIVE) { const db = await client(); const { data, error } = await db.rpc("claim_snakes", { p_ids: ids, p_minutes: minutes }); if (error) throw error; return data; }
  const now = Date.now(), until = new Date(now + minutes * 6e4).toISOString();
  let cl = demoGet(DEMO_CLAIMS).filter(c => new Date(c.expires_at) > now && !(c.collector_id === DEMO_ME && !ids.includes(c.snake_id)));
  for (const id of ids.slice(0, 15)) {
    const c = cl.find(x => x.snake_id === id);
    if (!c) cl.push({ snake_id: id, collector_id: DEMO_ME, expires_at: until });
    else if (c.collector_id === DEMO_ME) c.expires_at = until;
  }
  demoPut(DEMO_CLAIMS, cl); return cl.filter(c => c.collector_id === DEMO_ME).map(c => c.snake_id);
}
export async function releaseClaims(ids = null) {
  if (LIVE) { const db = await client(); const { error } = await db.rpc("release_claims", { p_ids: ids }); if (error) throw error; return; }
  demoPut(DEMO_CLAIMS, demoGet(DEMO_CLAIMS).filter(c => c.collector_id !== DEMO_ME || (ids && !ids.includes(c.snake_id))));
}

/** One visit: outcome emptied | partial | was_empty | not_emptied; all_ok false needs a problem. */
export async function recordVisit({ snake_id, outcome, all_ok, problem = null, note = null, cans = null, fill_after = null, photo = null, lang = "da", dist_m = null }) {
  if (!all_ok && !problem) throw new Error("problem_required");
  if (LIVE) {
    const db = await client(); let photo_path = null;
    if (photo) {
      const blob = await preparePhoto(photo); photo_path = `${snake_id}/${crypto.randomUUID()}.jpg`;
      const up = await db.storage.from(BUCKET).upload(photo_path, blob, { contentType: "image/jpeg", upsert: false }); if (up.error) throw up.error;
    }
    const { data, error } = await db.rpc("record_visit", { p_snake: snake_id, p_outcome: outcome, p_all_ok: all_ok, p_problem: problem,
      p_note: note, p_cans: cans, p_fill_after: fill_after, p_photo_path: photo_path, p_lang: lang, p_dist_m: dist_m == null ? null : Math.round(dist_m) });
    if (error) throw error; return data;
  }
  const visits = demoGet(DEMO_VISITS), now = new Date().toISOString();
  if (visits.some(v => v.snake_id === snake_id && Date.now() - new Date(v.created_at) < 120000)) throw new Error("duplicate_visit");
  const id = crypto.randomUUID();
  const photo_data = photo ? await blobToDataURL(await preparePhoto(photo, 900, 0.7)) : null;
  visits.push({ id, snake_id, collector_id: DEMO_ME, created_at: now, outcome, all_ok, problem, cans, fill_after, note, dist_m, verified: dist_m != null && dist_m <= VERIFY_M });
  demoPut(DEMO_VISITS, visits);
  const rows = demoAll();
  const fill = outcome === "emptied" || outcome === "was_empty" ? 0 : outcome === "partial" ? (fill_after ?? 1) : fill_after;
  if (fill != null) rows.push({ id: crypto.randomUUID(), snake_id, fill_level: fill, problem: null, lang, source: "collector", status: "resolved", created_at: now,
    message: outcome === "emptied" ? "Emptied by collector" : outcome === "was_empty" ? "Found empty by collector" : "Partly emptied by collector" });
  if (all_ok) rows.forEach(r => { if (r.snake_id === snake_id && r.status === "open" && r.problem) { r.status = "resolved"; r.resolved_at = now; } });
  else rows.push({ id: crypto.randomUUID(), snake_id, fill_level: null, problem, message: note, lang, source: "collector", status: "open", created_at: now, photo_data });
  demoSave(rows);
  demoPut(DEMO_CLAIMS, demoGet(DEMO_CLAIMS).filter(c => !(c.snake_id === snake_id && c.collector_id === DEMO_ME)));
  return id;
}

export async function myVisits(sinceDays = 30) {
  if (LIVE) {
    const db = await client();
    const { data, error } = await db.from("collections").select("*").gte("created_at", new Date(Date.now() - sinceDays * 864e5).toISOString()).order("created_at", { ascending: false });
    if (error) throw error; return data;
  }
  return demoGet(DEMO_VISITS).filter(v => Date.now() - new Date(v.created_at) < sinceDays * 864e5).sort((a, b) => b.created_at.localeCompare(a.created_at));
}
export function clearCollectorDemo() { if (!LIVE) { try { localStorage.removeItem(DEMO_VISITS); localStorage.removeItem(DEMO_CLAIMS); } catch {} } }
export const IS_DEMO_COLLECTOR = id => id === DEMO_ME;

/** Demo only: example fill history for the placed Aarhus snakes, so the collector map has something to plan.
 *  Runs once per browser; everything it adds is marked "Example". */
export function seedCollectorDemo() {
  if (LIVE) return;
  try { if (localStorage.getItem("snake-demo-seeded-aar")) return; localStorage.setItem("snake-demo-seeded-aar", "1"); } catch { return; }
  const placed = SNAKES.filter(s => s.lat != null), rows = demoAll(), now = Date.now();
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const at = h => new Date(now - h * 3.6e6).toISOString();
  const final = { "aar-01-rainbow": 3, "aar-05-bay": 4, "aar-07-domkirke-2": 4, "aar-14-festuge": 3, "aar-15-pant-2": 4, "aar-16-dokk1": 3, "aar-13-godsbanen": 4,
    "aar-08-aaen": 2, "aar-17-lighthouse": 3, "aar-21-teater": 2, "aar-12-au": 3, "aar-22-vandmand": 1, "aar-19-friheden": 4, "aar-03-runes": 2, "aar-25-musikhuset": 3, "aar-10-bro": 2 };
  for (const s of placed) {
    if (rows.some(r => r.snake_id === s.id)) continue;
    const end = final[s.id] ?? Math.floor(rnd() * 2);
    const emptiedH = 30 + rnd() * 30;                       // emptied by a collector a day or two ago, then filling up
    rows.push({ id: crypto.randomUUID(), snake_id: s.id, fill_level: 0, problem: null, message: "Example: emptied by collector", lang: "da", source: "collector", status: "resolved", created_at: at(emptiedH) });
    const lastH = 0.3 + rnd() * 4;                         // the latest report is from the last few hours
    for (let lv = 1; lv <= end; lv++) rows.push({ id: crypto.randomUUID(), snake_id: s.id, fill_level: lv, problem: null, message: "Example report", lang: "da", source: "public", status: "open",
      created_at: at(emptiedH - (emptiedH - lastH) * lv / end) });
  }
  // the University snake's last report is old: the map estimates how full it is by now
  for (const r of rows) if (r.snake_id === "aar-12-au" && r.fill_level === 3) r.created_at = at(14);
  const prob = (id, p, m, h) => rows.push({ id: crypto.randomUUID(), snake_id: id, fill_level: null, problem: p, message: "Example: " + m, lang: "da", source: "public", status: "open", created_at: at(h) });
  prob("aar-07-domkirke-2", "jam", "En stor flaske sidder fast i munden.", 1.5);
  prob("aar-13-godsbanen", "litter", "Flasker stillet rundt om stolpen.", 3);
  demoSave(rows);
  demoPut(DEMO_CLAIMS, [{ snake_id: "aar-19-friheden", collector_id: "example-other-collector", expires_at: new Date(now + 40 * 6e4).toISOString() }]);
  seedCommunityDemo();
}


// =====================================================================================================
// Community: profiles, leaderboards, other collectors nearby, sponsorship, notifications, toolkit offers
// =====================================================================================================
export const VERIFY_M = 60;                 // a visit counts as "proven" when the phone was within 60 m of the snake
export const SPONSOR_HEAD_START_MIN = 15;   // a sponsor who asked to be notified first gets this long before others see it in their plan
export const SPONSOR_MIN_VISITS = 5;        // proven visits in the last 90 days needed to sponsor a snake
const DEMO_PROFILE = "snake-demo-profile", DEMO_SPONSORS = "snake-demo-sponsors", DEMO_NOTES = "snake-demo-notes", DEMO_OFFERS = "snake-demo-offers", DEMO_OFFER_EV = "snake-demo-offer-events";
const DEMO_NEARBY = ["aar-05-bay", "aar-17-lighthouse"];   // demo: snakes another collector is close to right now
const demoObj = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || "null") ?? d; } catch { return d; } };

// ---------- profile ----------
export async function myProfile() {
  if (!LIVE) return demoObj(DEMO_PROFILE, { nickname: "You", city: "Aarhus", country: "DK", show_on_leaderboard: true });
  const db = await client(); const { data: u } = await db.auth.getUser(); if (!u?.user) return null;
  const { data } = await db.from("profiles").select("*").eq("user_id", u.user.id).maybeSingle(); return data;
}
export async function saveProfile({ nickname, city, country, show_on_leaderboard = true }) {
  nickname = String(nickname || "").trim().slice(0, 24);
  if (nickname.length < 2) throw new Error("nickname_short");
  if (!LIVE) { demoPut(DEMO_PROFILE, { nickname, city, country, show_on_leaderboard }); return; }
  const db = await client(); const { data: u } = await db.auth.getUser();
  const { error } = await db.from("profiles").upsert({ user_id: u.user.id, nickname, city, country, continent: "EU", show_on_leaderboard });
  if (error) throw new Error(error.code === "23505" ? "nickname_taken" : error.message);
}

// ---------- leaderboards: by containers collected; city, country or the whole continent ----------
const PEOPLE = [   // demo only: example collectors so the boards aren't empty
  ["PantPia", "Aarhus", "DK", 1840, 310], ["CanCaptain", "Aarhus", "DK", 1320, 240], ["AarhusAce", "Aarhus", "DK", 960, 150], ["DåseDorthe", "Aarhus", "DK", 610, 80],
  ["ÅenÅsa", "Aarhus", "DK", 420, 95], ["BottleBjørn", "Aarhus", "DK", 300, 40], ["LatinerLars", "Aarhus", "DK", 180, 22],
  ["HavneHelle", "Copenhagen", "DK", 2650, 400], ["NørrebroNiels", "Copenhagen", "DK", 1900, 260], ["AmagerAnna", "Copenhagen", "DK", 880, 120],
  ["OdenseOla", "Odense", "DK", 700, 90], ["LimfjordLise", "Aalborg", "DK", 520, 70],
  ["DobozDani", "Budapest", "HU", 3100, 520], ["PalackPetra", "Budapest", "HU", 1400, 180], ["DunaDénes", "Budapest", "HU", 760, 110], ["DebreceniDóra", "Debrecen", "HU", 380, 50],
  ["PfandPaul", "Berlin", "DE", 4200, 600], ["SpreeSophie", "Berlin", "DE", 1600, 210], ["HafenHanna", "Hamburg", "DE", 1250, 160], ["PantSven", "Stockholm", "SE", 2300, 300],
  ["MalmöMoa", "Malmö", "SE", 800, 100], ["FlaskeFrida", "Oslo", "NO", 2900, 350], ["StatiegeldSem", "Amsterdam", "NL", 1100, 140], ["PfandlerinPaula", "Vienna", "AT", 900, 100],
  ["ZálohaZuzana", "Prague", "CZ", 650, 80], ["KaucjaKuba", "Warsaw", "PL", 500, 60],
];
/** scope: "city" | "country" | "continent"; days: 30 or null (all time). Rows: { rank, nickname, city, country, containers, me } */
export async function leaderboard({ scope = "city", days = null } = {}) {
  if (LIVE) { const db = await client(); const { data, error } = await db.rpc("leaderboard", { p_scope: scope, p_days: days }); if (error) throw error; return data; }
  const me = await myProfile(), mine = demoGet(DEMO_VISITS).filter(v => !days || Date.now() - new Date(v.created_at) < days * 864e5).reduce((a, v) => a + (v.cans || 0), 0);
  let rows = PEOPLE.map(([nickname, city, country, all, d30]) => ({ nickname, city, country, containers: days ? d30 : all, me: false, example: true }));
  rows.push({ nickname: me.nickname, city: me.city, country: me.country, containers: mine, me: true });
  if (scope === "city") rows = rows.filter(r => r.city === me.city); else if (scope === "country") rows = rows.filter(r => r.country === me.country);
  rows = rows.sort((a, b) => b.containers - a.containers);
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}
/** lifetime numbers for the Impact tab */
export async function myTotals() {
  if (LIVE) { const db = await client(); const { data, error } = await db.rpc("my_totals"); if (error) throw error; return data[0] || { containers: 0, visits: 0, verified: 0 }; }
  const v = demoGet(DEMO_VISITS);
  return { containers: v.reduce((a, x) => a + (x.cans || 0), 0), visits: v.length, verified: v.filter(x => x.verified).length, first_at: v.map(x => x.created_at).sort()[0] || null };
}
/** everyone's containers in a city / country (for "together you saved…") */
export async function communityTotal(scope = "city") {
  const rows = await leaderboard({ scope }); return rows.reduce((a, r) => a + r.containers, 0);
}

// ---------- other collectors nearby: only "near snake X" is shared, never a position ----------
export async function reportNearby(ids) {
  if (!LIVE) return;
  const db = await client(); await db.rpc("report_nearby", { p_ids: ids.slice(0, 20) });
}

// ---------- sponsorship: the collector with the most proven visits may sponsor a snake (it is not ownership) ----------
function demoSponsors() {
  return demoObj(DEMO_SPONSORS, {
    "aar-14-festuge": { nick: "PantPia", user: "example-pia", show_name: true, notify_first: true, since: new Date(Date.now() - 40 * 864e5).toISOString(), visits: 9 },
    "aar-15-pant-2": { nick: "CanCaptain", user: "example-cc", show_name: true, notify_first: true, since: new Date(Date.now() - 60 * 864e5).toISOString(), visits: 5 } });
}
const DEMO_TOP = { "aar-14-festuge": ["PantPia", 9], "aar-15-pant-2": ["CanCaptain", 5], "aar-07-domkirke-2": ["AarhusAce", 4], "aar-01-rainbow": ["DåseDorthe", 3], "aar-25-musikhuset": ["ÅenÅsa", 2] };
/** { sponsor: {nickname, mine, show_name, notify_first} | null, my_visits, top_other: {nickname, visits} | null, eligible } */
export async function sponsorInfo(snake_id) {
  if (LIVE) { const db = await client(); const { data, error } = await db.rpc("sponsor_info", { p_snake: snake_id }); if (error) throw error; return data; }
  const sp = demoSponsors()[snake_id], mine = demoGet(DEMO_VISITS).filter(v => v.snake_id === snake_id && v.verified && Date.now() - new Date(v.created_at) < 90 * 864e5).length;
  const top = DEMO_TOP[snake_id] ? { nickname: DEMO_TOP[snake_id][0], visits: DEMO_TOP[snake_id][1] } : null;
  const isMine = !!sp && sp.user === DEMO_ME;
  return { sponsor: sp ? { nickname: sp.nick, mine: isMine, show_name: sp.show_name, notify_first: sp.notify_first, since: sp.since } : null,
    my_visits: mine, top_other: top, eligible: !isMine && mine >= SPONSOR_MIN_VISITS && mine > (top?.visits || 0), min_visits: SPONSOR_MIN_VISITS };
}
export async function becomeSponsor(snake_id, { show_name = true, notify_first = true } = {}) {
  if (LIVE) { const db = await client(); const { error } = await db.rpc("become_sponsor", { p_snake: snake_id, p_show_name: show_name, p_notify_first: notify_first }); if (error) throw error; return; }
  const info = await sponsorInfo(snake_id); if (!info.eligible && !info.sponsor?.mine) throw new Error("not_eligible");
  const sp = demoSponsors(), me = await myProfile(); sp[snake_id] = { nick: me.nickname, user: DEMO_ME, show_name, notify_first, since: sp[snake_id]?.user === DEMO_ME ? sp[snake_id].since : new Date().toISOString() };
  demoPut(DEMO_SPONSORS, sp);
  pushNote({ kind: "sponsor", snake_id });
}
export async function endSponsorship(snake_id) {
  if (LIVE) { const db = await client(); const { error } = await db.rpc("end_sponsorship", { p_snake: snake_id }); if (error) throw error; return; }
  const sp = demoSponsors(); if (sp[snake_id]?.user === DEMO_ME) delete sp[snake_id]; demoPut(DEMO_SPONSORS, sp);
}
export async function allSponsorships() {          // operator
  if (LIVE) { const db = await client(); const { data, error } = await db.rpc("all_sponsorships"); if (error) throw error; return data; }
  return Object.entries(demoSponsors()).map(([snake_id, x]) => ({ snake_id, nickname: x.nick, show_name: x.show_name, notify_first: x.notify_first, since: x.since, visits_90d: x.visits ?? null }));
}
export async function revokeSponsorship(snake_id) { // operator
  if (LIVE) { const db = await client(); const { error } = await db.from("sponsorships").delete().eq("snake_id", snake_id); if (error) throw error; return; }
  const sp = demoSponsors(); delete sp[snake_id]; demoPut(DEMO_SPONSORS, sp);
}

// ---------- notifications (sponsors hear first) ----------
function pushNote(n) { const all = demoGet(DEMO_NOTES); all.unshift({ id: crypto.randomUUID(), created_at: new Date().toISOString(), read_at: null, ...n }); demoPut(DEMO_NOTES, all.slice(0, 50)); }
function demoSponsorAlerts(reps, sponsors) {       // demo stand-in for the database trigger: a new ¾+/problem report → note to the sponsor
  const notes = demoGet(DEMO_NOTES), seen = new Set(notes.map(n => n.report_id));
  for (const [snake_id, sp] of Object.entries(sponsors)) {
    if (sp.user !== DEMO_ME || !sp.notify_first) continue;
    for (const r of reps) if (r.snake_id === snake_id && r.source === "public" && !seen.has(r.id) && new Date(r.created_at) > new Date(sp.since) && ((r.fill_level ?? 0) >= 3 || r.problem))
      pushNote({ kind: r.problem ? "problem" : "full", snake_id, report_id: r.id, fill_level: r.fill_level, problem: r.problem });
  }
}
export async function myNotifications() {
  if (LIVE) { const db = await client(); const { data, error } = await db.from("notifications").select("*").order("created_at", { ascending: false }).limit(50); if (error) throw error; return data; }
  return demoGet(DEMO_NOTES);
}
export async function markNotificationsRead() {
  if (LIVE) { const db = await client(); await db.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null); return; }
  demoPut(DEMO_NOTES, demoGet(DEMO_NOTES).map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
}
/** demo: a passer-by reports one of my sponsored snakes full, to show the "you hear first" flow */
export function simulateSponsorReport() {
  const sp = demoSponsors(), id = Object.keys(sp).find(k => sp[k].user === DEMO_ME); if (!id) return null;
  const rows = demoAll(); rows.push({ id: crypto.randomUUID(), snake_id: id, fill_level: 3, problem: null, message: "Example report", lang: "en", source: "public", status: "open", created_at: new Date().toISOString() }); demoSave(rows);
  return id;
}

// ---------- toolkit: gear suggestions sold as partner ad space; discounts unlock with containers collected ----------
const DEFAULT_OFFERS = [
  { id: "grabber", icon: "🦾", title: "Litter picker, 90 cm", partner: "GripGood (example partner)", body: "Reach cans in hedges and gutters without bending. Folds into a bag.", url: "", tiers: [[250, 5], [1000, 10], [5000, 20]], active: true },
  { id: "gloves", icon: "🧤", title: "Cut-resistant gloves", partner: "SafeHands (example partner)", body: "Level C cut protection, touchscreen fingertips, machine washable.", url: "", tiers: [[250, 5], [1000, 15]], active: true },
  { id: "bag", icon: "🛍️", title: "Collapsible collecting bag, 90 l", partner: "PackLoop (example partner)", body: "Fits about 200 cans. Waterproof base, folds to pocket size.", url: "", tiers: [[500, 10], [2000, 20]], active: true },
  { id: "trailer", icon: "🚲", title: "Bike trailer", partner: "TowTwo (example partner)", body: "Carries 40 kg behind any city bike. Quick-release hitch.", url: "", tiers: [[1000, 5], [5000, 15]], active: true },
  { id: "torch", icon: "🔦", title: "Head torch", partner: "NightOwl (example partner)", body: "For dark winter rounds: 400 lumens, USB-C, red mode.", url: "", tiers: [[250, 10]], active: true },
  { id: "vest", icon: "🦺", title: "Reflective vest", partner: "SeeMe (example partner)", body: "Be seen by cyclists and cars at dusk. One size.", url: "", tiers: [[100, 20]], active: true },
];
const offerCode = (id, cans) => `${id.toUpperCase().slice(0, 5)}-${cans}-DEMO`;
export async function listOffers({ all = false } = {}) {
  if (LIVE) { const db = await client(); let q = db.from("offers").select("*").order("sort"); if (!all) q = q.eq("active", true); const { data, error } = await q; if (error) throw error; return data.map(o => ({ ...o, tiers: (o.tiers || []).map(t => [t.cans, t.pct]) })); }
  const o = demoObj(DEMO_OFFERS, DEFAULT_OFFERS); return all ? o : o.filter(x => x.active);
}
/** the discount code for a tier, only once the collector has collected that many containers */
export async function unlockCode(offer_id, cans) {
  if (LIVE) { const db = await client(); const { data, error } = await db.rpc("unlock_code", { p_offer: offer_id, p_cans: cans }); if (error) throw error; return data; }
  const t = await myTotals(); if (t.containers < cans) throw new Error("not_yet");
  logOfferEvent(offer_id, "code"); return (demoObj(DEMO_OFFERS, DEFAULT_OFFERS).find(o => o.id === offer_id)?.codes || {})[cans] || offerCode(offer_id, cans);
}
export async function logOfferEvent(offer_id, kind) {
  if (LIVE) { try { const db = await client(); await db.rpc("log_offer_event", { p_offer: offer_id, p_kind: kind }); } catch {} return; }
  const ev = demoGet(DEMO_OFFER_EV); ev.push({ offer_id, kind, at: new Date().toISOString() }); demoPut(DEMO_OFFER_EV, ev.slice(-2000));
}
export async function offerStats() {                // operator: views, clicks and codes shown per offer, last 30 days
  if (LIVE) { const db = await client(); const { data, error } = await db.rpc("offer_stats"); if (error) throw error; return data; }
  const ev = demoGet(DEMO_OFFER_EV), out = {};
  for (const id of demoObj(DEMO_OFFERS, DEFAULT_OFFERS).map(o => o.id)) out[id] = { offer_id: id, views: 0, clicks: 0, codes: 0 };
  for (const e of ev) if (out[e.offer_id]) out[e.offer_id][e.kind === "view" ? "views" : e.kind === "click" ? "clicks" : "codes"]++;
  return Object.values(out);
}
export async function saveOffer(o) {                // operator
  if (LIVE) {
    const db = await client(); const { codes, ...row } = o;
    const { error } = await db.from("offers").upsert({ ...row, tiers: o.tiers.map(([cans, pct]) => ({ cans, pct })) }); if (error) throw error;
    if (codes) for (const [cans, code] of Object.entries(codes)) await db.from("offer_codes").upsert({ offer_id: o.id, cans: +cans, code });
    return;
  }
  const all = demoObj(DEMO_OFFERS, DEFAULT_OFFERS), i = all.findIndex(x => x.id === o.id);
  if (i >= 0) all[i] = { ...all[i], ...o }; else all.push(o); demoPut(DEMO_OFFERS, all);
}
export async function deleteOffer(id) {
  if (LIVE) { const db = await client(); const { error } = await db.from("offers").delete().eq("id", id); if (error) throw error; return; }
  demoPut(DEMO_OFFERS, demoObj(DEMO_OFFERS, DEFAULT_OFFERS).filter(o => o.id !== id));
}

// ---------- demo history: your own past rounds, so the Impact, Ranking and sponsorship screens have something to show ----------
function seedCommunityDemo() {
  try { if (localStorage.getItem("snake-demo-seeded-community")) return; localStorage.setItem("snake-demo-seeded-community", "1"); } catch { return; }
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const visits = demoGet(DEMO_VISITS), plan = [["aar-15-pant-2", 7], ["aar-25-musikhuset", 4], ["aar-01-rainbow", 3], ["aar-06-radhus", 4], ["aar-14-festuge", 2], ["aar-16-dokk1", 5], ["aar-21-teater", 3], ["aar-08-aaen", 4], ["aar-13-godsbanen", 3], ["aar-05-bay", 2]];
  for (const [snake_id, n] of plan) for (let i = 0; i < n; i++) {
    const daysAgo = 2 + rnd() * 80, d = Math.round(5 + rnd() * 40);
    visits.push({ id: crypto.randomUUID(), snake_id, collector_id: DEMO_ME, created_at: new Date(Date.now() - daysAgo * 864e5).toISOString(), outcome: "emptied", all_ok: true, problem: null,
      cans: Math.round(10 + rnd() * 12), fill_after: null, note: null, dist_m: d, verified: d <= VERIFY_M, example: true });
  }
  demoPut(DEMO_VISITS, visits);
  try { localStorage.setItem("collector-saved-min", JSON.stringify(146)); } catch {}
  // a passer-by just reported the Festival Week snake ¾ full: its sponsor PantPia gets a head start
  const rows = demoAll(); rows.push({ id: crypto.randomUUID(), snake_id: "aar-14-festuge", fill_level: 3, problem: null, message: "Example report", lang: "da", source: "public", status: "open", created_at: new Date(Date.now() - 4 * 6e4).toISOString() }); demoSave(rows);
}
