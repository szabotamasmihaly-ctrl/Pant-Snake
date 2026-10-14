// Collector app: map of every snake with its fill level, a planned collection route from where you stand,
// and a check-in at each snake ("all OK?" + "collected?") that updates the database.
// mountCollector(rootElement) builds the whole app inside rootElement (used by collector.html and the demo).
import { LIVE, SNAKES, designById, collectorSession, signIn, signUp, signOut, collectorMap, claimSnakes, releaseClaims, recordVisit, myVisits, clearCollectorDemo, seedCollectorDemo } from "./data.js";
import { MapView, MAPVIEW_CSS, loadDemoStreets } from "./mapview.js";
import { planRoute, routeCandidates, expectedCans, haversine, predictFill, TRANSPORT } from "./route.js";
import { createRouter, stepText, ARROW } from "./routing.js";
import { createCommunity, COMMUNITY_CSS } from "./community.js";
import { reportNearby } from "./data.js";

const CFG = window.SNAKE_CONFIG || {};
const CAN_VALUE = 1.1;                 // DKK per container on average (pant A = 1 kr, B = 1.50 kr)
const LEVEL_COL = ["#8C969C", "#7FB77E", "#3E9B5F", "#E3A21A", "#D2452F"];
const PROBLEMS = ["jam", "door", "locked", "damage", "glass", "litter", "graffiti", "blocked", "other"];

const TXT = {
  da: {
    app: "Indsamler", startShift: "Start vagt", endShift: "Afslut vagt", onShift: "På vagt",
    tabRoute: "Rute", tabSnakes: "Slanger", tabToday: "Indsats", tabRank: "Rangliste", tabKit: "Udstyr",
    otherNear: "En anden indsamler er tæt på – den bliver taget", avoided: n => `${n} slange${n === 1 ? "" : "r"} er overladt til andre: en indsamler er allerede tæt på, eller sponsoren har forspring.`, sponsorTurn: m => `Sponsorens forspring: ${m} min.`,
    plan: "Planlæg rute", replan: "Planlæg igen", startRoute: "Start ruten", routeActive: "Ruten er i gang",
    stops: n => `${n} stop`, km: "km", min: "min", cans: "dåser", dkk: "kr",
    next: "Næste", directions: "Rutevejledning", here: "Jeg er her", skip: "Spring over", add: "Tilføj til ruten", remove: "Fjern fra ruten",
    noRoute: "Ingen slanger er fulde nok lige nu med dine indstillinger. Sænk minimumsniveauet eller giv dig mere tid.",
    leftOut: n => `${n} fulde slanger kom ikke med (taske eller tid). Ret i indstillingerne for at få dem med.`,
    by: { walk: "til fods", bike: "på cykel", cargo: "på ladcykel" },
    minFill: "Mindst", timeBudget: "Tid", transport: "Transport", bag: "Taske, dåser",
    levels: ["Tom", "¼", "½", "¾", "Fuld"], levelWords: ["tom", "¼ fuld", "halvt fuld", "¾ fuld", "helt fuld"],
    predicted: "beregnet", reported: "meldt", unknown: "ingen melding", ago: (m) => m < 1 ? "lige nu" : m < 60 ? `for ${m} min. siden` : m < 2880 ? `for ${Math.round(m / 60)} t. siden` : `for ${Math.round(m / 1440)} dage siden`,
    src: { public: "af en forbipasserende", collector: "af en indsamler", operator: "af driften" },
    emptied: "tømt", claimedOther: "En anden indsamler er på vej", claimedMe: "Reserveret til dig",
    problems: { jam: "Noget sidder fast", door: "Lugen virker ikke", locked: "Låst / kan ikke åbnes", damage: "Ødelagt eller løs", glass: "Knust glas", litter: "Affald omkring", graffiti: "Graffiti / beskidt", blocked: "Kan ikke komme til", other: "Andet" },
    arrive: "Du er ved", away: m => `${m} m væk`, q1: "Er alt i orden med den?", ok: "Alt i orden", notOk: "Noget er galt", okBig: "OK – alt i orden og tømt", changeIfNot: "Er noget anderledes? Ret her:",
    which: "Hvad er galt?", note: "Kort besked (valgfri)", photo: "Tag foto", photoAgain: "Skift foto",
    q2: "Har du tømt den?", oEmptied: "Ja, tømt", oPartial: "Tog noget", oWasEmpty: "Den var tom", oNot: "Kunne ikke tømme",
    howFullNow: "Hvor fuld er den nu?", cansTaken: "Dåser taget (valgfrit)", save: "Gem", notNow: "Ikke nu",
    farWarn: m => `Din position er ${m} m fra slangen. Gem alligevel?`, saved: (c) => `Gemt${c ? ` · ${c} dåser` : ""}`, savedOffline: n => `Gemt på telefonen. Sendes når du har net (${n} venter)`,
    dupe: "Du har lige gemt denne slange.", error: "Kunne ikke gemme. Prøv igen.",
    todayVisits: "Besøg", todayCans: "Dåser", todayValue: "≈ værdi", todayKm: "Gået", week: "Seneste 7 dage", none: "Ingen besøg endnu i dag.",
    outcome: { emptied: "Tømt", partial: "Delvist tømt", was_empty: "Var tom", not_emptied: "Ikke tømt" },
    settings: "Indstillinger", language: "Sprog", arriveRadius: "Vis tjek-ind når jeg er inden for", endPoint: "Slutpunkt",
    endNone: "Intet slutpunkt", endSet: "Vælg på kortet", endPick: "Tryk på kortet for at sætte slutpunktet (fx en pantautomat).", endClear: "Fjern",
    claimToggle: "Reservér slangerne på min rute, så andre indsamlere ser at jeg er på vej", wake: "Hold skærmen tændt på vagt", darkMap: "Mørkt kort",
    done: "Færdig", resetDemo: "Nulstil demo-data", gpsOff: "Placering er slået fra. Tryk på kortet for at vise hvor du er.",
    gpsWait: "Finder din placering…", gpsSim: "Demo: GPS er simuleret. Tryk på kortet for at flytte dig, eller lad demoen gå ruten.", walk: "Gå ruten", stopWalk: "Stop",
    newFull: (n, d) => `${n} er meldt fuld · ${d} væk`, addIt: "Tilføj", locate: "Vis min position", zoomIn: "Zoom ind", zoomOut: "Zoom ud",
    all: "Alle", fullish: "¾ +", withProblems: "Problemer", sortDist: "nærmest først",
    signupTitle: "Bliv indsamler", signupText: "Gratis. Du vælger selv et kaldenavn bagefter; vi viser aldrig din e-mail eller hvor du er.", signup: "Opret konto", toSignup: "Ny her? Opret en indsamlerkonto", toLogin: "Har du en konto? Log ind",
    checkMail: "Tjek din e-mail og bekræft adressen. Log så ind her.", welcome: "Velkommen!", welcomeText: "Vælg et kaldenavn og din hjemby. Kaldenavnet vises på ranglisterne (kan slås fra).",
    loginTitle: "Log ind som indsamler", email: "E-mail", password: "Adgangskode", login: "Log ind", logout: "Log ud", loginErr: "Login mislykkedes.",
    notStaff: "Dette login er ikke sat op som indsamler endnu. Bed driften om at tilføje dig.",
    endPointName: "Slutpunkt", you: "Dig", openProblems: n => `${n} åbne problem${n === 1 ? "" : "er"}`, lastEmptied: "Sidst tømt", never: "aldrig",
    demoMap: "Demokort: kun hovedgader", planning: "Planlægger ad gaderne…", rerouting: "Finder ny rute…", via: n => `Tider og afstande ad gaderne · ${n}`, inM: d => `om ${d}`, toSnake: "til slangen", then: "Derefter",
    srcName: { ors: "openrouteservice", osrm: "OSRM", graph: "indbygget gadenet (hovedgader)", straight: "luftlinje: ingen gade-router svarede" },
    mapFallback: "Kortet kunne ikke hentes. Viser det indbyggede kort over Aarhus.", noWebgl: "Kortet kræver WebGL, som er slået fra i denne browser.", gmaps: "Google Maps",
    emptyHint: "Tryk på en slange for detaljer.", value: v => `≈ ${Math.round(v)} kr`, level: "Niveau", checkIn: "Tjek ind", legendNum: "tal = ≈ dåser", legendHint: "Stiplet ring: ingen ny melding, niveauet er beregnet ud fra hvor hurtigt slangen plejer at fyldes",
  },
  en: {
    app: "Collector", startShift: "Start shift", endShift: "End shift", onShift: "On shift",
    tabRoute: "Route", tabSnakes: "Snakes", tabToday: "Impact", tabRank: "Ranking", tabKit: "Toolkit",
    otherNear: "Another collector is close: it's being handled", avoided: n => `${n} snake${n === 1 ? " is" : "s are"} left to others: a collector is already close, or its sponsor has a head start.`, sponsorTurn: m => `Sponsor's head start: ${m} min`,
    plan: "Plan route", replan: "Re-plan", startRoute: "Start route", routeActive: "Route in progress",
    stops: n => `${n} stop${n === 1 ? "" : "s"}`, km: "km", min: "min", cans: "cans", dkk: "DKK",
    next: "Next", directions: "Directions", here: "I'm here", skip: "Skip", add: "Add to route", remove: "Remove from route",
    noRoute: "No snake is full enough right now with your settings. Lower the minimum level or give yourself more time.",
    leftOut: n => `${n} full snake${n === 1 ? "" : "s"} didn't fit (bag or time). Change the settings to include them.`,
    by: { walk: "on foot", bike: "by bike", cargo: "by cargo bike" },
    minFill: "At least", timeBudget: "Time", transport: "Transport", bag: "Bag, cans",
    levels: ["Empty", "¼", "½", "¾", "Full"], levelWords: ["empty", "¼ full", "half full", "¾ full", "full"],
    predicted: "estimated", reported: "reported", unknown: "no report", ago: (m) => m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 2880 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`,
    src: { public: "by a passer-by", collector: "by a collector", operator: "by the operator" },
    emptied: "emptied", claimedOther: "Another collector is on the way", claimedMe: "Reserved for you",
    problems: { jam: "Something stuck", door: "Trapdoor not working", locked: "Locked / won't open", damage: "Broken or loose", glass: "Broken glass", litter: "Litter around it", graffiti: "Graffiti / dirty", blocked: "Can't get to it", other: "Other" },
    arrive: "You're at", away: m => `${m} m away`, q1: "Is everything all right with it?", ok: "All OK", notOk: "Something's wrong", okBig: "OK – all good, emptied", changeIfNot: "Something different? Change it here:",
    which: "What's wrong?", note: "Short note (optional)", photo: "Take photo", photoAgain: "Change photo",
    q2: "Did you collect it?", oEmptied: "Yes, emptied", oPartial: "Took some", oWasEmpty: "It was empty", oNot: "Couldn't empty it",
    howFullNow: "How full is it now?", cansTaken: "Cans taken (optional)", save: "Save", notNow: "Not now",
    farWarn: m => `Your position is ${m} m from this snake. Save anyway?`, saved: (c) => `Saved${c ? ` · ${c} cans` : ""}`, savedOffline: n => `Saved on this phone. Will send when you're online (${n} waiting)`,
    dupe: "You just saved this snake.", error: "Couldn't save. Try again.",
    todayVisits: "Visits", todayCans: "Cans", todayValue: "≈ value", todayKm: "Walked", week: "Last 7 days", none: "No visits yet today.",
    outcome: { emptied: "Emptied", partial: "Partly emptied", was_empty: "Was empty", not_emptied: "Not emptied" },
    settings: "Settings", language: "Language", arriveRadius: "Show the check-in when I'm within", endPoint: "End point",
    endNone: "No end point", endSet: "Pick on map", endPick: "Tap the map to set where the route should end (a deposit machine, say).", endClear: "Remove",
    claimToggle: "Reserve the snakes on my route so other collectors see I'm on my way", wake: "Keep the screen on during a shift", darkMap: "Dark map",
    done: "Done", resetDemo: "Reset demo data", gpsOff: "Location is off. Tap the map to show where you are.",
    gpsWait: "Finding your location…", gpsSim: "Demo: GPS is simulated. Tap the map to move, or let the demo walk the route.", walk: "Walk the route", stopWalk: "Stop",
    newFull: (n, d) => `${n} was reported full · ${d} away`, addIt: "Add", locate: "Show my position", zoomIn: "Zoom in", zoomOut: "Zoom out",
    all: "All", fullish: "¾ +", withProblems: "Problems", sortDist: "nearest first",
    signupTitle: "Become a collector", signupText: "Free. You pick a nickname next; we never show your email or where you are.", signup: "Create account", toSignup: "New here? Create a collector account", toLogin: "Have an account? Sign in",
    checkMail: "Check your email and confirm the address, then sign in here.", welcome: "Welcome!", welcomeText: "Pick a nickname and your home city. The nickname shows on the leaderboards (you can turn that off).",
    loginTitle: "Collector sign-in", email: "Email", password: "Password", login: "Sign in", logout: "Sign out", loginErr: "Sign-in failed.",
    notStaff: "This login isn't set up as a collector yet. Ask the operator to add you.",
    endPointName: "End point", you: "You", openProblems: n => `${n} open problem${n === 1 ? "" : "s"}`, lastEmptied: "Last emptied", never: "never",
    demoMap: "Demo map: main streets only", planning: "Planning along the streets…", rerouting: "Finding a new route…", via: n => `Times and distances along the streets · ${n}`, inM: d => `in ${d}`, toSnake: "to the snake", then: "Then",
    srcName: { ors: "openrouteservice", osrm: "OSRM", graph: "built-in street network (main streets)", straight: "straight lines: no street router answered" },
    mapFallback: "Couldn't load the map. Showing the built-in map of Aarhus.", noWebgl: "The map needs WebGL, which is turned off in this browser.", gmaps: "Google Maps",
    emptyHint: "Tap a snake for details.", value: v => `≈ DKK ${Math.round(v)}`, level: "Level", checkIn: "Check in", legendNum: "number = ≈ cans", legendHint: "Dashed ring: no recent report, level estimated from how fast this snake usually fills",
  },
};

