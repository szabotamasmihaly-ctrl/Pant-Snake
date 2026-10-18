// Collector app, the session: how long the collector plans to stay, the best time to go, how the route is shared
// with other collectors (reservations), and how reliable the collector's planned times have been this week.
// createShift(ctx) is called by collector.js; ctx gives the shared helpers (el, modal, state, …).
import { expectedCans, predictFill, haversine, TRANSPORT } from "./route.js";

const X = {
  da: {
    howLong: "Hvor længe vil du samle?", howLongHint: "Så ved vi, hvornår du stopper, og hvor stort et område du kan nå. Du må gerne blive længere.",
    min: "min", h: "t", endsAt: hhmm => `Slutter ca. kl. ${hhmm}`, planned: (n, c) => `Vi planlægger ${n} stop · ≈ ${c} dåser`, nothing: "Ingen slanger er fulde nok lige nu.",
    start: m => `Start · ${m} min`, how: "Hvordan planlægger I min rute?",
    best: "Bedste tid i dag", bestNow: "Lige nu er et godt tidspunkt", bestLater: hhmm => `Bedst omkring kl. ${hhmm}`,
    bestWhy: (c, o) => `≈ ${c} dåser venter, og ${o === 0 ? "ingen andre indsamlere" : o === 1 ? "1 anden indsamler" : `${o} andre indsamlere`} er normalt ude.`,
    bestNote: "Skøn ud fra hvor hurtigt slangerne fyldes, og hvor mange der plejer at samle på hvert tidspunkt.",
    perYou: "dåser pr. indsamler", now: "nu",
    left: m => `${m} min tilbage`, over: m => `+${m} min`, endsAround: hhmm => `til ca. ${hhmm}`, sessionOf: m => `${m} min-vagt`,
    almost: "5 minutter tilbage. Fortsæt gerne, eller stop her – begge dele er fint.",
    endEarlyQ: "Stop vagten nu?", endEarlyText: hhmm => `Du planlagde at samle til kl. ${hhmm}. Når du stopper, frigiver vi dine reserverede slanger, så andre kan tage dem.`, endNow: "Stop nu", keep: "Fortsæt",
    rel: { new: "Ny indsamler: fuld reservation", full: "Pålidelig: fuld reservation", limited: "Kortere reservation", short: "Kun næste stop reserveres" },
    relWhy: { new: "Dine første vagter får altid fuld reservation.", full: "Du holder normalt din planlagte tid. Alle stop på din rute bliver reserveret til dig.",
      limited: "Flere af dine vagter sluttede før tid i denne uge. Vi reserverer kun stop, du når i den første del af din vagt.",
      short: "De fleste af dine vagter sluttede tidligt i denne uge. Vi reserverer kun dit næste stop. Det nulstilles, når du holder din tid igen." },
    relWeek: (k, n) => `${k} af ${n} vagter holdt i denne uge`,
    reserved: n => `${n} stop reserveret til dig`,
    // explainer
    exTitle: "Sådan planlægger vi din rute", exLead: "Målet: du får flest mulige dåser for din tid, og to indsamlere går aldrig efter den samme slange.",
    ex: [
      ["⏱", "Du vælger din tid", "Vagtens længde fortæller os, hvornår du stopper, og hvor stort et område du kan nå til fods, på cykel eller ladcykel."],
      ["🗺️", "Vi vælger de bedste slanger", "Vi tager de fuldeste slanger, du kan nå ad rigtige gader, og lægger dem i den rækkefølge, der giver flest dåser pr. minut. Din taske må ikke blive overfyldt."],
      ["🔒", "De bliver reserveret til dig", "Mens din vagt kører, springer andre aktive indsamleres ruter dine slanger over. Ingen går forgæves."],
      ["👥", "En anden er allerede tæt på?", "Så lader vi den være til dem og planlægger udenom. Vi deler kun “tæt på slange X”, aldrig hvor du er."],
      ["🔄", "Ruten følger med", "Bliver en slange meldt fuld undervejs, foreslår vi den. Springer du et stop over, planlægger vi igen."],
      ["✅", "Stop når du vil", "Stopper du før tid, frigives dine reservationer straks. Sker det tit, reserverer vi færre stop frem for dig, så andre ikke holdes væk."],
    ],
    exOk: "Forstået",
    you: "Dig", other: "Anden indsamler",
    upNext: "Kommer derefter", fromPrev: "fra forrige", total: (n, km, c, v) => `${n} stop · ${km} km · ≈ ${c} dåser · ≈ ${v} kr`,
  },
  en: {
    howLong: "How long will you collect?", howLongHint: "This tells us when you'll stop and how big an area you can cover. Staying longer is fine.",
    min: "min", h: "h", endsAt: hhmm => `Ends around ${hhmm}`, planned: (n, c) => `We'll plan ${n} stop${n === 1 ? "" : "s"} · ≈ ${c} cans`, nothing: "No snake is full enough right now.",
    start: m => `Start · ${m} min`, how: "How is my route planned?",
    best: "Best time today", bestNow: "Right now is a good time", bestLater: hhmm => `Best around ${hhmm}`,
    bestWhy: (c, o) => `≈ ${c} cans waiting, and ${o === 0 ? "no other collectors" : o === 1 ? "1 other collector" : `${o} other collectors`} usually out.`,
    bestNote: "Estimated from how fast the snakes fill and how many collectors are usually out at each hour.",
    perYou: "cans per collector", now: "now",
    left: m => `${m} min left`, over: m => `+${m} min`, endsAround: hhmm => `until ≈ ${hhmm}`, sessionOf: m => `${m}-min session`,
    almost: "5 minutes left. Keep going or stop here, either is fine.",
    endEarlyQ: "End your session now?", endEarlyText: hhmm => `You planned to collect until ${hhmm}. When you stop, your reserved snakes are released so others can collect them.`, endNow: "End now", keep: "Keep going",
    rel: { new: "New collector: full reservations", full: "Reliable: full reservations", limited: "Shorter reservations", short: "Only your next stop is reserved" },
    relWhy: { new: "Your first sessions always get full reservations.", full: "You usually keep to your planned time, so every stop on your route is reserved for you.",
      limited: "Several of your sessions ended early this week. We only reserve the stops you'll reach in the first part of your session.",
      short: "Most of your sessions ended early this week, so we only reserve your next stop. This resets as soon as you keep to your time again." },
    relWeek: (k, n) => `${k} of ${n} sessions kept this week`,
    reserved: n => `${n} stop${n === 1 ? "" : "s"} reserved for you`,
    exTitle: "How we plan your route", exLead: "The goal: the most cans for your time, and two collectors never walk to the same snake.",
    ex: [
      ["⏱", "You set your time", "Your session length tells us when you'll stop and how big an area you can cover on foot, by bike or by cargo bike."],
      ["🗺️", "We pick the best snakes", "We take the fullest snakes you can reach along real streets, in the order that brings the most cans per minute, without overfilling your bag."],
      ["🔒", "They're reserved for you", "While your session runs, other active collectors' routes skip your snakes. Nobody walks there for nothing."],
      ["👥", "Someone already close?", "Then we leave that snake to them and plan around it. We only ever share “near snake X”, never where you are."],
      ["🔄", "The route keeps up", "If a snake is reported full on the way, we suggest it. Skip a stop and we re-plan."],
      ["✅", "Stop whenever you like", "If you stop early, your reservations are released at once. If that happens often, we reserve fewer stops ahead for you, so others aren't kept away."],
    ],
    exOk: "Got it",
    you: "You", other: "Another collector",
    upNext: "Coming up", fromPrev: "from previous", total: (n, km, c, v) => `${n} stops · ${km} km · ≈ ${c} cans · ≈ DKK ${v}`,
  },
};

