// Collector app, community parts: impact and milestones, leaderboards, sponsorship, notifications, toolkit.
// createCommunity(ctx) is called by collector.js; ctx gives the shared helpers (el, modal, toast, state, …).
import { LIVE, myProfile, saveProfile, leaderboard, myTotals, communityTotal, sponsorInfo, becomeSponsor, endSponsorship,
  myNotifications, markNotificationsRead, simulateSponsorReport, listOffers, unlockCode, logOfferEvent, SPONSOR_MIN_VISITS, SPONSOR_HEAD_START_MIN, VERIFY_M } from "./data.js";
import { impactOf, milestones, CITIES, COUNTRY, FLAG, currencyOf, IMPACT } from "./impact.js";

const C = {
  da: {
    lifetime: "Alt i alt", containers: "dåser og flasker", co2: "kg CO₂ sparet", value: "værdi skabt", visits: "besøg", proven: "bevist ved slangen",
    breakdown: (d, c, t, cur) => `Pant tilbage i omløb ${d} · oprydning kommunen slipper for ${c} · tid sparet med planlagte ruter ${t} (${cur})`,
    milestones: "Milepæle", reached: "Nået", next: "Næste", toGo: kg => `${kg} kg CO₂ tilbage`, together: (city, kg, x) => `Indsamlere i ${city} har tilsammen sparet ${kg} kg CO₂ – ${x}.`,
    estimate: "Skøn: 0,11 kg CO₂ pr. dåse eller flaske (Dansk Retursystem). Se tallene under ⚙.",
    rank: "Rangliste", scope: { city: "By", country: "Land", continent: "Europa" }, period: { 30: "30 dage", all: "Altid" }, you: "dig", example: "eksempel",
    hidden: "Du er skjult på ranglisterne. Slå det til under ⚙ › Profil.", rankHint: "Rangeret efter dåser og flasker indsamlet.",
    sponsor: "Sponsor", noSponsor: "Ingen sponsor endnu.", sponsoredBy: n => `Sponsoreret af ${n}`, youSponsor: "Du sponsorerer denne slange",
    notOwnership: "Sponsorat er ikke ejerskab: alle må stadig bruge og tømme slangen. Som sponsor står dit kaldenavn på slangens side, når QR-koden scannes, og du får besked først, når den er fuld eller har et problem.",
    yourVisits: (m, o) => `Dine beviste besøg (90 dage): ${m}` + (o ? ` · flest af andre: ${o.nickname} ${o.visits}` : ""),
    needVisits: n => `Den, der har flest beviste besøg (mindst ${n} på 90 dage), kan blive sponsor.`,
    become: "Bliv sponsor", showName: "Vis mit kaldenavn på slangens side", notifyFirst: `Giv mig besked først (${SPONSOR_HEAD_START_MIN} min. forspring)`, confirm: "Bekræft sponsorat", end: "Stop sponsorat", save: "Gem",
    becameSponsor: "Du er nu sponsor. Tak!", headStart: (n, m) => `${n} har ${m} min. forspring (sponsor)`,
    inbox: "Beskeder", noNotes: "Ingen beskeder endnu.", noteFull: n => `${n} er meldt ¾ fuld eller mere. Du hører det først som sponsor.`, noteProblem: n => `${n} har fået meldt et problem.`,
    noteSponsor: n => `Du er nu sponsor for ${n}.`, simulate: "Demo: send en melding om min sponsor-slange",
    kit: "Udstyr", kitIntro: "Det udstyr, der gør runderne lettere, og de butikker, der sælger det. Vi er ved at finde partnere: når en butik siger ja, låser du rabat op, jo mere du samler. Intet her er påkrævet.", shops: "Butikker", wanted: "Partner søges – ingen rabat endnu", collected: n => `Du har samlet ${n} dåser og flasker`,
    ad: "Annonce", unlock: (c, p) => p >= 100 ? `Gratis ved ${c}` : `${p} % ved ${c}`, showCode: "Vis rabatkode", code: "Rabatkode", visit: "Til butikken", advertise: "Sælger du udstyr til indsamlere? Annoncér her",
    profile: "Profil", nickname: "Kaldenavn (vises på ranglister)", home: "Hjemby", showLb: "Vis mig på ranglisterne", saved: "Gemt", taken: "Kaldenavnet er taget.", short: "Mindst 2 tegn.",
    numbers: "Sådan regner vi", money: "Penge", near: "En anden indsamler er tæt på", nearLong: "En anden indsamler er tæt på denne slange, så den bliver taget. Den er lagt bagerst i din plan.",
  },
  en: {
    lifetime: "All time", containers: "cans and bottles", co2: "kg CO₂ saved", value: "value created", visits: "visits", proven: "proven at the snake",
    breakdown: (d, c, t, cur) => `Deposit back in circulation ${d} · clean-up the city is spared ${c} · time saved by planned routes ${t} (${cur})`,
    milestones: "Milestones", reached: "Reached", next: "Next", toGo: kg => `${kg} kg CO₂ to go`, together: (city, kg, x) => `Collectors in ${city} have saved ${kg} kg CO₂ together: ${x}.`,
    estimate: "Estimate: 0.11 kg CO₂ per can or bottle (Dansk Retursystem). The numbers are under ⚙.",
    rank: "Ranking", scope: { city: "City", country: "Country", continent: "Europe" }, period: { 30: "30 days", all: "All time" }, you: "you", example: "example",
    hidden: "You're hidden from the leaderboards. Turn it on under ⚙ › Profile.", rankHint: "Ranked by cans and bottles collected.",
    sponsor: "Sponsor", noSponsor: "No sponsor yet.", sponsoredBy: n => `Sponsored by ${n}`, youSponsor: "You sponsor this snake",
    notOwnership: "Sponsorship is not ownership: anyone may still use and empty this snake. As its sponsor, your nickname appears on the snake's page when its QR code is scanned, and you're told first when it's full or has a problem.",
    yourVisits: (m, o) => `Your proven visits (90 days): ${m}` + (o ? ` · most by anyone else: ${o.nickname} ${o.visits}` : ""),
    needVisits: n => `Whoever has the most proven visits (at least ${n} in 90 days) may sponsor it.`,
    become: "Become sponsor", showName: "Show my nickname on the snake's page", notifyFirst: `Tell me first (${SPONSOR_HEAD_START_MIN}-minute head start)`, confirm: "Confirm sponsorship", end: "End sponsorship", save: "Save",
    becameSponsor: "You're now the sponsor. Thank you!", headStart: (n, m) => `${n} has a ${m}-min head start (sponsor)`,
    inbox: "Notifications", noNotes: "No notifications yet.", noteFull: n => `${n} was reported ¾ full or more. As its sponsor you hear first.`, noteProblem: n => `${n} has a new problem report.`,
    noteSponsor: n => `You're now the sponsor of ${n}.`, simulate: "Demo: report my sponsored snake full",
    kit: "Gear", kitIntro: "The gear that makes rounds easier, and the shops that sell it. We're looking for partners: once a shop signs up, you unlock its discount as you collect. Nothing here is required.", shops: "Shops", wanted: "Partner wanted – no discount yet", collected: n => `You've collected ${n} cans and bottles`,
    ad: "Ad", unlock: (c, p) => p >= 100 ? `Free at ${c}` : `${p}% at ${c}`, showCode: "Show discount code", code: "Discount code", visit: "Go to shop", advertise: "Sell gear to collectors? Advertise here",
    profile: "Profile", nickname: "Nickname (shown on leaderboards)", home: "Home city", showLb: "Show me on the leaderboards", saved: "Saved", taken: "That nickname is taken.", short: "At least 2 characters.",
    numbers: "How we count", money: "Money", near: "Another collector is close", nearLong: "Another collector is close to this snake, so it's being handled. It's left out of your plan.",
  },
};

