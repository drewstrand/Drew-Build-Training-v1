// Push the Marathon Build plan to an intervals.icu calendar, which then sends each workout to Garmin.
//
//   [INTERVALS_API_KEY=...] [INTERVALS_ATHLETE_ID=0] node tools/push-intervals.mjs [--from YYYY-MM-DD] [--weeks N] [--settings settings.json] [--sync-thresholds] [--dry-run]
//
// --prune deletes events this plan created earlier (external_id "marathon-build:...") that fall inside the pushed
// date range but are no longer in the plan, e.g. after a day swap or a new race date.
// --sync-thresholds sets intervals.icu's Ride FTP and Run threshold pace to the dashboard's values first, because
// intervals.icu stores workout targets as percentages of those.
//
// Runs and rides go up as Garmin workout files (.FIT) built by the dashboard's own encoder, so the steps and
// targets match the Download week button exactly. Lifts and swims go up as notes on the right day.
// Every event has a stable external_id, so running this again updates the calendar instead of duplicating it.
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const opt = (name, dflt) => { const k = args.indexOf(name); return k >= 0 ? args[k + 1] : dflt; };
const DRY = args.includes("--dry-run");
const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(here, "..", "index.html"), "utf8");
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
const planCode = scripts[scripts.length - 1][1].split("/* ===================== Rendering")[0];

// Run the dashboard's plan code with the saved settings (export them from the artifact's database).
const settings = opt("--settings") ? JSON.parse(fs.readFileSync(opt("--settings"), "utf8")) : {};
const ctx = { console, TextEncoder, Date, Math, JSON, Number, String, Array, Object, Uint8Array, Set,
  localStorage: { getItem: () => null, setItem() {} }, window: {} };
vm.createContext(ctx);
vm.runInContext(planCode + `
  S = {...DEF, ...${JSON.stringify(settings)}};
  var ftpW = () => Number(S.ftp) > 0 ? Number(S.ftp) : 0;
  this.api = { S, Z, MI, ftpW, NW, weekStart, weekOf, buildWeek, icuRun, icuBike, textToSteps, liftSteps, fitEncode, SPORT, fmtD, add, TODAY };
`, ctx);
const P = ctx.api;

const from = opt("--from", P.TODAY);
const first = Math.max(0, P.weekOf(from));
const weeks = Number(opt("--weeks", P.NW() - first));
const b64 = (u8) => Buffer.from(u8).toString("base64");
const clean = (t) => t.split(" · ").join(". ");

const events = [];
for (let i = first; i < Math.min(P.NW(), first + weeks); i++) {
  P.buildWeek(i).forEach((d, k) => {
    const ds = P.add(P.weekStart(i), k);
    if (ds < from) return;
    const id = (kind, n = 0) => `marathon-build:${ds}:${kind}${n ? ":" + n : ""}`;
    const at = `${ds}T00:00:00`;
    if (d.mi > 0) {
      const name = `${d.mi} mi ${d.t.split(/[.:(]/)[0]}`.slice(0, 60);
      events.push({ category: "WORKOUT", start_date_local: at, type: "Run", name, external_id: id("run"),
        description: d.t, filename: `${ds}-run.fit`,
        file_contents_base64: b64(P.fitEncode(name.slice(0, 31), ...P.SPORT.run, P.textToSteps(P.icuRun(d), "run"))) });
    }
    d.x.forEach((s, n) => {
      const head = s.t.split(" · ")[0].replace(/^(PM, 6\+ hours after the morning session\. |At the gym\. )/, "");
      if (s.sp === "bike") {
        const name = `${s.amt} ${head.split(/[.:(]/)[0]}`.slice(0, 60);
        events.push({ category: "WORKOUT", start_date_local: at, type: "Ride", name, external_id: id("ride", n),
          description: s.t, filename: `${ds}-ride.fit`,
          file_contents_base64: b64(P.fitEncode(name.slice(0, 31), ...P.SPORT.bike, P.textToSteps(P.icuBike(s), "bike"))) });
      } else if (s.sp === "lift") {
        events.push({ category: "WORKOUT", start_date_local: at, type: "WeightTraining", name: head.slice(0, 60),
          external_id: id("lift", n), description: clean(s.t) });
      } else if (s.sp === "swim") {
        events.push({ category: "WORKOUT", start_date_local: at, type: "Swim", name: `Swim ${s.amt}`,
          external_id: id("swim", n), description: s.t });
      } else {
        events.push({ category: "NOTE", start_date_local: at, name: head.slice(0, 60), external_id: id("note", n), description: s.t });
      }
    });
    if (d.mi === 0 && !d.x.length && /travel|Christmas|New Year|Thanksgiving/i.test(d.t))
      events.push({ category: "NOTE", start_date_local: at, name: d.t.split(".")[0].slice(0, 60), external_id: id("note"), description: d.t });
  });
}