export const SHIFT_CSS = `
#col .sh-chips{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
#col .sh-chips button{min-height:64px;border-radius:18px;border:2px solid var(--line);background:var(--card);display:grid;place-items:center;gap:0;padding:6px}
#col .sh-chips button b{font-size:1.5rem;line-height:1;font-weight:800}
#col .sh-chips button span{font-size:.8125rem;color:var(--muted)}
#col .sh-chips button[aria-pressed="true"]{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 12%,var(--card));box-shadow:0 0 0 1px var(--accent) inset}
#col .sh-sum{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;font-size:.9375rem;color:var(--muted)}
#col .sh-sum b{color:var(--ink)}
#col .sh-best{border-radius:20px;padding:14px;display:grid;gap:8px;background:linear-gradient(135deg,color-mix(in srgb,#FF9500 16%,var(--card)),color-mix(in srgb,#FF2D55 10%,var(--card)));border:1px solid color-mix(in srgb,#FF9500 30%,var(--line))}
#col .sh-best .eb{font-size:.75rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#C2410C}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]) #col .sh-best .eb{color:#FFB060}}
:root[data-theme="dark"] #col .sh-best .eb{color:#FFB060}
#col .sh-best h3{margin:0;font-size:1.25rem;font-weight:800}
#col .sh-best p{margin:0;font-size:.9375rem}
#col .sh-bars{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:4px;align-items:end;height:74px;padding-top:6px}
#col .sh-bars button{border:0;padding:0;background:transparent;display:grid;grid-template-rows:1fr auto;gap:3px;height:100%;min-height:0;align-items:end}
#col .sh-bars i{display:block;border-radius:6px 6px 3px 3px;background:color-mix(in srgb,#FF9500 45%,transparent);min-height:4px;transition:background-color .15s}
#col .sh-bars button.top i{background:linear-gradient(#FF2D55,#FF9500)}
#col .sh-bars button[aria-pressed="true"] i{outline:2px solid var(--ink);outline-offset:1px}
#col .sh-bars small{font-size:.6875rem;color:var(--muted);text-align:center}
#col .sh-rel{display:flex;gap:10px;align-items:center;font-size:.9375rem;border-radius:14px;padding:10px 12px;background:var(--chip)}
#col .sh-rel .dot{width:12px;height:12px;border-radius:50%;flex:none}
#col .sh-link{border:0;background:transparent;color:var(--route);font-weight:700;padding:8px 0;min-height:44px;text-align:start;display:inline-flex;gap:6px;align-items:center}
#col .sh-ring{--p:0;width:26px;height:26px;border-radius:50%;background:conic-gradient(var(--accent) calc(var(--p)*1%),color-mix(in srgb,var(--muted) 25%,transparent) 0);display:grid;place-items:center;flex:none}
#col .sh-ring::after{content:"";width:16px;height:16px;border-radius:50%;background:var(--card)}
#col .sh-ring.over{background:conic-gradient(#FF9500 100%,transparent 0)}
#col .sh-timer{display:flex;align-items:center;gap:8px;font-weight:700;white-space:nowrap;font-size:.9375rem}
#col .sh-timer small{font-weight:500;color:var(--muted)}
@media (max-width:520px){#col .sh-timer small{display:none}}
#col .sh-session{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;font-size:.875rem;color:var(--muted)}
#col .sh-session span{display:inline-flex;gap:6px;align-items:center}
#col .sh-up{display:grid;gap:8px}
#col .sh-up h4{margin:4px 0 0;font-size:.8125rem;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
#col .sh-up ol{list-style:none;margin:0;padding:0;display:grid;gap:0}
#col .sh-up li{display:grid;grid-template-columns:32px minmax(0,1fr) auto;gap:10px;align-items:center;position:relative;padding:8px 0}
#col .sh-up li button{display:contents;text-align:start}
#col .sh-up li::before{content:"";position:absolute;left:15px;top:-10px;height:22px;border-left:2px dotted color-mix(in srgb,var(--route) 50%,transparent)}
#col .sh-up li:first-child::before{display:none}
#col .sh-up .n{width:32px;height:32px;border-radius:50%;background:var(--route);color:#fff;display:grid;place-items:center;font-weight:800;font-size:.875rem;z-index:1}
#col .sh-up b{display:block;font-size:1rem;line-height:1.2}
#col .sh-up small{display:block;color:var(--muted);font-size:.8125rem}
#col .sh-up .leg{color:var(--route);font-weight:700}
#col .sh-up .cans{display:grid;justify-items:end;gap:3px;font-weight:800;font-size:.9375rem}
#col .sh-up .cans small{font-weight:500}
#col .sh-tube{width:40px;height:8px;border-radius:4px;background:var(--chip);overflow:hidden}
#col .sh-tube i{display:block;height:100%}
#col .sh-total{font-size:.875rem;color:var(--muted);border-top:1px solid var(--line);padding-top:8px}
#col .sh-mini{font-size:.875rem;color:var(--muted);margin:0;display:flex;gap:6px;flex-wrap:wrap}
#col .sh-mini b{color:var(--ink);font-weight:700}
@media (min-width:900px){#col .sh-mini{display:none}}
@media (max-width:899px){#col .sh-up.desk{display:none}}
#col .ex-steps{list-style:none;margin:0;padding:0;display:grid;gap:12px}
#col .ex-steps li{display:grid;grid-template-columns:48px minmax(0,1fr);gap:12px;align-items:start}
#col .ex-steps .ic{width:48px;height:48px;border-radius:14px;display:grid;place-items:center;font-size:24px}
#col .ex-steps b{display:block;font-size:1.0625rem}
#col .ex-steps p{margin:2px 0 0;font-size:.9375rem;color:var(--muted)}
#col .ex-pic{border-radius:18px;background:var(--chip);overflow:hidden}
#col .ex-pic svg{display:block;width:100%;height:auto}
`;