export const COMMUNITY_CSS = `
#col .cm-big{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
#col .cm-big div{background:var(--chip);border-radius:12px;padding:10px;min-width:0}
#col .cm-big b{display:block;font:700 22px var(--mono);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#col .cm-big span{font-size:12px;color:var(--muted)}
#col .cm-big .co2{background:color-mix(in srgb,var(--accent) 16%,var(--card))}
#col .cm-ms{list-style:none;margin:0;padding:0;display:grid;gap:6px}
#col .cm-ms li{display:grid;grid-template-columns:34px minmax(0,1fr) auto;gap:8px;align-items:center;border:1px solid var(--line);border-radius:12px;padding:8px 10px}
#col .cm-ms li.got{background:color-mix(in srgb,var(--accent) 10%,var(--card));border-color:color-mix(in srgb,var(--accent) 40%,var(--line))}
#col .cm-ms li.nx{border:2px solid var(--accent)}
#col .cm-ms .ic{font-size:24px;text-align:center}
#col .cm-ms small{display:block;color:var(--muted);font-size:12px}
#col .cm-bar{height:6px;border-radius:3px;background:var(--chip);overflow:hidden;margin-top:4px}
#col .cm-bar i{display:block;height:100%;background:var(--accent)}
#col .cm-rank{list-style:none;margin:0;padding:0;display:grid;gap:4px}
#col .cm-rank li{display:grid;grid-template-columns:34px minmax(0,1fr) auto;gap:10px;align-items:center;padding:8px 10px;border-radius:10px;border:1px solid var(--line)}
#col .cm-rank li.me{border:2px solid var(--accent);background:color-mix(in srgb,var(--accent) 10%,var(--card))}
#col .cm-rank .n{font:700 15px var(--mono);text-align:center}
#col .cm-rank li:nth-child(1) .n{color:#B8860B}#col .cm-rank li:nth-child(2) .n{color:#8A9099}#col .cm-rank li:nth-child(3) .n{color:#A0522D}
#col .cm-rank b{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#col .cm-rank small{color:var(--muted);font-size:12px}
#col .cm-rank .v{text-align:end;font:700 14px var(--mono)}
#col .cm-rank .v small{display:block;font:500 11px var(--font)}
#col .cm-gap{text-align:center;color:var(--muted);list-style:none}
#col .cm-tag{font:600 10.5px var(--mono);border:1px solid currentColor;border-radius:999px;padding:0 5px;color:var(--muted);margin-inline-start:4px}
#col .cm-offer{border:1px solid var(--line);border-radius:14px;padding:12px;display:grid;grid-template-columns:44px minmax(0,1fr);gap:4px 12px}
#col .cm-offer .ic{font-size:30px;grid-row:span 3;text-align:center}
#col .cm-offer h4{margin:0;font-size:16px}
#col .cm-offer .pt{font-size:12px;color:var(--muted);display:flex;gap:6px;align-items:center}
#col .cm-offer .ad{font:700 10px var(--mono);letter-spacing:.06em;text-transform:uppercase;background:var(--chip);border-radius:4px;padding:1px 5px;color:var(--ink)}
#col .cm-offer p{margin:0;font-size:14px}
#col .cm-shops{grid-column:2;display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:.8125rem;color:var(--muted);margin-top:4px}
#col .cm-shop{font-weight:700;color:var(--ink);background:var(--chip);border-radius:999px;padding:3px 10px}
#col .cm-tiers{grid-column:1 / -1;display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
#col .cm-tiers span{font:600 12.5px var(--mono);border-radius:999px;padding:4px 9px;border:1.5px dashed var(--line);color:var(--muted)}
#col .cm-tiers span.on{border-style:solid;border-color:var(--accent);color:var(--accent);background:color-mix(in srgb,var(--accent) 10%,var(--card))}
#col .cm-offer .cl-row{grid-column:1 / -1;margin-top:6px}
#col .cm-code{grid-column:1 / -1;font:700 18px var(--mono);letter-spacing:.06em;text-align:center;border:2px dashed var(--accent);border-radius:10px;padding:8px;color:var(--accent)}
#col .cm-sp{border:1.5px dashed var(--accent);border-radius:12px;padding:10px 12px;display:grid;gap:8px}
#col .cm-sp b{font-size:15px}
#col .cm-sp p{margin:0;font-size:13px;color:var(--muted)}
#col .cm-inbox{list-style:none;margin:0;padding:0;display:grid;gap:6px}
#col .cm-inbox li{border:1px solid var(--line);border-radius:10px;padding:8px 10px;font-size:14px;display:grid;gap:2px}
#col .cm-inbox li.new{border-color:var(--route);background:color-mix(in srgb,var(--route) 8%,var(--card))}
#col .cm-inbox time{font:12px var(--mono);color:var(--muted)}
#col .cl-bell{position:relative}
#col .cl-bell em{position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;border-radius:9px;background:var(--bad);color:#fff;font:700 11px/18px var(--mono);font-style:normal;padding:0 4px}
#col .cl-tabs{overflow-x:auto;scrollbar-width:none}
#col .cl-tabs::-webkit-scrollbar{display:none}
#col .cl-tabs button{white-space:nowrap}
@media (max-width:480px){#col .cl-tabs button{padding:7px 8px;font-size:14px}#col .cl-handle{padding-inline:6px}}
#col .cl-pin.near::after{content:"";position:absolute;inset:-9px;border-radius:50%;border:3px solid color-mix(in srgb,#2E9E62 55%,transparent);background:color-mix(in srgb,#2E9E62 14%,transparent);z-index:-1}
#col .cl-pin em.near{background:#2E9E62;right:auto;left:-6px;bottom:-6px;top:auto}
#col .cl-pin em.sp{background:#7A5AF8;right:-8px;bottom:-6px;top:auto}
`;

