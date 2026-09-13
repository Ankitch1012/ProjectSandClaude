# Paused cavitation runs come back as different trials

I use Cavitation Lab to compare repeated runs, but after I pause and refresh, the setup returns without the same trial number, clock, or recent sample rows. A real change to velocity, depth, or temperature should pause the lab and start one clean trial for the new point. Choosing the point that is already active should leave the paused clock and history alone.

STEP should append one immutable reading without starting playback. RESET should open a fresh default trial even when the controls already show their defaults, and that reset should survive another refresh. A paused trial should reopen exactly as I left it, while refreshing during playback should return to the last paused checkpoint rather than a partly recorded frame.

The keyboard should behave the same when a slider has focus. Opening the keyboard guide from its button or the question-mark shortcut should pause without discarding the trial; closing it should not resume. While the guide is open, playback, step, reset, preset, and velocity shortcuts should leave the run untouched.

Presets sometimes split one choice into several trials, and sample rows can show the previous clock or operating point. Sliders, presets, and their matching shortcuts should create one consistent setup in any order. The live Telemetry panel is the reference for the selected point; each retained row and comparison pin should freeze the same velocity, depth, temperature, drag coefficient, and drag force that were shown when it was captured.

The comparison shelf is unreliable too. Pinning a candidate can rewrite the reference I already saved, swapping them leaves the deltas pointing the wrong way, and a refresh loses both cards. A pin should be a frozen copy of the latest reading from a paused trial. Reference and Candidate should remain independent while I start or reset other trials, survive refreshes, swap together with the sign of Candidate minus Reference, and clear only when I use CLEAR. There should be nothing to pin before a trial has a sample or while it is still playing.

On my phone the setup controls run past the edge, the readings crowd each other, the recent-sample ledger covers the experiment, and the flow field is reduced to a thin strip. I need to adjust a run and still see a useful flow view, with the telemetry, plots, history, and keyboard guide readable and reachable after resizing. This is the obstructed view I get:

<img src="/app/problem_assets/broken.png" alt="current (broken) app" width="900" />

The same run should remain contained and usable like this:

<img src="/app/problem_assets/target.png" alt="expected app" width="900" />