const CSS = `
#col{--bg:#F4F2EC;--card:#FFFFFF;--ink:#15201B;--muted:#5B665F;--line:#DAD6CC;--accent:#0F5D3A;--accent-ink:#FFFFFF;--route:#1D4ED8;--warn:#B45309;--bad:#C2410C;--chip:#EEEBE3;--shadow:0 10px 30px rgba(20,30,25,.18);
  --font:"Familjen Grotesk",system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;--mono:"JetBrains Mono",ui-monospace,Menlo,monospace}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]) #col{--bg:#0F1412;--card:#18201C;--ink:#E7EEE9;--muted:#9AA8A0;--line:#2A3530;--accent:#45C28A;--accent-ink:#0B1F15;--route:#6EA0FF;--chip:#222C27;--shadow:0 10px 30px rgba(0,0,0,.5);color-scheme:dark}}
:root[data-theme="dark"] #col{--bg:#0F1412;--card:#18201C;--ink:#E7EEE9;--muted:#9AA8A0;--line:#2A3530;--accent:#45C28A;--accent-ink:#0B1F15;--route:#6EA0FF;--chip:#222C27;--shadow:0 10px 30px rgba(0,0,0,.5);color-scheme:dark}
#col{position:fixed;inset:0;background:var(--bg);color:var(--ink);font-family:var(--font);font-size:15px;line-height:1.4;z-index:5}
#col *{box-sizing:border-box}
#col button{font:inherit;color:inherit;cursor:pointer}
#col button:focus-visible,#col input:focus-visible,#col select:focus-visible{outline:3px solid var(--route);outline-offset:2px}
#col [hidden]{display:none!important}
#col .cl-app{position:absolute;inset:0;display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:auto auto minmax(0,1fr) auto;padding-top:env(safe-area-inset-top,0px)}
#col .cl-top{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--line);background:var(--card);min-width:0}
#col .cl-brand{display:flex;align-items:center;gap:8px;font-weight:700;white-space:nowrap;min-width:0}
#col .cl-brand i{width:26px;height:26px;border-radius:50%;background:conic-gradient(var(--accent) 0 75%,var(--line) 0);display:grid;place-items:center;flex:none}
#col .cl-brand i::after{content:"";width:14px;height:14px;border-radius:50%;background:var(--card)}
#col .cl-brand span{font-weight:500;color:var(--muted)}
#col .cl-sp{flex:1}
#col .cl-btn{border:1px solid var(--line);background:var(--card);border-radius:10px;padding:8px 12px;min-height:40px;font-weight:600;white-space:nowrap}
#col a.cl-btn{color:var(--ink)}
#col .cl-btn.primary{background:var(--accent);border-color:var(--accent);color:var(--accent-ink)}
#col .cl-btn.cl-ok{width:100%;min-height:88px;font-size:26px;border-radius:18px;margin:10px 0 4px}
#col .cl-btn.ghost{background:transparent}
#col .cl-btn.small{min-height:34px;padding:5px 10px;font-size:13.5px}
#col .cl-btn:disabled{opacity:.45;cursor:not-allowed}
#col .cl-icon{width:40px;height:40px;padding:0;display:grid;place-items:center;border-radius:10px;border:1px solid var(--line);background:var(--card)}
#col .cl-shift{display:flex;align-items:center;gap:6px;font:600 13px var(--mono);white-space:nowrap}
#col .cl-shift .dot{width:9px;height:9px;border-radius:50%;background:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 30%,transparent)}
#col .cl-banner{padding:7px 12px;font-size:13px;background:color-mix(in srgb,var(--route) 12%,var(--card));border-bottom:1px solid var(--line);display:flex;gap:10px;align-items:center;flex-wrap:wrap}
#col .cl-banner b{font-weight:600}
#col .cl-mapwrap{position:relative;min-height:0}
#col .cl-map{position:absolute;inset:0}
#col .cl-fabs{position:absolute;right:10px;top:10px;display:grid;gap:8px;z-index:3}
#col .cl-fabs button{width:44px;height:44px;border-radius:12px;border:1px solid var(--line);background:var(--card);box-shadow:0 2px 8px rgba(0,0,0,.12);display:grid;place-items:center}
#col .cl-legend{position:absolute;left:10px;top:10px;right:66px;width:max-content;max-width:calc(100% - 76px);flex-wrap:wrap;z-index:3;display:flex;gap:4px;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:5px 7px;font:600 11px var(--mono);align-items:center}
#col .cl-legend i{width:12px;height:12px;border-radius:50%;display:inline-block}
#col .cl-legend span{display:inline-flex;gap:3px;align-items:center;margin-right:4px}
#col .cl-sheet{background:var(--card);border-top:1px solid var(--line);display:flex;flex-direction:column;max-height:46vh;min-height:0;padding-bottom:env(safe-area-inset-bottom,0px)}
#col .cl-sheet.collapsed{max-height:none}
#col .cl-sheet.collapsed .cl-pane{display:none}
#col .cl-handle{display:flex;align-items:center;gap:6px;padding:6px 10px 0}
#col .cl-tabs{display:flex;gap:4px;flex:1}
#col .cl-tabs button{border:0;background:transparent;padding:8px 12px;border-radius:9px;font-weight:600;color:var(--muted)}
#col .cl-tabs button[aria-selected="true"]{background:var(--chip);color:var(--ink)}
#col .cl-pane{overflow-y:auto;padding:10px 12px 14px;display:grid;gap:10px;align-content:start;min-height:0}
#col .cl-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
#col .cl-summary div{background:var(--chip);border-radius:10px;padding:7px 8px;min-width:0}
#col .cl-summary b{display:block;font:700 18px var(--mono);font-variant-numeric:tabular-nums;white-space:nowrap}
#col .cl-summary span{font-size:11.5px;color:var(--muted)}
#col .cl-opts{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
#col .cl-opts label{font-size:12px;color:var(--muted);margin-right:2px}
#col .cl-seg{display:inline-flex;border:1px solid var(--line);border-radius:9px;overflow:hidden}
#col .cl-seg button{border:0;background:var(--card);padding:6px 9px;font-size:13px;font-weight:600;min-height:34px}
#col .cl-seg button[aria-pressed="true"]{background:var(--ink);color:var(--bg)}
#col .cl-row{display:flex;gap:8px;flex-wrap:wrap}
#col .cl-row > .cl-btn{flex:1 1 auto}
#col .cl-next{border:2px solid var(--route);border-radius:14px;padding:10px 12px;display:grid;gap:8px;background:color-mix(in srgb,var(--route) 6%,var(--card))}
#col .cl-next .eyebrow{font:600 11px var(--mono);text-transform:uppercase;letter-spacing:.08em;color:var(--route)}
#col .cl-next h3{margin:0;font-size:19px;line-height:1.15}
#col .cl-meta{font-size:13px;color:var(--muted);display:flex;gap:6px 12px;flex-wrap:wrap}
#col .cl-list{list-style:none;margin:0;padding:0;display:grid;gap:6px}
#col .cl-item{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center;border:1px solid var(--line);border-radius:12px;padding:8px 10px;background:var(--card);text-align:left;width:100%}
#col .cl-item.done{opacity:.55}
#col .cl-item .n{width:28px;height:28px;border-radius:50%;background:var(--route);color:#fff;display:grid;place-items:center;font:700 13px var(--mono)}
#col .cl-item.done .n{background:var(--muted)}
#col .cl-item b{display:block;font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#col .cl-item small{color:var(--muted);font-size:12.5px}
#col .cl-pill{display:inline-flex;align-items:center;gap:5px;border-radius:999px;padding:2px 8px;font:600 12px var(--mono);white-space:nowrap;border:1px solid var(--line);background:var(--card)}
#col .cl-pill i{width:9px;height:9px;border-radius:50%}
#col .cl-pill.bad{color:var(--bad);border-color:currentColor}
#col .cl-note{font-size:13px;color:var(--muted);margin:0}
#col .cl-empty{color:var(--muted);text-align:center;padding:16px 6px;margin:0}
#col .cl-pin{width:40px;height:40px;margin:-20px 0 0 -20px;border-radius:50%;border:0;padding:0;background:conic-gradient(var(--c) calc(var(--f)*1%),rgba(140,150,156,.35) 0);display:grid;place-items:center;box-shadow:0 2px 6px rgba(0,0,0,.35);position:absolute}
#col .cl-pin::before{content:"";position:absolute;inset:6px;border-radius:50%;background:var(--card)}
#col .cl-pin span{position:relative;font:700 12px var(--mono);color:var(--ink)}
#col .cl-pin.route{outline:3px solid var(--route);outline-offset:1px}
#col .cl-pin.stale{background:conic-gradient(var(--c) calc(var(--f)*1%),rgba(140,150,156,.35) 0) border-box}
#col .cl-pin.stale::after{content:"";position:absolute;inset:-3px;border-radius:50%;border:2px dashed var(--muted)}
#col .cl-pin.other{opacity:.45}
#col .cl-pin.done{filter:grayscale(1);opacity:.6}
#col .cl-pin em{position:absolute;right:-6px;top:-6px;min-width:18px;height:18px;border-radius:9px;background:var(--route);color:#fff;font:700 11px/18px var(--mono);font-style:normal;padding:0 4px;z-index:1}
#col .cl-pin em.warn{background:var(--bad);right:auto;left:-6px}
#col .cl-pin.focus{transform:scale(1.15)}
#col .cl-modal{position:absolute;inset:0;z-index:20;display:flex;align-items:flex-end;justify-content:center;background:rgba(10,15,12,.35)}
#col .cl-dialog{background:var(--card);width:min(560px,100%);max-height:90%;overflow-y:auto;border-radius:18px 18px 0 0;box-shadow:var(--shadow);padding:14px 16px calc(16px + env(safe-area-inset-bottom,0px));display:grid;gap:12px}
@media (min-width:900px){#col .cl-modal{align-items:center}#col .cl-dialog{border-radius:18px}}
#col .cl-dialog h2{margin:0;font-size:22px;line-height:1.15}
#col .cl-dialog h3{margin:0;font-size:16px}
#col .cl-stripe{height:8px;border-radius:4px;display:flex;overflow:hidden}
#col .cl-stripe i{flex:1}
#col .cl-big{display:grid;grid-template-columns:1fr 1fr;gap:8px}
#col .cl-big button{min-height:58px;border-radius:14px;border:2px solid var(--line);background:var(--card);font-weight:700;font-size:16px;padding:8px}
#col .cl-big button[aria-pressed="true"]{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 12%,var(--card))}
#col .cl-big button.badsel[aria-pressed="true"]{border-color:var(--bad);background:color-mix(in srgb,var(--bad) 10%,var(--card))}
#col .cl-chips{display:flex;flex-wrap:wrap;gap:6px}
#col .cl-chips button{border:1.5px solid var(--line);background:var(--card);border-radius:999px;padding:7px 12px;font-weight:600;font-size:14px;min-height:40px}
#col .cl-chips button[aria-pressed="true"]{border-color:var(--ink);background:var(--ink);color:var(--bg)}
#col textarea,#col input[type=email],#col input[type=password],#col input[type=number],#col select{font:16px var(--font);border:1.5px solid var(--line);border-radius:10px;padding:10px;background:var(--bg);color:var(--ink);width:100%}
#col textarea{min-height:64px;resize:vertical}
#col .cl-stepper{display:flex;align-items:center;gap:8px}
#col .cl-stepper button{width:44px;height:44px;border-radius:12px;border:1.5px solid var(--line);background:var(--card);font-size:22px;font-weight:700}
#col .cl-stepper output{font:700 22px var(--mono);min-width:56px;text-align:center}
#col .cl-toast{position:absolute;left:50%;bottom:calc(var(--sheet-h,40vh) + 12px);transform:translateX(-50%);z-index:30;background:var(--ink);color:var(--bg);padding:10px 14px;border-radius:12px;box-shadow:var(--shadow);display:flex;gap:10px;align-items:center;max-width:calc(100% - 24px);font-size:14px}
#col .cl-toast button{background:transparent;border:1px solid currentColor;border-radius:8px;padding:4px 10px;color:inherit;font-weight:700}
#col .cl-kv{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;font-size:14px}
#col .cl-kv dt{color:var(--muted)}
#col .cl-kv dd{margin:0}
#col .cl-fillbar{height:12px;border-radius:6px;background:var(--chip);overflow:hidden}
#col .cl-fillbar i{display:block;height:100%}
#col .cl-set{display:grid;gap:12px}
#col .cl-set label.l{display:grid;gap:5px;font-weight:600;font-size:14px}
#col .cl-check{display:flex;gap:10px;align-items:flex-start;font-size:14px}
#col .cl-check input{width:20px;height:20px;margin-top:1px;flex:none}
#col .cl-login{position:absolute;inset:0;display:grid;place-items:center;padding:16px}
#col .cl-login form{width:min(380px,100%);background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px;display:grid;gap:12px}
#col .cl-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
#col .cl-stats div{background:var(--chip);border-radius:10px;padding:8px}
#col .cl-stats b{display:block;font:700 20px var(--mono)}
#col .cl-stats span{font-size:11.5px;color:var(--muted)}
#col .cl-visit{display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:center;font-size:14px;border-bottom:1px solid var(--line);padding:6px 0}
#col .cl-visit time{font:12px var(--mono);color:var(--muted)}
#col .cl-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
#col .cl-nav{position:absolute;left:10px;top:10px;right:66px;z-index:4;background:var(--route);color:#fff;border-radius:14px;box-shadow:var(--shadow);padding:10px 12px;display:grid;grid-template-columns:auto minmax(0,1fr);gap:2px 12px;align-items:center}
#col .cl-nav .ar{grid-row:span 2;font:700 34px/1 var(--font);width:44px;text-align:center}
#col .cl-nav b{font-size:17px;line-height:1.2;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
#col .cl-nav span{font:600 13px var(--mono);opacity:.9}
#col .cl-nav small{grid-column:1 / -1;font-size:12.5px;opacity:.85;border-top:1px solid rgba(255,255,255,.25);padding-top:5px;margin-top:4px}
#col .cl-turn{display:flex;gap:10px;align-items:center;font-weight:600}
#col .cl-turn i{font-style:normal;font-size:24px;width:30px;text-align:center;color:var(--route)}
#col .cl-src{font-size:12px;color:var(--muted);margin:0;display:flex;gap:6px;align-items:center;min-height:16px}
#col .cl-src.busy::before{content:"";width:10px;height:10px;border-radius:50%;border:2px solid var(--route);border-right-color:transparent;animation:clspin .8s linear infinite;flex:none}
@keyframes clspin{to{transform:rotate(360deg)}}
#col .cl-maperr{position:absolute;inset:auto 10px 30px 10px;z-index:4;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:8px 10px;font-size:13px}
@media (min-width:900px){
  #col .cl-app{grid-template-columns:420px minmax(0,1fr);grid-template-rows:auto auto minmax(0,1fr)}
  #col .cl-top{grid-column:1 / -1}
  #col .cl-banner{grid-column:1 / -1}
  #col .cl-sheet{grid-column:1;grid-row:3;max-height:none;border-top:0;border-right:1px solid var(--line)}
  #col .cl-mapwrap{grid-column:2;grid-row:3}
  #col .cl-toast{bottom:20px}
  #col .cl-collapse{display:none}
}
@media (max-width:440px){.cl-top:has(.cl-shift) .cl-brand{font-size:0;gap:0}}
@media (max-width:420px){#col .cl-brand span{display:none}#col .cl-summary b{font-size:16px}}
@media (prefers-reduced-motion: reduce){#col *{transition:none!important;animation:none!important}}
`;

