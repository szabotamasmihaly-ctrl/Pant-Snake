// Collector app, Ranking: weekly leagues. Every Monday collectors are put in groups of 20 at the same level and race
// for the most cans proven at a snake that week. The top 5 move up a league, the bottom 5 move down, the rest stay.
// The only public ranking is each country's top league. createLeague(ctx) is called by collector.js.
import { myLeague, topLeague, LEAGUE } from "./data.js";
import { FLAG, COUNTRY } from "./impact.js";

// metals, because the cans are metal: from the can itself up to diamond
export const TIERS = [
  { en: "Aluminium", da: "Aluminium", c: ["#E6EBEF", "#9AA5AE"] },
  { en: "Copper", da: "Kobber", c: ["#F2B48A", "#B5653A"] },
  { en: "Bronze", da: "Bronze", c: ["#E7C08A", "#9C6B30"] },
  { en: "Silver", da: "Sølv", c: ["#F4F6F8", "#A3ACB6"] },
  { en: "Gold", da: "Guld", c: ["#FFE48A", "#D39B12"] },
  { en: "Platinum", da: "Platin", c: ["#E4F3F7", "#7FB3C2"] },
  { en: "Diamond", da: "Diamant", c: ["#C9F1FF", "#5AA8FF"] },
];
const X = {
  da: {
    mine: "Min liga", top: "Topligaen", league: n => `${n}-ligaen`, left: (d, h) => d ? `${d} d ${h} t tilbage` : `${h} t tilbage`,
    rule: (u, dn) => `Top ${u} rykker op · de nederste ${dn} rykker ned`, upZone: "Oprykning", downZone: "Nedrykning", you: "dig", example: "eksempel",
    lastUp: (r, t) => `Du blev nr. ${r} sidste uge og rykkede op i ${t}! 🎉`, lastDown: t => `Du rykkede ned i ${t}. Ny uge, ny chance.`, lastStay: (r, t) => `Du blev nr. ${r} og blev i ${t}.`,
    toUp: n => `${n} dåser mere for at nå oprykning`, inUp: "Du er i oprykningszonen – hold den!", top1: "Du fører ligaen!",
    how: "Grupper på 20 indsamlere på samme niveau starter forfra hver mandag. Kun dåser, der er bevist ved en slange, tæller.",
    topHint: c => `De bedste i ${c}s højeste liga denne uge. Det er den eneste offentlige rangliste.`, cans: "dåser", hidden: "Du er skjult på ranglisterne. Slå det til under ⚙ › Profil.",
  },
  en: {
    mine: "My league", top: "Top league", league: n => `${n} League`, left: (d, h) => d ? `${d}d ${h}h left` : `${h}h left`,
    rule: (u, dn) => `Top ${u} move up · bottom ${dn} move down`, upZone: "Promotion zone", downZone: "Demotion zone", you: "you", example: "example",
    lastUp: (r, t) => `You finished #${r} last week and moved up to ${t}! 🎉`, lastDown: t => `You moved down to ${t}. New week, new chance.`, lastStay: (r, t) => `You finished #${r} and stayed in ${t}.`,
    toUp: n => `${n} more cans to reach promotion`, inUp: "You're in the promotion zone. Hold on to it!", top1: "You're leading the league!",
    how: "Groups of 20 collectors at the same level start fresh every Monday. Only cans proven at a snake count.",
    topHint: c => `The best of ${c}'s highest league this week. This is the only public ranking.`, cans: "cans", hidden: "You're hidden from the leaderboards. Turn it on under ⚙ › Profile.",
  },
};

