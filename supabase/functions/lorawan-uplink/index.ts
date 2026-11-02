import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const TOKEN = Deno.env.get("UPLINK_TOKEN");

function decode(b: number[]) {
  if (b.length < 7) return null;
  const coils = (b[1] << 8) | b[2];
  const withCans = [...Array(12).keys()].filter((i) => coils & (1 << i));
  return {
    type: ["alive", "level", "emptied"][b[0]] ?? "unknown",
    coils_with_cans: withCans,
    any_can: coils !== 0,
    battery_v: ((b[3] << 8) | b[4]) / 1000,
    temperature_c: b[5] === 0xff ? null : b[5] - 40,
    counter: b[6],
  };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  if (TOKEN && req.headers.get("authorization") !== "Bearer " + TOKEN) return new Response("unauthorized", { status: 401 });
  const msg = await req.json();
  // Accept the decoded JSON from the network's decoder, or the raw ChirpStack message (base64 "data")
  const devEui = msg.devEUI ?? msg.devEui ?? msg.deviceInfo?.devEui ?? msg.end_device_ids?.dev_eui ?? msg.deviceId ?? "unknown";
  let d = msg.object ?? msg.decoded ?? msg.uplink_message?.decoded_payload ?? null;
  if (!d?.type && msg.data) d = decode([...atob(msg.data)].map((c) => c.charCodeAt(0)));
  const rx = msg.rxInfo?.[0] ?? {};
  const { error } = await db.from("snake_uplinks").insert({
    dev_eui: String(devEui).toUpperCase(),
    type: d?.type, coils_with_cans: d?.coils_with_cans, any_can: d?.any_can,
    battery_v: d?.battery_v, temperature_c: d?.temperature_c, counter: d?.counter,
    rssi: rx.rssi ?? null, snr: rx.loRaSNR ?? rx.snr ?? null, raw: msg,
  });
  return error ? new Response(error.message, { status: 500 }) : new Response("ok");
});
