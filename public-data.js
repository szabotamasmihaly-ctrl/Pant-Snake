// Public data layer: the only data code the pedestrian page (index.html) loads.
// It can add a report and read what a passer-by may see about ONE snake. Nothing else.
// Live mode talks to Supabase with the publishable key; demo mode keeps reports in this browser.
export const CFG = window.SNAKE_CONFIG || {};
export const LIVE = !!(CFG.SUPABASE_URL && CFG.SUPABASE_KEY);
let sb = null;
export async function client() {
  if (!LIVE) return null;
  if (!sb) {
    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
    sb = createClient(CFG.SUPABASE_URL, CFG.SUPABASE_KEY);
  }
  return sb;
}
export const SNAKES = window.SNAKES || [];
export const snakeById = id => SNAKES.find(s => s.id === id) || null;
export const BUCKET = CFG.PHOTO_BUCKET || "report-photos";

// ---------- demo storage (this browser only) ----------
export const DEMO_KEY = "snake-demo-reports";
export function demoAll() { try { return JSON.parse(localStorage.getItem(DEMO_KEY) || "[]"); } catch { return []; } }
export function demoSave(rows) { try { localStorage.setItem(DEMO_KEY, JSON.stringify(rows)); return true; } catch { return false; } }
export const blobToDataURL = b => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(b); });

// ---------- photos: resized and re-encoded on the phone, which also strips GPS/EXIF data ----------
export async function preparePhoto(file, maxSide = 1600, quality = 0.8) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  return await new Promise(ok => c.toBlob(ok, "image/jpeg", quality));
}

/** A passer-by's report. fixed_problem: "the problem reported earlier (this type) is fixed now", optionally with a photo. */
export async function submitReport({ snake_id, fill_level = null, problem = null, fixed_problem = null, message = null, photo = null, lang = "en" }) {
  const id = crypto.randomUUID();
  if (!LIVE) {
    const rows = demoAll();
    const row = { id, snake_id, fill_level, problem, fixed_problem, message, lang, source: "public", status: "open", created_at: new Date().toISOString(), photo_data: null };
    if (photo) row.photo_data = await blobToDataURL(await preparePhoto(photo, 900, 0.7));
    rows.push(row);
    if (!demoSave(rows)) throw new Error("storage_full");
    return { id };
  }
  const db = await client();
  let photo_path = null;
  if (photo) {
    const blob = await preparePhoto(photo);
    photo_path = `${snake_id}/${id}.jpg`;
    const up = await db.storage.from(BUCKET).upload(photo_path, blob, { contentType: "image/jpeg", upsert: false });
    if (up.error) throw up.error;
  }
  const { error } = await db.from("reports").insert({ id, snake_id, fill_level, problem, fixed_problem, message, photo_path, lang, source: "public" });
  if (error) throw error;
  return { id };
}

// demo only: what the example city looks like (a few open problems, collectors nearby, two sponsors)
const DEMO_NEAR = ["aar-05-bay", "aar-15-pant-2", "aar-17-lighthouse", "cph-01-nyhavn", "bud-04-vizkopo-rez"];
const DEMO_SPONSOR = { "aar-14-festuge": "PantPia", "aar-15-pant-2": "CanCaptain", "bud-04-vizkopo-rez": "DobozDani" };
export function seedPublicDemo() {
  if (LIVE) return;
  try { if (localStorage.getItem("snake-demo-seeded")) return; localStorage.setItem("snake-demo-seeded", "1"); } catch { return; }
  const t = m => new Date(Date.now() - m * 60000).toISOString();
  const r = (snake_id, m, fill_level, problem, lang) => ({ id: crypto.randomUUID(), snake_id, created_at: t(m), fill_level, problem, fixed_problem: null,
    message: "Example report", lang, source: "public", status: "open", photo_data: null });
  const rows = demoAll();
  rows.push(r("aar-07-domkirke-2", 95, null, "jam", "da"), r("aar-07-domkirke-2", 60, 3, null, "en"), r("aar-13-godsbanen", 240, null, "litter", "da"),
    r("aar-05-bay", 30, 4, null, "da"), r("aar-01-rainbow", 48, 2, null, "en"), r("aar-15-pant-2", 20, 3, null, "de"),
    r("bud-04-vizkopo-rez", 12, 4, "jam", "hu"), r("cph-06-havnebad", 260, 1, "graffiti", "da"), r("cph-01-nyhavn", 34, 3, null, "en"),
    { ...r("aar-13-godsbanen", 25, null, null, "en"), fixed_problem: "litter", message: "Example: someone tidied up around it" });
  demoSave(rows.filter(x => SNAKES.some(s => s.id === x.snake_id)));
}

/** What a passer-by may see about one snake: last fill level, open problems (type and since when, never the
 *  message or photo), whether a collector is near it, and its sponsor's nickname if the sponsor chose to show it. */
export async function publicStatus(snake_id) {
  if (!LIVE) {
    const rows = demoAll().filter(x => x.snake_id === snake_id).sort((a, b) => b.created_at.localeCompare(a.created_at));
    const f = rows.find(x => x.fill_level != null), problems = {};
    for (const x of rows.slice().reverse()) {
      if (x.problem && x.status === "open") problems[x.problem] ??= { problem: x.problem, since: x.created_at, fix_reported: false };
      if (x.fixed_problem && problems[x.fixed_problem]) problems[x.fixed_problem].fix_reported = true;
    }
    return { fill_level: f ? f.fill_level : null, reported_at: f ? f.created_at : null, problems: Object.values(problems),
      collector_near: DEMO_NEAR.includes(snake_id) && (f?.fill_level ?? 0) >= 3, sponsor: DEMO_SPONSOR[snake_id] || null };
  }
  const db = await client();
  const { data, error } = await db.rpc("public_status", { p_snake: snake_id });
  if (error || !data || !data.length) return null;
  const d = data[0];
  return { ...d, problems: d.problems || [] };
}

/** The snake a QR code points at; also finds snakes added later on the map (live). */
export async function findSnake(id) {
  const s = snakeById(id); if (s || !LIVE || !id) return s;
  try {
    const db = await client(); const { data } = await db.from("snakes").select("id,city,number,design_name,place,location_label,design,active").eq("id", id).maybeSingle();
    if (data) { const d = snakeById(data.design) || {}; const x = { id: data.id, city: data.city, n: data.number, name: data.design_name, place: data.place ?? d.place ?? "", colors: d.colors || ["#4B5563", "#9CA3AF", "#E5E7EB"], active: data.active }; SNAKES.push(x); return x; }
  } catch {}
  return null;
}
