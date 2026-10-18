// Collector app: map of every snake with its fill level, a planned collection route from where you stand,
// and a check-in at each snake ("all OK?" + "collected?") that updates the database.
// mountCollector(rootElement) builds the whole app inside rootElement (used by collector.html and the demo).
import { LIVE, SNAKES, designById, collectorSession, signIn, signUp, signOut, collectorMap, claimSnakes, releaseClaims, recordVisit, myVisits, clearCollectorDemo, seedCollectorDemo } from "./data.js";
import { MapView, MAPVIEW_CSS, loadDemoStreets } from "./mapview.js";
import { planRoute, routeCandidates, expectedCans, haversine, predictFill, TRANSPORT } from "./route.js";
import { createRouter, stepText, ARROW } from "./routing.js";
import { createCommunity, COMMUNITY_CSS } from "./community.js";
import { reportNearby } from "./data.js";
import { createShift, SHIFT_CSS } from "./shift.js";
import { createStats, STATS_CSS } from "./stats.js";
import { createLeague, LEAGUE_CSS } from "./league.js";

const CFG = window.SNAKE_CONFIG || {};
const CAN_VALUE = 1.1;                 // DKK per container on average (pant A = 1 kr, B = 1.50 kr)
const LEVEL_COL = ["#8C969C", "#7FB77E", "#3E9B5F", "#E3A21A", "#D2452F"];
const PROBLEMS = ["jam", "door", "locked", "damage", "glass", "litter", "graffiti", "blocked", "other"];

const AHEAD = 3;            // a collector sees only this many planned snakes; checking in at one reveals the next
const MENU_TXT = {
  da: { title: "Menu", back: "Tilbage", close: "Luk", more: "Læs mere", demo: "Demo: data gemmes kun i denne browser, og eksempler er markeret.",
    items: {
      stats: ["Statistik", "Dine ringe for i dag, ugen som søjler, din stime og hvad dine dåser har sparet af CO₂."],
      league: ["Liga", "Hver mandag dyster du mod 19 andre på dit niveau. De 5 bedste rykker op, de 5 nederste ned. Kun dåser, der er bevist ved en slange, tæller."],
      gear: ["Udstyr", "Det udstyr, der gør runderne lettere, og de butikker der sælger det. Rabatter kommer, når en butik bliver partner."],
      best: ["Bedste tid", "Hvornår der venter flest dåser pr. indsamler i de næste 12 timer."],
      how: ["Sådan virker det", "Tre trin og svar på de spørgsmål, indsamlere oftest stiller."],
      feedback: ["Feedback", "Fortæl os med tommel op eller ned, hvordan ruten, slangerne og appen var."],
      snakes: ["Mine slanger", "Slanger, du har tømt før. Her kan du finde problemer og blive sponsor."],
      alerts: ["Beskeder", "Besked når en slange, du sponsorerer, er fuld eller har et problem."],
      key: ["Kortforklaring", "Hvad farverne og tallene på kortet betyder."],
      settings: ["Indstillinger", "Transport, taske, slutpunkt, sprog og din profil."],
    } },
  en: { title: "Menu", back: "Back", close: "Close", more: "Read more", demo: "Demo: data stays in this browser, and examples are marked.",
    items: {
      stats: ["Stats", "Your rings for today, the week as bars, your streak, and the CO₂ your cans have saved."],
      league: ["League", "Every Monday you race 19 others at your level. The top 5 move up, the bottom 5 move down. Only cans proven at a snake count."],
      gear: ["Gear", "The gear that makes rounds easier and the shops that sell it. Discounts come when a shop becomes a partner."],
      best: ["Best time", "When the most cans per collector are waiting in the next 12 hours."],
      how: ["How it works", "Three steps, and answers to what collectors ask most."],
      feedback: ["Feedback", "Tell us with a thumbs up or down how the route, the snakes and the app were."],
      snakes: ["My snakes", "Snakes you have emptied before. Find problems here and become a sponsor."],
      alerts: ["Alerts", "A message when a snake you sponsor is full or has a problem."],
      key: ["Map key", "What the colours and numbers on the map mean."],
      settings: ["Settings", "Transport, bag, end point, language and your profile."],
    } },
};

// home sheet, slider, drawer, "how it works" and end-of-shift feedback
const UI = {
  da: { city: "Aarhus", fullNow: "Fulde slanger", demand: ["Få", "Nogle", "Mange"], chart: "Forventet fulde slanger", now: "NU", quick: "Genveje",
    slideStart: "Start min vagt", slideEnd: "Afslut min vagt", slideHint: "Skub for at starte", profile: "Indsamler", on: "På vagt", off: "Ikke på vagt",
    fbTitle: "Feedback", fb: [["route", "Ruten", "Passede ruten og tiderne?"], ["snakes", "Slangerne", "Var slangerne i god stand?"], ["app", "Appen", "Var appen nem at bruge?"]],
    fbComment: "Tilføj en kommentar", fbSend: "Send feedback", fbThanks: "Tak! Det hjælper os med at planlægge bedre.", fbSkip: "Spring over",
    howTitle: "Sådan virker det", howSteps: [["Skub for at starte", "Vælg hvor længe du kan samle. Appen planlægger en rute, der passer."],
      ["Følg tre slanger", "Du ser de næste tre slanger. Ruten ændrer sig selv, når slanger bliver fulde, eller en anden kommer først."],
      ["Tjek ind ved hver", "Ét tryk på \"Alt godt\", når du har tømt den. Så dukker den næste slange op."]],
    faqTitle: "Spørgsmål", faq: [["Hvorfor ser jeg kun tre slanger?", "Så ingen løber efter den samme slange. Du ser den næste, så snart du tjekker ind eller springer over."],
      ["Hvorfor ændrede min rute sig?", "En slange blev fuld, en anden indsamler kom først, eller tiden er ved at løbe ud. Linjen øverst på kortet siger hvorfor."],
      ["Bliver en slange holdt til mig?", "De tre slanger, du kan se, er reserveret til dig, mens din vagt kører. Andre ser dem som optaget."],
      ["Hvad hvis en slange er i stykker?", "Tryk \"Noget var anderledes\", når du tjekker ind, og vælg problemet. Så sender vi nogen ud."],
      ["Skal jeg selv stoppe min vagt?", "Skub for at afslutte i menuen. Ellers slutter den af sig selv tre timer efter det planlagte slut."]],
    plannerMore: "Se hvordan ruten planlægges" },
  en: { city: "Aarhus", fullNow: "Full snakes", demand: ["Few", "Some", "Many"], chart: "Expected full snakes", now: "NOW", quick: "Quick links",
    slideStart: "Start my shift", slideEnd: "End my shift", slideHint: "Slide to start", profile: "Collector", on: "On shift", off: "Off shift",
    fbTitle: "Feedback", fb: [["route", "Route", "Were the route and the times right?"], ["snakes", "Snakes", "Were the snakes in good shape?"], ["app", "App", "Was the app easy to use?"]],
    fbComment: "Add a comment", fbSend: "Send feedback", fbThanks: "Thanks! That helps us plan better.", fbSkip: "Skip",
    howTitle: "How it works", howSteps: [["Slide to start", "Pick how long you can collect. The app plans a route that fits."],
      ["Follow three snakes", "You see the next three snakes. The route changes by itself when snakes fill up or someone else gets there first."],
      ["Check in at each one", "One tap on \"All good\" when you have emptied it. Then the next snake appears."]],
    faqTitle: "FAQ", faq: [["Why can I only see three snakes?", "So nobody rushes to the same snake. You see the next one as soon as you check in or skip."],
      ["Why did my route change?", "A snake filled up, another collector got there first, or time is running out. The line at the top of the card says why."],
      ["Is a snake kept for me?", "The three snakes you can see are reserved for you while your shift runs. Others see them as taken."],
      ["What if a snake is broken or jammed?", "Tap \"Something was different\" when you check in and choose the problem. We send someone to fix it."],
      ["Do I have to stop my shift?", "Slide to end it in the menu. Otherwise it ends by itself three hours after the planned end."]],
    plannerMore: "See how routes are planned" },
};

