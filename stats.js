// Collector app, "My stats": activity rings for today, the week as bars, a streak, colourful tiles and awards.
// Built to be read at a glance, with pictures before numbers. createStats(ctx) is called by collector.js.
import { myVisits, myTotals, myProfile } from "./data.js";
import { impactOf, milestones, currencyOf, IMPACT } from "./impact.js";

const CAN_VALUE = 1.1;
const CAN_HEIGHT_M = 0.115;            // a 33 cl can stands about 11.5 cm tall
const TOWER = { m: 96, en: "Aarhus Cathedral's tower", da: "Aarhus Domkirkes tårn" };
const GOALS = { cans: 60, snakes: 4, minutes: 60 };

const X = {
  da: {
    today: "I dag", rings: { cans: "Dåser", snakes: "Slanger", minutes: "Minutter" },
    toClose: (n, w) => `${n} ${w} mere for at lukke ringen`, closed: "Alle ringe lukket! Flot arbejde 🎉", closedOne: w => `${w}-ringen er lukket ✓`, start: "Start en vagt for at fylde dine ringe.",
    week: "Denne uge", avg: "snit", vsLast: p => p >= 0 ? `↑ ${p} % mere end på samme tid sidste uge` : `↓ ${-p} % mindre end på samme tid sidste uge`, firstWeek: "Din første uge",
    streak: n => n === 1 ? "1 dag i træk" : `${n} dage i træk`, streakNone: "Saml i dag for at starte en stime", streakHint: "Dage i træk med mindst én tømt slange",
    earned: "kr tjent (ca.)", walked: "km gået i dag", co2: "kg CO₂ sparet", proven: "beviste besøg",
    stack: "Dine dåser, stablet", stackText: (m, pct) => `${m} m høj – ${pct} % af vejen op ad ${TOWER.da} (${TOWER.m} m).`, stackDone: (m, x) => `${m} m høj – ${x}× ${TOWER.da}!`,
    awards: "Udmærkelser", visits: "Dagens besøg", none: "Ingen besøg endnu i dag.", cans: "dåser",
    days: ["M", "T", "O", "T", "F", "L", "S"], tapBar: "Tryk på en dag",
  },
  en: {
    today: "Today", rings: { cans: "Cans", snakes: "Snakes", minutes: "Minutes" },
    toClose: (n, w) => `${n} more ${w} to close your ring`, closed: "All rings closed! Great work 🎉", closedOne: w => `${w} ring closed ✓`, start: "Start a session to fill your rings.",
    week: "This week", avg: "avg", vsLast: p => p >= 0 ? `↑ ${p}% more than this time last week` : `↓ ${-p}% less than this time last week`, firstWeek: "Your first week",
    streak: n => n === 1 ? "1-day streak" : `${n}-day streak`, streakNone: "Collect today to start a streak", streakHint: "Days in a row with at least one snake emptied",
    earned: "DKK earned (approx.)", walked: "km walked today", co2: "kg CO₂ saved", proven: "proven visits",
    stack: "Your cans, stacked", stackText: (m, pct) => `${m} m tall – ${pct}% of the way up ${TOWER.en} (${TOWER.m} m).`, stackDone: (m, x) => `${m} m tall – ${x}× ${TOWER.en}!`,
    awards: "Awards", visits: "Today's visits", none: "No visits yet today.", cans: "cans",
    days: ["M", "T", "W", "T", "F", "S", "S"], tapBar: "Tap a day",
  },
};
const RING = { cans: "#FA114F", snakes: "#A4F000", minutes: "#00D8FF" };