export function createCommunity(ctx) {
  const { el, S, modal, toast, byId } = ctx;
  const c = () => C[S.lang] || C.en;
  const nf = (n, d = 0) => Number(n).toLocaleString(S.lang === "da" ? "da-DK" : "en-GB", { maximumFractionDigits: d, minimumFractionDigits: d });
  let profile = null, totals = null, board = null, offers = null;
  const loadProfile = async () => profile ||= await myProfile();

  // ---------- Impact ----------
  async function paneImpact(p) {
    const box = el("div", { style: "display:grid;gap:10px" }); p.append(box);
    await loadProfile(); totals = await myTotals().catch(() => ({ containers: 0, visits: 0, verified: 0 }));
    let saved = 0; try { saved = JSON.parse(localStorage.getItem("collector-saved-min") || "0"); } catch {}
    const cur = currencyOf(profile?.country), im = impactOf(totals.containers, saved, cur), money = v => `${nf(v)} ${cur}`;
    box.append(el("h3", { style: "margin:6px 0 0;font-size:15px" }, c().lifetime),
      el("div", { class: "cm-big" },
        el("div", {}, el("b", {}, nf(totals.containers)), el("span", {}, c().containers)),
        el("div", { class: "co2" }, el("b", {}, nf(im.co2, im.co2 < 100 ? 1 : 0)), el("span", {}, c().co2)),
        el("div", {}, el("b", {}, nf(im.money)), el("span", {}, `${cur} · ${c().value}`))),
      el("p", { class: "cl-note" }, `${nf(totals.visits)} ${c().visits} · ${nf(totals.verified)} ${c().proven}`),
      el("p", { class: "cl-note" }, c().breakdown(nf(im.deposit), nf(im.cleanup), nf(im.time), cur)));
    const ms = milestones(profile?.city, S.lang), got = ms.filter(m => im.co2 >= m.kg), next = ms.find(m => im.co2 < m.kg);
    const ul = el("ul", { class: "cm-ms" });
    for (const m of ms) {
      const reached = im.co2 >= m.kg, isNext = m === next;
      if (!reached && !isNext && ms.indexOf(m) > ms.indexOf(next) + 1) continue;     // show reached ones, the next, and one after
      ul.append(el("li", { class: reached ? "got" : isNext ? "nx" : "" }, el("span", { class: "ic", "aria-hidden": "true" }, m.icon),
        el("span", {}, m.text, el("small", {}, `${nf(m.kg)} kg CO₂`), isNext ? el("div", { class: "cm-bar" }, el("i", { style: `width:${Math.min(100, im.co2 / m.kg * 100)}%` })) : ""),
        el("span", { class: "cl-pill" }, reached ? "✓ " + c().reached : isNext ? c().toGo(nf(m.kg - im.co2, 1)) : "")));
    }
    box.append(el("h3", { style: "margin:6px 0 0;font-size:15px" }, `${c().milestones} · ${got.length}/${ms.length}`), ul);
    try {
      const tot = await communityTotal("city"), kg = tot * IMPACT.co2PerContainerKg, cm = ms.filter(m => kg >= m.kg).at(-1);
      if (cm) box.append(el("p", { class: "cl-note", style: "font-weight:600;color:var(--ink)" }, c().together(profile.city, nf(kg), cm.icon + " " + cm.text.toLowerCase())));
    } catch {}
    box.append(el("p", { class: "cl-note" }, c().estimate));
  }

  // ---------- Ranking ----------
  async function paneRanking(p) {
    await loadProfile();
    S.rankScope ||= "city"; S.rankDays ||= "all";
    const city = profile?.city || "Aarhus";
    p.append(el("div", { class: "cl-opts" },
      ctx.seg([["city", city], ["country", FLAG(profile?.country) + " " + (COUNTRY[profile?.country]?.split(" / ").at(-1) || c().scope.country)], ["continent", "🇪🇺 " + c().scope.continent]], S.rankScope, v => { S.rankScope = v; ctx.renderSheet(); }),
      ctx.seg([["30", c().period[30]], ["all", c().period.all]], S.rankDays, v => { S.rankDays = v; ctx.renderSheet(); })));
    const ul = el("ol", { class: "cm-rank" }); p.append(ul, el("p", { class: "cl-note" }, c().rankHint));
    if (profile && profile.show_on_leaderboard === false) p.append(el("p", { class: "cl-note" }, c().hidden));
    try { board = await leaderboard({ scope: S.rankScope, days: S.rankDays === "30" ? 30 : null }); } catch (e) { ul.append(el("li", {}, String(e.message || e))); return; }
    const meIdx = board.findIndex(r => r.me), show = board.slice(0, 10);
    const row = r => el("li", { class: r.me ? "me" : "" }, el("span", { class: "n" }, r.rank),
      el("span", { style: "min-width:0" }, el("b", {}, r.nickname, r.me ? el("span", { class: "cm-tag" }, c().you) : "", r.example ? el("span", { class: "cm-tag" }, c().example) : ""), el("small", {}, `${FLAG(r.country)} ${r.city}`)),
      el("span", { class: "v" }, nf(r.containers), el("small", {}, `${nf(r.containers * IMPACT.co2PerContainerKg)} kg CO₂`)));
    show.forEach(r => ul.append(row(r)));
    if (meIdx >= 10) { ul.append(el("li", { class: "cm-gap" }, "⋯")); ul.append(row(board[meIdx])); }
  }

  // ---------- Toolkit (partner ads) ----------
  async function paneToolkit(p) {
    totals ||= await myTotals().catch(() => ({ containers: 0 }));
    offers ||= await listOffers().catch(() => []);
    const have = totals.containers;
    p.append(el("p", { class: "cl-note", style: "color:var(--ink)" }, c().kitIntro), el("div", { class: "cl-pill", style: "justify-self:start" }, "♻ " + c().collected(nf(have))));
    for (const o of offers) {
      logOfferEvent(o.id, "view");
      const unlocked = o.tiers.filter(([n]) => have >= n), best = unlocked.at(-1), next = o.tiers.find(([n]) => have < n);
      if (o.status === "wanted") {      // no deal yet: show the gear and the likely shops, never a discount or a code
        p.append(el("article", { class: "cm-offer" }, el("span", { class: "ic", "aria-hidden": "true" }, o.icon || "🧰"),
          el("h4", {}, o.title), el("p", {}, o.body),
          el("div", { class: "cm-shops" }, el("span", {}, c().shops + ":"), ...(o.shops || []).map(n => el("span", { class: "cm-shop" }, n))),
          el("div", { class: "cm-tiers" }, el("span", {}, c().wanted))));
        continue;
      }
      const card = el("article", { class: "cm-offer" }, el("span", { class: "ic", "aria-hidden": "true" }, o.icon || "🧰"),
        el("h4", {}, o.title), el("div", { class: "pt" }, el("span", { class: "ad" }, c().ad), o.partner), el("p", {}, o.body),
        el("div", { class: "cm-tiers" }, ...o.tiers.map(([n, pct]) => el("span", { class: have >= n ? "on" : "" }, (have >= n ? "✓ " : "🔒 ") + c().unlock(nf(n), pct)))),
        next ? el("div", { style: "grid-column:1 / -1" }, el("div", { class: "cm-bar" }, el("i", { style: `width:${Math.min(100, have / next[0] * 100)}%` }))) : "");
      const row = el("div", { class: "cl-row" });
      if (best) row.append(el("button", { class: "cl-btn primary small", onclick: async ev => {
        try { const code = await unlockCode(o.id, best[0]); ev.target.replaceWith(el("div", { class: "cm-code", "aria-label": c().code }, code)); } catch (e) { toast(String(e.message || e)); } } }, `${c().showCode}` + (best[1] >= 100 ? "" : ` · ${best[1]}%`)));
      if (o.url) row.append(el("a", { class: "cl-btn small", href: o.url, target: "_blank", rel: "noopener", style: "text-decoration:none", onclick: () => logOfferEvent(o.id, "click") }, c().visit + " ↗"));
      if (row.children.length) card.append(row);
      p.append(card);
    }
    const mail = (window.SNAKE_CONFIG || {}).ADVERTISE_EMAIL;
    p.append(mail ? el("a", { class: "cl-note", href: `mailto:${mail}?subject=Pant%20Snake%20toolkit`, style: "color:var(--muted)" }, c().advertise) : el("p", { class: "cl-note" }, c().advertise));
  }

  // ---------- sponsorship block in the snake dialog ----------
  async function sponsorBlock(snakeId, host) {
    const box = el("div", { class: "cm-sp" }, el("p", {}, "…")); host.append(box);
    let info; try { info = await sponsorInfo(snakeId); } catch (e) { box.replaceChildren(el("p", {}, String(e.message || e))); return; }
    const s = byId(snakeId), parts = [];
    if (info.sponsor?.mine) parts.push(el("b", {}, "🌱 " + c().youSponsor));
    else if (info.sponsor) parts.push(el("b", {}, "🌱 " + c().sponsoredBy(info.sponsor.show_name ? info.sponsor.nickname : "—")));
    else parts.push(el("b", {}, c().sponsor + ": " + c().noSponsor));
    parts.push(el("p", {}, c().yourVisits(info.my_visits, info.top_other)));
    if (s?.sponsor_turn_until && !s.i_sponsor) parts.push(el("p", { style: "color:#7A5AF8;font-weight:600" }, c().headStart(s.sponsor_nick || c().sponsor, Math.max(1, Math.round((new Date(s.sponsor_turn_until) - Date.now()) / 6e4)))));
    if (info.eligible) parts.push(el("button", { class: "cl-btn primary", onclick: () => sponsorDialog(snakeId, info) }, "🌱 " + c().become));
    else if (info.sponsor?.mine) parts.push(el("button", { class: "cl-btn small", onclick: () => sponsorDialog(snakeId, info) }, c().sponsor + " ⚙"));
    else parts.push(el("p", {}, c().needVisits(info.min_visits || SPONSOR_MIN_VISITS)));
    box.replaceChildren(...parts);
  }
  function sponsorDialog(snakeId, info) {
    const s = byId(snakeId);
    modal((d, close) => {
      const show = el("input", { type: "checkbox", id: "cm-show" }), first = el("input", { type: "checkbox", id: "cm-first" });
      show.checked = info.sponsor?.mine ? info.sponsor.show_name : true; first.checked = info.sponsor?.mine ? info.sponsor.notify_first : true;
      d.append(el("h2", {}, "🌱 " + (s?.design_name || snakeId)), el("p", { class: "cl-note", style: "color:var(--ink);font-size:14.5px" }, c().notOwnership),
        el("label", { class: "cl-check", for: "cm-show" }, show, c().showName), el("label", { class: "cl-check", for: "cm-first" }, first, c().notifyFirst),
        el("div", { class: "cl-row" },
          el("button", { class: "cl-btn primary", onclick: async () => { try { await becomeSponsor(snakeId, { show_name: show.checked, notify_first: first.checked }); close(); toast(info.sponsor?.mine ? c().saved : c().becameSponsor); ctx.refresh(); refreshBell(); } catch (e) { toast(String(e.message || e)); } } }, info.sponsor?.mine ? c().save : c().confirm),
          info.sponsor?.mine ? el("button", { class: "cl-btn ghost", onclick: async () => { await endSponsorship(snakeId); close(); ctx.refresh(); } }, c().end) : el("button", { class: "cl-btn ghost", onclick: close }, "×")));
    });
  }

  // ---------- notifications ----------
  let bellEl = null;
  function bell() {
    bellEl = el("button", { class: "cl-icon cl-bell", "aria-label": c().inbox, title: c().inbox, onclick: openInbox, html: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>` });
    refreshBell(); return bellEl;
  }
  async function refreshBell() {
    if (!bellEl) return; const n = (await myNotifications().catch(() => [])).filter(x => !x.read_at).length;
    bellEl.querySelector("em")?.remove(); if (n) bellEl.append(el("em", {}, n));
  }
  async function openInbox() {
    const list = await myNotifications().catch(() => []);
    modal((d, close) => {
      d.append(el("h2", {}, c().inbox));
      if (!list.length) d.append(el("p", { class: "cl-empty" }, c().noNotes));
      const ul = el("ul", { class: "cm-inbox" });
      for (const n of list) {
        const name = byId(n.snake_id)?.design_name || n.snake_id;
        const txt = n.kind === "full" ? c().noteFull(name) : n.kind === "problem" ? c().noteProblem(name) : c().noteSponsor(name);
        ul.append(el("li", { class: n.read_at ? "" : "new" }, el("time", {}, new Date(n.created_at).toLocaleString(S.lang === "da" ? "da-DK" : "en-GB", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })),
          el("button", { class: "cl-btn ghost small", style: "text-align:start;white-space:normal;border:0;padding:0;min-height:0", onclick: () => { close(); ctx.focusSnake(n.snake_id); ctx.openSnake(n.snake_id); } }, txt)));
      }
      d.append(ul);
      if (!LIVE && Object.keys(S.snakes).length && S.snakes.some(s => s.i_sponsor)) d.append(el("button", { class: "cl-btn small", onclick: async () => { simulateSponsorReport(); close(); await ctx.refresh(); refreshBell(); openInbox(); } }, c().simulate));
      d.append(el("button", { class: "cl-btn primary", onclick: close }, "OK"));
    }, () => { markNotificationsRead().then(refreshBell); });
  }

  // ---------- profile (in settings) ----------
  function profileSection() {
    const wrap = el("div", { class: "cl-set", style: "border-top:1px solid var(--line);padding-top:12px" }, el("b", {}, c().profile));
    loadProfile().then(pr => {
      const nick = el("input", { type: "text", id: "cm-nick", maxlength: 24, value: pr?.nickname || "", style: "font:16px var(--font);border:1.5px solid var(--line);border-radius:10px;padding:10px;background:var(--bg);color:var(--ink);width:100%" });
      const city = el("select", { id: "cm-city" }, ...CITIES.map(x => el("option", { value: x.name, selected: x.name === (pr?.city || "Aarhus") }, `${FLAG(x.country)} ${x.name}`)));
      const lb = el("input", { type: "checkbox", id: "cm-lb" }); lb.checked = pr?.show_on_leaderboard !== false;
      const msg = el("p", { class: "cl-note", role: "status" });
      wrap.append(el("label", { class: "l", for: "cm-nick" }, c().nickname, nick), el("label", { class: "l", for: "cm-city" }, c().home, city),
        el("label", { class: "cl-check", for: "cm-lb" }, lb, c().showLb), msg,
        el("button", { class: "cl-btn small", onclick: async () => {
          const ci = CITIES.find(x => x.name === city.value);
          try { await saveProfile({ nickname: nick.value, city: ci.name, country: ci.country, show_on_leaderboard: lb.checked }); profile = null; await loadProfile(); msg.textContent = c().saved; ctx.renderSheet(); }
          catch (e) { msg.textContent = e.message === "nickname_taken" ? c().taken : e.message === "nickname_short" ? c().short : String(e.message || e); } } }, c().save));
    });
    return wrap;
  }

  return { paneImpact, paneRanking, paneToolkit, sponsorBlock, bell, refreshBell, profileSection, text: c, reset: () => { totals = null; board = null; } };
}
