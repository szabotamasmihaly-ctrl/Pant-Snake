// The map used by the collector app and the owner's map: MapLibre GL (vector map, smooth zoom, sharp on every screen).
//
// Two base maps:
//  * live  — a full street map from a vector tile service. Default: OpenFreeMap (free, no key, OpenStreetMap data,
//            every street, path, building and house number). Any MapLibre style URL works (MapTiler, Stadia, your own).
//  * demo  — built into the app (demo-map/): the real Aarhus coastline (Danish DAGI data), the main street network with
//            names and the light rail (OpenStreetMap). Used when no style is configured or the tile service can't be reached.
// Markers are ordinary HTML elements, so the app styles them and they work with screen readers and keyboards.
// Overlays (route, accuracy circle) survive style switches (light/dark).

const OFM = "https://tiles.openfreemap.org/styles/";
const EMPTY = { type: "FeatureCollection", features: [] };
const here = () => location.href.replace(/[#?].*$/, "").replace(/[^/]*$/, "");

const DEMO_COL = {
  light: { water: "#9FD5EC", land: "#F4F3F0", case: "#C3C7CE", street: "#FFFFFF", minor: "#FFFFFF", path: "#C9CDD3", major: "#FFFFFF", majorCase: "#C5CAD3",
           motor: "#9DB0CC", motorCase: "#7F93B3", rb: "#FFFFFF", tram: "#A8AEB6", rail: "#B4B9C1", text: "#5F6368", halo: "rgba(255,255,255,.95)", place: "#3C4043", waterText: "#3E7FA6",
           park: "#C6EDCF", wood: "#B9E4C3", grass: "#D5F1DA", scrub: "#CDEBD0", pitch: "#B7E3C0", beach: "#FBF0D0", wetland: "#C9E6DA", cemetery: "#D2EBD6", allot: "#DCEFD6", farm: "#EEF2E4",
           hospital: "#FCE3E3", edu: "#F6F1DC", industrial: "#ECE9F1", res: "#E9EAEC", parking: "#ECECEC", commercial: "#F6EEE6", building: "#DFE1E5", buildingLine: "#D2D5DA", greenText: "#2E7D46" },
  dark:  { water: "#123A50", land: "#1E2124", case: "#16181B", street: "#3A3F45", minor: "#33383D", path: "#3B4147", major: "#4A5058", majorCase: "#1A1C1F",
           motor: "#5C6F8C", motorCase: "#2A3442", rb: "#3A3F45", tram: "#5D6870", rail: "#4C535B", text: "#A9B0B7", halo: "rgba(18,20,22,.92)", place: "#D5DADF", waterText: "#7FB2D3",
           park: "#1E3A2A", wood: "#1C3627", grass: "#203629", scrub: "#203528", pitch: "#24402F", beach: "#3A3628", wetland: "#1F3530", cemetery: "#213528", allot: "#22352A", farm: "#22261F",
           hospital: "#3A2528", edu: "#2E2C24", industrial: "#25262B", res: "#232629", parking: "#26282B", commercial: "#2A2623", building: "#2A2D31", buildingLine: "#33373C", greenText: "#7FC896" },
};
// neighbourhood names for the demo map (the live map has its own, from OpenStreetMap)
const PLACES = [
  ["Aarhus C", 56.1567, 10.2039, 1], ["Latinerkvarteret", 56.1592, 10.2093, 3], ["Frederiksbjerg", 56.1458, 10.2025, 2], ["Trøjborg", 56.1752, 10.2118, 2],
  ["Aarhus Ø", 56.1648, 10.2268, 2], ["Åbyhøj", 56.1530, 10.1580, 2], ["Hasle", 56.1722, 10.1612, 2], ["Viby J", 56.1265, 10.1650, 2], ["Brabrand", 56.1530, 10.1100, 2],
  ["Risskov", 56.1935, 10.2310, 2], ["Højbjerg", 56.1120, 10.2050, 2], ["Marselisborgskovene", 56.1150, 10.2260, 3], ["Aarhus Bugt", 56.1450, 10.2900, 0],
];

let demoData = null;
async function loadDemo() {
  if (demoData) return demoData;
  const get = f => fetch(here() + "demo-map/" + f).then(r => { if (!r.ok) throw new Error(f + " " + r.status); return r.json(); });
  // detail layers made by tools/osm2demo.py from an OpenStreetMap export; list a file here once it is in demo-map/
  const DETAIL = ["areas.json", "roads.json", "buildings.json"];   // traced from OpenStreetMap map images (tools: cc/mapimg)
  const opt = f => DETAIL.includes(f) ? get(f).catch(() => EMPTY) : Promise.resolve(EMPTY);
  const [land, streets, tram, areas, waterways, rail, labels, roads] = await Promise.all([get("land.json"), get("streets.json"), get("tram.json").catch(() => EMPTY),
    opt("areas.json"), opt("waterways.json"), opt("rail.json"), opt("labels.json"), opt("roads.json")]);
  const osm = null;     // stitched OpenStreetMap picture (demo-map/osm/) — replaced by the traced vector layers
  demoData = { land, streets, tram, areas, waterways, rail, labels, roads, osm, buildings: EMPTY };
  demoData.ready = opt("buildings.json").then(b => (demoData.buildings = b));
  return demoData;
}
export const loadDemoStreets = () => loadDemo().then(d => d.streets);

// label glyphs: normally the .pbf files in demo-map/fonts; a page that can only serve scripts can embed them as
// window.DEMO_GLYPHS = { "NotoSans-Regular/0-255": "<base64>", … } instead
function glyphURL() {
  if (!window.DEMO_GLYPHS) return here() + "demo-map/fonts/{fontstack}/{range}.pbf";
  if (!glyphURL.done) {
    glyphURL.done = true;
    maplibregl.addProtocol("demoglyph", async params => {
      const key = decodeURIComponent(params.url.replace("demoglyph://", "")).split(",")[0].trim(), b64 = window.DEMO_GLYPHS[key];
      if (!b64) return { data: new ArrayBuffer(0) };
      const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      return { data: u.buffer };
    });
  }
  return "demoglyph://{fontstack}/{range}";
}
function demoStyle(d, dark) {
  const C = dark ? DEMO_COL.dark : DEMO_COL.light;
  const hasLabels = d.labels && d.labels.features.length;
  const places = hasLabels ? d.labels : { type: "FeatureCollection", features: PLACES.map(([name, lat, lng, rank]) => ({ type: "Feature", properties: { name, rank, k: rank === 0 ? "water" : "place" }, geometry: { type: "Point", coordinates: [lng, lat] } })) };
  const cls = ["coalesce", ["get", "c"], "t"];
  const isC = (...c) => ["in", cls, ["literal", c]];
  // line widths in px per zoom, Google-like hierarchy
  const W = { m: [8, 1.4, 11, 2.4, 13, 4, 15, 8, 17, 16, 19, 34], p: [9, 0.8, 11, 1.6, 13, 3.4, 15, 7, 17, 14, 19, 30], s: [10, 0.6, 12, 1.4, 14, 3.6, 16, 8, 18, 18, 19, 26],
              t: [11, 0.5, 13, 1.4, 15, 4.6, 17, 11, 19, 24], r: [12, 0.4, 14, 1.4, 16, 4.6, 18, 13, 19, 19], v: [14, 0.6, 16, 2.2, 18, 7, 19, 11], f: [15, 0.6, 17, 1.4, 19, 2.6] };
  const lw = (c, k = 1, add = 0) => ["interpolate", ["exponential", 1.4], ["zoom"], ...W[c].map((v, i) => i % 2 ? v * k + add : v)];
  const RS = d.roads?.features?.length ? "roads" : "streets";       // drawn roads: the traced network when present
  const road = (id, c, color, k, add, extra = {}) => ({ id, type: "line", source: RS, filter: ["all", isC(c), ["!", ["has", "tn"]]], minzoom: W[c][0],
    layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": color, "line-width": lw(c, k, add) }, ...extra });
  const area = (k, minzoom = 0) => ({ id: "a-" + k, type: "fill", source: "areas", minzoom, filter: ["==", ["get", "k"], k], paint: { "fill-color": C[k], "fill-antialias": true } });
  const caseW = c => ["interpolate", ["exponential", 1.4], ["zoom"], ...W[c].map((v, i) => i % 2 ? v + Math.max(1, v * 0.18) : v)];
  const style = {
    version: 8, name: "Pant Snake built-in map",
    glyphs: glyphURL(),
    sources: {
      land: { type: "geojson", data: d.land, attribution: "Coastline © SDFI (DAGI)" },
      areas: { type: "geojson", data: d.areas, tolerance: 0.3 },
      waterways: { type: "geojson", data: d.waterways },
      buildings: { type: "geojson", data: d.buildings, tolerance: 0.2 },
      roads: { type: "geojson", data: d.roads || EMPTY, tolerance: 0.25 },
      streets: { type: "geojson", data: d.streets, tolerance: 0.3, attribution: '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a> contributors' },
      rail: { type: "geojson", data: d.rail },
      tram: { type: "geojson", data: d.tram },
      places: { type: "geojson", data: places },
    },
    layers: [
      { id: "water", type: "background", paint: { "background-color": C.water } },
      { id: "land", type: "fill", source: "land", paint: { "fill-color": C.land, "fill-antialias": true } },
      area("farm", 10), area("res", 10), area("parking", 13), area("commercial", 12), area("industrial", 11), area("hospital", 11), area("edu", 11), area("allot", 12), area("cemetery", 11),
      area("grass", 11), area("scrub", 10), area("park"), area("wood"), area("pitch", 13), area("beach"), area("wetland", 10),
      { id: "a-water", type: "fill", source: "areas", filter: ["==", ["get", "k"], "water"], paint: { "fill-color": C.water, "fill-antialias": true } },
      { id: "waterway", type: "line", source: "waterways", minzoom: 11, layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": C.water, "line-width": ["interpolate", ["linear"], ["zoom"], 11, ["match", ["get", "k"], "river", 1.6, 0.6], 16, ["match", ["get", "k"], "river", 6, "canal", 5, 2.2], 19, ["match", ["get", "k"], "river", 14, 5]] } },
      { id: "building", type: "fill", source: "buildings", minzoom: 13.5, paint: { "fill-color": C.building, "fill-outline-color": C.buildingLine, "fill-opacity": ["interpolate", ["linear"], ["zoom"], 13.5, 0, 14.5, 1] } },
      { id: "rail", type: "line", source: "rail", minzoom: 10, filter: ["all", ["==", ["get", "k"], "rail"], ["!", ["has", "tn"]]],
        paint: { "line-color": C.rail, "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.8, 16, 2.4, 19, 4] } },
      { id: "rail-tie", type: "line", source: "rail", minzoom: 14, filter: ["all", ["==", ["get", "k"], "rail"], ["!", ["has", "tn"]]],
        paint: { "line-color": C.rail, "line-width": ["interpolate", ["linear"], ["zoom"], 14, 4, 19, 9], "line-dasharray": [0.15, 2.5] } },
      // street casings, then fills (minor first, motorways on top)
      { id: "path", type: "line", source: RS, minzoom: 15, filter: isC("f"), layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": C.path, "line-width": lw("f"), "line-dasharray": [2, 1.4] } },
      road("case-v", "v", C.case, 1, 1.2), road("case-r", "r", C.case, 1, 1.4), road("case-t", "t", C.case, 1, 1.6),
      road("case-s", "s", C.majorCase, 1, 1.8), road("case-p", "p", C.majorCase, 1, 2), road("case-m", "m", C.motorCase, 1, 2),
      { id: "case-rb", type: "line", source: RS, filter: ["all", ["has", "rb"], ["!", ["has", "c"]]], layout: { "line-join": "round" }, paint: { "line-color": C.case, "line-width": caseW("t") } },
      road("fill-v", "v", C.minor, 1, 0), road("fill-r", "r", C.minor, 1, 0), road("fill-t", "t", C.street, 1, 0),
      road("fill-s", "s", C.major, 1, 0), road("fill-p", "p", C.major, 1, 0), road("fill-m", "m", C.motor, 1, 0),
      { id: "tunnel", type: "line", source: RS, minzoom: 14, filter: ["all", ["has", "tn"], ["!", isC("f")]], paint: { "line-color": C.case, "line-width": lw("r"), "line-dasharray": [1, 1.2], "line-opacity": 0.8 } },
      { id: "tram", type: "line", source: "tram", minzoom: 11, paint: { "line-color": C.tram, "line-width": ["interpolate", ["linear"], ["zoom"], 11, 1, 18, 3], "line-dasharray": [3, 2] } },
      // labels
      { id: "water-name", type: "symbol", source: "places", filter: ["==", ["get", "k"], "water"], minzoom: 11,
        layout: { "text-field": ["get", "name"], "text-font": ["NotoSans-Italic"], "text-size": ["interpolate", ["linear"], ["zoom"], 11, 11.5, 16, 15], "text-letter-spacing": 0.05, "text-max-width": 8,
                  "symbol-sort-key": ["-", 0, ["coalesce", ["get", "area"], 1e7]] },
        paint: { "text-color": C.waterText, "text-halo-color": C.halo, "text-halo-width": 1 } },
      { id: "street-label", type: "symbol", source: "streets", minzoom: 13.2,
        filter: ["all", ["!=", ["get", "name"], ""], ["any", ["!", isC("f", "v")], [">=", ["zoom"], 16.5]], ["any", isC("m", "p", "s", "t"), [">=", ["zoom"], 14.8]]],
        layout: { "symbol-placement": "line", "text-field": ["get", "name"], "text-font": ["NotoSans-Regular"], "text-size": ["interpolate", ["linear"], ["zoom"], 13, 10, 16, 12, 19, 15],
                  "text-max-angle": 30, "symbol-spacing": 300, "symbol-sort-key": ["match", cls, "m", 0, "p", 1, "s", 2, "t", 3, "r", 4, 5] },
        paint: { "text-color": C.text, "text-halo-color": C.halo, "text-halo-width": 1.6 } },
      { id: "road-shield", type: "symbol", source: "streets", minzoom: 10.5, filter: ["has", "ref"],
        layout: { "symbol-placement": "line", "symbol-spacing": 420, "text-field": ["get", "ref"], "text-font": ["NotoSans-Medium"], "text-size": 10.5,
                  "text-rotation-alignment": "viewport", "icon-rotation-alignment": "viewport", "icon-image": ["case", ["==", cls, "m"], "mv-shield-y", "mv-shield-w"],
                  "icon-text-fit": "both", "icon-text-fit-padding": [1, 4, 1, 4], "symbol-sort-key": ["match", cls, "m", 0, 1] },
        paint: { "text-color": "#3C4043" } },
      { id: "green-name", type: "symbol", source: "places", minzoom: 13.5, filter: ["in", ["get", "k"], ["literal", ["park", "wood", "cemetery", "beach"]]],
        layout: { "text-field": ["get", "name"], "text-font": ["NotoSans-Medium"], "text-size": ["interpolate", ["linear"], ["zoom"], 13.5, 10.5, 17, 13], "text-max-width": 8,
                  "symbol-sort-key": ["-", 0, ["coalesce", ["get", "area"], 0]] },
        paint: { "text-color": C.greenText, "text-halo-color": C.halo, "text-halo-width": 1.4 } },
      { id: "poi-name", type: "symbol", source: "places", minzoom: 13.5, filter: ["in", ["get", "k"], ["literal", ["hospital", "edu"]]],
        layout: { "text-field": ["get", "name"], "text-font": ["NotoSans-Medium"], "text-size": 11, "text-max-width": 9 },
        paint: { "text-color": ["match", ["get", "k"], "hospital", dark ? "#E79A9A" : "#B3261E", dark ? "#B7A9E0" : "#5B4BA6"], "text-halo-color": C.halo, "text-halo-width": 1.4 } },
      { id: "place-label", type: "symbol", source: "places", filter: ["==", ["get", "k"], "place"],
        minzoom: 10,
        layout: { "text-field": ["get", "name"], "text-font": ["NotoSans-Medium"], "text-size": ["match", ["get", "rank"], 1, 17, 2, 12.5, 3, 11, 10.5], "text-letter-spacing": ["match", ["get", "rank"], 1, 0.02, 0.1],
                  "text-transform": ["match", ["get", "rank"], 1, "none", "uppercase"], "symbol-sort-key": ["get", "rank"], "text-max-width": 9 },
        paint: { "text-color": C.place, "text-halo-color": C.halo, "text-halo-width": 1.8,
                 "text-opacity": ["step", ["zoom"], ["match", ["get", "rank"], 1, 1, 0], 11, ["match", ["get", "rank"], 4, 0, 1], 14, ["match", ["get", "rank"], 1, 1, 2, 0.9, 0.8], 17, 0.5] } },
    ],
  };
  // the stitched OpenStreetMap picture sits on top of the drawn map; the drawn map only shows where the picture has gaps
  (d.osm?.chunks || []).forEach((c, i) => {
    style.sources["osm" + i] = { type: "image", url: here() + "demo-map/osm/" + c.file, coordinates: c.coordinates };
    style.layers.push({ id: "osm" + i, type: "raster", source: "osm" + i, paint: { "raster-fade-duration": 0, "raster-resampling": "linear",
      ...(dark ? { "raster-brightness-max": 0.62, "raster-saturation": -0.35, "raster-contrast": 0.05 } : {}) } });
  });
  style.layers.push({ id: "mv-top", type: "fill", source: "places", filter: ["has", "__none__"] });   // overlays (route, accuracy) go here, above everything
  return style;
}

function shield(fill, stroke) {                  // stretchable road-number badge
  const s = 2, w = 20 * s, h = 18 * s, c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d"); g.fillStyle = fill; g.strokeStyle = stroke; g.lineWidth = 1.5 * s;
  g.beginPath(); g.roundRect(g.lineWidth / 2, g.lineWidth / 2, w - g.lineWidth, h - g.lineWidth, 4 * s); g.fill(); g.stroke();
  return [{ width: w, height: h, data: new Uint8Array(g.getImageData(0, 0, w, h).data.buffer) },
          { pixelRatio: s, stretchX: [[6 * s, 14 * s]], stretchY: [[6 * s, 12 * s]], content: [3 * s, 3 * s, 17 * s, 15 * s] }];
}

function chevron(color) {                       // small arrow drawn along the route line
  const s = 24, c = document.createElement("canvas"); c.width = c.height = s;
  const g = c.getContext("2d"); g.strokeStyle = color; g.lineWidth = 3.2; g.lineCap = g.lineJoin = "round";
  g.beginPath(); g.moveTo(8, 6); g.lineTo(15, 12); g.lineTo(8, 18); g.stroke();
  return { width: s, height: s, data: new Uint8Array(g.getImageData(0, 0, s, s).data.buffer) };
}
function circlePoly(p, r, n = 48) {
  const out = [], kx = 111320 * Math.cos(p.lat * Math.PI / 180), ky = 110574;
  for (let i = 0; i <= n; i++) { const a = i / n * 2 * Math.PI; out.push([p.lng + Math.cos(a) * r / kx, p.lat + Math.sin(a) * r / ky]); }
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [out] } };
}

export const MAPVIEW_CSS = `
.mv,.mv.maplibregl-map{position:absolute;inset:0}
.mv .maplibregl-canvas:focus-visible{outline:3px solid #1D4ED8;outline-offset:-3px}
.mv-pin{width:0;height:0}
.mv-pin > *{position:absolute;left:0;top:0}
.mv-me{width:0;height:0;pointer-events:none}
.mv-me i{position:absolute;left:-9px;top:-9px;width:18px;height:18px;border-radius:50%;background:var(--mv-me,#1D4ED8);border:3px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.4)}
.mv-me b{position:absolute;left:-14px;top:-34px;width:28px;height:28px;background:linear-gradient(to top,var(--mv-me,#1D4ED8),transparent);clip-path:polygon(50% 0,100% 100%,50% 80%,0 100%);opacity:.75;transform-origin:50% 34px;display:none}
.mv-me.heading b{display:block}
.mv-flag{width:0;height:0;pointer-events:none}
.mv-flag svg{position:absolute;left:-3px;top:-34px}
.mv .maplibregl-ctrl-attrib{font:11px/1.4 system-ui,sans-serif}
.mv-note{position:absolute;left:8px;bottom:8px;z-index:5;font:600 11px/1.3 system-ui,sans-serif;background:rgba(255,255,255,.85);color:#3F3B35;border-radius:6px;padding:3px 7px;pointer-events:none;max-width:60%}
.mv-dark .mv-note{background:rgba(20,24,22,.8);color:#C9D2CC}
@media (max-width:600px){.mv-note{bottom:30px;max-width:calc(100% - 16px)}}
.mv-dark .maplibregl-ctrl-attrib{background:rgba(20,24,22,.75);color:#B9C3BD}
.mv-dark .maplibregl-ctrl-attrib a{color:#DDE5E0}
.mv-dark .maplibregl-ctrl-attrib-button{filter:invert(1)}
`;

export class MapView {
  /** opts: center [lat,lng], zoom, live (use the tile service), style / styleDark (URLs), dark, colors {route, routeLater, case, me, connector} */
  constructor(el, opts = {}) {
    if (!window.maplibregl) throw new Error("maplibre_missing");
    this.el = el; el.classList.add("mv"); el._mv = this;
    this.o = Object.assign({ center: [56.1567, 10.2108], zoom: 13, minZoom: 9, maxZoom: 19, live: false, style: OFM + "positron", styleDark: OFM + "dark", dark: false,
      colors: { route: "#1D4ED8", later: "#6E8FD8", case: "#FFFFFF", connector: "#1D4ED8", done: "#9AA3AB", acc: "#1D4ED8" } }, opts);
    this.dark = !!this.o.dark; this.mode = this.o.live ? "live" : "demo";
    this.listeners = {}; this.markers = new Map(); this.routeFC = EMPTY; this.user = null; this.end = null;
    const [lat, lng] = this.o.center;
    const initial = this.mode === "live" ? (this.dark ? this.o.styleDark : this.o.style) : { version: 8, sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": (this.dark ? DEMO_COL.dark : DEMO_COL.light).water } }] };
    this.map = new maplibregl.Map({ container: el, style: initial, center: [lng, lat], zoom: this.o.zoom, minZoom: this.o.minZoom, maxZoom: this.o.maxZoom,
      dragRotate: false, pitchWithRotate: false, touchPitch: false, attributionControl: { compact: true }, cooperativeGestures: false, fadeDuration: 150 });
    this.map.touchZoomRotate.disableRotation(); this.map.keyboard.disableRotation?.();
    // MapLibre ignores the first size change it observes; layouts that settle right after the map is created need this
    new ResizeObserver(() => { const c = this.map.getCanvas(); if (Math.abs(c.clientHeight - el.clientHeight) > 1 || Math.abs(c.clientWidth - el.clientWidth) > 1) this.map.resize(); }).observe(el);
    el.classList.toggle("mv-dark", this.dark);
    this.note = document.createElement("div"); this.note.className = "mv-note"; this.note.hidden = true; el.append(this.note);
    this.map.on("style.load", () => { this.styleOK = true; this._overlays(); this.setNote(); this._emit("style", this.mode); });
    this.map.on("click", e => this._emit("click", { lat: e.lngLat.lat, lng: e.lngLat.lng }));
    this.map.on("dragstart", () => this._emit("drag"));
    this.map.on("moveend", () => this._emit("move"));
    if (this.mode === "live") {
      this.map.on("error", e => { if (!this.styleOK) this._fallback(e?.error); });
      this._t = setTimeout(() => { if (!this.styleOK) this._fallback(new Error("style_timeout")); }, 9000);
    } else this._demo();
  }
  on(ev, fn) { (this.listeners[ev] ||= []).push(fn); }
  _emit(ev, ...a) { (this.listeners[ev] || []).forEach(f => { try { f(...a); } catch (e) { console.error(e); } }); }
  async _demo() {
    try {
      const d = await loadDemo(); this.styleOK = false; this.map.setStyle(demoStyle(d, this.dark), { diff: false });
      // the stitched picture is sharp to about zoom 15 and soft beyond; stop before it turns to mush
      this.hasPic = !!d.osm?.chunks?.length; this.map.setMaxZoom(this.hasPic ? Math.min(this.o.maxZoom, 16.6) : this.o.maxZoom);
      this.detailed = this.hasPic || !!d.roads?.features?.length; this.setNote();     // every street is drawn: the "main streets only" note no longer applies
      d.ready.then(b => {
        const put = () => { const src = this.mode === "demo" && this.map.getSource("buildings"); if (src) src.setData(b); };
        if (this.styleOK) put(); else this.map.once("style.load", put);
      });
    }
    catch (e) { console.error("demo map", e); this._emit("error", e); }
  }
  _fallback(err) {
    if (this.mode === "demo") return;
    console.warn("map style failed, using the built-in map", err);
    clearTimeout(this._t); this.mode = "demo"; this._emit("fallback", err); this._demo();
  }
  setDark(d) {
    d = !!d; if (d === this.dark) return; this.dark = d; this.el.classList.toggle("mv-dark", d);
    if (this.mode === "live") { this.styleOK = false; this.map.setStyle(d ? this.o.styleDark : this.o.style, { diff: false }); } else this._demo();
  }
  /** small label shown on the built-in map only (e.g. "Built-in map: main streets only") */
  setNote(text = this.o.demoNote) { this.o.demoNote = text; this.note.textContent = text || ""; this.note.hidden = !(text && this.mode === "demo" && !this.detailed); }
  setColors(c) { Object.assign(this.o.colors, c); if (this.styleOK) this._overlays(); }

  _overlays() {
    const m = this.map, C = this.o.colors;
    const first = m.getLayer("mv-top") ? "mv-top" : m.getStyle().layers.find(l => l.type === "symbol")?.id;          // draw under the labels
    const add = (layer, before = first) => { if (m.getLayer(layer.id)) m.removeLayer(layer.id); m.addLayer(layer, before); };
    for (const [id, data] of [["mv-route", this.routeFC], ["mv-acc", this.user?.acc ? circlePoly(this.user, this.user.acc) : EMPTY]]) {
      if (m.getSource(id)) m.getSource(id).setData(data); else m.addSource(id, { type: "geojson", data });
    }
    if (!m.hasImage("mv-shield-y")) { m.addImage("mv-shield-y", ...shield("#FDE293", "#D9A92B")); m.addImage("mv-shield-w", ...shield("#FFFFFF", "#9AA0A6")); }
    for (const [k, col] of [["mv-chev", C.case], ["mv-chev-dark", C.route]]) { if (m.hasImage(k)) m.removeImage(k); m.addImage(k, chevron(col), { pixelRatio: 2 }); }
    const zw = (a, b) => ["interpolate", ["exponential", 1.5], ["zoom"], 12, a, 18, b];
    const isLeg = ["==", ["get", "kind"], "leg"];
    add({ id: "mv-acc-fill", type: "fill", source: "mv-acc", paint: { "fill-color": C.acc, "fill-opacity": 0.12 } });
    add({ id: "mv-acc-line", type: "line", source: "mv-acc", paint: { "line-color": C.acc, "line-opacity": 0.45, "line-width": 1 } });
    add({ id: "mv-route-case", type: "line", source: "mv-route", filter: isLeg, layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": C.case, "line-width": zw(6, 14) } });
    add({ id: "mv-route-later", type: "line", source: "mv-route", filter: ["all", isLeg, ["==", ["get", "state"], "later"]], layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": C.later, "line-width": zw(3.5, 9) } });
    add({ id: "mv-route-next", type: "line", source: "mv-route", filter: ["all", isLeg, ["==", ["get", "state"], "next"]], layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": C.route, "line-width": zw(4.5, 11) } });
    add({ id: "mv-route-straight", type: "line", source: "mv-route", filter: ["==", ["get", "kind"], "straight"], layout: { "line-cap": "round" }, paint: { "line-color": C.route, "line-width": 3, "line-dasharray": [1.2, 1.6], "line-opacity": 0.8 } });
    add({ id: "mv-route-connector", type: "line", source: "mv-route", filter: ["==", ["get", "kind"], "connector"], layout: { "line-cap": "round" }, paint: { "line-color": C.connector, "line-width": 2.5, "line-dasharray": [0.6, 1.8] } });
    add({ id: "mv-route-arrows", type: "symbol", source: "mv-route", filter: isLeg, minzoom: 13,
      layout: { "symbol-placement": "line", "symbol-spacing": 70, "icon-image": "mv-chev", "icon-size": ["interpolate", ["linear"], ["zoom"], 13, 0.7, 18, 1.1], "icon-allow-overlap": true, "icon-ignore-placement": true, "icon-rotation-alignment": "map" } });
  }
  _set(id, data) { const s = this.styleOK && this.map.getSource(id); if (s) s.setData(data); }

  // ----- view -----
  get lat() { return this.map.getCenter().lat; }
  get lng() { return this.map.getCenter().lng; }
  get z() { return this.map.getZoom(); }
  setView(lat, lng, z = this.z, animate = true) { this.map.easeTo({ center: [lng, lat], zoom: z, duration: animate ? 500 : 0 }); }
  fit(points, pad = 50, maxZ = 16, animate = false) {
    const p = points.filter(x => x && x.lat != null); if (!p.length) return;
    if (p.length === 1) return this.setView(p[0].lat, p[0].lng, Math.min(maxZ, 16), animate);
    const lngs = p.map(x => x.lng), lats = p.map(x => x.lat);
    this.map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: pad, maxZoom: maxZ, duration: animate ? 600 : 0 });
  }
  zoomAt(d) { this.map.easeTo({ zoom: this.z + d, duration: 250 }); }
  redraw() { this.map.resize(); }
  project(p) { return this.map.project([p.lng, p.lat]); }

  // ----- markers: [{ id, lat, lng, el, z, draggable, onDragEnd({lat,lng}) }] -----
  setMarkers(items) {
    const keep = new Set(items.map(i => i.id));
    for (const [id, m] of this.markers) if (!keep.has(id)) { m.marker.remove(); this.markers.delete(id); }
    for (const it of items) {
      let m = this.markers.get(it.id);
      if (!m) {
        const wrap = document.createElement("div"); wrap.className = "mv-pin";
        wrap.addEventListener("click", e => e.stopPropagation());
        const marker = new maplibregl.Marker({ element: wrap, anchor: "center", draggable: !!it.draggable }).setLngLat([it.lng, it.lat]).addTo(this.map);
        m = { marker, wrap, it }; this.markers.set(it.id, m);
        marker.on("dragstart", () => { m.dragging = true; wrap.classList.add("dragging"); });
        marker.on("dragend", () => { const ll = marker.getLngLat(); wrap.classList.remove("dragging"); setTimeout(() => m.dragging = false, 250); m.it.onDragEnd && m.it.onDragEnd({ lat: ll.lat, lng: ll.lng }); });
      }
      if (m.wrap.firstChild !== it.el) { m.wrap.innerHTML = ""; m.wrap.append(it.el); }
      if (!m.dragging) m.marker.setLngLat([it.lng, it.lat]);
      m.marker.setDraggable(!!it.draggable);
      m.wrap.style.zIndex = it.z ?? 1; m.it = it;
    }
  }
  isDragging(id) { return !!this.markers.get(id)?.dragging; }

  /** route: { legs:[{ coords:[[lng,lat]…], connectors?:[[a,b],[c,d]], straight? }], active: index of the leg being walked } — or null */
  setRoute(route) {
    const f = [];
    (route?.legs || []).forEach((l, i) => {
      if (!l.coords || l.coords.length < 2) return;
      const state = i < (route.active ?? 0) ? "done" : i === (route.active ?? 0) ? "next" : "later";
      if (state === "done") return;
      if (l.straight) { f.push({ type: "Feature", properties: { kind: "straight", state }, geometry: { type: "LineString", coordinates: l.coords } }); return; }
      const core = l.connectors ? l.coords.slice(1, -1) : l.coords;
      if (core.length > 1) f.push({ type: "Feature", properties: { kind: "leg", state }, geometry: { type: "LineString", coordinates: core } });
      for (const c of l.connectors || []) if (c[0] && c[1] && (c[0][0] !== c[1][0] || c[0][1] !== c[1][1])) f.push({ type: "Feature", properties: { kind: "connector", state }, geometry: { type: "LineString", coordinates: c } });
    });
    this.routeFC = { type: "FeatureCollection", features: f.sort((a, b) => (a.properties.state === "next") - (b.properties.state === "next")) };
    this._set("mv-route", this.routeFC);
  }
  setUser(p) {
    this.user = p;
    if (!p) { this._me?.remove(); this._me = null; this._set("mv-acc", EMPTY); return; }
    if (!this._me) { const e = document.createElement("div"); e.className = "mv-me"; e.innerHTML = "<b></b><i></i>"; e.setAttribute("aria-hidden", "true"); this._me = new maplibregl.Marker({ element: e, anchor: "center" }).setLngLat([p.lng, p.lat]).addTo(this.map); this._meEl = e; }
    this._me.setLngLat([p.lng, p.lat]);
    this._meEl.classList.toggle("heading", p.heading != null);
    if (p.heading != null) this._meEl.querySelector("b").style.transform = `rotate(${p.heading}deg)`;
    this._meEl.style.setProperty("--mv-me", this.o.colors.route);
    this._set("mv-acc", p.acc ? circlePoly(p, p.acc) : EMPTY);
  }
  setEnd(p) {
    this.end = p;
    if (!p) { this._end?.remove(); this._end = null; return; }
    if (!this._end) { const e = document.createElement("div"); e.className = "mv-flag"; e.innerHTML = `<svg width="22" height="36" viewBox="0 0 22 36"><path d="M3 2v33" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M4 3h15l-4 6 4 6H4z" fill="currentColor"/></svg>`; e.style.color = "var(--ink,#111)"; this._end = new maplibregl.Marker({ element: e, anchor: "center" }).addTo(this.map); }
    this._end.setLngLat([p.lng, p.lat]);
  }
}