const TILE = ["#FF9500", "#007AFF", "#AF52DE", "#34C759", "#30B0C7", "#FF2D55"];
// demo assumption until real session data exists: how many other collectors are out at each hour of the day
const OTHERS_BY_HOUR = [1, 1, 0, 0, 0, 0, 0, 1, 2, 1, 1, 1, 2, 2, 1, 2, 3, 4, 4, 3, 2, 2, 2, 1];
const CANS_PER_COLLECTOR_HOUR = 30;

export function createShift(ctx) {
  const { el, S, modal, toast, store } = ctx;
  const x = () => X[S.lang] || X.en;
  const hhmm = d => new Date(d).toLocaleTimeString(S.lang === "da" ? "da-DK" : "en-GB", { hour: "2-digit", minute: "2-digit" });

  // ---------- reliability: did the collector keep to the time they planned? ----------
  const sessions = () => store.get("sessions", []);
  function reliability() {
    const week = sessions().filter(s => s.end && Date.now() - new Date(s.start) < 7 * 864e5);
    const kept = week.filter(s => (new Date(s.end) - new Date(s.start)) / 6e4 >= 0.85 * s.planned).length;
    if (sessions().filter(s => s.end).length < 3 || week.length < 2) return { level: "new", factor: 1, kept, n: week.length };
    const share = kept / week.length;
    return share >= 0.7 ? { level: "full", factor: 1, kept, n: week.length } : share >= 0.4 ? { level: "limited", factor: 0.6, kept, n: week.length } : { level: "short", factor: 0, kept, n: week.length };
  }
  const REL_COL = { new: "#007AFF", full: "#34C759", limited: "#FF9500", short: "#FF3B30" };
  function relBadge() {
    const r = reliability();
    return el("div", { class: "sh-rel" }, el("i", { class: "dot", style: `background:${REL_COL[r.level]}` }),
      el("span", {}, el("b", {}, x().rel[r.level]), r.n ? el("small", { style: "display:block;color:var(--muted)" }, x().relWeek(r.kept, r.n)) : ""));
  }
  /** the stops to reserve: all of them, the ones reached early in the session, or only the next one */
  function toReserve(stops, remainingMin) {
    const r = reliability();
    if (r.factor === 0) return stops.slice(0, 1);
    const lim = Math.max(15, remainingMin * r.factor);
    const ok = stops.filter(s => (s.arriveMin ?? 0) <= lim);
    return ok.length ? ok : stops.slice(0, 1);
  }
  function startSession(minutes) {
    const all = sessions().filter(s => Date.now() - new Date(s.start) < 30 * 864e5);
    S.shift = { start: new Date().toISOString(), planned: minutes };
    all.push({ start: S.shift.start, planned: minutes, end: null });
    store.set("sessions", all); store.set("shift", S.shift);
  }
  function endSession() {
    const all = sessions(); const s = all.findLast?.(v => !v.end) || [...all].reverse().find(v => !v.end);
    if (s) { s.end = new Date().toISOString(); store.set("sessions", all); }
  }
  const plannedMin = () => S.shift?.planned || S.set.minutes || 60;
  const elapsedMin = () => S.shift ? (Date.now() - new Date(S.shift.start)) / 6e4 : 0;
  const remainingMin = () => Math.round(plannedMin() - elapsedMin());
  const endsAt = () => new Date(new Date(S.shift.start).getTime() + plannedMin() * 6e4);

  // ---------- the session timer in the top bar ----------
  function timer() {
    if (!S.shift) return null;
    const left = remainingMin(), pct = Math.max(0, Math.min(100, elapsedMin() / plannedMin() * 100));
    return el("span", { class: "sh-timer", role: "timer" }, el("i", { class: "sh-ring" + (left < 0 ? " over" : ""), style: `--p:${pct}` }),
      left >= 0 ? x().left(left) : x().over(-left), el("small", {}, x().endsAround(hhmm(endsAt()))));
  }
  let warned = false;
  function tick() {
    if (!S.shift) { warned = false; return; }
    if (!warned && remainingMin() <= 5 && remainingMin() > 0) { warned = true; toast(x().almost); }
  }

  // ---------- best time to go: cans waiting per collector out, for the next 12 hours ----------
  function bestTimes(snakes, minFill = 2) {
    const out = [], now = Date.now(), h0 = new Date(); h0.setMinutes(0, 0, 0);
    let takenByOthers = 0;
    for (let k = 0; k < 12; k++) {
      const at = k === 0 ? now : h0.getTime() + k * 3.6e6, hour = new Date(at).getHours();
      let cans = 0;
      for (const s of snakes) {
        if (s.fill_level == null) continue;
        const f = s.fill_rate_per_hour ? predictFill(s.fill_level, s.fill_at, s.fill_rate_per_hour, at) : s.fill_level;
        if (f >= minFill) cans += expectedCans(f);
      }
      const others = OTHERS_BY_HOUR[hour];
      const avail = Math.max(0, cans - takenByOthers);
      out.push({ at, hour, cans: avail, others, per: Math.round(avail / (1 + others)) });
      takenByOthers += others * CANS_PER_COLLECTOR_HOUR;
    }
    const awake = out.filter((o, k) => k === 0 || o.hour >= 6);      // don't suggest the small hours, though they still show
    const best = awake.reduce((a, b) => b.per > a.per ? b : a, awake[0]);
    out.forEach(o => o.top = o === best);
    return { hours: out, best };
  }
  function bestCard(snakes) {
    const { hours, best } = bestTimes(snakes);
    const max = Math.max(1, ...hours.map(h => h.per));
    let sel = best;
    const card = el("div", { class: "sh-best" });
    const draw = () => {
      card.innerHTML = "";
      const isNow = sel === hours[0];
      card.append(el("span", { class: "eb" }, "☀︎ " + x().best),
        el("h3", {}, sel === best ? (isNow ? x().bestNow : x().bestLater(hhmm(sel.at))) : hhmm(sel.at)),
        el("p", {}, x().bestWhy(sel.cans, sel.others)),
        el("div", { class: "sh-bars", role: "group", "aria-label": x().perYou }, ...hours.map((h, i) =>
          el("button", { class: h.top ? "top" : "", "aria-pressed": String(h === sel), "aria-label": `${hhmm(h.at)}: ${h.per} ${x().perYou}`, onclick: () => { sel = h; draw(); } },
            el("i", { style: `height:${Math.max(6, h.per / max * 100)}%` }), el("small", {}, i === 0 ? x().now : String(h.hour).padStart(2, "0"))))),
        el("p", { class: "cl-note", style: "font-size:.8125rem" }, x().bestNote));
    };
    draw(); return card;
  }

  // ---------- "how long will you collect?" before the session starts ----------
  function startDialog(onStart) {
    let minutes = S.set.minutes || 60;
    modal((d, close) => {
      const sum = el("div", { class: "sh-sum" });
      const go = el("button", { class: "cl-btn primary", style: "width:100%;min-height:60px;font-size:1.2rem" });
      const update = () => {
        const p = ctx.preview(minutes);
        sum.replaceChildren(el("span", {}, el("b", {}, x().endsAt(hhmm(Date.now() + minutes * 6e4)))), el("span", {}, p.stops ? x().planned(p.stops, p.cans) : x().nothing));
        go.textContent = "▶ " + x().start(minutes);
        chips.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.m === minutes)));
      };
      const chips = el("div", { class: "sh-chips", role: "group", "aria-label": x().howLong }, ...[30, 45, 60, 90, 120, 180].map(m =>
        el("button", { "data-m": m, onclick: () => { minutes = m; update(); } }, el("b", {}, m < 60 || m % 60 ? m : m / 60), el("span", {}, m < 60 || m % 60 ? x().min : x().h))));
      go.onclick = () => { S.set.minutes = minutes; ctx.saveSet(); close(); onStart(minutes); };
      d.append(el("h2", {}, x().howLong), el("p", { class: "cl-note", style: "margin-top:-6px" }, x().howLongHint), chips,
        el("div", { class: "cl-opts" }, ctx.seg(Object.keys(TRANSPORT).map(k => [k, TRANSPORT[k].label[S.lang]]), S.set.mode, v => { S.set.mode = v; S.set.bag = null; ctx.saveSet(); d.querySelector(".cl-seg").replaceWith(ctx.seg(Object.keys(TRANSPORT).map(k => [k, TRANSPORT[k].label[S.lang]]), v, () => {})); update(); })),
        sum, go, el("button", { class: "sh-link", onclick: () => explain() }, "ⓘ " + x().how));
      update();
    });
  }
  function confirmEnd(onEnd) {
    if (!S.shift || remainingMin() <= 3) return onEnd();
    modal((d, close) => {
      d.append(el("h2", {}, x().endEarlyQ), el("p", { class: "cl-note", style: "color:var(--ink);font-size:1rem" }, x().endEarlyText(hhmm(endsAt()))),
        el("div", { class: "cl-row" }, el("button", { class: "cl-btn primary", onclick: () => { close(); onEnd(); } }, x().endNow), el("button", { class: "cl-btn", onclick: close }, x().keep)));
    });
  }

  // ---------- the route explainer ----------
  function picture() {
    // you (blue) with your reserved snakes; another collector (grey) with theirs; the route never crosses to their snakes
    const snake = (cx, cy, c, n, lock) => `<g><circle cx="${cx}" cy="${cy}" r="17" fill="var(--card)" stroke="${c}" stroke-width="5"/><text x="${cx}" y="${cy + 5}" text-anchor="middle" font-size="13" font-weight="800" fill="var(--ink)">${n}</text>${lock ? `<text x="${cx + 14}" y="${cy - 12}" font-size="13">🔒</text>` : ""}</g>`;
    return `<svg viewBox="0 0 340 170" role="img" aria-label="${x().exTitle}">
      <path d="M40 130 C 80 120, 90 70, 130 62 S 200 40, 214 100" fill="none" stroke="var(--route)" stroke-width="5" stroke-linecap="round"/>
      <path d="M300 40 C 280 70, 270 110, 262 140" fill="none" stroke="#8E8E93" stroke-width="4" stroke-dasharray="2 8" stroke-linecap="round"/>
      ${snake(130, 62, "#D2452F", 21, true)}${snake(214, 100, "#E3A21A", 16, true)}${snake(262, 140, "#D2452F", 21, false)}${snake(88, 30, "#7FB77E", 5, false)}
      <circle cx="40" cy="130" r="9" fill="var(--route)" stroke="#fff" stroke-width="3"/><text x="40" y="158" text-anchor="middle" font-size="12" font-weight="700" fill="var(--ink)">${x().you}</text>
      <circle cx="300" cy="40" r="9" fill="#8E8E93" stroke="#fff" stroke-width="3"/><text x="328" y="20" text-anchor="end" font-size="12" font-weight="700" fill="var(--muted)">${x().other}</text>
    </svg>`;
  }
  function explain() {
    modal((d, close) => {
      d.append(el("h2", {}, x().exTitle), el("p", { class: "cl-note", style: "color:var(--ink);font-size:1rem;margin-top:-4px" }, x().exLead),
        el("div", { class: "ex-pic", html: picture() }),
        el("ol", { class: "ex-steps" }, ...x().ex.map(([ic, h, p], i) => el("li", {}, el("span", { class: "ic", style: `background:color-mix(in srgb,${TILE[i]} 18%,var(--card))`, "aria-hidden": "true" }, ic), el("span", {}, el("b", {}, h), el("p", {}, p))))),
        relBadge(), el("p", { class: "cl-note" }, x().relWhy[reliability().level]),
        el("button", { class: "cl-btn primary", onclick: close }, x().exOk));
    });
  }

  // ---------- the stops after the next one, with distance and cans (desktop: list; phone: one line) ----------
  function upNext(stops, byId, eff, levelCol, onPick) {
    const wrap = el("div", {});
    if (!stops.length) return wrap;
    const rows = stops.slice(0, 3);
    wrap.append(el("p", { class: "sh-mini" }, el("span", {}, x().upNext + ":"), ...rows.map((st, i) => el("b", {}, `${i ? "· " : ""}${byId(st.id)?.design_name || ""}`))));
    const ol = el("ol", {});
    rows.forEach((st, i) => {
      const s = byId(st.id); if (!s) return;
      const f = eff(s).f, lv = f == null ? null : Math.max(0, Math.min(4, Math.round(f)));
      ol.append(el("li", {}, el("button", { onclick: () => onPick(s.id) },
        el("span", { class: "n" }, st.num),
        el("span", { style: "min-width:0" }, el("b", {}, s.design_name), el("small", {}, el("span", { class: "leg" }, `+${fmt(st.legM)} · ${Math.max(1, Math.round(st.legMin ?? 0))} ${x().min}`), ` ${x().fromPrev}`, s.location_label ? ` · ${s.location_label}` : "")),
        el("span", { class: "cans" }, `≈ ${expectedCans(f)}`, el("span", { class: "sh-tube" }, el("i", { style: `width:${(f ?? 0) / 4 * 100}%;background:${lv == null ? "#8C969C" : levelCol[lv]}` }))))));
    });
    wrap.append(el("div", { class: "sh-up desk" }, el("h4", {}, x().upNext), ol));
    return wrap;
  }
  const fmt = m => m == null ? "–" : m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`;
  function sessionLine(reservedN) {
    return el("div", { class: "sh-session" }, el("span", {}, "🔒 " + x().reserved(reservedN)), el("button", { class: "sh-link", onclick: () => explain() }, "ⓘ " + x().how));
  }

  return { startDialog, confirmEnd, explain, timer, tick, toReserve, startSession, endSession, remainingMin, upNext, sessionLine, bestCard, bestTimes, relBadge, text: x, totalLine: (...a) => x().total(...a) };
}
