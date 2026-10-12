// Pull daily recovery data (Garmin → intervals.icu) into a compact JSON file for the dashboard's database.
//
//   NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node tools/pull-wellness.mjs [--days 180] [--out wellness.json]
//
// Then store it in the artifact database as collection "wellness", doc "daily" (ArtifactData "set" with file_path),
// which the dashboard's Recovery card reads. The intervals.icu key comes from INTERVALS_API_KEY or the
// environment's network secret for intervals.icu.
import fs from "node:fs";
const args = process.argv.slice(2);
const opt = (n, d) => { const k = args.indexOf(n); return k >= 0 ? args[k + 1] : d; };
const days = Number(opt("--days", 180)), out = opt("--out", "wellness.json");
const headers = {};
if (process.env.INTERVALS_API_KEY) headers.Authorization = "Basic " + Buffer.from(`API_KEY:${process.env.INTERVALS_API_KEY}`).toString("base64");
const iso = (d) => d.toISOString().slice(0, 10);
const newest = new Date(), oldest = new Date(Date.now() - days * 864e5);
const r = await fetch(`https://intervals.icu/api/v1/athlete/${process.env.INTERVALS_ATHLETE_ID || 0}/wellness?oldest=${iso(oldest)}&newest=${iso(newest)}`, { headers });
if (!r.ok) { console.error(`intervals.icu refused: ${r.status} ${(await r.text()).slice(0, 300)}`); process.exit(1); }
const num = (v, k = 1) => (typeof v === "number" && isFinite(v) && v > 0 ? Math.round(v * k) / k : null);
const rows = (await r.json()).map((w) => ({
  d: w.id,
  hrv: num(w.hrv, 10), rhr: num(w.restingHR), sleep: num(w.sleepSecs ? w.sleepSecs / 3600 : null, 10),
  score: num(w.sleepScore), ctl: num(w.ctl, 10), atl: num(w.atl, 10),
})).filter((x) => x.hrv || x.rhr || x.sleep || x.ctl);
fs.writeFileSync(out, JSON.stringify({ updated: new Date().toISOString(), source: "Garmin via intervals.icu", days: rows }));
const last = rows[rows.length - 1] || {};
console.log(`${rows.length} days written to ${out}; latest ${last.d}: HRV ${last.hrv ?? "-"}, RHR ${last.rhr ?? "-"}, sleep ${last.sleep ?? "-"} h`);