console.log(`${events.length} events from ${from}, weeks ${first + 1}-${Math.min(P.NW(), first + weeks)}`);
if (DRY) {
  console.log(JSON.stringify(events.slice(0, 4).map(e => ({ ...e, file_contents_base64: e.file_contents_base64 ? `<${e.file_contents_base64.length} chars>` : undefined })), null, 2));
  process.exit(0);
}

// The key comes from INTERVALS_API_KEY, or from a network secret on the cloud environment
// (Basic auth, username API_KEY, host intervals.icu), which the agent proxy attaches to each request.
const key = process.env.INTERVALS_API_KEY;
const athlete = process.env.INTERVALS_ATHLETE_ID || "0";
const headers = { "Content-Type": "application/json" };
if (key) headers.Authorization = "Basic " + Buffer.from(`API_KEY:${key}`).toString("base64");
const api = (path, init = {}) => fetch(`https://intervals.icu/api/v1/athlete/${athlete}${path}`, { ...init, headers });
if (args.includes("--sync-thresholds")) {
  const z = P.Z(), thr = +(P.MI / (z.T * 60)).toFixed(4), ftp = P.ftpW();
  const sports = await (await api("/sport-settings")).json();
  for (const sp of sports) {
    const t = sp.types || [], body = {};
    if (t.includes("Run") && Math.abs((sp.threshold_pace || 0) - thr) > 0.005) body.threshold_pace = thr;
    if (t.includes("Ride") && ftp && sp.ftp !== ftp) body.ftp = ftp;
    if (!Object.keys(body).length) continue;
    const r = await api(`/sport-settings/${sp.id}`, { method: "PUT", body: JSON.stringify(body) });
    if (!r.ok) { console.error(`Couldn't update ${t[0]} thresholds: ${r.status}`); process.exit(1); }
    console.log(`${t[0]} thresholds updated:`, JSON.stringify(body));
  }
}
for (let k = 0; k < events.length; k += 50) {
  const batch = events.slice(k, k + 50);
  const r = await api("/events/bulk?upsert=true", { method: "POST", body: JSON.stringify(batch) });
  const body = await r.text();
  if (!r.ok) { console.error(`intervals.icu refused batch ${k / 50 + 1}: ${r.status} ${body.slice(0, 400)}`); process.exit(1); }
  console.log(`batch ${k / 50 + 1}: ${batch.length} events ok`);
}
if (args.includes("--prune") && events.length) {
  const dates = events.map(e => e.start_date_local.slice(0, 10)).sort(), keep = new Set(events.map(e => e.external_id));
  const have = await (await api(`/events?oldest=${from}&newest=${P.add(P.weekStart(Math.min(P.NW(), first + weeks) - 1), 6)}`)).json();
  for (const e of have) {
    if (!String(e.external_id || "").startsWith("marathon-build:") || keep.has(e.external_id)) continue;
    const r = await api(`/events/${e.id}`, { method: "DELETE" });
    console.log(`${r.ok ? "removed" : "couldn't remove"} stale ${e.start_date_local.slice(0, 10)} ${e.name}`);
  }
}
console.log("Done. intervals.icu sends upcoming workouts to Garmin Connect, and your watch picks them up on its next sync.");
