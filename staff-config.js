// Settings for the collector app (collector.html) and the dashboard (admin.html). Loaded after config.js.
// On claude.ai outside map servers are blocked, so the apps use the built-in Aarhus map there. Anywhere else
// (Netlify, GitHub Pages…) they use the full OpenFreeMap street map.
const ON_CLAUDE = /claude|^localhost$|^127\./.test(location.hostname) || location.protocol === "file:";
const HERE = location.origin + location.pathname.replace(/[^/]*$/, "");
Object.assign(window.SNAKE_CONFIG, {
  // The public address of the pedestrian page (no trailing slash): what the QR codes open. Empty = this folder.
  PUBLIC_BASE_URL: "",
  LINK_TEMPLATE: "https://claude.ai/artifact/CjsgP29v32VgiCjLhkk7fa#{id}",  // optional instead of PUBLIC_BASE_URL, e.g. "https://kigyo.hu/?s={id}"

  // ---- Map ----
  // A MapLibre style URL. Default: OpenFreeMap, free with no key and no view limit (OpenStreetMap data, every street,
  // path, building and house number). Other options: a MapTiler or Stadia Maps style URL with your key in it.
  // "" = always use the built-in Aarhus map.
  MAP_STYLE: ON_CLAUDE ? "" : "https://tiles.openfreemap.org/styles/positron",
  MAP_STYLE_DARK: ON_CLAUDE ? "" : "https://tiles.openfreemap.org/styles/dark",
  // Google base map (Map Tiles API). Needs the Map Tiles API enabled and a key restricted to this site's address.
  // If it fails, the app falls back to the OpenFreeMap style above. Empty = don't use Google.
  GOOGLE_MAPS_KEY: ON_CLAUDE ? "" : "AIzaSyCBG49koBtKDFXMpyjQ2hV2JGXrrYjsts4",

  // ---- Street routing (routes that follow the streets, real walking/cycling times) ----
  // "ors"   openrouteservice by HeiGIT: free key at https://account.heigit.org (about 2,000 routes a day free). Recommended.
  // "osrm"  your own OSRM server(s), one with the foot profile and one with the bicycle profile (OSRM_FOOT / OSRM_BIKE).
  // "graph" the built-in Aarhus main-street network (no key, works offline, less precise).
  // Whatever you choose, the app falls back to "graph" and then to straight lines if the service doesn't answer.
  ROUTING_PROVIDER: "graph",
  ORS_KEY: "",        // paste the openrouteservice key here (it's sent from the browser, so restrict it to your site in the HeiGIT dashboard if offered)
  ORS_BASE: "https://api.heigit.org/openrouteservice",
  OSRM_FOOT: "",      // e.g. "https://osrm-foot.example.dk"
  OSRM_BIKE: "",      // e.g. "https://osrm-bike.example.dk"

  // ---- Toolkit ads ----
  ADVERTISE_EMAIL: "", // shown to collectors as "Sell gear to collectors? Advertise here"
});