const ICON = {
  locate: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>`,
  plus: `<svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`,
  minus: `<svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 12h14"/></svg>`,
  gear: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>`,
  chev: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 15l6-6 6 6"/></svg>`,
};

function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") e.className = v; else if (k === "html") e.innerHTML = v; else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(String(k)));
  return e;
}
const fmtM = m => m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`;
const minutesSince = iso => iso ? Math.max(0, Math.round((Date.now() - new Date(iso)) / 6e4)) : null;
const levelOf = f => f == null ? null : Math.max(0, Math.min(4, Math.round(f)));

export function mountCollector(root) {
  if (!document.getElementById("collector-css")) document.head.append(el("style", { id: "collector-css", html: MAPVIEW_CSS + CSS + COMMUNITY_CSS }));
  root.id = "col"; root.innerHTML = "";
  const store = { get(k, d) { try { const v = localStorage.getItem("collector-" + k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem("collector-" + k, JSON.stringify(v)); } catch {} } };
  const S = {
    lang: store.get("lang", (navigator.language || "da").startsWith("da") ? "da" : "en"),
    set: Object.assign({ mode: "walk", bag: null, minutes: 60, minFill: 3, radius: 30, claim: true, wake: true, dark: false, end: null }, store.get("settings", {})),
    snakes: [], plan: null, routeOn: false, done: new Set(store.get("done-today", { day: "", ids: [] }).day === new Date().toDateString() ? store.get("done-today", {}).ids : []),
    skipped: new Set(), mustInclude: [], me: null, gps: "wait", shift: store.get("shift", null), visits: [], dismissed: new Map(), tab: "route",
    filter: "all", walking: false, pickingEnd: false, focus: null, queue: store.get("queue", []), lastFull: new Set(), session: null, walkedM: store.get("walked", { day: "", m: 0 }),
    geo: null, planning: false, planStart: null, routeSrc: null,
  };
  if (S.walkedM.day !== new Date().toDateString()) S.walkedM = { day: new Date().toDateString(), m: 0 };
  const t = () => TXT[S.lang];
  const cm = createCommunity({ el, S, modal: (...a) => modal(...a), toast: (...a) => toast(...a), byId: id => byId(id), seg: (...a) => seg(...a), renderSheet: () => renderSheet(), refresh: () => refresh(), focusSnake: id => focusSnake(id), openSnake: id => openSnake(id) });
  const saveSet = () => store.set("settings", S.set);

  // ---------- frame ----------
  const app = el("div", { class: "cl-app" });
  const top = el("header", { class: "cl-top" });
  const banner = el("div", { class: "cl-banner", role: "status" });
  const mapWrap = el("div", { class: "cl-mapwrap" });
  const mapEl = el("div", { class: "cl-map", "aria-label": "Map" });
  const fabs = el("div", { class: "cl-fabs" });
  const legend = el("div", { class: "cl-legend", "aria-hidden": "true" });
  const navEl = el("div", { class: "cl-nav", role: "status", "aria-live": "polite", hidden: true });
  const mapNote = el("div", { class: "cl-maperr", role: "status", hidden: true });
  mapWrap.append(mapEl, fabs, legend, navEl, mapNote);
  const sheet = el("section", { class: "cl-sheet" });
  app.append(top, banner, mapWrap, sheet);
  const modalHost = el("div"); const toastHost = el("div");
  root.append(app, modalHost, toastHost);

  const dark = () => S.set.dark || (document.documentElement.dataset.theme === "dark") || (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
  const mapColors = d => d ? { route: "#6EA0FF", later: "#3F5F9E", case: "#0F1412", connector: "#6EA0FF", acc: "#6EA0FF" }
                              : { route: "#1D4ED8", later: "#7C9BE0", case: "#FFFFFF", connector: "#1D4ED8", acc: "#1D4ED8" };
  // the base map: a full street map from the tile service in CFG.MAP_STYLE (default OpenFreeMap), or the built-in Aarhus map
  const MAP_LIVE = CFG.MAP_STYLE !== "" && CFG.MAP_STYLE !== null;
  let map;
  try {
    map = new MapView(mapEl, { center: [56.1567, 10.2108], zoom: 12.6, live: MAP_LIVE || !!CFG.GOOGLE_MAPS_KEY, google: CFG.GOOGLE_MAPS_KEY ? { key: CFG.GOOGLE_MAPS_KEY, region: "DK", language: S.lang === "da" ? "da-DK" : "en-GB" } : null, style: CFG.MAP_STYLE || undefined, styleDark: CFG.MAP_STYLE_DARK || undefined, dark: dark(), colors: mapColors(dark()), demoNote: TXT[S.lang].demoMap });
  } catch (e) {
    console.error(e); mapNote.hidden = false; mapNote.textContent = TXT[S.lang].noWebgl;
    const noop = () => {}; map = { on: noop, setMarkers: noop, setRoute: noop, setUser: noop, setEnd: noop, setDark: noop, setColors: noop, setView: noop, fit: noop, zoomAt: noop, redraw: noop, isDragging: () => false, lat: 56.1567, lng: 10.2108, z: 13 };
  }
  map.on("fallback", () => { mapNote.hidden = false; mapNote.textContent = t().mapFallback; setTimeout(() => mapNote.hidden = true, 8000); });
  // street routing: openrouteservice / OSRM when configured, else the built-in Aarhus street network, else straight lines
  const router = createRouter({ provider: CFG.ROUTING_PROVIDER || (CFG.ORS_KEY ? "ors" : CFG.OSRM_FOOT ? "osrm" : "graph"), orsKey: CFG.ORS_KEY, orsBase: CFG.ORS_BASE, osrmFoot: CFG.OSRM_FOOT, osrmBike: CFG.OSRM_BIKE }, loadDemoStreets);
  const retheme = () => { map.setColors(mapColors(dark())); map.setDark(dark()); };
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", retheme);
  new MutationObserver(retheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  map.on("click", ll => {
    if (S.pickingEnd) { S.set.end = { lat: ll.lat, lng: ll.lng }; saveSet(); S.pickingEnd = false; map.setEnd(S.set.end); toast(t().endPointName + " ✓"); replan(); renderBanner(); return; }
    if (S.gps !== "on") { setMe({ lat: ll.lat, lng: ll.lng, acc: 8, src: "tap" }); }
  });

  // ---------- data ----------
  function eff(s) {                                   // fill used for planning: reported, or estimated when old
    if (s.fill_level == null) return { f: null, predicted: false };
    const ageH = (Date.now() - new Date(s.fill_at)) / 3.6e6;
    if (ageH > 6 && s.fill_rate_per_hour && s.fill_level < 4) { const p = predictFill(s.fill_level, s.fill_at, s.fill_rate_per_hour); return { f: p, predicted: p > s.fill_level + 0.25 }; }
    return { f: s.fill_level, predicted: false };
  }
  const snakeMeta = id => SNAKES.find(x => x.id === id) || designById(S.snakes.find(x => x.id === id)?.design) || {};
  const byId = id => S.snakes.find(s => s.id === id);

  async function refresh(first = false) {
    try { S.snakes = await collectorMap(); } catch (e) { console.error(e); toast(t().error); return; }
    // alert: snakes that just became ¾+ and are close
    if (!first && S.me) for (const s of S.snakes) {
      const lv = levelOf(s.fill_level), was = S.lastFull.has(s.id);
      if (lv >= 3 && !was && minutesSince(s.fill_at) < 30 && !S.plan?.stops.some(x => x.id === s.id)) {
        const d = haversine(S.me, s); if (d < 2000) toast(t().newFull(s.design_name, fmtM(d)), t().addIt, () => { S.mustInclude.push(s.id); replan(); });
      }
    }
    S.lastFull = new Set(S.snakes.filter(s => levelOf(s.fill_level) >= 3).map(s => s.id));
    if (first) map.fit(S.snakes, 50, 14);
    renderMarkers(); if (!S.plan || first) replan(); else renderSheet();
  }
  async function loadVisits() { try { S.visits = await myVisits(7); } catch { S.visits = []; } }

  // ---------- route ----------
  // 1) street travel times between the start and every candidate snake  2) choose and order the stops on those times
  // 3) fetch the street-by-street route for the chosen order. Every step falls back gracefully (see routing.js).
  const mCache = new Map();
  async function streetMatrix(pts, mode) {
    const key = mode + "|" + pts.map(p => p.id || `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join(";");
    if (mCache.has(key)) return mCache.get(key);
    const m = await router.matrix(pts, mode); m.source = router.source;
    mCache.set(key, m); if (mCache.size > 12) mCache.delete(mCache.keys().next().value);
    return m;
  }
  let planSeq = 0;
  async function replan() {
    const seq = ++planSeq;
    const start = S.me || { lat: map.lat, lng: map.lng };
    // left out: claimed by someone, another collector close to it, or its sponsor's head start
    const handled = s => (s.other_nearby && !s.claimed_by_me) || (s.sponsor_turn_until && !s.i_sponsor && new Date(s.sponsor_turn_until) > Date.now());
    S.avoided = S.snakes.filter(s => handled(s) && (eff(s).f ?? 0) >= S.set.minFill).length;
    const sn = S.snakes.map(s => ({ id: s.id, lat: s.lat, lng: s.lng, fill: eff(s).f, blocked: s.claimed_by_other || handled(s) || S.skipped.has(s.id) || S.done.has(s.id) }));
    const opts = { start, end: S.set.end, snakes: sn, mode: S.set.mode, bag: S.set.bag || undefined, minutes: S.set.minutes, minFill: S.set.minFill, mustInclude: S.mustInclude.filter(id => !S.done.has(id)) };
    let cand = routeCandidates(opts);
    if (cand.length > 48) cand = cand.sort((a, b) => haversine(start, a) - haversine(start, b)).slice(0, 48);     // keeps a matrix request under the free-tier size limit
    if (!S.plan) S.plan = planRoute({ ...opts, snakes: cand });                                                     // instant first guess while the streets load
    S.planning = true; renderSheet();
    let matrix = null;
    try { matrix = await streetMatrix([{ lat: start.lat, lng: start.lng, id: null }, ...cand, ...(S.set.end ? [S.set.end] : [])], S.set.mode); } catch (e) { console.warn(e); }
    if (seq !== planSeq) return;
    S.plan = planRoute({ ...opts, snakes: cand, matrix }); S.planStart = { ...start }; S.routeSrc = matrix?.source || "straight";
    renderMarkers(); renderSheet();
    await routeGeometry(seq);
  }
  // the line on the map: from where you are, through the remaining stops (and the end point)
  async function routeGeometry(seq = ++planSeq) {
    const start = S.me || { lat: map.lat, lng: map.lng };
    const rest = (S.plan?.stops || []).filter(s => !S.done.has(s.id)).map(s => s.id === "__end" ? S.set.end : byId(s.id)).filter(Boolean);
    if (!rest.length) { S.geo = null; S.planning = false; drawRoute(); renderSheet(); renderNav(); return; }
    S.planning = true;
    try {
      const g = await router.route([{ lat: start.lat, lng: start.lng }, ...rest.map(p => ({ lat: p.lat, lng: p.lng }))], S.set.mode);
      if (seq !== planSeq) return;
      g.from = { ...start }; S.geo = g; S.routeSrc = g.source;
      applyGeo();
    } catch (e) { console.warn(e); if (seq !== planSeq) return; S.geo = null; }
    S.planning = false; S.walkLeg = null; drawRoute(); renderSheet(); renderNav();
  }
  // replace the planner's estimates by the router's own distances and times for each leg
  function applyGeo() {
    if (!S.geo || !S.plan) return;
    const rest = S.plan.stops.filter(s => !S.done.has(s.id));
    if (rest.length !== S.geo.legs.length) return;
    let t = 0, m = 0;
    for (const st of S.plan.stops) {
      const i = rest.indexOf(st);
      if (i >= 0) { st.legM = Math.round(S.geo.legs[i].dist); st.legMin = S.geo.legs[i].dur / 60; }
      if (S.done.has(st.id)) continue;
      t += st.legMin ?? st.legM / (TRANSPORT[S.set.mode].kmh * 1000 / 60); m += st.legM; st.arriveMin = Math.round(t); if (st.id !== "__end") t += 3;
    }
    if (!S.routeOn) { S.plan.km = m / 1000; S.plan.minutes = Math.round(t); }
  }
  function drawRoute() {
    map.setEnd(S.set.end);
    if (!S.plan || (!routeStops().length && !S.geo)) return map.setRoute(null);
    if (S.geo) {
      const legs = S.geo.legs.map(l => ({ ...l }));
      const nav = S.routeOn && navInfo();
      if (nav && legs[0] && !legs[0].straight) {                    // trim the part of the current leg already walked
        const cut = cutLine(legs[0].coords, nav.along);
        legs[0] = { ...legs[0], coords: [[S.me.lng, S.me.lat], ...cut], connectors: legs[0].connectors ? [[[S.me.lng, S.me.lat], cut[0]], legs[0].connectors[1]] : null };
      }
      return map.setRoute({ legs, active: S.routeOn ? 0 : -1 });
    }
    const start = S.me || { lat: map.lat, lng: map.lng };
    const pts = [start, ...S.plan.stops.filter(s => !S.done.has(s.id)).map(s => s.id === "__end" ? S.set.end : byId(s.id)).filter(Boolean)];
    map.setRoute({ legs: pts.slice(1).map((p, i) => ({ coords: [[pts[i].lng, pts[i].lat], [p.lng, p.lat]], straight: true })), active: S.routeOn ? 0 : -1 });
  }

  // ---------- following the route ----------
  const KX = 111320 * Math.cos(56.15 * Math.PI / 180), KY = 110574;
  function project(coords, p) {                       // nearest point of a line to p: distance off the line and distance along it
    let best = { d: Infinity, along: 0, i: 0 }, acc = 0;
    for (let i = 1; i < coords.length; i++) {
      const [ax, ay] = coords[i - 1], [bx, by] = coords[i];
      const dx = (bx - ax) * KX, dy = (by - ay) * KY, px = (p.lng - ax) * KX, py = (p.lat - ay) * KY, L2 = dx * dx + dy * dy, L = Math.sqrt(L2);
      const tt = L2 ? Math.max(0, Math.min(1, (px * dx + py * dy) / L2)) : 0, d = Math.hypot(px - tt * dx, py - tt * dy);
      if (d < best.d) best = { d, along: acc + tt * L, i };
      acc += L;
    }
    best.total = acc; return best;
  }
  function pointAt(coords, along) {
    let acc = 0;
    for (let i = 1; i < coords.length; i++) {
      const [ax, ay] = coords[i - 1], [bx, by] = coords[i], L = Math.hypot((bx - ax) * KX, (by - ay) * KY);
      if (acc + L >= along) { const f = L ? (along - acc) / L : 0; return { lng: ax + (bx - ax) * f, lat: ay + (by - ay) * f, heading: Math.atan2((bx - ax) * KX, (by - ay) * KY) * 180 / Math.PI }; }
      acc += L;
    }
    const e = coords.at(-1); return { lng: e[0], lat: e[1] };
  }
  function cutLine(coords, along) {
    let acc = 0;
    for (let i = 1; i < coords.length; i++) {
      const [ax, ay] = coords[i - 1], [bx, by] = coords[i], L = Math.hypot((bx - ax) * KX, (by - ay) * KY);
      if (acc + L >= along) { const f = L ? (along - acc) / L : 0; return [[ax + (bx - ax) * f, ay + (by - ay) * f], ...coords.slice(i)]; }
      acc += L;
    }
    return coords.slice(-1);
  }
  function navInfo() {
    const leg = S.geo?.legs?.[0]; if (!leg || !S.me || leg.straight) return null;
    const pr = project(leg.coords, S.me);
    leg._steps ||= (leg.steps || []).map(st => ({ ...st, along: project(leg.coords, st).along }));
    const ahead = leg._steps.filter(st => st.kind !== "depart" && st.along > pr.along + 6);
    return { off: pr.d, along: pr.along, left: Math.max(0, pr.total - pr.along), step: ahead[0] || null, stepIn: ahead[0] ? ahead[0].along - pr.along : null, then: ahead[1] || null, dur: leg.dur * Math.max(0, pr.total - pr.along) / Math.max(1, pr.total) };
  }
  function renderNav() {
    const n = S.routeOn ? navInfo() : null, st = nextStop();
    navEl.hidden = !n || !st; legend.hidden = !navEl.hidden;
    if (navEl.hidden) return;
    const s = byId(st.id), step = n.step && n.step.kind !== "arrive" ? n.step : null;
    navEl.innerHTML = "";
    navEl.append(el("span", { class: "ar", "aria-hidden": "true" }, step ? (ARROW[step.mod] || (step.kind === "roundabout" ? "⟳" : "↑")) : "◎"),
      el("b", {}, step ? stepText(step, S.lang) : `${s?.design_name || ""}`),
      el("span", {}, step ? t().inM(fmtM(n.stepIn)) + ` · ${fmtM(n.left)} ${t().toSnake}` : `${fmtM(n.left)} · ${Math.max(1, Math.round(n.dur / 60))} ${t().min}`),
      n.then && step && n.then.kind !== "arrive" ? el("small", {}, `${t().then}: ${stepText(n.then, S.lang)}`) : el("small", {}, `${t().next}: ${s?.design_name || ""} · ${s?.location_label || ""}`));
  }
  let lastReroute = 0;
  function followRoute() {                            // called on every position update while a route is active
    const n = navInfo();
    if (n && n.off > 45 + Math.min(40, (S.me.acc || 0) / 2) && Date.now() - lastReroute > 15000 && !S.planning) { lastReroute = Date.now(); toast(t().rerouting); routeGeometry(); }
  }
  const routeStops = () => (S.plan?.stops || []).filter(s => s.id !== "__end");
  const nextStop = () => routeStops().find(s => !S.done.has(s.id));
  // time a planned route saves against visiting the same snakes fullest-first (what you'd do without a plan)
  function countSavedMinutes() {
    const stops = routeStops().map(x => byId(x.id)).filter(Boolean); if (stops.length < 2 || !S.me) return;
    const leg = (pts) => pts.slice(1).reduce((a, p, i) => a + haversine(pts[i], p) * 1.3, 0) / (TRANSPORT[S.set.mode].kmh * 1000 / 60);
    const naive = leg([S.me, ...stops.slice().sort((a, b) => (eff(b).f ?? 0) - (eff(a).f ?? 0))]), planned = leg([S.me, ...stops]);
    const saved = Math.max(0, Math.round(naive - planned));
    try { localStorage.setItem("collector-saved-min", JSON.stringify((JSON.parse(localStorage.getItem("collector-saved-min") || "0") || 0) + saved)); } catch {}
  }
  async function startRoute() {
    S.routeOn = true; countSavedMinutes();
    if (!S.shift) startShift();
    routeGeometry();
    if (S.me) map.setView(S.me.lat, S.me.lng, Math.max(map.z, 15));
    if (S.set.claim) { try { await claimSnakes(routeStops().map(s => s.id), Math.min(180, Math.max(30, (S.plan?.minutes || 60) + 20))); } catch (e) { console.error(e); } }
    renderSheet(); refresh();
  }

  // ---------- position ----------
  let lastMe = null;
  function setMe(p) {
    if (lastMe && S.shift) { const d = haversine(lastMe, p); if (d > 2 && d < 500) { S.walkedM.m += d; store.set("walked", S.walkedM); } }
    if (lastMe && haversine(lastMe, p) > 3) p.heading = Math.atan2((p.lng - lastMe.lng) * Math.cos(p.lat * Math.PI / 180), p.lat - lastMe.lat) * 180 / Math.PI;
    if (p.heading == null && lastMe?.heading != null && haversine(lastMe, p) <= 3) p.heading = lastMe.heading;
    lastMe = p; S.me = p; map.setUser(p);
    if (!S.routeOn) { if (!S.planStart || haversine(S.planStart, p) > 40 || p.src === "tap") { clearTimeout(setMe.tm); setMe.tm = setTimeout(replan, 400); } }
    else { followRoute(); drawRoute(); renderNav(); if (Date.now() - (setMe.last || 0) > 2000) { setMe.last = Date.now(); renderSheet(); } }
    checkArrival();
  }
  function startGps() {
    if (!("geolocation" in navigator)) { S.gps = "off"; renderBanner(); return; }
    S.gps = "wait"; renderBanner();
    try {
      navigator.geolocation.watchPosition(pos => {
        if (S.walking) return;
        if (!LIVE && haversine({ lat: 56.1567, lng: 10.2108 }, { lat: pos.coords.latitude, lng: pos.coords.longitude }) > 30000) { S.gps = "off"; renderBanner(); return; }
        if (pos.coords.accuracy > 200 && S.me?.src === "gps") return;                  // ignore a very rough fix once we have a good one
        S.gps = "on"; renderBanner();
        setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy, src: "gps" });
        if (!startGps.centered) { startGps.centered = true; map.setView(pos.coords.latitude, pos.coords.longitude, Math.max(map.z, 14)); }
      }, () => { S.gps = "off"; renderBanner(); if (!S.me) setMe({ lat: 56.1567, lng: 10.2085, acc: 10, src: "tap" }); },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 });
    } catch { S.gps = "off"; renderBanner(); }
    setTimeout(() => { if (S.gps === "wait") { S.gps = "off"; renderBanner(); if (!S.me) setMe({ lat: 56.1567, lng: 10.2085, acc: 10, src: "tap" }); } }, 6000);
  }
  function checkArrival() {
    if (!S.me || document.querySelector("#col .cl-modal")) return;
    let best = null;
    for (const s of S.snakes) {
      const d = haversine(S.me, s); const r = S.set.radius + Math.min(25, (S.me.acc || 0) * 0.5);
      if (d <= r && (!best || d < best.d)) best = { s, d };
    }
    if (!best) return;
    const { s, d } = best, dis = S.dismissed.get(s.id);
    if (S.done.has(s.id) || (dis && Date.now() - dis < 5 * 6e4)) return;
    if (navigator.vibrate) try { navigator.vibrate([60, 40, 60]); } catch {}
    openArrival(s.id, d);
  }
  // demo walk: follow the street route at 15× real speed (bikes 8×)
  let walkTimer = null;
  function toggleWalk() {
    if (S.walking) { S.walking = false; clearInterval(walkTimer); renderBanner(); return; }
    if (!S.plan || !routeStops().length) return;
    if (!S.routeOn) startRoute();
    S.walking = true; renderBanner();
    const speed = (TRANSPORT[S.set.mode].kmh * 1000 / 3600) * (S.set.mode === "walk" ? 15 : 8), step = 0.25;
    walkTimer = setInterval(() => {
      if (document.querySelector("#col .cl-modal") || S.planning) return;   // wait while the check-in is open or the route is loading
      const n = nextStop(); if (!n) { S.walking = false; clearInterval(walkTimer); renderBanner(); return; }
      const target = byId(n.id), leg = S.geo?.legs?.[0];
      if (!leg || !target) return;
      if (S.walkLeg !== leg) { S.walkLeg = leg; S.walkAlong = project(leg.coords, S.me || target).along; }
      S.walkAlong += speed * step;
      const total = project(leg.coords, target).total;
      if (S.walkAlong >= total - 4) { setMe({ lat: target.lat - 0.00003, lng: target.lng, acc: 6, src: "sim" }); return; }
      setMe({ ...pointAt(leg.coords, S.walkAlong), acc: 6, src: "sim" });
      if (!map._userPanned) map.setView(S.me.lat, S.me.lng, Math.max(map.z, 15.5), false);
    }, step * 1000);
  }
  map.on("drag", () => { map._userPanned = true; clearTimeout(map._upT); map._upT = setTimeout(() => map._userPanned = false, 8000); });
  setInterval(() => { if (S.routeOn && S.me && S.gps === "on" && !map._userPanned) map.setView(S.me.lat, S.me.lng, Math.max(map.z, 15)); }, 4000);   // follow me

  // ---------- shift ----------
  function startShift() { S.shift = { start: new Date().toISOString() }; store.set("shift", S.shift); wake(); renderTop(); }
  async function endShift() { S.shift = null; store.set("shift", null); S.routeOn = false; S.done.clear(); store.set("done-today", { day: "", ids: [] }); S.skipped.clear(); S.mustInclude = []; try { await releaseClaims(); } catch {} wake(); renderTop(); renderSheet(); refresh(); }
  let lock = null;
  async function wake() { try { if (S.shift && S.set.wake && navigator.wakeLock) lock = await navigator.wakeLock.request("screen"); else if (lock) { await lock.release(); lock = null; } } catch {} }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { wake(); refresh(); } });

  // ---------- offline queue ----------
  async function flushQueue() {
    if (!S.queue.length) return;
    const left = [];
    for (const job of S.queue) { try { await recordVisit(job); } catch (e) { if (String(e.message).includes("duplicate")) continue; left.push(job); } }
    S.queue = left; store.set("queue", S.queue); if (!left.length) refresh();
    renderBanner();
  }
  addEventListener("online", flushQueue); setInterval(flushQueue, 30000);

  // ---------- rendering ----------
  function renderTop() {
    top.innerHTML = "";
    const shift = S.shift ? el("span", { class: "cl-shift" }, el("i", { class: "dot" }), `${t().onShift} ${elapsed()}`) : null;
    top.append(el("div", { class: "cl-brand" }, el("i"), "Pant Snake", el("span", {}, "· " + t().app)), el("div", { class: "cl-sp" }), shift || "",
      el("button", { class: "cl-btn small " + (S.shift ? "ghost" : "primary"), onclick: () => S.shift ? endShift() : startShift() }, S.shift ? t().endShift : t().startShift),
      cm.bell(), el("button", { class: "cl-icon", title: t().settings, "aria-label": t().settings, html: ICON.gear, onclick: openSettings }));
  }
  const elapsed = () => { const m = minutesSince(S.shift?.start) || 0; return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`; };
  setInterval(() => { if (S.shift) { const s = top.querySelector(".cl-shift"); if (s) s.lastChild.textContent = `${t().onShift} ${elapsed()}`; } }, 30000);

  function renderBanner() {
    banner.innerHTML = ""; const parts = [];
    if (S.pickingEnd) parts.push(el("span", {}, t().endPick), el("button", { class: "cl-btn small", onclick: () => { S.pickingEnd = false; renderBanner(); } }, t().notNow));
    else if (S.gps !== "on") {
      parts.push(el("span", {}, S.gps === "wait" ? t().gpsWait : !LIVE ? t().gpsSim : t().gpsOff));
      if (S.plan && routeStops().length) parts.push(el("button", { class: "cl-btn small", onclick: toggleWalk }, S.walking ? t().stopWalk : "▶ " + t().walk));
    }
    if (S.queue.length) parts.push(el("b", {}, t().savedOffline(S.queue.length)));
    banner.hidden = !parts.length; banner.append(...parts);
  }

  function renderLegend() {
    legend.innerHTML = ""; t().levels.forEach((l, i) => legend.append(el("span", {}, el("i", { style: `background:${LEVEL_COL[i]}` }), l)));
    legend.append(el("span", { title: t().legendHint }, el("i", { style: "border:2px dashed var(--muted);background:transparent" }), t().predicted), el("span", { style: "font-weight:500;color:var(--muted)" }, "· " + t().legendNum));
  }

  const pins = new Map();
  function renderMarkers() {
    const order = new Map(routeStops().map((s, i) => [s.id, i + 1]));
    const items = S.snakes.map(s => {
      let b = pins.get(s.id);
      if (!b) { b = el("button", { class: "cl-pin", onclick: (e) => { e.stopPropagation(); openSnake(s.id); } }); pins.set(s.id, b); }
      const e = eff(s), lv = levelOf(e.f), f = e.f == null ? 0 : Math.max(6, e.f / 4 * 100);
      b.style.setProperty("--c", lv == null ? "#8C969C" : LEVEL_COL[lv]); b.style.setProperty("--f", f);
      const turn = s.sponsor_turn_until && !s.i_sponsor && new Date(s.sponsor_turn_until) > Date.now();
      b.className = "cl-pin" + (order.has(s.id) ? " route" : "") + (e.predicted ? " stale" : "") + (s.claimed_by_other ? " other" : "") + (s.other_nearby && !s.claimed_by_me ? " near" : "") + (S.done.has(s.id) ? " done" : "") + (S.focus === s.id ? " focus" : "");
      b.innerHTML = `<span>${lv == null ? "?" : expectedCans(e.f)}</span>` + (order.has(s.id) && !S.done.has(s.id) ? `<em>${order.get(s.id)}</em>` : "") + (s.open_problems ? `<em class="warn">!</em>` : "")
        + (s.other_nearby && !s.claimed_by_me && !s.open_problems ? `<em class="near" title="${t().otherNear}">👥</em>` : "") + (turn || s.i_sponsor ? `<em class="sp">🌱</em>` : "");
      b.setAttribute("aria-label", `${s.design_name}: ${lv == null ? t().unknown : t().levelWords[lv]}${s.open_problems ? ", " + t().openProblems(s.open_problems) : ""}`);
      return { id: s.id, lat: s.lat, lng: s.lng, el: b, z: order.has(s.id) ? 3 : 1 };
    });
    map.setMarkers(items);
  }

  function pill(s) {
    const e = eff(s), lv = levelOf(e.f);
    return el("span", { class: "cl-pill" }, el("i", { style: `background:${lv == null ? "#8C969C" : LEVEL_COL[lv]}` }), lv == null ? "?" : t().levels[lv] + (e.predicted ? "*" : ""));
  }
  const snakeLine = s => [s.location_label || snakeMeta(s.id).place || "", s.fill_at ? `${eff(s).predicted ? t().predicted : t().reported} ${t().ago(minutesSince(s.fill_at))}` : t().unknown].filter(Boolean).join(" · ");

  function renderSheet() {
    sheet.innerHTML = "";
    const tabs = el("div", { class: "cl-tabs", role: "tablist" }, ...[["route", t().tabRoute], ["snakes", t().tabSnakes], ["today", t().tabToday], ["rank", t().tabRank], ["kit", t().tabKit]].map(([k, l]) =>
      el("button", { role: "tab", "aria-selected": String(S.tab === k), onclick: () => { S.tab = k; sheet.classList.remove("collapsed"); if (k === "today") loadVisits().then(renderSheet); renderSheet(); } }, l)));
    const col = el("button", { class: "cl-icon cl-collapse", "aria-label": "Collapse", html: ICON.chev, style: sheet.classList.contains("collapsed") ? "" : "transform:rotate(180deg)", onclick: () => { sheet.classList.toggle("collapsed"); renderSheet(); requestAnimationFrame(() => map.redraw()); } });
    sheet.append(el("div", { class: "cl-handle" }, tabs, col));
    const pane = el("div", { class: "cl-pane", role: "tabpanel" }); sheet.append(pane);
    if (S.tab === "route") paneRoute(pane); else if (S.tab === "snakes") paneSnakes(pane); else if (S.tab === "today") { paneToday(pane); cm.paneImpact(pane); }
    else if (S.tab === "rank") cm.paneRanking(pane); else cm.paneToolkit(pane);
    root.style.setProperty("--sheet-h", sheet.getBoundingClientRect().height + "px");
  }

  function seg(options, value, onPick) {
    return el("span", { class: "cl-seg" }, ...options.map(([v, l]) => el("button", { "aria-pressed": String(value === v), onclick: () => onPick(v) }, l)));
  }
  function paneRoute(p) {
    const P = S.plan, stops = routeStops(), val = (P?.cans || 0) * CAN_VALUE, nav = S.routeOn ? navInfo() : null;
    p.append(el("div", { class: "cl-summary" },
      el("div", {}, el("b", {}, stops.length), el("span", {}, t().stops(stops.length).replace(/^\d+\s*/, ""))),
      el("div", {}, el("b", {}, (P?.km || 0).toFixed(1)), el("span", {}, t().km)),
      el("div", {}, el("b", {}, P?.minutes || 0), el("span", {}, t().min + " " + t().by[S.set.mode])),
      el("div", {}, el("b", {}, `${P?.cans || 0}`), el("span", {}, `${t().cans} · ${t().value(val)}`))));
    p.append(el("div", { class: "cl-opts" },
      seg(Object.keys(TRANSPORT).map(k => [k, TRANSPORT[k].label[S.lang]]), S.set.mode, v => { S.set.mode = v; S.set.bag = null; saveSet(); replan(); })),
      el("div", { class: "cl-opts" }, el("label", {}, t().timeBudget),
      seg([[30, "30"], [60, "60"], [90, "90"], [120, "120"]], S.set.minutes, v => { S.set.minutes = v; saveSet(); replan(); }), el("label", {}, t().min + " ·"),
      el("label", {}, t().minFill),
      seg([[2, "½"], [3, "¾"], [4, t().levels[4]]], S.set.minFill, v => { S.set.minFill = v; saveSet(); replan(); })));
    p.append(el("p", { class: "cl-src" + (S.planning ? " busy" : "") }, S.planning ? (S.routeOn ? t().rerouting : t().planning) : S.routeSrc ? t().via(t().srcName[S.routeSrc] || S.routeSrc) : ""));
    const n = nextStop();
    if (S.routeOn && n) {
      const s = byId(n.id), d = S.me ? haversine(S.me, s) : null;
      p.append(el("div", { class: "cl-next" }, el("div", { class: "eyebrow" }, t().next),
        el("h3", {}, s.design_name), el("div", { class: "cl-meta" }, pill(s), el("span", {}, s.location_label || ""), nav ? el("span", {}, `${fmtM(nav.left)} · ${Math.max(1, Math.round(nav.dur / 60))} ${t().min}`) : d != null ? el("span", {}, fmtM(d)) : "", s.open_problems ? el("span", { class: "cl-pill bad" }, "! " + t().openProblems(s.open_problems)) : ""),
        nav?.step ? el("div", { class: "cl-turn" }, el("i", { "aria-hidden": "true" }, ARROW[nav.step.mod] || (nav.step.kind === "arrive" ? "◎" : "↑")), el("span", {}, stepText(nav.step, S.lang) + " · " + t().inM(fmtM(nav.stepIn)))) : "",
        el("div", { class: "cl-row" },
          el("a", { class: "cl-btn", href: dirLink(s), target: "_blank", rel: "noopener", style: "text-decoration:none;text-align:center" }, t().gmaps + " ↗"),
          el("button", { class: "cl-btn primary", onclick: () => openArrival(s.id, d) }, t().here),
          el("button", { class: "cl-btn ghost", onclick: () => { S.skipped.add(s.id); replan(); } }, t().skip))));
      p.append(el("button", { class: "cl-btn", style: "width:100%;margin-top:8px", onclick: () => replan() }, "↻ " + t().replan));   // always available, also mid-route
    } else {
      p.append(el("div", { class: "cl-row" },
        el("button", { class: "cl-btn primary", disabled: !stops.length, onclick: startRoute }, S.routeOn ? t().routeActive : t().startRoute),
        el("button", { class: "cl-btn", onclick: () => { S.skipped.clear(); replan(); } }, t().replan)));
    }
    if (!stops.length) p.append(el("p", { class: "cl-empty" }, t().noRoute));
    const list = el("ol", { class: "cl-list" });
    stops.forEach((st, i) => {
      const s = byId(st.id); if (!s) return;
      list.append(el("li", {}, el("button", { class: "cl-item" + (S.done.has(s.id) ? " done" : ""), onclick: () => { focusSnake(s.id); openSnake(s.id); } },
        el("span", { class: "n" }, i + 1),
        el("span", { style: "min-width:0" }, el("b", {}, s.design_name), el("small", {}, `${fmtM(st.legM)} · ${S.done.has(s.id) ? "✓" : st.arriveMin + " " + t().min} · ≈ ${st.cans} ${t().cans}`)),
        el("span", { style: "display:grid;gap:3px;justify-items:end" }, pill(s), s.open_problems ? el("span", { class: "cl-pill bad" }, "!") : ""))));
    });
    if (S.set.end && S.plan?.stops.at(-1)?.id === "__end") list.append(el("li", {}, el("div", { class: "cl-item" }, el("span", { class: "n", style: "background:var(--ink)" }, "⚑"), el("span", {}, el("b", {}, t().endPointName), el("small", {}, `${fmtM(S.plan.stops.at(-1).legM)} · ${S.plan.stops.at(-1).arriveMin} ${t().min}`)), "")));
    p.append(list);
    if (P?.left?.length) p.append(el("p", { class: "cl-note" }, t().leftOut(P.left.length)));
    if (S.avoided) p.append(el("p", { class: "cl-note" }, "👥 " + t().avoided(S.avoided)));
  }
  function paneSnakes(p) {
    p.append(el("div", { class: "cl-opts" }, seg([["all", t().all], ["full", t().fullish], ["prob", t().withProblems]], S.filter, v => { S.filter = v; renderSheet(); }), el("label", {}, S.me ? t().sortDist : "")));
    let list = S.snakes.slice();
    if (S.filter === "full") list = list.filter(s => (eff(s).f ?? 0) >= 3); if (S.filter === "prob") list = list.filter(s => s.open_problems);
    list.sort((a, b) => S.me ? haversine(S.me, a) - haversine(S.me, b) : (eff(b).f ?? -1) - (eff(a).f ?? -1));
    const ul = el("ul", { class: "cl-list" });
    for (const s of list) {
      const d = S.me ? haversine(S.me, s) : null;
      ul.append(el("li", {}, el("button", { class: "cl-item", onclick: () => { focusSnake(s.id); openSnake(s.id); } },
        el("span", { class: "cl-stripe", style: "width:10px;height:34px;flex-direction:column" }, ...(snakeMeta(s.id).colors || []).map(c => el("i", { style: `background:${c}` }))),
        el("span", { style: "min-width:0" }, el("b", {}, s.design_name), el("small", {}, [d != null ? fmtM(d) : "", snakeLine(s)].filter(Boolean).join(" · "))),
        el("span", { style: "display:grid;gap:3px;justify-items:end" }, pill(s), s.open_problems ? el("span", { class: "cl-pill bad" }, "! " + s.open_problems) : "", s.claimed_by_other ? el("small", {}, "🔒") : ""))));
    }
    if (!list.length) p.append(el("p", { class: "cl-empty" }, "—")); p.append(ul);
  }
  function paneToday(p) {
    const today = S.visits.filter(v => new Date(v.created_at).toDateString() === new Date().toDateString());
    const cans = today.reduce((a, v) => a + (v.cans || 0), 0);
    p.append(el("div", { class: "cl-stats" },
      el("div", {}, el("b", {}, today.length), el("span", {}, t().todayVisits)),
      el("div", {}, el("b", {}, cans), el("span", {}, t().todayCans)),
      el("div", {}, el("b", {}, Math.round(cans * CAN_VALUE)), el("span", {}, `${t().todayValue}, ${t().dkk}`)),
      el("div", {}, el("b", {}, (S.walkedM.m / 1000).toFixed(1)), el("span", {}, `${t().todayKm}, ${t().km}`))));
    if (!today.length) p.append(el("p", { class: "cl-empty" }, t().none));
    for (const v of today) {
      const s = byId(v.snake_id) || { design_name: snakeMeta(v.snake_id).name || v.snake_id };
      p.append(el("div", { class: "cl-visit" }, el("time", {}, new Date(v.created_at).toLocaleTimeString(S.lang === "da" ? "da-DK" : "en-GB", { hour: "2-digit", minute: "2-digit" })),
        el("span", {}, s.design_name, " · ", t().outcome[v.outcome] || v.outcome, v.all_ok ? "" : " · ⚠ " + (t().problems[v.problem] || "")), el("b", {}, v.cans ? `${v.cans}` : "")));
    }
    const week = S.visits, wc = week.reduce((a, v) => a + (v.cans || 0), 0);
    p.append(el("h3", { style: "margin:8px 0 0;font-size:15px" }, t().week), el("p", { class: "cl-note" }, `${week.length} ${t().todayVisits.toLowerCase()} · ${wc} ${t().cans} · ${t().value(wc * CAN_VALUE)}`));
  }

  function dirLink(s) { const m = { walk: "walking", bike: "bicycling", cargo: "bicycling" }[S.set.mode]; return `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}&travelmode=${m}`; }
  function focusSnake(id) { const s = byId(id); if (!s) return; S.focus = id; renderMarkers(); map.setView(s.lat, s.lng, Math.max(map.z, 15)); }

  // ---------- dialogs ----------
  function modal(build, onClose) {
    modalHost.innerHTML = "";
    const dlg = el("div", { class: "cl-dialog", role: "dialog", "aria-modal": "true" });
    const close = () => { modalHost.innerHTML = ""; onClose && onClose(); };
    const wrap = el("div", { class: "cl-modal", onclick: e => { if (e.target === wrap) close(); } }, dlg);
    build(dlg, close); modalHost.append(wrap);
    const f = dlg.querySelector("button,input,textarea"); if (f) f.focus({ preventScroll: true });
    wrap.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
    return close;
  }
  function stripe(id) { return el("div", { class: "cl-stripe" }, ...(snakeMeta(id).colors || ["#999"]).map(c => el("i", { style: `background:${c}` }))); }

  function openSnake(id) {
    const s = byId(id); if (!s) return;
    S.focus = id; renderMarkers();
    const spHost = el("div");
    modal((d, close) => {
      const e = eff(s), lv = levelOf(e.f), inRoute = routeStops().some(x => x.id === id), dist = S.me ? haversine(S.me, s) : null;
      d.append(stripe(id), el("h2", {}, s.design_name), el("div", { class: "cl-meta" }, s.location_label || "", dist != null ? fmtM(dist) : ""),
        el("div", { class: "cl-fillbar" }, el("i", { style: `width:${(e.f ?? 0) / 4 * 100}%;background:${lv == null ? "#8C969C" : LEVEL_COL[lv]}` })),
        el("dl", { class: "cl-kv" },
          el("dt", {}, t().level), el("dd", {}, lv == null ? t().unknown : `${t().levelWords[lv]} · ≈ ${expectedCans(e.f)} ${t().cans}` + (e.predicted ? ` (${t().predicted})` : "")),
          el("dt", {}, t().reported), el("dd", {}, s.fill_at ? `${t().levelWords[s.fill_level]} ${t().ago(minutesSince(s.fill_at))} ${t().src[s.fill_source] || ""}` : t().unknown),
          el("dt", {}, t().lastEmptied), el("dd", {}, s.last_emptied_at ? t().ago(minutesSince(s.last_emptied_at)) : t().never),
          s.open_problems ? el("dt", {}, "!") : "", s.open_problems ? el("dd", { style: "color:var(--bad);font-weight:600" }, s.problem_types.map(p => t().problems[p] || p).join(", ")) : "",
          s.claimed_by_other || s.claimed_by_me ? el("dt", {}, "🔒") : "", s.claimed_by_other ? el("dd", {}, t().claimedOther) : s.claimed_by_me ? el("dd", {}, t().claimedMe) : "",
          s.other_nearby && !s.claimed_by_me ? el("dt", {}, "👥") : "", s.other_nearby && !s.claimed_by_me ? el("dd", { style: "color:#2E9E62;font-weight:600" }, t().otherNear) : "",
          s.sponsor_turn_until && !s.i_sponsor && new Date(s.sponsor_turn_until) > Date.now() ? el("dt", {}, "🌱") : "", s.sponsor_turn_until && !s.i_sponsor && new Date(s.sponsor_turn_until) > Date.now() ? el("dd", { style: "color:#7A5AF8;font-weight:600" }, t().sponsorTurn(Math.max(1, Math.round((new Date(s.sponsor_turn_until) - Date.now()) / 6e4)))) : ""),
        el("div", { class: "cl-row" },
          el("button", { class: "cl-btn primary", onclick: () => { close(); openArrival(id, dist); } }, t().here),
          el("button", { class: "cl-btn", onclick: () => { if (inRoute) { S.skipped.add(id); S.mustInclude = S.mustInclude.filter(x => x !== id); } else { S.skipped.delete(id); S.mustInclude.push(id); } close(); replan(); } }, inRoute ? t().remove : t().add),
          el("a", { class: "cl-btn", href: dirLink(s), target: "_blank", rel: "noopener", style: "text-decoration:none;text-align:center" }, t().directions + " ↗")),
        spHost, el("button", { class: "cl-btn ghost", onclick: close }, t().done));
      cm.sponsorBlock(id, spHost);
    }, () => { S.focus = null; renderMarkers(); });
  }

  function openArrival(id, dist) {
    const s = byId(id); if (!s) return;
    const expected = expectedCans(eff(s).f ?? s.fill_level ?? 0);
    // the usual case is preselected (all good, emptied): one tap on the big OK saves it; change things only when something was different
    const st = { ok: true, problem: null, note: "", photo: null, outcome: "emptied", fillAfter: null, cans: expected, cansTouched: false };
    modal((d, close) => {
      const render = () => {
        d.innerHTML = "";
        d.append(stripe(id), el("div", { class: "cl-meta" }, el("span", {}, dist == null || dist <= S.set.radius * 2 ? t().arrive : t().checkIn), dist != null ? el("span", {}, t().away(Math.round(dist))) : ""), el("h2", {}, s.design_name),
          el("div", { class: "cl-meta" }, pill(s), s.open_problems ? el("span", { class: "cl-pill bad" }, "! " + s.problem_types.map(p => t().problems[p] || p).join(", ")) : "", snakeLine(s)));
        const ready = st.ok !== null && st.outcome && (st.ok || st.problem) && (st.outcome !== "partial" || st.fillAfter);
        const msg = el("p", { class: "cl-note", role: "alert" });
        const quick = st.ok === true && st.outcome === "emptied";
        d.append(el("button", { class: "cl-btn primary cl-ok", disabled: !ready, onclick: async (ev) => {
            const far = S.me && haversine(S.me, s) > 150;
            if (far && !ev.target.dataset.confirmed) { msg.textContent = t().farWarn(Math.round(haversine(S.me, s))); ev.target.dataset.confirmed = "1"; return; }
            ev.target.disabled = true;
            const job = { snake_id: id, outcome: st.outcome, all_ok: st.ok, problem: st.ok ? null : st.problem, note: st.note.trim() || null,
              cans: st.outcome === "emptied" || st.outcome === "partial" ? st.cans : null, fill_after: st.outcome === "partial" ? st.fillAfter : null, photo: st.photo, lang: S.lang,
              dist_m: S.me && S.me.src !== "tap" ? haversine(S.me, s) : null };     // within 60 m = a proven visit (counts for sponsorship)
            try { await recordVisit(job); toast(t().saved(job.cans)); }
            catch (e) {
              const m = String(e?.message || e);
              if (m.includes("duplicate")) { msg.textContent = t().dupe; ev.target.disabled = false; return; }
              if (!navigator.onLine || e instanceof TypeError) { S.queue.push({ ...job, photo: null }); store.set("queue", S.queue); toast(t().savedOffline(S.queue.length)); }
              else { msg.textContent = t().error; ev.target.disabled = false; return; }
            }
            S.done.add(id); store.set("done-today", { day: new Date().toDateString(), ids: [...S.done] });
            cm.reset(); close(); await loadVisits(); await refresh(); renderBanner();
            if (S.routeOn) routeGeometry(); else replan();
          } }, quick ? "✓ " + t().okBig : t().save), msg, el("p", { class: "cl-note" }, t().changeIfNot));
        d.append(el("h3", {}, "1 · " + t().q1), el("div", { class: "cl-big" },
          el("button", { "aria-pressed": String(st.ok === true), onclick: () => { st.ok = true; st.problem = null; render(); } }, "✓ " + t().ok),
          el("button", { class: "badsel", "aria-pressed": String(st.ok === false), onclick: () => { st.ok = false; render(); } }, "⚠ " + t().notOk)));
        if (st.ok === false) {
          d.append(el("div", { class: "cl-chips", role: "group", "aria-label": t().which }, ...PROBLEMS.map(p => el("button", { "aria-pressed": String(st.problem === p), onclick: () => { st.problem = p; if (p === "locked" || p === "blocked") st.outcome ??= "not_emptied"; render(); } }, t().problems[p]))));
          const ta = el("textarea", { maxlength: 500, placeholder: t().note, "aria-label": t().note }); ta.value = st.note; ta.oninput = () => st.note = ta.value;
          const file = el("input", { type: "file", accept: "image/*", capture: "environment", class: "cl-sr", id: "cl-photo" });
          file.onchange = () => { st.photo = file.files[0] || null; render(); };
          d.append(ta, el("label", { class: "cl-btn", for: "cl-photo", style: "text-align:center;display:block" }, st.photo ? `${t().photoAgain} ✓` : `📷 ${t().photo}`), file);
        }
        d.append(el("h3", {}, "2 · " + t().q2), el("div", { class: "cl-big" },
          ...[["emptied", t().oEmptied], ["partial", t().oPartial], ["was_empty", t().oWasEmpty], ["not_emptied", t().oNot]].map(([k, l]) =>
            el("button", { "aria-pressed": String(st.outcome === k), class: k === "not_emptied" ? "badsel" : "", onclick: () => { st.outcome = k; if (!st.cansTouched) st.cans = k === "emptied" ? expected : k === "partial" ? Math.round(expected / 2) : 0; render(); } }, l))));
        if (st.outcome === "partial") d.append(el("div", { class: "cl-meta" }, t().howFullNow), el("div", { class: "cl-chips" }, ...[1, 2, 3].map(v => el("button", { "aria-pressed": String(st.fillAfter === v), onclick: () => { st.fillAfter = v; render(); } }, t().levels[v]))));
        if (st.outcome === "emptied" || st.outcome === "partial") {
          const out = el("output", {}, st.cans ?? 0);
          const bump = n => { st.cans = Math.max(0, Math.min(300, (st.cans || 0) + n)); st.cansTouched = true; out.value = st.cans; out.textContent = st.cans; };
          d.append(el("div", { class: "cl-meta" }, t().cansTaken), el("div", { class: "cl-stepper" }, el("button", { "aria-label": "−5", onclick: () => bump(-5) }, "−"), out, el("button", { "aria-label": "+5", onclick: () => bump(5) }, "+"), el("span", { class: "cl-note" }, t().value((st.cans || 0) * CAN_VALUE))));
        }
        d.append(el("div", { class: "cl-row" },
          el("button", { class: "cl-btn ghost", onclick: () => { S.dismissed.set(id, Date.now()); close(); } }, t().notNow)));
      };
      render();
    });
  }

  function openSettings() {
    modal((d, close) => {
      const chk = (key, label) => { const i = el("input", { type: "checkbox", id: "cl-" + key }); i.checked = !!S.set[key]; i.onchange = () => { S.set[key] = i.checked; saveSet(); if (key === "dark") retheme(); if (key === "wake") wake(); }; return el("label", { class: "cl-check", for: "cl-" + key }, i, label); };
      const bag = el("input", { type: "number", min: 5, max: 400, step: 5, id: "cl-bag" }); bag.value = S.set.bag || TRANSPORT[S.set.mode].bag; bag.onchange = () => { S.set.bag = Math.max(5, +bag.value || 40); saveSet(); replan(); };
      const rad = el("select", { id: "cl-rad" }, ...[20, 30, 50, 80].map(v => el("option", { value: v, selected: S.set.radius === v }, `${v} m`))); rad.onchange = () => { S.set.radius = +rad.value; saveSet(); };
      d.append(el("h2", {}, t().settings), el("div", { class: "cl-set" },
        el("label", { class: "l" }, t().language, seg([["da", "Dansk"], ["en", "English"]], S.lang, v => { S.lang = v; store.set("lang", v); close(); renderAll(); openSettings(); })),
        el("label", { class: "l", for: "cl-bag" }, t().bag, bag),
        el("label", { class: "l", for: "cl-rad" }, t().arriveRadius, rad),
        el("div", { class: "l" }, el("b", {}, t().endPoint), el("div", { class: "cl-row", style: "margin-top:6px" },
          el("button", { class: "cl-btn small", onclick: () => { S.pickingEnd = true; close(); renderBanner(); } }, t().endSet),
          S.set.end ? el("button", { class: "cl-btn small ghost", onclick: () => { S.set.end = null; saveSet(); map.setEnd(null); close(); replan(); } }, t().endClear) : el("span", { class: "cl-note" }, t().endNone))),
        chk("claim", t().claimToggle), chk("wake", t().wake), chk("dark", t().darkMap),
        cm.profileSection(),
        LIVE ? el("button", { class: "cl-btn", onclick: async () => { await signOut(); location.reload(); } }, t().logout)
             : el("button", { class: "cl-btn ghost", onclick: () => { clearCollectorDemo(); try { const placed = new Set(SNAKES.filter(x => x.lat != null).map(x => x.id)); const rows = JSON.parse(localStorage.getItem("snake-demo-reports") || "[]").filter(r => !placed.has(r.snake_id)); localStorage.setItem("snake-demo-reports", JSON.stringify(rows)); localStorage.removeItem("snake-demo-seeded-aar"); } catch {} seedCollectorDemo(); S.done.clear(); store.set("done-today", { day: "", ids: [] }); S.walkedM.m = 0; store.set("walked", S.walkedM); close(); loadVisits().then(() => refresh()); } }, t().resetDemo)),
        el("button", { class: "cl-btn primary", onclick: close }, t().done));
    });
  }

  let toastTimer = null;
  function toast(msg, action, fn) {
    toastHost.innerHTML = "";
    const box = el("div", { class: "cl-toast", role: "status" }, el("span", {}, msg), action ? el("button", { onclick: () => { fn(); toastHost.innerHTML = ""; } }, action) : "");
    toastHost.append(box); clearTimeout(toastTimer); toastTimer = setTimeout(() => toastHost.innerHTML = "", action ? 9000 : 3500);
  }

  // ---------- fabs, sign-in, start ----------
  fabs.append(
    el("button", { "aria-label": t().locate, title: t().locate, html: ICON.locate, onclick: () => { map._userPanned = false; if (S.me) map.setView(S.me.lat, S.me.lng, Math.max(map.z, 15)); } }),
    el("button", { "aria-label": t().zoomIn, html: ICON.plus, onclick: () => map.zoomAt(1) }),
    el("button", { "aria-label": t().zoomOut, html: ICON.minus, onclick: () => map.zoomAt(-1) }));
  function renderAll() { map.setNote?.(t().demoMap); renderTop(); renderBanner(); renderLegend(); renderSheet(); renderMarkers(); }

  async function boot() {
    seedCollectorDemo();
    S.session = await collectorSession();
    if (!S.session) return showLogin();
    if (LIVE && !["collector", "operator"].includes(S.session.role)) return showProfileSetup();   // signed in, no collector profile yet
    renderAll(); await loadVisits(); await refresh(true);
    if (S.set.end) map.setEnd(S.set.end);
    if (!LIVE) { setMe({ lat: 56.1556, lng: 10.2086, acc: 8, src: "sim" }); map.setView(56.1556, 10.2086, 13.6, false); }   // holds the place until the first real fix
    startGps();                                                                                                                // real phone GPS in every mode
    renderBanner(); flushQueue(); wake();
    setInterval(() => refresh(), LIVE ? 60000 : 20000);
    // tell other collectors which snakes I'm close to (snake ids only, never my position); expires after 10 minutes
    setInterval(() => { if (LIVE && S.shift && S.gps === "on" && S.me) reportNearby(S.snakes.filter(x => haversine(S.me, x) < 300).map(x => x.id)).catch(() => {}); }, 120000);
    addEventListener("storage", e => { if (e.key && e.key.startsWith("snake-demo")) refresh(); });
  }
  // sign in, or create a collector account (anyone can join; the operator dashboard is a separate, operator-only app)
  function showLogin(msg, mode = "in") {
    app.hidden = true; root.querySelector(".cl-login")?.remove();
    const err = el("p", { class: "cl-note", role: "alert", style: "color:var(--bad)" }, msg || "");
    const em = el("input", { type: "email", id: "cl-email", autocomplete: "username", placeholder: t().email }), pw = el("input", { type: "password", id: "cl-pw", autocomplete: mode === "in" ? "current-password" : "new-password", placeholder: t().password, minlength: 8 });
    const form = el("form", { onsubmit: async e => {
        e.preventDefault(); err.textContent = "";
        try {
          if (mode === "in") { await signIn(em.value.trim(), pw.value); location.reload(); }
          else { const r = await signUp(em.value.trim(), pw.value); if (r.session) location.reload(); else { err.style.color = "var(--accent)"; err.textContent = t().checkMail; } }
        } catch (x) { err.textContent = mode === "in" ? t().loginErr : String(x.message || x); } } },
      el("div", { class: "cl-brand" }, el("i"), "Pant Snake", el("span", {}, "· " + t().app)), el("h2", { style: "margin:0" }, mode === "in" ? t().loginTitle : t().signupTitle),
      mode === "up" ? el("p", { class: "cl-note" }, t().signupText) : "", em, pw,
      el("button", { class: "cl-btn primary", type: "submit" }, mode === "in" ? t().login : t().signup), err,
      el("button", { class: "cl-btn ghost", type: "button", onclick: () => showLogin("", mode === "in" ? "up" : "in") }, mode === "in" ? t().toSignup : t().toLogin));
    root.append(el("div", { class: "cl-login" }, form));
  }
  function showProfileSetup() {
    app.hidden = true; root.querySelector(".cl-login")?.remove();
    const box = el("div", { class: "cl-dialog", style: "border-radius:16px" }, el("div", { class: "cl-brand" }, el("i"), "Pant Snake", el("span", {}, "· " + t().app)), el("h2", {}, t().welcome), el("p", { class: "cl-note" }, t().welcomeText));
    const sec = cm.profileSection(); box.append(sec,
      el("button", { class: "cl-btn primary", onclick: async () => { location.reload(); } }, t().done),
      el("button", { class: "cl-btn ghost", onclick: async () => { await signOut(); location.reload(); } }, t().logout));
    root.append(el("div", { class: "cl-login" }, box));
  }
  boot();
  return { map, state: S, refresh, replan };
}