const TXT = {
  da: {
    app: "Indsamler", startShift: "Start vagt", endShift: "Afslut vagt", onShift: "På vagt",
    startMyShift: "Start min vagt", stopMyShift: "Stop min vagt", shiftHint: "Vi finder den bedste rute til dig.", stopsLeft: n => `${n} stop tilbage`, allDone: "Færdig – godt gået!", newRoute: "Ny rute", somethingElse: "Noget var anderledes", findIt: "Slangen er markeret på kortet.", routeOptions: "Rute",
    tabRoute: "Rute", tabSnakes: "Slanger", tabToday: "Mine tal", tabRank: "Liga", tabKit: "Udstyr",
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
    allGood: "Alt godt", wrong: "Noget er galt", arrive: "Du er ved", away: m => `${m} m væk`, q1: "Er alt i orden med den?", ok: "Alt i orden", notOk: "Noget er galt", okBig: "OK – alt i orden og tømt", changeIfNot: "Er noget anderledes? Ret her:",
    which: "Hvad er galt?", note: "Kort besked (valgfri)", photo: "Tag foto", photoAgain: "Skift foto",
    q2: "Har du tømt den?", oEmptied: "Ja, tømt", oPartial: "Tog noget", oWasEmpty: "Den var tom", oNot: "Kunne ikke tømme",
    howFullNow: "Hvor fuld er den nu?", cansTaken: "Dåser taget (valgfrit)", save: "Gem", notNow: "Ikke nu",
    farWarn: m => `Din position er ${m} m fra slangen. Gem alligevel?`, saved: (c) => `Gemt${c ? ` · ${c} dåser` : ""}`, savedOffline: n => `Gemt på telefonen. Sendes når du har net (${n} venter)`,
    dupe: "Du har lige gemt denne slange.", error: "Kunne ikke gemme. Prøv igen.",
    todayVisits: "Besøg", todayCans: "Dåser og flasker", todayValue: "≈ værdi", todayKm: "Gået", week: "Seneste 7 dage", none: "Ingen besøg endnu i dag.",
    outcome: { emptied: "Tømt", partial: "Delvist tømt", was_empty: "Var tom", not_emptied: "Ikke tømt" },
    settings: "Indstillinger", language: "Sprog", arriveRadius: "Vis tjek-ind når jeg er inden for", endPoint: "Slutpunkt",
    endNone: "Intet slutpunkt", endSet: "Vælg på kortet", endPick: "Tryk på kortet for at sætte slutpunktet (fx en pantautomat).", endClear: "Fjern",
    lightMode: "Lyst tema", claimToggle: "Reservér slangerne på min rute, så andre indsamlere ser at jeg er på vej", wake: "Hold skærmen tændt på vagt", darkMap: "Mørkt kort",
    done: "Færdig", resetDemo: "Nulstil demo-data", gpsOff: "Placering er slået fra. Tryk på kortet for at vise hvor du er.",
    gpsWait: "Finder din placering…", gpsSim: "Demo: GPS er simuleret. Tryk på kortet for at flytte dig, eller lad demoen gå ruten.", walk: "Gå ruten", stopWalk: "Stop",
    replan: "Planlæg igen", menuRoutes: "Sådan planlægges ruten", newFull: (n, d) => `${n} er meldt fuld · ${d} væk`, addIt: "Tilføj", locate: "Vis min position", zoomIn: "Zoom ind", zoomOut: "Zoom ud",
    all: "Alle", fullish: "¾ +", withProblems: "Problemer", sortDist: "nærmest først",
    signupTitle: "Bliv indsamler", signupText: "Gratis. Du vælger selv et kaldenavn bagefter; vi viser aldrig din e-mail eller hvor du er.", signup: "Opret konto", toSignup: "Ny her? Opret en indsamlerkonto", toLogin: "Har du en konto? Log ind",
    checkMail: "Tjek din e-mail og bekræft adressen. Log så ind her.", welcome: "Velkommen!", welcomeText: "Vælg et kaldenavn og din hjemby. Kaldenavnet vises på ranglisterne (kan slås fra).",
    loginTitle: "Log ind som indsamler", email: "E-mail", password: "Adgangskode", login: "Log ind", logout: "Log ud", loginErr: "Login mislykkedes.",
    notStaff: "Dette login er ikke sat op som indsamler endnu. Bed driften om at tilføje dig.",
    endPointName: "Slutpunkt", you: "Dig", openProblems: n => `${n} åbne problem${n === 1 ? "" : "er"}`, lastEmptied: "Sidst tømt", never: "aldrig",
    demoMap: "Demokort: kun hovedgader", planning: "Planlægger ad gaderne…", rerouting: "Finder ny rute…", via: n => `Tider og afstande ad gaderne · ${n}`, inM: d => `om ${d}`, toSnake: "til slangen", then: "Derefter",
    srcName: { ors: "openrouteservice", osrm: "OSRM", graph: "indbygget gadenet (hovedgader)", straight: "luftlinje: ingen gade-router svarede" },
    mapFallback: "Kortet kunne ikke hentes. Viser det indbyggede kort over Aarhus.", noWebgl: "Kortet kræver WebGL, som er slået fra i denne browser.", gmaps: "Google Maps",
    replanning: "Planlægger ruten igen med de nyeste meldinger…", plannedAgo: m => m == null || m < 1 ? "Ruten er planlagt lige nu · opdateres løbende" : `Ruten er planlagt for ${m} min. siden · opdateres løbende`,
    whyTaken: n => `${n} bliver taget af en anden indsamler – ruten er ændret`, whyFull: n => `${n} er lige blevet fuld – lagt ind i din rute`, whyTime: "Ruten er tilpasset den tid, du har tilbage", whyData: "Ruten er opdateret med de nyeste fyldniveauer",
    revealed: n => `Næste slange: ${n}`, owedHint: n => `Svar på tjek-ind ved ${n} for at se de næste slanger.`, aheadHint: n => `${n} slange${n === 1 ? "" : "r"} mere er planlagt. Du ser den næste, når du tjekker ind.`, walkMin: m => `${m} min`, noMine: "Du har ikke tømt nogen slanger endnu. De dukker op her efter dit første besøg.",
    snakesWhat: "Hvad er listen til?", gotIt: "Forstået", searchPh: "Søg efter slange eller sted", noMatch: q => `Ingen slange matcher “${q}”.`,
    snakesUses: [["🧭", "Dine slanger", "Slanger, du har tømt før, nærmest først. Nye kommer på listen efter dit første besøg."], ["⚠️", "Find problemer", "Vælg Problemer for at se slanger, der sidder fast eller er i stykker, så du kan melde dem ordnet."], ["🌱", "Bliv sponsor", "Åbn en slange, du tømmer tit, for at se om du kan blive dens sponsor."]], emptyHint: "Tryk på en slange for detaljer.", value: v => `≈ ${Math.round(v)} kr`, level: "Niveau", checkIn: "Tjek ind", legendNum: "tal = ≈ dåser", legendHint: "Stiplet ring: ingen ny melding, niveauet er beregnet ud fra hvor hurtigt slangen plejer at fyldes",
  },
  en: {
    app: "Collector", startShift: "Start shift", endShift: "End shift", onShift: "On shift",
    startMyShift: "Start my shift", stopMyShift: "Stop my shift", shiftHint: "We find the best route for you.", stopsLeft: n => `${n} stop${n === 1 ? "" : "s"} left`, allDone: "All done – great job!", newRoute: "New route", somethingElse: "Something was different", findIt: "The can is marked on the map.", routeOptions: "Route",
    tabRoute: "Route", tabSnakes: "Snakes", tabToday: "My stats", tabRank: "League", tabKit: "Gear",
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
    allGood: "All good", wrong: "Something's wrong", arrive: "You're at", away: m => `${m} m away`, q1: "Is everything all right with it?", ok: "All OK", notOk: "Something's wrong", okBig: "OK – all good, emptied", changeIfNot: "Something different? Change it here:",
    which: "What's wrong?", note: "Short note (optional)", photo: "Take photo", photoAgain: "Change photo",
    q2: "Did you collect it?", oEmptied: "Yes, emptied", oPartial: "Took some", oWasEmpty: "It was empty", oNot: "Couldn't empty it",
    howFullNow: "How full is it now?", cansTaken: "Cans taken (optional)", save: "Save", notNow: "Not now",
    farWarn: m => `Your position is ${m} m from this snake. Save anyway?`, saved: (c) => `Saved${c ? ` · ${c} cans` : ""}`, savedOffline: n => `Saved on this phone. Will send when you're online (${n} waiting)`,
    dupe: "You just saved this snake.", error: "Couldn't save. Try again.",
    todayVisits: "Visits", todayCans: "Cans & bottles", todayValue: "≈ value", todayKm: "Walked", week: "Last 7 days", none: "No visits yet today.",
    outcome: { emptied: "Emptied", partial: "Partly emptied", was_empty: "Was empty", not_emptied: "Not emptied" },
    settings: "Settings", language: "Language", arriveRadius: "Show the check-in when I'm within", endPoint: "End point",
    endNone: "No end point", endSet: "Pick on map", endPick: "Tap the map to set where the route should end (a deposit machine, say).", endClear: "Remove",
    lightMode: "Light theme", claimToggle: "Reserve the snakes on my route so other collectors see I'm on my way", wake: "Keep the screen on during a shift", darkMap: "Dark map",
    done: "Done", resetDemo: "Reset demo data", gpsOff: "Location is off. Tap the map to show where you are.",
    gpsWait: "Finding your location…", gpsSim: "Demo: GPS is simulated. Tap the map to move, or let the demo walk the route.", walk: "Walk the route", stopWalk: "Stop",
    replan: "Re-plan now", menuRoutes: "How routes are planned", newFull: (n, d) => `${n} was reported full · ${d} away`, addIt: "Add", locate: "Show my position", zoomIn: "Zoom in", zoomOut: "Zoom out",
    all: "All", fullish: "¾ +", withProblems: "Problems", sortDist: "nearest first",
    signupTitle: "Become a collector", signupText: "Free. You pick a nickname next; we never show your email or where you are.", signup: "Create account", toSignup: "New here? Create a collector account", toLogin: "Have an account? Sign in",
    checkMail: "Check your email and confirm the address, then sign in here.", welcome: "Welcome!", welcomeText: "Pick a nickname and your home city. The nickname shows on the leaderboards (you can turn that off).",
    loginTitle: "Collector sign-in", email: "Email", password: "Password", login: "Sign in", logout: "Sign out", loginErr: "Sign-in failed.",
    notStaff: "This login isn't set up as a collector yet. Ask the operator to add you.",
    endPointName: "End point", you: "You", openProblems: n => `${n} open problem${n === 1 ? "" : "s"}`, lastEmptied: "Last emptied", never: "never",
    demoMap: "Demo map: main streets only", planning: "Planning along the streets…", rerouting: "Finding a new route…", via: n => `Times and distances along the streets · ${n}`, inM: d => `in ${d}`, toSnake: "to the snake", then: "Then",
    srcName: { ors: "openrouteservice", osrm: "OSRM", graph: "built-in street network (main streets)", straight: "straight lines: no street router answered" },
    mapFallback: "Couldn't load the map. Showing the built-in map of Aarhus.", noWebgl: "The map needs WebGL, which is turned off in this browser.", gmaps: "Google Maps",
    replanning: "Re-planning with the latest reports…", plannedAgo: m => m == null || m < 1 ? "Route planned just now · updates live" : `Route planned ${m} min ago · updates live`,
    whyTaken: n => `${n} is being collected by someone else, so your route changed`, whyFull: n => `${n} just filled up and was added to your route`, whyTime: "Route fitted to the time you have left", whyData: "Route updated with the latest fill levels",
    revealed: n => `Next snake: ${n}`, owedHint: n => `Answer the check-in at ${n} to see the next snakes.`, aheadHint: n => `${n} more snake${n === 1 ? " is" : "s are"} planned. You'll see the next one when you check in.`, walkMin: m => `${m} min`, noMine: "You haven't emptied any snakes yet. They appear here after your first visit.",
    snakesWhat: "What is this list for?", gotIt: "Got it", searchPh: "Search for a snake or a place", noMatch: q => `No snake matches “${q}”.`,
    snakesUses: [["🧭", "Your snakes", "Snakes you have emptied before, nearest first. New ones join the list after your first visit."], ["⚠️", "Find problems", "Choose Problems to see snakes that are jammed or broken, so you can report them fixed."], ["🌱", "Become a sponsor", "Open a snake you empty often to see whether you can become its sponsor."]], emptyHint: "Tap a snake for details.", value: v => `≈ DKK ${Math.round(v)}`, level: "Level", checkIn: "Check in", legendNum: "number = ≈ cans", legendHint: "Dashed ring: no recent report, level estimated from how fast this snake usually fills",
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
#col .cl-top{grid-row:1}#col .cl-banner{grid-row:2}#col .cl-mapwrap{grid-row:3}#col .cl-sheet{grid-row:4}   /* fixed rows: a hidden banner must not shift the map and the sheet up a row */
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
#col .cl-snakerow{grid-template-columns:76px minmax(0,1fr) auto}
#col .cl-dist{display:grid;gap:0;justify-items:start;padding-right:10px;border-right:1px solid var(--line)}
#col .cl-dist b{font-size:1.375rem;font-weight:800;line-height:1.1;color:var(--route);white-space:nowrap}
#col .cl-dist small{font-size:.8125rem;color:var(--muted);font-weight:600}
#col .cl-searchwrap{display:flex;align-items:center;gap:8px;border:1.5px solid var(--line);border-radius:14px;background:var(--bg);padding:0 12px;min-height:48px}
#col .cl-searchwrap span{font-size:1.25rem;color:var(--muted)}
#col .cl-searchwrap:focus-within{border-color:var(--route);box-shadow:0 0 0 2px var(--route)}
#col .cl-search:focus-visible{outline:none}
#col .cl-search{flex:1;min-width:0;border:0;background:transparent;font:16px var(--font);color:var(--ink);padding:10px 0;outline:none}
#col .cl-help{border-radius:18px;padding:12px 14px;background:color-mix(in srgb,var(--route) 8%,var(--card));border:1px solid color-mix(in srgb,var(--route) 25%,var(--line));display:grid;gap:8px}
#col .cl-help ul{list-style:none;margin:0;padding:0;display:grid;gap:8px}
#col .cl-help li{display:grid;grid-template-columns:28px minmax(0,1fr);gap:8px;align-items:start}
#col .cl-help .ic{font-size:20px;text-align:center}
#col .cl-help li b{display:block;font-size:.9375rem}
#col .cl-help small{display:block;color:var(--muted);font-size:.875rem}
#col .cl-help .cl-btn{justify-self:start}
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
@media (max-width:440px){.cl-top:has(.sh-timer) .cl-brand{font-size:0;gap:0}}
@media (max-width:420px){#col .cl-brand span{display:none}#col .cl-summary b{font-size:16px}}
/* ---- Design layer. Wolt: warm rounded type, soft cards, one dominant action, every tap answers back, calm and oriented.
   Apple HIG: clarity (big legible text), deference (content first, light chrome), depth (sheets, materials), 44 pt targets,
   safe areas, system text size, light/dark, reduced motion. ---- */
#col{--font:ui-rounded,"SF Pro Rounded","Nunito",system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;--mono:var(--font);--ease:cubic-bezier(.2,.8,.2,1);--r-card:18px;--r-btn:16px;
  font-size:1.0625rem;-webkit-text-size-adjust:100%;text-size-adjust:100%;-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
#col button{-webkit-tap-highlight-color:transparent;touch-action:manipulation}
#col .cl-top{padding:10px 16px}
#col .cl-banner{padding:10px 16px;font-size:14px}
#col .cl-legend,#col .cl-fabs button{background:color-mix(in srgb,var(--card) 82%,transparent);-webkit-backdrop-filter:saturate(180%) blur(16px);backdrop-filter:saturate(180%) blur(16px);border-color:color-mix(in srgb,var(--line) 60%,transparent)}
#col .cl-legend{border-radius:16px}
#col .cl-fabs button{width:48px;height:48px;border-radius:14px}
#col .cl-sheet{border-radius:24px 24px 0 0;border-top:0;box-shadow:0 -8px 30px rgba(20,30,25,.16);margin-top:-16px;position:relative;z-index:4}
#col .cl-sheet::before{content:"";display:block;flex:none;width:38px;height:5px;border-radius:3px;background:color-mix(in srgb,var(--muted) 45%,transparent);margin:8px auto 2px}
#col .maplibregl-ctrl-bottom-left,#col .maplibregl-ctrl-bottom-right{bottom:18px}   /* keep the map credits (Google, OpenStreetMap) clear of the rounded sheet */
#col .cl-tabs{overflow-x:auto;scrollbar-width:none}
#col .cl-tabs button{min-height:44px;padding:8px 14px;border-radius:14px;font-size:15px;white-space:nowrap;transition:background-color .18s var(--ease),color .18s}
#col .cl-icon{width:44px;height:44px;border-radius:14px}
#col .cl-summary div{border-radius:16px;padding:10px}
#col .cl-summary b{font-weight:800}
#col .cl-item{border-radius:var(--r-card);padding:12px 14px;border-color:color-mix(in srgb,var(--line) 70%,transparent);box-shadow:0 1px 2px rgba(20,30,25,.05),0 4px 14px rgba(20,30,25,.05);transition:transform .14s var(--ease),background-color .14s}
#col .cl-next{border-radius:22px;padding:14px 16px}
#col .cl-pill{padding:3px 10px}
#col .cl-btn{min-height:48px;border-radius:var(--r-btn);padding:10px 16px;font-weight:700;transition:transform .14s var(--ease),background-color .14s,box-shadow .14s}
#col .cl-btn.small{min-height:44px}
#col .cl-btn.primary{min-height:54px;font-size:1.0625rem;box-shadow:0 6px 16px color-mix(in srgb,var(--accent) 30%,transparent)}
#col .cl-btn.primary:disabled{box-shadow:none}
#col .cl-btn.cl-ok{min-height:92px;font-size:1.65rem;border-radius:24px;letter-spacing:-.01em;white-space:normal;line-height:1.15}
#col button:active:not(:disabled),#col .cl-item:active{transform:scale(.97)}
#col .cl-seg{border:0;border-radius:14px;padding:3px;gap:2px;background:var(--chip)}
#col .cl-seg button{min-height:44px;border-radius:11px;padding:6px 12px;font-size:15px;background:transparent;transition:background-color .18s var(--ease),color .18s}
#col .cl-seg button[aria-pressed="true"]{background:var(--ink);color:var(--bg);box-shadow:0 2px 6px rgba(0,0,0,.18)}
#col .cl-chips button{min-height:44px;font-size:15px;padding:8px 14px;transition:transform .14s var(--ease),background-color .18s}
#col .cl-big button{min-height:60px;border-radius:var(--r-card);transition:transform .14s var(--ease),background-color .18s,border-color .18s}
#col .cl-stepper button{width:52px;height:52px;border-radius:16px}
#col .cl-dialog{border-radius:26px 26px 0 0}
@media (max-width:899px){#col .cl-dialog::before{content:"";display:block;width:38px;height:5px;border-radius:3px;background:color-mix(in srgb,var(--muted) 45%,transparent);margin:0 auto 4px}}
@media (min-width:900px){#col .cl-dialog{border-radius:26px}}
#col .cl-dialog h2{font-size:1.6rem;font-weight:800;letter-spacing:-.02em}
#col .cl-dialog h3{font-size:1.0625rem;font-weight:700}
@keyframes cl-bump{0%{transform:scale(1)}35%{transform:scale(1.22)}100%{transform:scale(1)}}
@keyframes cl-sheet-up{from{transform:translateY(32px);opacity:0}to{transform:none;opacity:1}}
@keyframes cl-fade{from{opacity:0}to{opacity:1}}
#col .cl-stepper output.bump{animation:cl-bump .28s var(--ease)}
#col .cl-modal{animation:cl-fade .18s ease-out}
#col .cl-dialog{animation:cl-sheet-up .32s var(--ease)}
#col .cl-start{display:grid;gap:14px;justify-items:center;text-align:center;padding:6px 2px}
#col .cl-startbtn{width:100%;min-height:128px;border-radius:30px;border:0;background:var(--accent);color:var(--accent-ink);font-size:2rem;font-weight:800;letter-spacing:-.015em;box-shadow:0 14px 30px color-mix(in srgb,var(--accent) 38%,transparent);transition:transform .14s var(--ease)}
#col .cl-modal.peek{background:transparent;pointer-events:none;animation:none}
#col .cl-modal.peek .cl-dialog{pointer-events:auto;max-height:min(58%,420px);box-shadow:0 -12px 40px rgba(0,0,0,.28);padding-top:10px;gap:8px}
#col .cl-modal.peek .cl-stripe{display:none}
#col .cl-modal.peek .cl-dialog h2{font-size:1.35rem}
#col .cl-modal.peek .cl-btn.cl-ok{min-height:76px;font-size:1.45rem;margin:4px 0 0}
#col.arriving .cl-nav,#col.arriving .cl-legend{display:none!important}
/* ---- Map first (Oct 2026): the map fills the whole phone, everything else floats on it. ---- */
#col .cl-app{display:block;padding-top:0}
#col .cl-mapwrap{position:absolute;inset:0}
#col .cl-legend{display:none!important}
#col .cl-top{position:absolute;z-index:6;left:0;right:0;top:0;border:0;background:transparent;pointer-events:none;padding:calc(env(safe-area-inset-top,0px) + 12px) calc(env(safe-area-inset-right,0px) + 12px) 0 calc(env(safe-area-inset-left,0px) + 12px)}
#col .cl-top > *{pointer-events:auto}
#col .cl-brandpill,#col .cl-timerbtn,#col .cl-menubtn{background:color-mix(in srgb,var(--card) 88%,transparent);-webkit-backdrop-filter:saturate(180%) blur(16px);backdrop-filter:saturate(180%) blur(16px);border:1px solid color-mix(in srgb,var(--line) 60%,transparent);box-shadow:0 4px 16px rgba(20,30,25,.16)}
#col .cl-brandpill{display:inline-flex;align-items:center;gap:8px;min-height:48px;padding:0 16px 0 10px;border-radius:999px;font-weight:800;letter-spacing:-.01em}
#col .cl-brandpill i{width:24px;height:24px;border-radius:50%;background:conic-gradient(var(--accent) 0 75%,var(--line) 0);display:grid;place-items:center}
#col .cl-brandpill i::after{content:"";width:12px;height:12px;border-radius:50%;background:var(--card)}
#col .cl-timerbtn{min-height:48px;border-radius:999px;padding:0 16px;display:inline-flex;align-items:center;font-weight:700}
#col .cl-menubtn{position:relative;width:52px;height:52px;border-radius:16px;display:grid;place-items:center;padding:0}
#col .cl-menubtn svg{width:24px;height:24px}
#col .cl-menubtn em{position:absolute;right:-4px;top:-4px;min-width:20px;height:20px;border-radius:10px;background:var(--bad);color:#fff;font:700 12px/20px var(--font);font-style:normal;padding:0 5px;text-align:center}
#col .cl-banner{position:absolute;z-index:5;left:50%;transform:translateX(-50%);top:calc(env(safe-area-inset-top,0px) + 72px);width:max-content;max-width:calc(100% - 24px);border:0;border-radius:999px;padding:6px 8px 6px 14px;box-shadow:0 4px 16px rgba(20,30,25,.16);background:color-mix(in srgb,var(--card) 92%,transparent);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px)}
#col .cl-fabs{top:auto;bottom:calc(var(--sheet-h,160px) + 12px);right:calc(env(safe-area-inset-right,0px) + 12px)}
#col .cl-nav{top:calc(env(safe-area-inset-top,0px) + 74px);left:12px;right:12px}
#col .cl-app:has(.cl-nav:not([hidden])) .cl-banner{top:auto;bottom:calc(var(--sheet-h,160px) + 12px)}
#col .cl-sheet{position:absolute;z-index:4;left:0;right:0;bottom:0;margin:0;max-height:62vh;overflow-y:auto;padding:4px 12px calc(env(safe-area-inset-bottom,0px) + 12px);background:transparent;box-shadow:none;border-radius:0;pointer-events:none}
#col .cl-sheet::before{display:none}
#col .cl-sheet > *{pointer-events:auto}
#col .cl-sheet .cl-startbtn{min-height:84px;font-size:1.65rem;border-radius:26px;display:flex;align-items:center;justify-content:center;gap:12px;box-shadow:0 14px 34px color-mix(in srgb,var(--accent) 40%,transparent),0 2px 0 rgba(255,255,255,.15) inset}
#col .cl-sheet .cl-next{min-width:0;grid-template-columns:minmax(0,1fr);background:var(--card);border:0;border-radius:26px;box-shadow:0 -6px 30px rgba(20,30,25,.2);padding:12px 14px 14px;gap:10px}
#col .cl-planstrip{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:var(--muted);min-height:32px}
#col .cl-planstrip > i{width:10px;height:10px;border-radius:50%;background:var(--accent);flex:none;box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 25%,transparent)}
#col .cl-planstrip.busy > i{background:transparent;border:2px solid var(--route);border-right-color:transparent;box-shadow:none;animation:clspin .8s linear infinite}
#col .cl-planstrip span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#col .cl-mini{width:36px;height:36px;min-width:36px;border-radius:12px;border:0;background:var(--chip);display:grid;place-items:center;font-size:17px;font-weight:700;padding:0}
#col .cl-mini:disabled{opacity:.4}
#col .cl-nexthead{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center}
#col .cl-nexthead .n,#col .cl-ahead .n{width:30px;height:30px;border-radius:50%;background:var(--route);color:#fff;display:grid;place-items:center;font-weight:800;font-size:14px}
#col .cl-nexthead h3{margin:0;font-size:1.25rem;line-height:1.15;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#col .cl-nexthead .cl-meta{align-items:center;margin-top:3px;flex-wrap:nowrap;overflow:hidden;white-space:nowrap}
#col .cl-dist.big{border:0;padding:0;justify-items:end}
#col .cl-dist.big b{font-size:1.75rem;line-height:1}
#col .cl-ahead{list-style:none;margin:0;padding:8px 0 0;border-top:1px solid var(--line);display:grid;gap:6px}
#col .cl-ahead li{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center;padding:4px 2px;border-radius:12px}
#col .cl-ahead .n{width:24px;height:24px;font-size:12px;background:color-mix(in srgb,var(--route) 55%,var(--card))}
#col .cl-ahead b{display:block;font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#col .cl-ahead small{color:var(--muted);font-size:13px}
#col .cl-ahead .c{font-weight:700;color:var(--muted);font-size:14px}
#col .cl-demowalk{border:0;background:transparent;color:var(--route);font-weight:700;font-size:14px;min-height:36px;padding:0}
#col .cl-next > .cl-note{text-align:center;font-size:12.5px}
@keyframes cl-fresh{0%{background:color-mix(in srgb,var(--accent) 28%,transparent)}100%{background:transparent}}
@keyframes cl-pinpop{0%{transform:scale(.4);opacity:0}60%{transform:scale(1.2);opacity:1}100%{transform:scale(1)}}
#col .cl-planstrip.fresh{animation:cl-fresh 2.4s var(--ease);border-radius:10px;color:var(--ink)}
#col .cl-ahead li.fresh{animation:cl-fresh 2.4s var(--ease)}
#col .cl-next.fresh .cl-nexthead{animation:cl-fresh 2.4s var(--ease);border-radius:14px}
#col .cl-pin.fresh{animation:cl-pinpop .6s var(--ease)}
#col.arriving .cl-sheet{display:none}
#col .cl-toast{bottom:auto;top:calc(env(safe-area-inset-top,0px) + 72px)}   /* at the top, so it never covers the snakes ahead */
/* the menu: full screen on a phone, a drawer from the right on a big screen */
#col .cl-menu{position:absolute;inset:0;z-index:15;background:rgba(10,15,12,.35);display:flex;justify-content:flex-end;animation:cl-fade .18s ease-out}
#col .cl-menupanel{background:var(--bg);width:100%;height:100%;overflow-y:auto;padding:calc(env(safe-area-inset-top,0px) + 10px) 16px calc(env(safe-area-inset-bottom,0px) + 20px);display:grid;gap:14px;align-content:start;animation:cl-drawer .28s var(--ease)}
@keyframes cl-drawer{from{transform:translateX(40px);opacity:0}to{transform:none;opacity:1}}
#col .cl-menuhead{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:8px;position:sticky;top:calc(-10px - env(safe-area-inset-top,0px));background:var(--bg);z-index:1;padding:4px 0}
#col .cl-menuhead h2{margin:0;text-align:center;font-size:1.25rem;font-weight:800;letter-spacing:-.01em}
#col .cl-menuhead .cl-icon{font-size:22px;background:var(--card)}
#col .cl-menubody{display:grid;gap:12px;align-content:start;min-width:0}
#col .cl-menulist{list-style:none;margin:0;padding:6px;display:grid;gap:2px;background:var(--card);border-radius:22px;box-shadow:0 1px 2px rgba(20,30,25,.05),0 4px 14px rgba(20,30,25,.05)}
#col .cl-menulist li + li{border-top:1px solid color-mix(in srgb,var(--line) 60%,transparent)}
#col .cl-menurow{display:flex;align-items:center;gap:6px}
#col .cl-menugo{flex:1;min-width:0;display:flex;align-items:center;gap:12px;border:0;background:transparent;text-align:left;padding:12px 8px;min-height:56px;border-radius:14px}
#col .cl-menugo .ic{font-size:22px;width:30px;text-align:center}
#col .cl-menugo b{flex:1;font-size:1.0625rem;font-weight:700}
#col .cl-menugo em{min-width:22px;height:22px;border-radius:11px;background:var(--bad);color:#fff;font:700 12px/22px var(--font);font-style:normal;text-align:center;padding:0 6px}
#col .cl-menugo .chev{color:var(--muted);font-size:22px}
#col .cl-menurow .cl-mini{background:transparent;color:var(--muted)}
#col .cl-menurow .cl-mini[aria-expanded="true"]{background:var(--chip);color:var(--route)}
#col .cl-menumore{margin:0 8px 12px 50px;font-size:14px;color:var(--muted);line-height:1.45}
#col .cl-readmore{background:var(--card);border-radius:16px;padding:10px 14px;font-size:14px}
#col .cl-readmore summary{cursor:pointer;font-weight:700;color:var(--route);list-style:none;min-height:28px;display:flex;align-items:center;gap:6px}
#col .cl-readmore summary::-webkit-details-marker{display:none}
#col .cl-readmore summary::before{content:"ⓘ"}
#col .cl-readmore p{margin:8px 0 2px;color:var(--muted);line-height:1.45}
#col .cl-keylist{list-style:none;margin:0;padding:12px 14px;display:grid;gap:10px;background:var(--card);border-radius:18px}
#col .cl-keylist li{display:flex;gap:10px;align-items:center;font-size:15px}
#col .cl-keylist i{width:16px;height:16px;border-radius:50%;flex:none}
@media (max-height:700px){
  #col .cl-sheet .cl-next{gap:7px;padding:10px 12px 10px}
  #col .cl-next > .cl-note{display:none}
  #col .cl-sheet .cl-btn.primary,#col .cl-sheet .cl-btn.ghost{min-height:48px}
  #col .cl-ahead{gap:2px;padding-top:6px}
  #col .cl-ahead li{padding:2px}
  #col .cl-fabs button:not(:first-child){display:none}   /* pinch to zoom; keep only "show me" */
}
@media (min-width:900px){
  #col .cl-app{display:block}
  #col .cl-sheet{left:calc(env(safe-area-inset-left,0px) + 16px);right:auto;width:420px;bottom:16px;padding:0;max-height:calc(100% - 110px)}
  #col .cl-mapwrap{grid-column:auto;grid-row:auto}
  #col .cl-fabs{bottom:48px;right:16px}
  #col .cl-nav{left:452px;right:auto;width:min(440px,calc(100% - 540px))}
  #col .cl-menu{background:rgba(10,15,12,.2)}
  #col .cl-menupanel{width:440px;box-shadow:-12px 0 40px rgba(0,0,0,.2)}
}

/* ---- Night-shift look (Oct 2026): dark navy by default, round floating buttons, a home sheet with a slider. ---- */
#col#col.dk{--bg:#0B0F1A;--card:#161B28;--ink:#EEF1F7;--muted:#97A0B3;--line:#283043;--accent:#3FCF8E;--accent-ink:#04170D;--route:#6EA8FF;--warn:#F2A93B;--bad:#FF6B57;--chip:#212839;--shadow:0 10px 30px rgba(0,0,0,.5);color-scheme:dark}
#col#col.lt{--bg:#F4F2EC;--card:#FFFFFF;--ink:#15201B;--muted:#5B665F;--line:#DAD6CC;--accent:#0F5D3A;--accent-ink:#FFFFFF;--route:#1D4ED8;--warn:#B45309;--bad:#C2410C;--chip:#EEEBE3;--shadow:0 10px 30px rgba(20,30,25,.18);color-scheme:light}
#col .cl-menubtn,#col .cl-top .cl-round{width:56px;height:56px;border-radius:50%;display:grid;place-items:center;padding:0;background:color-mix(in srgb,var(--card) 92%,transparent);border:1px solid color-mix(in srgb,var(--line) 70%,transparent);box-shadow:0 6px 18px rgba(0,0,0,.28);color:var(--ink);position:relative}
#col .cl-top .cl-round svg{width:24px;height:24px}
#col .cl-top .cl-round em{position:absolute;right:10px;top:10px;min-width:12px;height:12px;border-radius:6px;background:var(--bad);font-size:0;padding:0;border:2px solid var(--card)}
#col .cl-top{align-items:flex-start}
#col .cl-timerbtn{margin-top:4px}
/* home sheet */
#col .cl-home{background:var(--card);border-radius:28px;box-shadow:0 -10px 34px rgba(0,0,0,.32);padding:6px 16px 16px;display:grid;gap:12px}
#col .cl-grab{width:100%;height:22px;border:0;background:transparent;padding:0;display:grid;place-items:center}
#col .cl-grab::before{content:"";width:44px;height:5px;border-radius:3px;background:color-mix(in srgb,var(--muted) 55%,transparent)}
#col .cl-homehead{border:0;background:transparent;text-align:left;padding:0;display:grid;gap:2px;color:var(--ink)}
#col .cl-homehead h2{margin:0;font-size:2rem;font-weight:800;letter-spacing:-.02em;line-height:1.05}
#col .cl-demand{margin:0;display:flex;align-items:center;gap:8px;font-size:1.0625rem;color:var(--muted)}
#col .cl-demand b{color:var(--ink);font-weight:700}
#col .cl-lvl{display:inline-flex;align-items:flex-end;gap:2px;height:16px}
#col .cl-lvl i{width:4px;border-radius:1px;background:color-mix(in srgb,var(--muted) 45%,transparent)}
#col .cl-lvl i:nth-child(1){height:6px}#col .cl-lvl i:nth-child(2){height:11px}#col .cl-lvl i:nth-child(3){height:16px}
#col .cl-lvl.l0 i:nth-child(1){background:var(--bad)}
#col .cl-lvl.l1 i:nth-child(-n+2){background:var(--warn)}
#col .cl-lvl.l2 i{background:var(--accent)}
#col .cl-chart{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:6px;height:150px;align-items:end;padding-top:30px;border-bottom:1px solid var(--line);position:relative}
#col .cl-chart span{position:relative;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center}
#col .cl-chart i{width:100%;border-radius:6px 6px 2px 2px;background:color-mix(in srgb,var(--muted) 55%,transparent)}
#col .cl-chart span.now i{background:var(--accent)}
#col .cl-chart small{position:absolute;bottom:-20px;left:0;font-size:11px;color:var(--muted);white-space:nowrap}
#col .cl-chart em{position:absolute;top:-28px;left:50%;transform:translateX(-30%);font:700 11px var(--font);font-style:normal;letter-spacing:.06em;background:var(--ink);color:var(--bg);border-radius:999px;padding:3px 8px}
#col .cl-chartkey{margin:14px 0 0;display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
#col .cl-chartkey i{width:12px;height:12px;border-radius:3px;background:color-mix(in srgb,var(--muted) 55%,transparent)}
#col .cl-quickh{margin:6px 0 0;font-size:1.25rem;font-weight:800}
#col .cl-quick{list-style:none;margin:0;padding:0}
#col .cl-quick li + li{border-top:1px solid var(--line)}
#col .cl-quick button{width:100%;display:flex;align-items:center;gap:14px;border:0;background:transparent;padding:14px 2px;min-height:56px;text-align:left;color:var(--ink)}
#col .cl-quick b{flex:1;font-size:1.0625rem;font-weight:600}
#col .cl-quick .ic,#col .cl-quick .chev{display:grid;color:var(--muted)}
/* slider */
#col .cl-slide{position:relative;width:100%;height:76px;border:0;border-radius:999px;padding:0;background:color-mix(in srgb,var(--accent) calc(55% + var(--p,0) * 45%),var(--card));color:var(--accent-ink);touch-action:none;user-select:none;-webkit-user-select:none;overflow:hidden;box-shadow:0 10px 26px color-mix(in srgb,var(--accent) 30%,transparent)}
#col .cl-slide .lbl{position:absolute;inset:0;display:grid;place-items:center;padding-left:56px;font-size:1.35rem;font-weight:800;letter-spacing:-.01em;opacity:calc(1 - var(--p,0) * 1.4);pointer-events:none}
#col .cl-knob{position:absolute;left:6px;top:6px;width:64px;height:64px;border-radius:50%;background:var(--bg);color:var(--accent);display:grid;place-items:center;box-shadow:0 2px 8px rgba(0,0,0,.25);transition:transform .25s var(--ease)}
#col .cl-knob svg{width:30px;height:30px;stroke-width:2.6}
#col .cl-slide.drag .cl-knob{transition:none}
#col .cl-slide:active:not(:disabled){transform:none}
@keyframes cl-nudge{0%,100%{transform:translateX(0)}40%{transform:translateX(26px)}70%{transform:translateX(8px)}}
#col .cl-slide.hint .cl-knob{animation:cl-nudge .6s var(--ease)}
#col .cl-slide.end{background:color-mix(in srgb,var(--bad) calc(30% + var(--p,0) * 70%),#3A0D0A);color:#FFD9D2;box-shadow:none;margin-top:6px}
#col .cl-slide.end .cl-knob{background:#FF8A78;color:#3A0D0A}
/* the drawer: from the left, an icon and one word per row */
#col .cl-menu{justify-content:flex-start;background:rgba(0,0,0,.45)}
#col .cl-menupanel{width:min(86%,380px);box-shadow:12px 0 40px rgba(0,0,0,.35);animation:cl-drawer-l .28s var(--ease);background:var(--bg)}
@keyframes cl-drawer-l{from{transform:translateX(-40px);opacity:0}to{transform:none;opacity:1}}
#col .cl-menulist{background:transparent;box-shadow:none;padding:0}
#col .cl-menulist li + li{border-top:1px solid var(--line)}
#col .cl-menugo{padding:14px 2px;min-height:60px}
#col .cl-menugo .ic{display:grid;place-items:center;width:28px;color:var(--ink)}
#col .cl-menugo b{font-weight:500;font-size:1.125rem}
#col .cl-menugo .chev{display:none}
#col .cl-menumore{margin:0 4px 14px 44px}
#col .cl-profile{display:flex;align-items:center;gap:14px;padding:6px 2px 14px;border-bottom:1px solid var(--line)}
#col .cl-profile .ic{display:grid;place-items:center;width:28px}
#col .cl-profile b{display:block;font-size:1.125rem;font-weight:600}
#col .cl-profile small{color:var(--muted);font-size:.95rem}
#col .cl-profile small.on{color:var(--accent)}
/* how it works */
#col .cl-steps{list-style:none;margin:0;padding:0;display:grid;gap:22px}
#col .cl-steps li{display:grid;grid-template-columns:44px minmax(0,1fr);gap:14px;align-items:start}
#col .cl-steps .n{width:40px;height:40px;border-radius:50%;background:color-mix(in srgb,var(--accent) 18%,var(--bg));color:var(--accent);display:grid;place-items:center;font-weight:800;font-size:1.1rem}
#col .cl-steps b{display:block;font-size:1.125rem;font-weight:700;margin-bottom:3px}
#col .cl-steps small{display:block;color:var(--muted);font-size:1rem;line-height:1.45}
#col .cl-faqh{margin:12px 0 0;font-size:1.35rem;font-weight:800}
#col .cl-faq details{border-bottom:1px solid var(--line)}
#col .cl-faq summary{list-style:none;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:12px;padding:16px 0;font-size:1.0625rem;font-weight:600;min-height:56px}
#col .cl-faq summary::-webkit-details-marker{display:none}
#col .cl-faq summary::after{content:"";width:9px;height:9px;border-right:2px solid var(--muted);border-bottom:2px solid var(--muted);transform:rotate(45deg) translateY(-3px);flex:none;transition:transform .2s var(--ease)}
#col .cl-faq details[open] summary::after{transform:rotate(225deg) translateY(-3px)}
#col .cl-faq p{margin:0 0 16px;color:var(--muted);line-height:1.5}
/* feedback */
#col .cl-fbq + .cl-fbq{margin-top:10px}
#col .cl-cardhead{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
#col .cl-cardhead h2{margin:0}
#col .cl-cardsub{display:block;margin-top:2px;font-size:1.25rem;font-weight:800;color:var(--route)}
#col .cl-x{width:40px;height:40px;flex:none;border-radius:50%;border:0;background:var(--chip);color:var(--muted);font-size:16px;display:grid;place-items:center;padding:0}
#col .cl-btn.cl-wrong{width:100%;min-height:56px;font-size:1.0625rem}
#col .cl-home .cl-slide{position:sticky;bottom:0;z-index:1}
#col#col.dk .cl-nav{background:#2A57C6}
#col .cl-fbq{display:grid;gap:6px;justify-items:center;text-align:center}
#col .cl-fbq h3{margin:0;font-size:1.2rem}
#col .cl-fbq p{margin:0 0 4px;color:var(--muted)}
#col .cl-thumbs{display:grid;grid-template-columns:1fr 1fr;width:100%;border-radius:999px;overflow:hidden;background:var(--chip)}
#col .cl-thumbs button{border:0;background:transparent;min-height:64px;display:grid;place-items:center;color:var(--ink)}
#col .cl-thumbs button + button{border-left:1px solid var(--line)}
#col .cl-thumbs button svg{width:28px;height:28px}
#col .cl-thumbs button[aria-pressed="true"]{background:color-mix(in srgb,var(--accent) 28%,var(--chip));color:var(--accent)}
#col .cl-thumbs button + button[aria-pressed="true"]{background:color-mix(in srgb,var(--bad) 25%,var(--chip));color:var(--bad)}
@media (prefers-reduced-motion: reduce){#col *{transition:none!important;animation:none!important}}
`;

const ICON = {
  i_stats: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19h16M5 15l4-5 4 3 6-7"/></svg>`,
  i_league: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h8v4a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 12v4M8 20h8M10 16h4v4h-4z"/></svg>`,
  i_gear: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8h12l-1 12H7zM9 8a3 3 0 0 1 6 0"/></svg>`,
  i_best: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`,
  i_how: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.01"/></svg>`,
  i_snakes: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/></svg>`,
  i_key: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5"/></svg>`,
  i_settings: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>`,
  i_feedback: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 11v9H4v-9zM7 11l4-8a2 2 0 0 1 2 2v4h5.5a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.3 20H7"/></svg>`,
  i_down: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 13V4h3v9zM17 13l-4 8a2 2 0 0 1-2-2v-4H5.5a2 2 0 0 1-2-2.3l1.2-7A2 2 0 0 1 6.7 4H17"/></svg>`,
  i_user: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>`,
  i_arrow: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>`,

  locate: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>`,
  plus: `<svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`,
  minus: `<svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 12h14"/></svg>`,
  gear: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>`,
  menu: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>`,
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
  if (!document.getElementById("collector-css")) document.head.append(el("style", { id: "collector-css", html: MAPVIEW_CSS + CSS + COMMUNITY_CSS + SHIFT_CSS + STATS_CSS + LEAGUE_CSS }));
  root.id = "col"; root.innerHTML = "";
  const store = { get(k, d) { try { const v = localStorage.getItem("collector-" + k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem("collector-" + k, JSON.stringify(v)); } catch {} } };
  const S = {
    lang: store.get("lang", (navigator.language || "da").startsWith("da") ? "da" : "en"),
    set: Object.assign({ mode: "walk", bag: null, minutes: 60, minFill: 3, radius: 30, claim: true, wake: true, dark: false, end: null }, store.get("settings", {})),
    snakes: [], plan: null, routeOn: false, done: new Set(store.get("done-today", { day: "", ids: [] }).day === new Date().toDateString() ? store.get("done-today", {}).ids : []),
    skipped: new Set(), mustInclude: [], me: null, gps: "wait", shift: freshShift(store.get("shift", null)), visits: [], dismissed: new Map(), tab: "route",
    filter: "all", walking: false, pickingEnd: false, focus: null, queue: store.get("queue", []), lastFull: new Set(), session: null, walkedM: store.get("walked", { day: "", m: 0 }),
    geo: null, planning: false, planStart: null, routeSrc: null,
  };
  if (S.walkedM.day !== new Date().toDateString()) S.walkedM = { day: new Date().toDateString(), m: 0 };
  const t = () => TXT[S.lang];
  const cm = createCommunity({ el, S, modal: (...a) => modal(...a), toast: (...a) => toast(...a), byId: id => byId(id), seg: (...a) => seg(...a), renderSheet: () => renderMenu(), refresh: () => refresh(), focusSnake: id => focusSnake(id), openSnake: id => openSnake(id) });
  const saveSet = () => store.set("settings", S.set);
  const sh = createShift({ el, S, store, modal: (...a) => modal(...a), toast: (...a) => toast(...a), seg: (...a) => seg(...a), saveSet, preview: m => previewPlan(m) });
  const stats = createStats({ el, S, store, cm, byId: id => byId(id), snakeMeta: id => snakeMeta(id), t: () => t(), shiftText: () => sh.text() });
  const league = createLeague({ el, S, seg: (...a) => seg(...a), renderSheet: () => renderMenu() });

  // a shift is over 3 hours after its planned end (the phone was closed without stopping it)
  function freshShift(sh) {
    if (!sh || Date.now() - new Date(sh.start).getTime() <= ((sh.planned || 60) + 180) * 6e4) return sh;
    store.set("shift", null); return null;
  }
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
  const sheet = el("section", { class: "cl-sheet" });          // the dock: one Start button, or the three snakes ahead
  const menu = el("div", { class: "cl-menu", hidden: true, role: "dialog", "aria-modal": "true" });
  menu.addEventListener("keydown", e => { if (e.key === "Escape") closeMenu(); });
  menu.addEventListener("click", e => { if (e.target === menu) closeMenu(); });
  app.append(mapWrap, top, banner, sheet, menu);
  const modalHost = el("div"); const toastHost = el("div");
  root.append(app, modalHost, toastHost);

  const dark = () => !S.set.light;
  root.classList.toggle("dk", !S.set.light); root.classList.toggle("lt", !!S.set.light);
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
  const retheme = () => { root.classList.toggle("dk", !S.set.light); root.classList.toggle("lt", !!S.set.light); map.setColors(mapColors(dark())); map.setDark(dark()); };
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

  async function refresh(first = false, quiet = false) {
    try { S.snakes = await collectorMap(); } catch (e) { console.error(e); toast(t().error); return; }
    // alert: snakes that just became ¾+ and are close
    if (!first && S.me) for (const s of S.snakes) {
      const lv = levelOf(s.fill_level), was = S.lastFull.has(s.id);
      if (lv >= 3 && !was && minutesSince(s.fill_at) < 30 && !S.plan?.stops.some(x => x.id === s.id)) {
        const d = haversine(S.me, s); if (d < 2000) toast(t().newFull(s.design_name, fmtM(d)), t().addIt, () => { S.mustInclude.push(s.id); replan(); });
      }
    }
    S.lastFull = new Set(S.snakes.filter(s => levelOf(s.fill_level) >= 3).map(s => s.id));
    renderMarkers();
    if (!S.plan || first) replan(); else if (S.routeOn && !quiet && planSig() !== lastSig) replanLive("data"); else renderSheet();
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
    const opts = { start, end: S.set.end, snakes: sn, mode: S.set.mode, bag: S.set.bag || undefined, minutes: S.shift ? Math.max(15, sh.remainingMin()) : S.set.minutes, minFill: S.set.minFill, mustInclude: S.mustInclude.filter(id => !S.done.has(id)) };
    let cand = routeCandidates(opts);
    if (cand.length > 48) cand = cand.sort((a, b) => haversine(start, a) - haversine(start, b)).slice(0, 48);     // keeps a matrix request under the free-tier size limit
    if (!S.plan) S.plan = topUp(planRoute({ ...opts, snakes: cand }), start, sn);                                                     // instant first guess while the streets load
    S.planning = true; renderSheet();
    let matrix = null;
    try { matrix = await streetMatrix([{ lat: start.lat, lng: start.lng, id: null }, ...cand, ...(S.set.end ? [S.set.end] : [])], S.set.mode); } catch (e) { console.warn(e); }
    if (seq !== planSeq) return;
    S.plan = topUp(planRoute({ ...opts, snakes: cand, matrix }), start, sn); S.planStart = { ...start }; S.routeSrc = matrix?.source || "straight";
    renderMarkers(); renderSheet();
    await routeGeometry(seq);
  }
  // quick straight-line plan for the "how long?" sheet: how many stops and cans a session of m minutes would bring
  function previewPlan(m) {
    const start = S.me || { lat: map.lat, lng: map.lng };
    const sn = S.snakes.map(s => ({ id: s.id, lat: s.lat, lng: s.lng, fill: eff(s).f, blocked: s.claimed_by_other || (s.other_nearby && !s.claimed_by_me) || S.done.has(s.id) }));
    const p = planRoute({ start, end: S.set.end, snakes: sn, mode: S.set.mode, bag: S.set.bag || undefined, minutes: m, minFill: S.set.minFill });
    return { stops: p.stops.filter(x => x.id !== "__end").length, cans: p.cans };
  }
  // the line on the map: from where you are, through the remaining stops (and the end point)
  async function routeGeometry(seq = ++planSeq) {
    const start = S.me || { lat: map.lat, lng: map.lng };
    const all = (S.plan?.stops || []).filter(s => !S.done.has(s.id));
    const k = S.owed ? 1 : AHEAD;                                    // the line never shows more than the snakes on screen
    S.geoStops = all.filter(s => s.id !== "__end").length <= k ? all : all.filter(s => s.id !== "__end").slice(0, k);
    const rest = S.geoStops.map(s => s.id === "__end" ? S.set.end : byId(s.id)).filter(Boolean);
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
    const rest = S.geoStops || [];
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
    if (!S.routeOn || !S.plan || (!routeStops().length && !S.geo)) return map.setRoute(null);
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
    const pts = [start, ...(S.geoStops || []).map(s => s.id === "__end" ? S.set.end : byId(s.id)).filter(Boolean)];
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
  const visibleStops = () => {
    const v = routeStops().filter(s => !S.done.has(s.id)).slice(0, AHEAD);
    return S.owed && v[0]?.id === S.owed ? v.slice(0, 1) : v;       // a check-in at the first snake left unanswered holds back the rest
  };
  // always three ahead: when the time budget covers fewer, add the nearest worthwhile snakes after the last stop
  function topUp(plan, start, sn) {
    const real = plan.stops.filter(x => x.id !== "__end"); if (real.length >= AHEAD) return plan;
    const used = new Set(real.map(x => x.id)), mpm = TRANSPORT[S.set.mode].kmh * 1000 / 60;
    let pool = sn.filter(x => !x.blocked && !used.has(x.id) && x.lat != null), at = real.length ? byId(real.at(-1).id) || start : start;
    const extra = [];
    while (real.length + extra.length < AHEAD && pool.length) {
      const rank = x => ((x.fill ?? 0) >= S.set.minFill ? 0 : (x.fill ?? 0) >= 1 ? 1e6 : 2e6) + haversine(at, x);
      const nx = pool.reduce((a, b) => rank(b) < rank(a) ? b : a); pool = pool.filter(x => x !== nx);
      const legM = Math.round(haversine(at, nx) * 1.3);
      extra.push({ id: nx.id, cans: expectedCans(nx.fill ?? 0), expected: expectedCans(nx.fill ?? 0), legM, legMin: legM / mpm, extra: true }); at = nx;
    }
    const endI = plan.stops.findIndex(x => x.id === "__end");
    plan.stops.splice(endI < 0 ? plan.stops.length : endI, 0, ...extra);
    return plan;
  }
  // what the plan depends on: fill levels, claims, other collectors close by, sponsors' head starts
  const planSig = () => S.snakes.map(s => `${s.id}:${levelOf(eff(s).f)}:${s.claimed_by_other ? 1 : 0}:${s.other_nearby && !s.claimed_by_me ? 1 : 0}:${s.sponsor_turn_until && !s.i_sponsor ? 1 : 0}`).join("|");
  let lastSig = "";
  // re-plan during a shift and say why the stops ahead changed
  async function replanLive(cause, prev) {
    if (!S.routeOn || S.planning || S.arrivalId) return;
    const before = prev || visibleStops().map(s => s.id);
    try { await replan(); } catch (e) { console.warn(e); }
    lastSig = planSig(); S.plannedAt = Date.now();
    const after = visibleStops().map(s => s.id), gone = before.filter(id => !after.includes(id)), added = after.filter(id => !before.includes(id));
    S.fresh = new Set(added);
    if (gone.length || added.length || cause === "manual") {
      const g = byId(gone[0]), a = byId(added[0]);
      const why = (cause === "visit" || cause === "skip") && a ? t().revealed(a.design_name)
        : g && (g.claimed_by_other || (g.other_nearby && !g.claimed_by_me)) ? t().whyTaken(g.design_name)
        : a && cause === "data" && levelOf(eff(a).f) >= 3 ? t().whyFull(a.design_name) : cause === "time" ? t().whyTime : t().whyData;
      S.planNote = { text: why, at: Date.now() };
      reclaim();
    }
    if (gone.length || added.length || cause === "visit" || cause === "skip") fitAhead();
    renderMarkers(); renderSheet();
    setTimeout(() => { S.fresh = new Set(); renderSheet(); }, 4000);
  }
  async function reclaim() {
    if (!S.set.claim) return;
    try { S.reserved = sh.toReserve(visibleStops(), sh.remainingMin()).map(s => s.id); await claimSnakes(S.reserved, Math.min(240, Math.max(20, sh.remainingMin() + 15))); } catch (e) { console.error(e); }
  }
  // show you and the snakes ahead, clear of the dock and the top bar
  function fitAhead() {
    const pts = [S.me, ...visibleStops().map(s => byId(s.id))].filter(Boolean);
    const wide = innerWidth >= 900, dock = Math.min(sheet.getBoundingClientRect().height, innerHeight * .6);
    if (pts.length > 1) map.fit(pts, { top: wide || navEl.hidden ? 90 : navEl.getBoundingClientRect().bottom + 30, bottom: wide ? 60 : dock + 30, left: wide ? 460 : 50, right: 70 }, 15.5, true);
    else if (S.me) map.setView(S.me.lat, S.me.lng, 14.5);
  }
  setInterval(() => { if (S.routeOn) replanLive("time"); }, 180000);
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
    await routeGeometry(); S.plannedAt = Date.now(); lastSig = planSig();
    fitAhead(); await reclaim();
    renderMarkers(); renderSheet(); refresh(false, true);
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
        if (!startGps.centered) { startGps.centered = true; map.setView(pos.coords.latitude, pos.coords.longitude, Math.max(map.z, 13.5)); }
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
      if (!map._userPanned) map.setView(S.me.lat, S.me.lng, map.z, false);
    }, step * 1000);
  }
  map.on("drag", () => { map._userPanned = true; clearTimeout(map._upT); map._upT = setTimeout(() => map._userPanned = false, 8000); });
  setInterval(() => { if (S.routeOn && S.me && S.gps === "on" && !map._userPanned && !S.arrivalId) map.setView(S.me.lat, S.me.lng, map.z); }, 4000);   // follow me, at the zoom the collector chose

  // ---------- shift ----------
  function startShift(minutes = S.set.minutes) { sh.startSession(minutes); wake(); renderTop(); }
  async function endShift() { closeMenu(); navEl.hidden = true; S.planNote = null; S.owed = null; sh.endSession(); S.shift = null; S.reserved = []; store.set("shift", null); S.routeOn = false; S.done.clear(); store.set("done-today", { day: "", ids: [] }); S.skipped.clear(); S.mustInclude = []; try { await releaseClaims(); } catch {} wake(); drawRoute(); renderTop(); renderSheet(); refresh(); }
  async function finishShift() { await endShift(); openFeedback(); }
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
  // one persistent menu button; the notifications bell lives inside the menu and its count shows on this button
  const bellBtn = cm.bell();
  const menuBtn = el("button", { class: "cl-menubtn", "aria-label": "Menu", html: ICON.menu, onclick: () => openMenu() });
  bellBtn.classList.add("cl-round");
  function renderTop() {
    top.replaceChildren(menuBtn, el("div", { class: "cl-sp" }), S.shift ? el("button", { class: "cl-timerbtn", title: t().stopMyShift, onclick: () => sh.confirmEnd(finishShift) }, sh.timer()) : "", el("div", { class: "cl-sp" }), bellBtn);
  }
  setInterval(() => { if (S.shift) { sh.tick(); const old = top.querySelector(".sh-timer"); if (old) old.replaceWith(sh.timer()); } }, 15000);

  function renderBanner() {
    banner.innerHTML = ""; const parts = [];
    if (S.pickingEnd) parts.push(el("span", {}, t().endPick), el("button", { class: "cl-btn small", onclick: () => { S.pickingEnd = false; renderBanner(); } }, t().notNow));
    else if (S.gps !== "on" && (LIVE || S.routeOn)) {      // the demo's GPS note only matters once the shift has started
      if (LIVE) parts.push(el("span", {}, S.gps === "wait" ? t().gpsWait : t().gpsOff));
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
    const order = new Map((S.routeOn ? visibleStops() : []).map((s, i) => [s.id, i + 1]));
    // before a shift no snake is shown; during it only the planned snakes ahead (and one you opened yourself); at a snake only that one
    const shown = S.arrivalId ? S.snakes.filter(s => s.id === S.arrivalId) : S.snakes.filter(s => order.has(s.id) || s.id === S.focus);
    const items = shown.map(s => {
      let b = pins.get(s.id);
      if (!b) { b = el("button", { class: "cl-pin", onclick: (e) => { e.stopPropagation(); openSnake(s.id); } }); pins.set(s.id, b); }
      const e = eff(s), lv = levelOf(e.f), f = e.f == null ? 0 : Math.max(6, e.f / 4 * 100);
      b.style.setProperty("--c", lv == null ? "#8C969C" : LEVEL_COL[lv]); b.style.setProperty("--f", f);
      const turn = s.sponsor_turn_until && !s.i_sponsor && new Date(s.sponsor_turn_until) > Date.now();
      b.className = "cl-pin" + (order.has(s.id) ? " route" : "") + (e.predicted ? " stale" : "") + (s.claimed_by_other ? " other" : "") + (s.other_nearby && !s.claimed_by_me ? " near" : "") + (S.done.has(s.id) ? " done" : "") + (S.focus === s.id ? " focus" : "");
      b.innerHTML = `<span>${lv == null ? "?" : expectedCans(e.f)}</span>` + (order.has(s.id) && !S.done.has(s.id) ? `<em>${order.get(s.id)}</em>` : "") + (s.open_problems ? `<em class="warn">!</em>` : "")
        + (s.other_nearby && !s.claimed_by_me && !s.open_problems ? `<em class="near" title="${t().otherNear}">👥</em>` : "") + (turn || s.i_sponsor ? `<em class="sp">🌱</em>` : "");
      b.setAttribute("aria-label", `${s.design_name}: ${lv == null ? t().unknown : t().levelWords[lv]}${s.open_problems ? ", " + t().openProblems(s.open_problems) : ""}`);
      if (S.fresh?.has(s.id)) b.classList.add("fresh");
      return { id: s.id, lat: s.lat, lng: s.lng, el: b, z: order.has(s.id) ? 4 - order.get(s.id) : 1 };
    });
    map.setMarkers(items);
  }

  function pill(s) {
    const e = eff(s), lv = levelOf(e.f);
    return el("span", { class: "cl-pill" }, el("i", { style: `background:${lv == null ? "#8C969C" : LEVEL_COL[lv]}` }), lv == null ? "?" : t().levels[lv] + (e.predicted ? "*" : ""));
  }
  const snakeLine = s => [s.location_label || snakeMeta(s.id).place || "", s.fill_at ? `${eff(s).predicted ? t().predicted : t().reported} ${t().ago(minutesSince(s.fill_at))}` : t().unknown].filter(Boolean).join(" · ");

  // the dock: before a shift one Start button; during it the next snake big, the two after it small, and the planner's status
  const setH = () => root.style.setProperty("--sheet-h", sheet.getBoundingClientRect().height + "px");
  function renderSheet() {
    sheet.replaceChildren();
    if (!S.shift) { sheet.append(homeCard()); return setH(); }
    const ahead = visibleStops(), n = ahead[0];
    const note = S.planning ? t().replanning : S.planNote && Date.now() - S.planNote.at < 90000 ? S.planNote.text : t().plannedAgo(minutesSince(S.plannedAt && new Date(S.plannedAt).toISOString()));
    const strip = el("div", { class: "cl-planstrip" + (S.planning ? " busy" : "") + (S.fresh?.size && S.planNote && Date.now() - S.planNote.at < 4000 ? " fresh" : "") }, el("i", { "aria-hidden": "true" }), el("span", { role: "status" }, note),
      el("button", { class: "cl-mini", "aria-label": t().menuRoutes, title: t().menuRoutes, onclick: () => sh.explain() }, "ⓘ"),
      el("button", { class: "cl-mini", "aria-label": t().replan, title: t().replan, disabled: S.planning, onclick: () => replanLive("manual") }, "↻"));
    if (!n) { sheet.append(el("div", { class: "cl-next" }, strip, el("h3", {}, S.planning ? t().planning : routeStops().length ? t().allDone : t().noRoute))); return setH(); }
    const s = byId(n.id), d = S.me ? haversine(S.me, s) : null, nav = S.routeOn ? navInfo() : null, mpm = TRANSPORT[S.set.mode].kmh * 1000 / 60;
    const dist = nav ? nav.left : d, mins = nav ? Math.max(1, Math.round(nav.dur / 60)) : d != null ? Math.max(1, Math.round(d * 1.3 / mpm)) : null;
    sheet.append(el("div", { class: "cl-next" + (S.fresh?.has(n.id) ? " fresh" : "") }, strip,
      el("div", { class: "cl-nexthead" }, el("span", { class: "n" }, "1"),
        el("span", { style: "min-width:0" }, el("h3", {}, s.design_name)),
        el("span", { class: "cl-dist big" }, el("b", {}, dist != null ? fmtM(dist) : "–"), el("small", {}, mins ? t().walkMin(mins) : ""))),
      nav?.step && navEl.hidden ? el("div", { class: "cl-meta" }, el("span", { class: "cl-turn" }, el("i", { "aria-hidden": "true" }, ARROW[nav.step.mod] || (nav.step.kind === "arrive" ? "◎" : "↑")), stepText(nav.step, S.lang) + " · " + t().inM(fmtM(nav.stepIn)))) : "",
      el("div", { class: "cl-row" },
        el("button", { class: "cl-btn primary", onclick: () => openArrival(s.id, d) }, t().here),
        el("button", { class: "cl-btn ghost", onclick: () => { S.skipped.add(s.id); if (S.owed === s.id) S.owed = null; replanLive("skip"); } }, t().skip)),
      ahead.length > 1 ? el("ol", { class: "cl-ahead", start: 2 }, ...ahead.slice(1).map((st, i) => {
        const x = byId(st.id); if (!x) return "";
        return el("li", { class: S.fresh?.has(st.id) ? "fresh" : "" }, el("span", { class: "n" }, i + 2), el("span", { style: "min-width:0" }, el("b", {}, x.design_name), el("small", {}, `+${fmtM(st.legM ?? 0)} · ${t().walkMin(Math.max(1, Math.round(st.legMin ?? (st.legM || 0) / mpm)))}`)));
      })) : "",
      S.owed === n.id ? el("p", { class: "cl-note" }, "🔒 " + t().owedHint(s.design_name)) : "",
      !LIVE && S.gps !== "on" ? el("button", { class: "cl-demowalk", onclick: () => { toggleWalk(); renderSheet(); } }, S.walking ? "■ " + t().stopWalk : "▶ " + t().walk + " (demo)") : ""));
    setH();
  }

  // expected full snakes for the next 12 hours: the cans still waiting after the usual collectors at that hour
  // (the best-time model), counted as snakes of about 18 cans; "now" is the snakes that are full right now
  function fullByHour() {
    const fullNow = S.snakes.filter(s => (eff(s).f ?? 0) >= 3).length;
    return sh.bestTimes(S.snakes, 3).hours.map((h, k) => ({ at: h.at, hour: h.hour, n: k === 0 ? fullNow : Math.min(S.snakes.length, Math.round(h.cans / 18)) }));
  }
  // the home sheet: city, how many snakes are full now, and the slider. Pull it up for the day's chart and quick links.
  function homeCard() {
    const U = u(), hrs = fullByHour(), total = Math.max(1, S.snakes.length), share = hrs[0].n / total;
    const lv = share < .15 ? 0 : share < .35 ? 1 : 2, max = Math.max(1, ...hrs.map(h => h.n));
    const toggle = () => { S.homeOpen = !S.homeOpen; renderSheet(); };
    const card = el("div", { class: "cl-home" + (S.homeOpen ? " open" : "") },
      el("button", { class: "cl-grab", "aria-expanded": String(!!S.homeOpen), "aria-label": U.chart, onclick: toggle }),
      el("button", { class: "cl-homehead", onclick: toggle },
        el("h2", {}, U.city),
        el("p", { class: "cl-demand" }, el("span", {}, U.fullNow), el("span", { class: "cl-lvl l" + lv, "aria-hidden": "true" }, el("i"), el("i"), el("i")), el("b", {}, `${U.demand[lv]} · ${hrs[0].n}`))));
    if (S.homeOpen) {
      card.append(el("div", { class: "cl-chart", role: "img", "aria-label": `${U.chart}: ` + hrs.map(h => `${String(h.hour).padStart(2, "0")}:00 ${h.n}`).join(", ") },
          ...hrs.map((h, i) => el("span", { class: i === 0 ? "now" : "" }, i === 0 ? el("em", {}, U.now) : "", el("i", { style: `height:${Math.max(6, h.n / max * 100)}%` }),
            el("small", {}, i % 3 === 0 ? `${String(h.hour).padStart(2, "0")}:00` : "")))),
        el("p", { class: "cl-chartkey" }, el("i"), U.chart),
        el("h3", { class: "cl-quickh" }, U.quick),
        el("ul", { class: "cl-quick" }, ...[["how", ICON.i_how], ["snakes", ICON.i_snakes], ["settings", ICON.i_settings]].map(([k, ic]) =>
          el("li", {}, el("button", { onclick: () => { openMenu(); menuGo(k); } }, el("span", { class: "ic", html: ic }), el("b", {}, mt().items[k][0]), el("span", { class: "chev", html: ICON.i_arrow }))))));
    }
    card.append(slider(U.slideStart, beginShift));
    return card;
  }
  // slide to start / end: a deliberate gesture, so a pocket tap can't start or end a shift. Enter or Space works too.
  function slider(label, onDone, cls = "") {
    const knob = el("span", { class: "cl-knob", "aria-hidden": "true", html: ICON.i_arrow });
    const b = el("button", { class: "cl-slide " + cls, "aria-label": label }, knob, el("span", { class: "lbl" }, label));
    let x0 = null, w = 0, dx = 0;
    b.addEventListener("pointerdown", e => { x0 = e.clientX; w = b.clientWidth - knob.offsetWidth - 12; dx = 0; b.setPointerCapture?.(e.pointerId); b.classList.add("drag"); });
    b.addEventListener("pointermove", e => { if (x0 == null) return; dx = Math.max(0, Math.min(w, e.clientX - x0)); knob.style.transform = `translateX(${dx}px)`; b.style.setProperty("--p", (dx / w).toFixed(3)); });
    const end = () => {
      if (x0 == null) return; const done = dx >= w * .8; x0 = null; b.classList.remove("drag"); knob.style.transform = ""; b.style.setProperty("--p", 0);
      if (done) { try { navigator.vibrate?.(30); } catch {} onDone(); } else { b.classList.remove("hint"); void b.offsetWidth; b.classList.add("hint"); }
    };
    b.addEventListener("pointerup", end); b.addEventListener("pointercancel", end);
    b.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onDone(); } });
    return b;
  }
  // after a shift: three thumbs and an optional comment (kept on this phone in the demo)
  function openFeedback() {
    const U = u(), ans = {}; let note = "";
    modal((d, close) => {
      const draw = () => {
        d.replaceChildren(el("h2", {}, U.fbTitle));
        for (const [k, h, q] of U.fb) d.append(el("div", { class: "cl-fbq" }, el("h3", {}, h), el("p", {}, q),
          el("div", { class: "cl-thumbs", role: "group", "aria-label": h },
            el("button", { "aria-pressed": String(ans[k] === 1), "aria-label": "👍", html: ICON.i_feedback, onclick: () => { ans[k] = ans[k] === 1 ? undefined : 1; draw(); } }),
            el("button", { "aria-pressed": String(ans[k] === -1), "aria-label": "👎", html: ICON.i_down, onclick: () => { ans[k] = ans[k] === -1 ? undefined : -1; draw(); } }))));
        const ta = el("textarea", { maxlength: 500, placeholder: U.fbComment, "aria-label": U.fbComment }); ta.value = note; ta.oninput = () => note = ta.value;
        d.append(ta, el("button", { class: "cl-btn primary", style: "width:100%", disabled: !Object.values(ans).some(v => v) && !note.trim(), onclick: () => {
            const all = store.get("feedback", []); all.push({ at: new Date().toISOString(), ...ans, note: note.trim() || null }); store.set("feedback", all.slice(-50));
            close(); toast(U.fbThanks);
          } }, U.fbSend), el("button", { class: "cl-btn ghost", style: "width:100%", onclick: close }, U.fbSkip));
        ta.addEventListener("input", () => d.querySelector(".cl-btn.primary").disabled = !Object.values(ans).some(v => v) && !note.trim());
      };
      draw();
    });
  }
  function paneHow(p) {
    const U = u();
    p.append(el("ol", { class: "cl-steps" }, ...U.howSteps.map(([h, d], i) => el("li", {}, el("span", { class: "n" }, i + 1), el("span", {}, el("b", {}, h), el("small", {}, d))))),
      el("h3", { class: "cl-faqh" }, U.faqTitle),
      el("div", { class: "cl-faq" }, ...U.faq.map(([q, a]) => el("details", {}, el("summary", {}, q), el("p", {}, a)))),
      el("button", { class: "cl-btn", style: "width:100%", onclick: () => sh.explain() }, U.plannerMore));
  }

  // ---------- the menu (top right): keywords, each with a short "read more", opening its own view ----------
  const MENU = [["stats", ICON.i_stats], ["league", ICON.i_league], ["gear", ICON.i_gear], ["best", ICON.i_best], ["snakes", ICON.i_snakes], ["how", ICON.i_how], ["key", ICON.i_key], ["feedback", ICON.i_feedback], ["settings", ICON.i_settings]];
  const u = () => UI[S.lang] || UI.en;
  let menuView = null;
  const mt = () => MENU_TXT[S.lang] || MENU_TXT.en;
  function openMenu(view = null) { menuView = view; menu.hidden = false; renderMenu(); menu.querySelector("button")?.focus({ preventScroll: true }); }
  function closeMenu() { menu.hidden = true; menuView = null; menu.replaceChildren(); }
  function menuGo(k) {
    if (k === "settings") return openSettings();
    if (k === "feedback") { closeMenu(); return openFeedback(); }
    if (k === "snakes") myVisits(120).then(v => { S.mine = new Set(v.map(x => x.snake_id)); if (menuView === "snakes") drawSnakeList(); }).catch(() => {});
    menuView = k; renderMenu();
  }
  function renderMenu() {
    if (menu.hidden) return;
    if (menuView === "snakes" && document.activeElement === snakeSearch) { drawSnakeList(); return; }
    const M = mt(), body = el("div", { class: "cl-menubody" });
    const head = el("div", { class: "cl-menuhead" },
      menuView ? el("button", { class: "cl-icon", "aria-label": M.back, onclick: () => { menuView = null; renderMenu(); } }, "‹") : el("span", { class: "cl-icon", style: "visibility:hidden" }),
      el("h2", {}, menuView ? M.items[menuView][0] : M.title), el("button", { class: "cl-icon", "aria-label": M.close, onclick: closeMenu }, "✕"));
    menu.replaceChildren(el("div", { class: "cl-menupanel" }, head, body));
    if (!menuView) {
      body.append(el("div", { class: "cl-profile" }, el("span", { class: "ic", html: ICON.i_user }), el("span", {}, el("b", {}, u().profile), el("small", { class: S.shift ? "on" : "" }, S.shift ? u().on : u().off))));
      const ul = el("ul", { class: "cl-menulist" });
      for (const [k, ic] of MENU) {
        const [kw, more] = M.items[k], open = S.menuMore === k, badge = null;
        ul.append(el("li", {}, el("div", { class: "cl-menurow" },
            el("button", { class: "cl-menugo", onclick: () => menuGo(k) }, el("span", { class: "ic", "aria-hidden": "true", html: ic }), el("b", {}, kw), badge ? el("em", {}, badge) : "", el("span", { class: "chev", "aria-hidden": "true" }, "›")),
            el("button", { class: "cl-mini", "aria-expanded": String(open), "aria-label": `${M.more}: ${kw}`, onclick: () => { S.menuMore = open ? null : k; renderMenu(); } }, "ⓘ")),
          open ? el("p", { class: "cl-menumore" }, more) : ""));
      }
      body.append(ul);
      if (S.shift) body.append(slider(u().slideEnd, finishShift, "end"));
      if (!LIVE) body.append(el("p", { class: "cl-note" }, M.demo));
      return;
    }
    if (menuView !== "how") body.append(el("details", { class: "cl-readmore" }, el("summary", {}, M.more), el("p", {}, M.items[menuView][1])));
    if (menuView === "stats") stats.pane(body);
    else if (menuView === "league") league.pane(body);
    else if (menuView === "gear") cm.paneToolkit(body);
    else if (menuView === "best") body.append(sh.bestCard(S.snakes));
    else if (menuView === "snakes") paneSnakes(body);
    else if (menuView === "key") mapKey(body);
    else if (menuView === "how") paneHow(body);
  }
  function mapKey(p) {
    const ul = el("ul", { class: "cl-keylist" });
    t().levels.forEach((l, i) => ul.append(el("li", {}, el("i", { style: `background:${LEVEL_COL[i]}` }), `${l} · ≈ ${[0, 5, 10, 16, 21][i]} ${t().cans}`)));
    ul.append(el("li", {}, el("i", { style: "border:2px dashed var(--muted);background:transparent" }), t().legendHint), el("li", {}, el("i", { style: "background:var(--route)" }), t().legendNum));
    p.append(ul);
  }

  function seg(options, value, onPick) {
    return el("span", { class: "cl-seg" }, ...options.map(([v, l]) => el("button", { "aria-pressed": String(value === v), onclick: () => onPick(v) }, l)));
  }
  // Simple on purpose: before a shift one big button; during a shift only the next stop. Route options live in Settings, numbers in "My stats".
  function beginShift() { sh.startDialog(runShift); }
  async function runShift(minutes) {
    startShift(minutes); renderSheet();
    try { await replan(); } catch (e) { console.warn(e); }
    await startRoute();
  }
  // Snakes: every snake in the city, nearest first, with a search. The search box lives for the whole session so typing
  // survives the sheet being redrawn (GPS, refresh); while it has focus only the list is redrawn.
  const snakeSearch = el("input", { type: "search", id: "cl-snake-search", class: "cl-search", autocomplete: "off", enterkeyhint: "search" });
  snakeSearch.addEventListener("input", () => { S.q = snakeSearch.value; drawSnakeList(); });
  let snakeListEl = null;
  function paneSnakes(p) {
    if (!store.get("snakes-help-hidden", false)) {
      p.append(el("div", { class: "cl-help" }, el("b", {}, t().snakesWhat),
        el("ul", {}, ...t().snakesUses.map(([ic, h, d]) => el("li", {}, el("span", { class: "ic", "aria-hidden": "true" }, ic), el("span", {}, el("b", {}, h), el("small", {}, d))))),
        el("button", { class: "cl-btn small", onclick: () => { store.set("snakes-help-hidden", true); renderMenu(); } }, t().gotIt)));
    }
    snakeSearch.placeholder = t().searchPh; snakeSearch.setAttribute("aria-label", t().searchPh); snakeSearch.value = S.q || "";
    p.append(el("label", { class: "cl-searchwrap", for: "cl-snake-search" }, el("span", { "aria-hidden": "true" }, "⌕"), snakeSearch),
      el("div", { class: "cl-opts" }, seg([["all", t().all], ["full", t().fullish], ["prob", t().withProblems]], S.filter, v => { S.filter = v; renderMenu(); }), el("label", {}, S.me ? t().sortDist : "")));
    snakeListEl = el("div", { style: "display:grid;gap:6px" }); p.append(snakeListEl);
    drawSnakeList();
  }
  const norm = v => String(v || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  function drawSnakeList() {
    if (!snakeListEl) return;
    let list = S.snakes.filter(s => S.mine?.has(s.id));      // only snakes you have emptied before: locations are earned, not browsed
    if (S.filter === "full") list = list.filter(s => (eff(s).f ?? 0) >= 3); if (S.filter === "prob") list = list.filter(s => s.open_problems);
    const q = norm(S.q).trim();
    if (q) list = list.filter(s => [s.design_name, s.location_label, snakeMeta(s.id).place, s.id].some(v => norm(v).includes(q)));
    list.sort((a, b) => S.me ? haversine(S.me, a) - haversine(S.me, b) : (eff(b).f ?? -1) - (eff(a).f ?? -1));
    const ul = el("ul", { class: "cl-list" }), mpm = TRANSPORT[S.set.mode].kmh * 1000 / 60;
    for (const s of list) {
      const d = S.me ? haversine(S.me, s) : null;
      ul.append(el("li", {}, el("button", { class: "cl-item cl-snakerow", onclick: () => { closeMenu(); focusSnake(s.id); openSnake(s.id, true); } },
        d != null ? el("span", { class: "cl-dist" }, el("b", {}, fmtM(d)), el("small", {}, `${Math.max(1, Math.round(d * 1.3 / mpm))} ${t().min}`)) : el("span"),
        el("span", { style: "min-width:0;display:flex;gap:10px;align-items:center" }, el("span", { class: "cl-stripe", style: "width:8px;height:34px;flex:none;flex-direction:column" }, ...(snakeMeta(s.id).colors || []).map(c => el("i", { style: `background:${c}` }))),
          el("span", { style: "min-width:0" }, el("b", {}, s.design_name), el("small", {}, snakeLine(s)))),
        el("span", { style: "display:grid;gap:3px;justify-items:end" }, pill(s), s.open_problems ? el("span", { class: "cl-pill bad" }, "! " + s.open_problems) : "", s.claimed_by_other ? el("small", {}, "🔒") : ""))));
    }
    snakeListEl.replaceChildren(list.length ? ul : el("p", { class: "cl-empty" }, q ? t().noMatch(S.q.trim()) : S.mine ? t().noMine : "…"));
  }
  function dirLink(s) { const m = { walk: "walking", bike: "bicycling", cargo: "bicycling" }[S.set.mode]; return `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}&travelmode=${m}`; }
  function focusSnake(id) { const s = byId(id); if (!s) return; S.focus = id; renderMarkers(); map.setView(s.lat, s.lng, Math.max(map.z, 15)); }

  // ---------- dialogs ----------
  function modal(build, onClose, opts = {}) {
    modalHost.innerHTML = "";
    const dlg = el("div", { class: "cl-dialog", role: "dialog", "aria-modal": "true" });
    const close = () => { modalHost.innerHTML = ""; onClose && onClose(); };
    const wrap = el("div", { class: "cl-modal" + (opts.peek ? " peek" : ""), onclick: e => { if (!opts.peek && e.target === wrap) close(); } }, dlg);
    build(dlg, close); modalHost.append(wrap);
    const f = dlg.querySelector("button,input,textarea"); if (f) f.focus({ preventScroll: true });
    wrap.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
    return close;
  }
  function stripe(id) { return el("div", { class: "cl-stripe" }, ...(snakeMeta(id).colors || ["#999"]).map(c => el("i", { style: `background:${c}` }))); }

  function openSnake(id, full = false) {      // from the map: the essentials; from "My snakes": with sponsorship
    const s = byId(id); if (!s) return;
    S.focus = id; renderMarkers();
    const spHost = el("div");
    modal((d, close) => {
      const e = eff(s), lv = levelOf(e.f), inRoute = routeStops().some(x => x.id === id), dist = S.me ? haversine(S.me, s) : null;
      d.append(el("div", { class: "cl-cardhead" }, el("span", {}, el("h2", {}, s.design_name), el("span", { class: "cl-cardsub" }, [dist != null ? fmtM(dist) : "", lv == null ? "" : `≈ ${expectedCans(e.f)} ${t().cans}`].filter(Boolean).join(" · "))),
          el("button", { class: "cl-x", "aria-label": mt().close, onclick: close }, "✕")),
        s.open_problems ? el("p", { class: "cl-note", style: "color:var(--bad);font-weight:600;margin:0" }, "! " + s.problem_types.map(p => t().problems[p] || p).join(", ")) : "",
        el("div", { class: "cl-row" },
          el("button", { class: "cl-btn primary", onclick: () => { close(); openArrival(id, dist); } }, t().here),
          el("button", { class: "cl-btn", onclick: () => { if (inRoute) { S.skipped.add(id); S.mustInclude = S.mustInclude.filter(x => x !== id); } else { S.skipped.delete(id); S.mustInclude.push(id); } close(); S.routeOn ? replanLive("manual") : replan(); } }, inRoute ? t().remove : t().add)),
        spHost);
      if (full) cm.sponsorBlock(id, spHost);
    }, () => { S.focus = null; renderMarkers(); });
  }

  function openArrival(id, dist) {
    const s = byId(id); if (!s) return;
    const expected = expectedCans(eff(s).f ?? s.fill_level ?? 0);
    // the usual case is preselected (all good, emptied): one tap on the big OK saves it; change things only when something was different
    const st = { more: false, ok: true, problem: null, note: "", photo: null, outcome: "emptied", fillAfter: null, cans: expected, cansTouched: false };
    S.arrivalId = id; root.classList.add("arriving"); renderMarkers();
    if (s.lat != null) map.setView(S.me ? (S.me.lat + s.lat) / 2 : s.lat, S.me ? (S.me.lng + s.lng) / 2 : s.lng, haversine(S.me || s, s) > 120 ? 16.5 : 17.8, false);
    modal((d, close) => {
      const render = () => {
        d.innerHTML = "";
        // only the essentials: which snake, how far, all good or not
        d.append(el("div", { class: "cl-cardhead" }, el("span", {}, el("h2", {}, s.design_name), dist != null ? el("span", { class: "cl-cardsub" }, fmtM(dist)) : ""),
          el("button", { class: "cl-x", "aria-label": mt().close, onclick: leave }, "✕")));
        const ready = st.ok !== null && st.outcome && (st.ok || st.problem) && (st.outcome !== "partial" || st.fillAfter);
        const msg = el("p", { class: "cl-note", role: "alert" });
        const quick = st.ok === true && st.outcome === "emptied";
        const okBtn = el("button", { class: "cl-btn primary cl-ok", disabled: !ready, onclick: async (ev) => {
            try { navigator.vibrate?.(25); } catch {}                                    // a light tap on phones that support it
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
            const prevAhead = visibleStops().map(s => s.id);                    // what the collector could see before this check-in
            S.done.add(id); store.set("done-today", { day: new Date().toDateString(), ids: [...S.done] });     // the home test can too: it comes back next shift
            if (S.owed === id) S.owed = null;
            cm.reset(); close(); await loadVisits(); await refresh(false, true); renderBanner();
            if (S.routeOn) replanLive("visit", prevAhead.filter(x => x !== id)); else replan();
          } }, quick ? "✓ " + t().allGood : t().save);
        if (!st.more) {      // the usual case stays tiny: one big button, the map stays visible above
          d.append(okBtn, msg, el("button", { class: "cl-btn cl-wrong", onclick: () => { st.more = true; st.ok = false; render(); } }, t().wrong));
          return;
        }
        {                    // "something's wrong": what, then whether it was emptied, then save
          d.append(el("h3", {}, t().which));
          d.append(el("div", { class: "cl-chips", role: "group", "aria-label": t().which }, ...PROBLEMS.map(p => el("button", { "aria-pressed": String(st.problem === p), onclick: () => { st.problem = p; if (p === "locked" || p === "blocked") st.outcome ??= "not_emptied"; render(); } }, t().problems[p]))));
          const ta = el("textarea", { maxlength: 500, placeholder: t().note, "aria-label": t().note }); ta.value = st.note; ta.oninput = () => st.note = ta.value;
          const file = el("input", { type: "file", accept: "image/*", capture: "environment", class: "cl-sr", id: "cl-photo" });
          file.onchange = () => { st.photo = file.files[0] || null; render(); };
          d.append(ta, el("label", { class: "cl-btn", for: "cl-photo", style: "text-align:center;display:block" }, st.photo ? `${t().photoAgain} ✓` : `📷 ${t().photo}`), file);
        }
        d.append(el("h3", {}, t().q2), el("div", { class: "cl-big" },
          ...[["emptied", t().oEmptied], ["partial", t().oPartial], ["was_empty", t().oWasEmpty], ["not_emptied", t().oNot]].map(([k, l]) =>
            el("button", { "aria-pressed": String(st.outcome === k), class: k === "not_emptied" ? "badsel" : "", onclick: () => { st.outcome = k; if (!st.cansTouched) st.cans = k === "emptied" ? expected : k === "partial" ? Math.round(expected / 2) : 0; render(); } }, l))));
        if (st.outcome === "partial") d.append(el("div", { class: "cl-meta" }, t().howFullNow), el("div", { class: "cl-chips" }, ...[1, 2, 3].map(v => el("button", { "aria-pressed": String(st.fillAfter === v), onclick: () => { st.fillAfter = v; render(); } }, t().levels[v]))));
        if (st.outcome === "emptied" || st.outcome === "partial") {
          const out = el("output", {}, st.cans ?? 0);
          const bump = n => { st.cans = Math.max(0, Math.min(300, (st.cans || 0) + n)); st.cansTouched = true; out.value = st.cans; out.textContent = st.cans; out.classList.remove("bump"); void out.offsetWidth; out.classList.add("bump"); };
          d.append(el("div", { class: "cl-meta" }, t().cansTaken), el("div", { class: "cl-stepper" }, el("button", { "aria-label": "−5", onclick: () => bump(-5) }, "−"), out, el("button", { "aria-label": "+5", onclick: () => bump(5) }, "+"), el("span", { class: "cl-note" }, t().value((st.cans || 0) * CAN_VALUE))));
        }
        d.append(okBtn, msg);
      };
      // closing without an answer: it won't pop up again for 5 minutes, and the snakes after it stay hidden
      const leave = () => { S.dismissed.set(id, Date.now()); if (S.routeOn && routeStops().find(x => !S.done.has(x.id))?.id === id) { S.owed = id; routeGeometry(); } close(); };
      render();
    }, () => { S.arrivalId = null; root.classList.remove("arriving"); renderMarkers(); if (S.routeOn) { renderSheet(); fitAhead(); } }, { peek: true });
  }

  function openSettings() {
    modal((d, close) => {
      const chk = (key, label) => { const i = el("input", { type: "checkbox", id: "cl-" + key }); i.checked = !!S.set[key]; i.onchange = () => { S.set[key] = i.checked; saveSet(); if (key === "light") retheme(); if (key === "wake") wake(); }; return el("label", { class: "cl-check", for: "cl-" + key }, i, label); };
      const bag = el("input", { type: "number", min: 5, max: 400, step: 5, id: "cl-bag" }); bag.value = S.set.bag || TRANSPORT[S.set.mode].bag; bag.onchange = () => { S.set.bag = Math.max(5, +bag.value || 40); saveSet(); replan(); };
      const rad = el("select", { id: "cl-rad" }, ...[20, 30, 50, 80].map(v => el("option", { value: v, selected: S.set.radius === v }, `${v} m`))); rad.onchange = () => { S.set.radius = +rad.value; saveSet(); };
      d.append(el("h2", {}, t().settings), el("div", { class: "cl-set" },
        el("div", { class: "l" }, el("b", {}, t().routeOptions),
          el("div", { class: "cl-opts", style: "margin-top:6px" }, seg(Object.keys(TRANSPORT).map(k => [k, TRANSPORT[k].label[S.lang]]), S.set.mode, v => { S.set.mode = v; S.set.bag = null; saveSet(); replan(); close(); openSettings(); })),
          el("div", { class: "cl-opts", style: "margin-top:6px" }, el("label", {}, t().timeBudget), seg([[30, "30"], [60, "60"], [90, "90"], [120, "120"]], S.set.minutes, v => { S.set.minutes = v; saveSet(); replan(); close(); openSettings(); }), el("label", {}, t().min)),
          el("div", { class: "cl-opts", style: "margin-top:6px" }, el("label", {}, t().minFill), seg([[2, "½"], [3, "¾"], [4, t().levels[4]]], S.set.minFill, v => { S.set.minFill = v; saveSet(); replan(); close(); openSettings(); }))),
        el("label", { class: "l" }, t().language, seg([["da", "Dansk"], ["en", "English"]], S.lang, v => { S.lang = v; store.set("lang", v); close(); renderAll(); openSettings(); })),
        el("label", { class: "l", for: "cl-bag" }, t().bag, bag),
        el("label", { class: "l", for: "cl-rad" }, t().arriveRadius, rad),
        el("div", { class: "l" }, el("b", {}, t().endPoint), el("div", { class: "cl-row", style: "margin-top:6px" },
          el("button", { class: "cl-btn small", onclick: () => { S.pickingEnd = true; close(); renderBanner(); } }, t().endSet),
          S.set.end ? el("button", { class: "cl-btn small ghost", onclick: () => { S.set.end = null; saveSet(); map.setEnd(null); close(); replan(); } }, t().endClear) : el("span", { class: "cl-note" }, t().endNone))),
        chk("claim", t().claimToggle), chk("wake", t().wake), chk("light", t().lightMode),
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
    el("button", { "aria-label": t().locate, title: t().locate, html: ICON.locate, onclick: () => { map._userPanned = false; if (S.routeOn) fitAhead(); else if (S.me) map.setView(S.me.lat, S.me.lng, Math.max(map.z, 13.5)); } }),
    el("button", { "aria-label": t().zoomIn, html: ICON.plus, onclick: () => map.zoomAt(1) }),
    el("button", { "aria-label": t().zoomOut, html: ICON.minus, onclick: () => map.zoomAt(-1) }));
  function renderAll() { map.setNote?.(t().demoMap); renderTop(); renderBanner(); renderLegend(); renderSheet(); renderMarkers(); }

  async function boot() {
    seedCollectorDemo();
    S.session = await collectorSession();
    if (!S.session) return showLogin();
    if (LIVE && !["collector", "operator"].includes(S.session.role)) return showProfileSetup();   // signed in, no collector profile yet
    renderAll(); await loadVisits(); await refresh(true);
    if (S.shift && !S.routeOn) { await replan(); await startRoute(); }          // a shift that was running when the page was closed carries on
    if (S.set.end) map.setEnd(S.set.end);
    if (!LIVE) { setMe({ lat: 56.1556, lng: 10.2086, acc: 8, src: "sim" }); map.setView(56.1556, 10.2086, 13.4, false); }   // holds the place until the first real fix
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
