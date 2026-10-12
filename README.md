# Marathon Build

A single-page marathon training dashboard (`index.html`), published as a claude.ai Artifact.

- **Week**: today's workout and the current week's plan with target paces, matched against your Strava runs.
- **Progress**: planned vs. run weekly mileage across the 18-week build, plus recent runs.
- **Paces**: VDOT-based training paces and race equivalents from a recent benchmark.
- **Weather**: AccuWeather conditions with a heat/dew-point pace adjustment and the 10-day forecast next to your plan.
- **Plan**: race settings (name, date, goal, peak mileage, weather location) and the full plan by phase.

Strava and AccuWeather data come through claude.ai connectors; settings are saved in the artifact's database.