export const LEAGUE_CSS = `
#col .lg{display:grid;gap:12px}
#col .lg-tiers{min-height:max-content;display:flex;gap:6px;align-items:end;justify-content:space-between;padding:6px 2px 0;overflow-x:auto;scrollbar-width:none}
#col .lg-tiers::-webkit-scrollbar{display:none}
#col .lg-badge{flex:none;display:grid;justify-items:center;gap:2px}
#col .lg-badge svg{width:38px;height:44px;transition:transform .3s}
#col .lg-badge.cur svg{width:64px;height:74px;filter:drop-shadow(0 6px 10px rgba(0,0,0,.25))}
#col .lg-badge.lock svg{filter:grayscale(1);opacity:.35}
#col .lg-head{text-align:center;display:grid;gap:2px}
#col .lg-head h3{margin:0;font-size:1.5rem;font-weight:800;letter-spacing:-.01em}
#col .lg-head p{margin:0;color:var(--muted);font-size:.9375rem}
#col .lg-last{border-radius:16px;padding:10px 12px;font-weight:700;font-size:.9375rem;background:color-mix(in srgb,#34C759 16%,var(--card));color:var(--ink)}
#col .lg-last.down{background:color-mix(in srgb,#FF9500 14%,var(--card))}
#col .lg-goal{border-radius:16px;padding:10px 12px;display:grid;gap:6px;background:var(--chip);font-weight:700;font-size:.9375rem}
#col .lg-goal .bar{height:10px;border-radius:5px;background:color-mix(in srgb,var(--muted) 20%,transparent);overflow:hidden}
#col .lg-goal .bar i{display:block;height:100%;border-radius:5px;background:linear-gradient(90deg,#34C759,#30D158)}
#col .lg-list{list-style:none;margin:0;padding:0;display:grid;gap:4px}
#col .lg-list li{display:grid;grid-template-columns:28px 36px minmax(0,1fr) auto;gap:10px;align-items:center;padding:7px 10px;border-radius:14px}
#col .lg-list li.me{background:color-mix(in srgb,var(--route) 12%,var(--card));box-shadow:0 0 0 2px var(--route) inset}
#col .lg-list .r{font-weight:800;text-align:center;color:var(--muted)}
#col .lg-list li.up .r{color:#1E9E4A}
#col .lg-list li.dn .r{color:#D2452F}
#col .lg-list .av{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;color:#fff;font-weight:800;font-size:.9375rem}
#col .lg-list b{display:block;font-size:1rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#col .lg-list small{color:var(--muted);font-size:.8125rem}
#col .lg-list .v{font-weight:800;text-align:end}
#col .lg-list .v small{display:block;font-weight:500}
#col .lg-list li.zone{display:flex;gap:8px;align-items:center;padding:4px 6px;font-size:.75rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase}
#col .lg-list li.zone::before,#col .lg-list li.zone::after{content:"";flex:1;border-top:2px solid currentColor;opacity:.35}
#col .lg-list li.zone.up{color:#1E9E4A}
#col .lg-list li.zone.dn{color:#D2452F}
#col .lg-list li:nth-child(1) .r::after{content:" 🥇"}
#col .lg-cc{display:flex;gap:6px;flex-wrap:wrap}
#col .lg-cc button{border:1.5px solid var(--line);background:var(--card);border-radius:999px;padding:6px 12px;min-height:44px;font-weight:700}
#col .lg-cc button[aria-pressed="true"]{background:var(--ink);color:var(--bg);border-color:var(--ink)}
`;
const AV = ["#FF9500", "#34C759", "#007AFF", "#AF52DE", "#FF2D55", "#30B0C7", "#5856D6", "#FF3B30"];
const avColor = s => AV[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % AV.length];

function shield(t, i) {
  const [a, b] = t.c;
  return `<svg viewBox="0 0 64 74" aria-hidden="true"><defs><linearGradient id="lg${i}" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
    <path d="M32 2l28 10v22c0 18-12 31-28 38C16 65 4 52 4 34V12z" fill="url(#lg${i})" stroke="${b}" stroke-width="2"/>
    <path d="M32 10l20 7v17c0 13-8 23-20 29-12-6-20-16-20-29V17z" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2"/>
    <text x="32" y="44" text-anchor="middle" font-size="22" font-weight="800" fill="#fff" stroke="${b}" stroke-width=".8">${i + 1}</text></svg>`;
}

