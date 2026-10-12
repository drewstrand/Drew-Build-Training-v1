// Push the Marathon Build plan to an intervals.icu calendar, which then sends each workout to Garmin.
//
//   [INTERVALS_API_KEY=...] [INTERVALS_ATHLETE_ID=0] node tools/push-intervals.mjs [--from YYYY-MM-DD] [--weeks N] [--settings settings.json] [--dry-run]
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
  this.api = { S, NW, weekStart, weekOf, buildWeek, icuRun, icuBike, textToSteps, liftSteps, fitEncode, SPORT, fmtD, add, TODAY };
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
for (let k = 0; k < events.length; k += 50) {
  const batch = events.slice(k, k + 50);
  const r = await fetch(`https://intervals.icu/api/v1/athlete/${athlete}/events/bulk?upsert=true`, {
    method: "POST", headers, body: JSON.stringify(batch) });
  const body = await r.text();
  if (!r.ok) { console.error(`intervals.icu refused batch ${k / 50 + 1}: ${r.status} ${body.slice(0, 400)}`); process.exit(1); }
  console.log(`batch ${k / 50 + 1}: ${batch.length} events ok`);
}
console.log("Done. intervals.icu sends upcoming workouts to Garmin Connect, and your watch picks them up on its next sync.");
