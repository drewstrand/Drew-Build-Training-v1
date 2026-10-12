# Marathon Build

A single-page marathon training dashboard (`index.html`), published as a claude.ai Artifact.

- **Week**: today's workout and the current week's plan with target paces and heart rates, matched against your Strava runs.
- **Progress**: planned vs. run weekly mileage across the 18-week build, plus recent runs.
- **Paces**: VDOT-based training paces and race equivalents from your Strava best efforts (or a manual benchmark).
- **Plan**: race settings (name, date, goal, peak mileage, plan start, starting volume) and the full plan by phase.

Set up for Grandma's Marathon (June 19, 2027), a sub-3:30 goal and a 50-mile peak week:

- **Weeks 1–3, recover and settle in**: easy, short sessions after the Oct 4 Portland marathon and around a new job.
- **Weeks 4–18, hybrid training** (Rebuild, Strength, Power): 3 runs (Mon workout, Wed easy, Sat long), 3 lifts
  (a 4th optional in good weeks) mixing strength, Olympic lifts and mobility, 2 rides and 1 swim once there's a pool.
  Tuesday and Friday are recovery days. Every 4th week is lighter, with a 5K time trial. FTP test in week 4.
- **Boston weather**: dark-evening guidance from November, and from mid-December to mid-February long runs cap at
  60–75 min with the time moved to indoor rides. Winter weeks show cold and ice rules (NWS wind chill chart,
  ACSM 2021 cold-weather consensus). Holidays are rest days.
- **Trips home to Minnesota** (Thanksgiving Nov 25–29, Christmas Dec 23–Jan 1, editable): travel days are rest days,
  an easy run lost to travel moves to the next free day, rides move to a gym spin bike, no swims, colder rules.
- **Garmin**: the Week tab downloads a zip of Garmin workout files (.FIT) for a week or the next 4 weeks.
  Copy them to the watch's GARMIN/NewFiles folder. Runs carry pace ranges, rides carry watts from FTP,
  and lifts step through each set with rest timers using Garmin's exercise codes. The encoder is validated
  against Garmin's FIT SDK decoder (all 264 plan workouts decode with no errors). "Copy for Garmin" still
  copies intervals.icu workout text for anyone using intervals.icu.
  Lifts logged as Garmin Strength activities show their sets and weights from Strava.
- **Weeks 19–36, marathon build**: base, threshold, marathon specific and taper, with lifting dropping from twice a
  week to one maintenance session, plus easy swims and spins for recovery.

The Plan tab lists the research behind the structure (intensity distribution, heavy and plyometric strength,
concurrent-training spacing, VO2max intervals, strength maintenance, fueling).

Bike watts come from your FTP (Strava's estimate or one you enter). All run data comes from the Strava connector in claude.ai (needs a Strava subscription): activities, heart rate zones,
and per-run best efforts and heart rate. The page prompts you to connect Strava when it isn't connected.
Settings and per-run details are saved in the artifact's database.