export const STATS_CSS = `
#col .st{display:grid;gap:12px}
#col .st-hero{border-radius:24px;padding:16px;background:radial-gradient(120% 120% at 0% 0%,#2C2C2E 0%,#000 70%);color:#fff;display:grid;grid-template-columns:132px minmax(0,1fr);gap:16px;align-items:center}
#col .st-hero .eb{font-size:.75rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#8E8E93}
#col .st-hero h3{margin:2px 0 8px;font-size:1.125rem;line-height:1.25;font-weight:800}
#col .st-rings{width:132px;height:132px;border:0;background:transparent;padding:0}
#col .st-rings circle{fill:none;stroke-linecap:round;transition:stroke-dashoffset 1s cubic-bezier(.2,.8,.2,1)}
#col .st-legend{display:grid;gap:6px}
#col .st-legend button{display:grid;grid-template-columns:auto 1fr;gap:0 8px;text-align:start;border:0;background:transparent;color:#fff;padding:2px 0;min-height:40px;align-items:center;border-radius:10px;opacity:.75}
#col .st-legend button[aria-pressed="true"]{opacity:1}
#col .st-legend b{font-size:1.25rem;font-weight:800;line-height:1}
#col .st-legend b small{font-size:.8125rem;font-weight:600;color:#8E8E93}
#col .st-legend span{font-size:.75rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;grid-column:2}
#col .st-legend i{grid-row:span 2;width:10px;height:10px;border-radius:50%}
@media (max-width:360px){#col .st-hero{grid-template-columns:1fr;justify-items:center}}
#col .st-card{border-radius:22px;padding:14px 16px;background:var(--card);border:1px solid color-mix(in srgb,var(--line) 70%,transparent);box-shadow:0 1px 2px rgba(0,0,0,.04),0 6px 20px rgba(0,0,0,.05);display:grid;gap:8px}
#col .st-card h3{margin:0;font-size:1.0625rem;font-weight:800;display:flex;justify-content:space-between;gap:8px;align-items:baseline}
#col .st-card h3 small{font-size:.8125rem;font-weight:600;color:var(--muted)}
#col .st-week{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px;align-items:end;height:120px;position:relative}
#col .st-week button{border:0;background:transparent;padding:0;height:100%;display:grid;grid-template-rows:1fr auto;gap:4px;align-items:end;min-height:0}
#col .st-week i{display:block;border-radius:8px;min-height:6px;background:linear-gradient(180deg,#FF9500,#FF2D55);opacity:.55;transition:height .6s cubic-bezier(.2,.8,.2,1),opacity .15s}
#col .st-week button.today i{opacity:1}
#col .st-week button.empty i{background:var(--chip);opacity:1}
#col .st-week button[aria-pressed="true"] i{opacity:1;outline:2px solid var(--ink);outline-offset:2px}
#col .st-week small{font-size:.75rem;color:var(--muted);text-align:center;font-weight:700}
#col .st-week button.today small{color:var(--ink)}
#col .st-avg{position:absolute;left:0;right:0;border-top:2px dashed color-mix(in srgb,var(--muted) 60%,transparent);pointer-events:none}
#col .st-avg span{position:absolute;right:0;top:-18px;font-size:.6875rem;color:var(--muted);font-weight:700}
#col .st-sel{font-size:.9375rem;min-height:1.4em}
#col .st-sel b{font-size:1.5rem;font-weight:800}
#col .st-trend{font-size:.875rem;font-weight:700;color:#34C759}
#col .st-trend.down{color:var(--muted)}
#col .st-streak{display:grid;grid-template-columns:56px minmax(0,1fr);gap:12px;align-items:center;border-radius:22px;padding:14px 16px;background:linear-gradient(135deg,#FF9500,#FF5E3A);color:#fff}
#col .st-streak .fl{font-size:40px;text-align:center;line-height:1}
#col .st-streak b{font-size:1.25rem;font-weight:800;display:block}
#col .st-streak small{opacity:.9;font-size:.8125rem}
#col .st-dots{display:flex;gap:6px;margin-top:6px}
#col .st-dots i{width:22px;height:22px;border-radius:50%;background:rgba(255,255,255,.28);display:grid;place-items:center;font-size:12px;font-style:normal;font-weight:800}
#col .st-dots i.on{background:#fff;color:#FF5E3A}
#col .st-tiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
#col .st-tile{border-radius:20px;padding:12px 14px;color:#fff;display:grid;gap:2px;min-width:0}
#col .st-tile svg{width:26px;height:26px;margin-bottom:6px;opacity:.95}
#col .st-tile b{font-size:1.6rem;font-weight:800;line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#col .st-tile span{font-size:.8125rem;font-weight:600;opacity:.92}
#col .st-stack{display:grid;grid-template-columns:64px minmax(0,1fr);gap:14px;align-items:end}
#col .st-stack svg{width:64px;height:120px}
#col .st-stack p{margin:0;font-size:.9375rem}
#col .st-stack b{font-size:1.6rem;font-weight:800;display:block}
#col .st-awards{display:grid;grid-template-columns:repeat(auto-fill,minmax(76px,1fr));gap:10px}
#col .st-award{border:0;background:transparent;padding:0;display:grid;justify-items:center;gap:4px;text-align:center}
#col .st-award .m{width:64px;height:64px;border-radius:50%;display:grid;place-items:center;font-size:28px;position:relative;background:radial-gradient(circle at 30% 25%,#FFF6C8,#F5C542 45%,#C9871B);box-shadow:0 4px 12px rgba(201,135,27,.35),inset 0 -3px 6px rgba(0,0,0,.18)}
#col .st-award.next .m{background:conic-gradient(#FF9500 calc(var(--p)*1%),var(--chip) 0);box-shadow:none}
#col .st-award.next .m::before{content:"";position:absolute;inset:5px;border-radius:50%;background:var(--card)}
#col .st-award.next .m span{position:relative;filter:grayscale(.3)}
#col .st-award.lock .m{background:var(--chip);box-shadow:none;filter:grayscale(1);opacity:.55}
#col .st-award small{font-size:.75rem;color:var(--muted);font-weight:700;line-height:1.2}
#col .st-award[aria-pressed="true"] .m{outline:3px solid var(--route);outline-offset:2px}
#col .st-awtext{font-size:.9375rem;margin:0;min-height:1.4em}
#col .st-visit{display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:10px;align-items:center;padding:6px 0}
#col .st-visit .sw{width:44px;height:44px;border-radius:12px;overflow:hidden;display:flex;flex-direction:column}
#col .st-visit .sw i{flex:1}
#col .st-visit b{display:block;font-size:1rem}
#col .st-visit small{color:var(--muted);font-size:.8125rem}
#col .st-visit .c{font-weight:800;font-size:1.125rem}
`;