export function createLeague(ctx) {
  const { el, S } = ctx;
  const x = () => X[S.lang] || X.en;
  const nf = n => Number(n).toLocaleString(S.lang === "da" ? "da-DK" : "en-GB");
  const tn = i => TIERS[i][S.lang] || TIERS[i].en;

  const row = (r, cls = "") => el("li", { class: (r.me ? "me " : "") + cls }, el("span", { class: "r" }, r.rank),
    el("span", { class: "av", style: `background:${avColor(r.nickname)}`, "aria-hidden": "true" }, [...r.nickname][0].toUpperCase()),
    el("span", { style: "min-width:0" }, el("b", {}, r.nickname, r.me ? el("span", { class: "cm-tag" }, x().you) : "", r.example ? el("span", { class: "cm-tag" }, x().example) : ""), el("small", {}, `${FLAG(r.country)} ${r.city}`)),
    el("span", { class: "v" }, nf(r.containers), el("small", {}, x().cans)));

  async function pane(p) {
    S.lgView ||= "mine"; S.lgCountry ||= "DK";
    p.append(el("div", { class: "cl-opts" }, ctx.seg([["mine", x().mine], ["top", "🏆 " + x().top]], S.lgView, v => { S.lgView = v; ctx.renderSheet(); })));
    const box = el("div", { class: "lg" }); p.append(box);
    if (S.lgView === "top") return paneTop(box);
    let L; try { L = await myLeague(); } catch (e) { box.append(el("p", { class: "cl-note" }, String(e.message || e))); return; }
    const ms = new Date(L.ends_at) - Date.now(), d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 3.6e6);
    box.append(el("div", { class: "lg-tiers" }, ...TIERS.map((t, i) => el("span", { class: "lg-badge" + (i === L.tier ? " cur" : i > L.tier ? " lock" : ""), title: tn(i), html: shield(t, i) }))),
      el("div", { class: "lg-head" }, el("h3", {}, x().league(tn(L.tier))), el("p", {}, `${x().rule(LEAGUE.up, LEAGUE.down)} · ${x().left(d, h)}`)));
    if (L.last) box.append(el("div", { class: "lg-last" + (L.last.moved === "down" ? " down" : "") }, L.last.moved === "up" ? x().lastUp(L.last.rank, tn(L.tier)) : L.last.moved === "down" ? x().lastDown(tn(L.tier)) : x().lastStay(L.last.rank, tn(L.tier))));
    const me = L.rows.find(r => r.me), cut = L.rows[LEAGUE.up - 1];
    if (me && L.tier < TIERS.length - 1) {
      const need = me.rank <= LEAGUE.up ? 0 : cut.containers - me.containers + 1;
      box.append(el("div", { class: "lg-goal" }, el("span", {}, me.rank === 1 ? x().top1 : need ? "⬆ " + x().toUp(need) : "⬆ " + x().inUp),
        el("div", { class: "bar" }, el("i", { style: `width:${need ? Math.min(100, me.containers / Math.max(1, cut.containers + 1) * 100) : 100}%` }))));
    }
    const ul = el("ol", { class: "lg-list" }), n = L.rows.length;
    L.rows.forEach((r, i) => {
      if (i === LEAGUE.up && L.tier < TIERS.length - 1) ul.append(el("li", { class: "zone up", "aria-hidden": "true" }, "⬆ " + x().upZone));
      if (i === n - LEAGUE.down && L.tier > 0) ul.append(el("li", { class: "zone dn", "aria-hidden": "true" }, "⬇ " + x().downZone));
      ul.append(row(r, i < LEAGUE.up && L.tier < TIERS.length - 1 ? "up" : i >= n - LEAGUE.down && L.tier > 0 ? "dn" : ""));
    });
    box.append(ul, el("p", { class: "cl-note" }, x().how));
  }
  async function paneTop(box) {
    const cs = ["DK", "HU", "SE", "NO", "DE"];
    box.append(el("div", { class: "lg-tiers", style: "justify-content:center" }, el("span", { class: "lg-badge cur", html: shield(TIERS[6], 6) })),
      el("div", { class: "lg-head" }, el("h3", {}, x().league(tn(6))), el("p", {}, x().topHint(COUNTRY[S.lgCountry]?.split(" / ").at(-1) || S.lgCountry))),
      el("div", { class: "lg-cc" }, ...cs.map(c => el("button", { "aria-pressed": String(S.lgCountry === c), onclick: () => { S.lgCountry = c; ctx.renderSheet(); } }, `${FLAG(c)} ${c}`))));
    let rows = []; try { rows = await topLeague(S.lgCountry); } catch (e) { box.append(el("p", { class: "cl-note" }, String(e.message || e))); return; }
    box.append(el("ol", { class: "lg-list" }, ...rows.map(r => row(r))));
  }
  return { pane };
}
