// What collecting is worth: CO2 saved, money saved, and fun milestones. All figures are estimates; every
// assumption is a number in IMPACT below, with where it comes from, so it can be changed in one place.

export const IMPACT = {
  // Dansk Retursystem: about 223,000 t CO2 saved in 2022 against incinerating the containers and making new ones,
  // from about 2 billion bottles and cans returned → ≈ 0.11 kg per container. (For an aluminium can alone the
  // Aluminum Association's 2021 can LCA gives 0.099 kg CO2e saved per can recycled.)
  co2PerContainerKg: 0.11,
  // money per container, by currency: the deposit that goes back into circulation (Denmark: A 1 kr, B 1.50 kr,
  // C 3 kr, most cans are A → ≈ 1.1 kr on average; Hungary: 50 Ft per container since 2024)
  deposit: { DKK: 1.1, HUF: 50, EUR: 0.15 },
  // ASSUMPTION, set it with your municipality: what it costs the city to pick up one littered can or bottle.
  cleanup: { DKK: 0.5, HUF: 25, EUR: 0.07 },
  // value of one collector hour, for the time planned routes save (only routes started in the app count)
  hour: { DKK: 180, HUF: 3500, EUR: 25 },
  // flights: ≈ 0.13 kg CO2e per passenger-km for economy short and medium haul (EEA/ICAO based route figures,
  // e.g. Amsterdam–Rome ≈ 175 kg one way)
  flightKgPerKm: 0.13,
  carKgPerKm: 0.12,                  // average petrol car, per km
};

export const CITIES = [
  { name: "Aarhus", country: "DK", lat: 56.1567, lng: 10.2108 }, { name: "Copenhagen", country: "DK", lat: 55.6761, lng: 12.5683 },
  { name: "Odense", country: "DK", lat: 55.4038, lng: 10.4024 }, { name: "Aalborg", country: "DK", lat: 57.0488, lng: 9.9217 },
  { name: "Budapest", country: "HU", lat: 47.4979, lng: 19.0402 }, { name: "Debrecen", country: "HU", lat: 47.5316, lng: 21.6273 },
  { name: "Szeged", country: "HU", lat: 46.253, lng: 20.1414 }, { name: "Malmö", country: "SE", lat: 55.605, lng: 13.0038 },
  { name: "Stockholm", country: "SE", lat: 59.3293, lng: 18.0686 }, { name: "Oslo", country: "NO", lat: 59.9139, lng: 10.7522 },
  { name: "Berlin", country: "DE", lat: 52.52, lng: 13.405 }, { name: "Hamburg", country: "DE", lat: 53.5511, lng: 9.9937 },
  { name: "Amsterdam", country: "NL", lat: 52.3676, lng: 4.9041 }, { name: "Vienna", country: "AT", lat: 48.2082, lng: 16.3738 },
  { name: "Prague", country: "CZ", lat: 50.0755, lng: 14.4378 }, { name: "Warsaw", country: "PL", lat: 52.2297, lng: 21.0122 },
  { name: "Paris", country: "FR", lat: 48.8566, lng: 2.3522 }, { name: "London", country: "GB", lat: 51.5074, lng: -0.1278 },
  { name: "Madrid", country: "ES", lat: 40.4168, lng: -3.7038 }, { name: "Rome", country: "IT", lat: 41.9028, lng: 12.4964 },
];
export const COUNTRY = { DK: "Danmark / Denmark", HU: "Magyarország / Hungary", SE: "Sverige / Sweden", NO: "Norge / Norway", DE: "Deutschland / Germany",
  NL: "Nederland", AT: "Österreich / Austria", CZ: "Česko / Czechia", PL: "Polska / Poland", FR: "France", GB: "United Kingdom", ES: "España / Spain", IT: "Italia / Italy" };
export const FLAG = c => c ? String.fromCodePoint(...[...c.toUpperCase()].map(x => 0x1F1E6 + x.charCodeAt(0) - 65)) : "";
export const currencyOf = country => country === "DK" ? "DKK" : country === "HU" ? "HUF" : "EUR";
export const cityOf = name => CITIES.find(c => c.name === name) || CITIES[0];

const km = (a, b) => { const R = 6371, r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(s)); };
const PLACES = { Berlin: { lat: 52.52, lng: 13.405 }, Rome: { lat: 41.9028, lng: 12.4964 }, Paris: { lat: 48.8566, lng: 2.3522 },
  "New York": { lat: 40.7128, lng: -74.006 }, London: { lat: 51.5074, lng: -0.1278 }, Tokyo: { lat: 35.6762, lng: 139.6503 }, Barcelona: { lat: 41.3874, lng: 2.1686 } };

/** totals for a number of containers and minutes saved */
export function impactOf(containers, minutesSaved = 0, currency = "DKK") {
  const co2 = containers * IMPACT.co2PerContainerKg;
  const deposit = containers * IMPACT.deposit[currency], cleanup = containers * IMPACT.cleanup[currency], time = minutesSaved / 60 * IMPACT.hour[currency];
  return { co2, deposit, cleanup, time, money: deposit + cleanup + time, currency };
}

/** Milestones in kg CO2e. Flights start from the collector's own city; one is a famous route. */
export function milestones(homeCity = "Aarhus", lang = "en") {
  const da = lang === "da", home = cityOf(homeCity), name = home.name === "Copenhagen" && da ? "København" : home.name;
  const fly = (dest, alt) => { const d = home.name === dest ? alt : dest; return { kg: Math.round(km(home, PLACES[d]) * IMPACT.flightKgPerKm), icon: "✈️",
    text: da ? `En flyrejse fra ${name} til ${d === "Rome" ? "Rom" : d === "New York" ? "New York" : d === "Paris" ? "Paris" : d === "Barcelona" ? "Barcelona" : d}` : `A flight from ${name} to ${d}` }; };
  const L = (en, dk) => da ? dk : en;
  return [
    { kg: 3, icon: "🫖", text: L("A cup of tea every day for a year (the kettle's electricity)", "En kop te hver dag i et år (strømmen til elkedlen)") },
    { kg: 7, icon: "📺", text: L("A 200-hour Netflix binge", "200 timers Netflix i træk") },
    { kg: 20, icon: "🍔", text: L("Seven beef burgers", "Syv bøfburgere") },
    { kg: 52, icon: "🐄", text: L("Everything a cow burps out in a week", "Alt det, en ko bøvser ud på en uge") },
    fly("Berlin", "Paris"),
    fly("Rome", "Paris"),
    { kg: 220, icon: "🌳", text: L("What a big tree absorbs in ten years", "Hvad et stort træ optager på ti år") },
    fly("Barcelona", "Rome"),
    { kg: Math.round(km(PLACES.London, PLACES["New York"]) * IMPACT.flightKgPerKm), icon: "🗽", text: L("A flight from London to New York", "En flyrejse fra London til New York") },
    fly("New York", "Tokyo"),
    { kg: Math.round(40075 * IMPACT.carKgPerKm), icon: "🌍", text: L("Driving a car once around the Earth", "At køre en bil én gang jorden rundt") },
    { kg: Math.round(384400 * IMPACT.carKgPerKm), icon: "🌕", text: L("Driving a car to the Moon", "At køre en bil til Månen") },
  ].sort((a, b) => a.kg - b.kg);
}
