# Keep each colocated leaf-pack pair scientifically comparable

When I analyze the supplied intermittent-stream recovery, the channel map and paired results do not always agree with the field and laboratory records. Each coarse/fine replicate is one fixed spatial anchor: both bags must share its site, batch, species, cohort, replicate, deployment window, and bed elevation at the study’s stated precision, with exactly one bag of each mesh.

Water-contact duration is an estimate. Add each signed datum offset to its stage reading, normalize timezone-aware timestamps, and linearly interpolate only between valid adjacent readings whose gap is no greater than that study’s limit. Stage equals-or-exceeds the bag threshold is wet; count only `[deployment, retrieval)`, sum before rounding, and never extrapolate. Conflicting duplicate timestamps, invalid readings, excessive gaps, or unbracketed coverage make an estimate indeterminate only when they interrupt that bag’s required window; quality problems wholly outside it do not.

Recovered AFDM is `(dry gross − dry tare) − (ash gross − ash tare)`. Invalid net masses, ash above dry mass, and nonpositive corrected initial AFDM are unavailable rather than clamped. Match controls by site, batch, species, mesh, and cohort. Controls also have stable identities: identical repeated records count once, conflicting records for one identity are unusable, and another valid exact match remains usable. Average each distinct usable control’s recovered-AFDM-to-loaded-mass ratio, then apply that mean ratio to the deployed bag’s loaded mass. For each visible bag, show recovered AFDM, the applied mean ratio, corrected initial AFDM, and proportional mass loss.

Disturbed and lost bags remain visible but are ineligible, and a lost bag exposes no recovered AFDM or proportional loss even if stale numbers were recorded. Missing hydroperiod, control, or mate also makes the pair ineligible. Coarse and fine members need present, distinct bag identities, and one site/batch/species/cohort/replicate identity can belong to only one spatial anchor. For each eligible anchor, report coarse proportional mass loss minus fine proportional mass loss, including zero or negative values. The reach result is the equal-weight mean of eligible anchor contrasts, and `n` counts anchors—not bags. This is descriptive only and must not be presented as a causal contribution or divided by wet duration.

Filtering changes visibility only, never reach membership. If filtering or a new analysis hides the selected anchor, clear selection and do not revive it when the filter later widens; if it remains visible, keep the same anchor identity. Spatial anchors never reorder. At 1440, 760, and 390 pixels wide, the channel, anchor glyphs and hit targets, filter shoal, recovery tag, laboratory values, and analysis action must remain aligned, contained, readable, and reachable, including after a live resize.

In the broken view, the recovery tag and laboratory controls cover the channel while downstream filtering hides the work area.

<img src="/app/problem_assets/broken.png" alt="Current RifflePair map with recovery controls covering the spatial channel" width="900" />

The target keeps the same reach, selected anchor, values, and viewport while separating the spatial map from every analysis control.

<img src="/app/problem_assets/target.png" alt="Expected RifflePair map with separated spatial and analytical regions" width="900" />
