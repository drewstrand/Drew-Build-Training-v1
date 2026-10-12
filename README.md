# Marathon Build

A single-page marathon training dashboard (`index.html`), published as a claude.ai Artifact.

- **Week**: today's workout and the current week's plan with target paces and heart rates, matched against your Strava runs.
- **Progress**: planned vs. run weekly mileage across the 18-week build, plus recent runs.
- **Paces**: VDOT-based training paces and race equivalents from your Strava best efforts (or a manual benchmark).
- **Plan**: race settings (name, date, goal, peak mileage, plan start, starting volume) and the full plan by phase.

Set up for Grandma's Marathon (June 19, 2027), a sub-3:30 goal and a 50-mile peak week:

- **Weeks 1–18, hybrid training**: 3 runs (Mon workout, Wed easy, Sat long), 4 lifts (2 lower on the hard run/ride days,
  2 upper on easier days, mixing strength, Olympic lifts and mobility), 2 rides and 1 swim a week, in three 6-week phases
  (Rebuild, Strength, Power), with a lighter week and a 5K time trial every fourth week.
- **Weeks 19–36, marathon build**: base, threshold, marathon specific and taper, with lifting dropping from twice a
  week to one maintenance session, plus easy swims and spins for recovery.

The Plan tab lists the research behind the structure (intensity distribution, heavy and plyometric strength,
concurrent-training spacing, VO2max intervals, strength maintenance, fueling).

All run data comes from the Strava connector in claude.ai (needs a Strava subscription): activities, heart rate zones,
and per-run best efforts and heart rate. The page prompts you to connect Strava when it isn't connected.
Settings and per-run details are saved in the artifact's database.