const ICONS = {
  coin: `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.6-1-1.7-1.5-3-1.5-1.7 0-3 .9-3 2.1 0 2.8 6 1.4 6 4.2 0 1.2-1.3 2.2-3 2.2-1.4 0-2.6-.6-3.1-1.6M12 6v2M12 16v2"/></svg>`,
  walk: `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13" cy="4" r="2"/><path d="M9 21l2-6 3 3v3M11 15l1-5 3 3h3M12 10l-3 1-2 3"/></svg>`,
  leaf: `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19c0-8 5-13 15-14-1 10-6 15-14 15M5 19l7-7"/></svg>`,
  pin: `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><path d="M9.5 10l2 2 3.5-3.5"/></svg>`,
};

export function createStats(ctx) {
  const { el, S, store, snakeMeta, byId } = ctx;
  const x = () => X[S.lang] || X.en;
  const nf = (n, d = 0) => Number(n).toLocaleString(S.lang === "da" ? "da-DK" : "en-GB", { maximumFractionDigits: d, minimumFractionDigits: d });
  const dayKey = d => new Date(d).toDateString();
  let focus = "cans", selDay = null, selAward = null;

  function rings(v) {
    const R = [["cans", 56], ["snakes", 41], ["minutes", 26]], C = r => 2 * Math.PI * r;
    const svg = R.map(([k, r]) => {
      const p = Math.min(1, v[k] / GOALS[k]);
      return `<circle cx="66" cy="66" r="${r}" stroke="${RING[k]}" stroke-opacity=".22" stroke-width="13"/>
        <circle class="ring-${k}" cx="66" cy="66" r="${r}" stroke="${RING[k]}" stroke-width="13" stroke-dasharray="${C(r)}" stroke-dashoffset="${C(r)}" data-to="${C(r) * (1 - p)}" transform="rotate(-90 66 66)" opacity="${focus === k ? 1 : .9}"/>`;
    }).join("");
    const box = el("div", { class: "st-rings", role: "img", "aria-label": R.map(([k]) => `${x().rings[k]} ${v[k]}/${GOALS[k]}`).join(", "), html: `<svg viewBox="0 0 132 132" width="132" height="132">${svg}</svg>` });
    requestAnimationFrame(() => requestAnimationFrame(() => box.querySelectorAll("circle[data-to]").forEach(c => c.style.strokeDashoffset = c.dataset.to)));
    return box;
  }
  function headline(v) {
    const open = Object.keys(GOALS).filter(k => v[k] < GOALS[k]);
    if (!open.length) return x().closed;
    if (!v.cans && !v.minutes) return x().start;
    if (v[focus] >= GOALS[focus]) return x().closedOne(x().rings[focus]);
    return x().toClose(GOALS[focus] - v[focus], x().rings[focus].toLowerCase());
  }

  async function pane(p) {
    const box = el("div", { class: "st" }); p.append(box);
    const [visits, totals, profile] = await Promise.all([myVisits(60).catch(() => []), myTotals().catch(() => ({ containers: 0, visits: 0, verified: 0 })), myProfile().catch(() => null)]);
    const today = visits.filter(v => dayKey(v.created_at) === dayKey(Date.now()));
    const sessions = store.get("sessions", []).filter(s => dayKey(s.start) === dayKey(Date.now()));
    const minutes = Math.round(sessions.reduce((a, s) => a + ((s.end ? new Date(s.end) : Date.now()) - new Date(s.start)) / 6e4, 0));
    const v = { cans: today.reduce((a, x) => a + (x.cans || 0), 0), snakes: today.filter(x => x.outcome === "emptied" || x.outcome === "partial").length, minutes };

    // ---- today: rings ----
    const hero = el("div", { class: "st-hero" });
    const drawHero = () => {
      hero.replaceChildren(rings(v), el("div", {}, el("div", { class: "eb" }, x().today), el("h3", {}, headline(v)),
        el("div", { class: "st-legend" }, ...Object.keys(GOALS).map(k => el("button", { "aria-pressed": String(focus === k), onclick: () => { focus = k; drawHero(); } },
          el("i", { style: `background:${RING[k]}` }), el("b", { style: `color:${RING[k]}` }, nf(v[k]), el("small", {}, ` / ${GOALS[k]}`)), el("span", {}, x().rings[k]))))));
    };
    drawHero(); box.append(hero);

    // ---- the week: bars Monday to Sunday ----
    const mon = new Date(); mon.setHours(0, 0, 0, 0); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
    const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); const vs = visits.filter(v => dayKey(v.created_at) === dayKey(d)); return { d, cans: vs.reduce((a, v) => a + (v.cans || 0), 0), n: vs.length }; });
    // compared with last week up to the same moment, so a Thursday isn't measured against a whole week
    const lastWeek = visits.filter(v => { const t = new Date(v.created_at); return t >= new Date(mon.getTime() - 7 * 864e5) && t < new Date(Date.now() - 7 * 864e5); }).reduce((a, v) => a + (v.cans || 0), 0);
    const weekCans = days.reduce((a, d) => a + d.cans, 0), todayIdx = (new Date().getDay() + 6) % 7;
    const active = days.filter(d => d.cans), avg = active.length ? weekCans / active.length : 0, max = Math.max(1, ...days.map(d => d.cans), avg);
    const sel = el("div", { class: "st-sel", "aria-live": "polite" });
    const bars = el("div", { class: "st-week" });
    const drawWeek = () => {
      bars.replaceChildren(...days.map((d, i) => el("button", { class: (i === todayIdx ? "today " : "") + (d.cans ? "" : "empty"), "aria-pressed": String(selDay === i), "aria-label": `${d.d.toLocaleDateString(S.lang === "da" ? "da-DK" : "en-GB", { weekday: "long" })}: ${d.cans} ${x().cans}`, onclick: () => { selDay = selDay === i ? null : i; drawWeek(); } },
        el("i", { style: `height:${Math.max(4, d.cans / max * 100)}%` }), el("small", {}, x().days[i]))),
        avg ? el("div", { class: "st-avg", style: `bottom:calc(${avg / max} * (100% - 20px) + 20px)` }, el("span", {}, `${x().avg} ${Math.round(avg)}`)) : "");
      const d = selDay != null ? days[selDay] : null;
      sel.replaceChildren(d ? el("span", {}, el("b", {}, nf(d.cans)), ` ${x().cans} · ${d.d.toLocaleDateString(S.lang === "da" ? "da-DK" : "en-GB", { weekday: "long" })} · ≈ ${nf(d.cans * CAN_VALUE)} ${currencyOf(profile?.country)}`)
        : el("span", {}, el("b", {}, nf(weekCans)), ` ${x().cans}`));
    };
    drawWeek();
    const pct = lastWeek ? Math.round((weekCans - lastWeek) / lastWeek * 100) : null;
    box.append(el("div", { class: "st-card" }, el("h3", {}, x().week, el("small", {}, x().tapBar)), sel, bars,
      el("div", { class: "st-trend" + (pct != null && pct < 0 ? " down" : "") }, pct == null ? x().firstWeek : x().vsLast(pct))));

    // ---- streak ----
    const daysWith = new Set(visits.filter(v => v.outcome === "emptied" || v.outcome === "partial").map(v => dayKey(v.created_at)));
    let streak = 0; const d0 = new Date(); if (!daysWith.has(dayKey(d0))) d0.setDate(d0.getDate() - 1);
    while (daysWith.has(dayKey(d0))) { streak++; d0.setDate(d0.getDate() - 1); }
    box.append(el("div", { class: "st-streak" }, el("span", { class: "fl", "aria-hidden": "true" }, "🔥"),
      el("div", {}, el("b", {}, streak ? x().streak(streak) : x().streakNone), el("small", {}, x().streakHint),
        el("div", { class: "st-dots", "aria-hidden": "true" }, ...days.map((d, i) => el("i", { class: daysWith.has(dayKey(d.d)) ? "on" : "" }, daysWith.has(dayKey(d.d)) ? "✓" : x().days[i]))))));

    // ---- tiles ----
    const cur = currencyOf(profile?.country), im = impactOf(totals.containers, 0, cur);
    const tile = (bg, icon, value, label) => el("div", { class: "st-tile", style: `background:${bg}` }, el("span", { html: ICONS[icon], "aria-hidden": "true" }), el("b", {}, value), el("span", {}, label));
    box.append(el("div", { class: "st-tiles" },
      tile("linear-gradient(135deg,#34C759,#1E9E4A)", "coin", nf(totals.containers * IMPACT.deposit[cur]), S.lang === "da" ? x().earned : x().earned.replace("DKK", cur)),
      tile("linear-gradient(135deg,#0A84FF,#5E5CE6)", "walk", nf((S.walkedM?.m || 0) / 1000, 1), x().walked),
      tile("linear-gradient(135deg,#30B0C7,#0F8A7E)", "leaf", nf(im.co2, im.co2 < 100 ? 1 : 0), x().co2),
      tile("linear-gradient(135deg,#BF5AF2,#8E44AD)", "pin", nf(totals.verified), x().proven)));

    // ---- the cans as a picture: a stack next to the cathedral tower ----
    const m = totals.containers * CAN_HEIGHT_M, frac = Math.min(1, m / TOWER.m), stackH = 104 * frac;
    box.append(el("div", { class: "st-card" }, el("h3", {}, x().stack),
      el("div", { class: "st-stack" },
        el("span", { "aria-hidden": "true", html: `<svg viewBox="0 0 64 120"><path d="M40 118V40l6-12 6 12v78z" fill="var(--chip)"/><path d="M46 8v20" stroke="var(--muted)" stroke-width="2"/><rect x="8" y="${116 - stackH}" width="20" height="${stackH}" rx="3" fill="url(#cg)"/><defs><linearGradient id="cg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#FF2D55"/><stop offset="1" stop-color="#FF9500"/></linearGradient></defs><path d="M2 118h60" stroke="var(--muted)" stroke-width="2"/></svg>` }),
        el("p", {}, el("b", {}, `${nf(totals.containers)} ${x().cans}`), m >= TOWER.m ? x().stackDone(nf(m), nf(m / TOWER.m, 1)) : x().stackText(nf(m), Math.round(frac * 100))))));

    // ---- awards: the CO₂ milestones as medals ----
    const ms = milestones(profile?.city, S.lang), next = ms.find(a => im.co2 < a.kg);
    const awText = el("p", { class: "st-awtext", "aria-live": "polite" });
    const grid = el("div", { class: "st-awards" });
    const drawAwards = () => {
      grid.replaceChildren(...ms.map((a, i) => {
        const got = im.co2 >= a.kg, isNext = a === next;
        return el("button", { class: "st-award" + (got ? "" : isNext ? " next" : " lock"), style: isNext ? `--p:${Math.min(100, im.co2 / a.kg * 100)}` : "", "aria-pressed": String(selAward === i), onclick: () => { selAward = i; drawAwards(); } },
          el("span", { class: "m" }, el("span", {}, a.icon)), el("small", {}, `${nf(a.kg)} kg`));
      }));
      const a = ms[selAward ?? Math.max(0, ms.indexOf(next))];
      awText.textContent = a ? `${a.icon} ${a.text} · ${nf(a.kg)} kg CO₂` + (im.co2 >= a.kg ? " ✓" : ` · ${nf(Math.max(0, a.kg - im.co2), 1)} kg ${S.lang === "da" ? "tilbage" : "to go"}`) : "";
    };
    drawAwards();
    box.append(el("div", { class: "st-card" }, el("h3", {}, x().awards, el("small", {}, `${ms.filter(a => im.co2 >= a.kg).length}/${ms.length}`)), grid, awText));

    // ---- today's visits ----
    const vis = el("div", { class: "st-card" }, el("h3", {}, x().visits));
    if (!today.length) vis.append(el("p", { class: "cl-note" }, x().none));
    for (const t of today) {
      const s = byId(t.snake_id), meta = snakeMeta(t.snake_id);
      vis.append(el("div", { class: "st-visit" }, el("span", { class: "sw", "aria-hidden": "true" }, ...(meta.colors || ["#999"]).map(c => el("i", { style: `background:${c}` }))),
        el("span", { style: "min-width:0" }, el("b", {}, s?.design_name || meta.name || t.snake_id), el("small", {}, new Date(t.created_at).toLocaleTimeString(S.lang === "da" ? "da-DK" : "en-GB", { hour: "2-digit", minute: "2-digit" }) + (t.verified ? " · ✓" : ""))),
        el("span", { class: "c" }, t.cans ? `+${t.cans}` : "")));
    }
    box.append(vis);
  }
  return { pane };
}
