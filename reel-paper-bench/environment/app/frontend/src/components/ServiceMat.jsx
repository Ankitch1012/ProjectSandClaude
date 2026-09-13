import React from 'react';
import BladeTape from './BladeTape';
import PaperSwatch from './PaperSwatch';
import KnurledAdjuster from './KnurledAdjuster';
import { orderedStations, screenEnds } from '../bench-state';

export default function ServiceMat({
  state,
  blade,
  unit,
  released,
  onBlade,
  onResult,
  onFreeSpin,
  onRelease,
}) {
  const { fixture, results, recommendations, release } = state;
  const stations = orderedStations(fixture);
  const ends = screenEnds(fixture);

  return (
    <main className="service-mat" aria-label="Reel paper service mat">
      <div className="mat-stamp">
        <span>CUTTING EDGE WITNESS</span>
        <strong>Blade {blade} / {fixture.bladeCount}</strong>
      </div>

      <BladeTape bladeCount={fixture.bladeCount} selected={blade} onSelect={onBlade} />

      <section className="reel-bed" aria-label="Cutting edge">
        <div className="reel-cylinder" aria-hidden="true">
          {Array.from({ length: fixture.bladeCount }, (_, index) => (
            <i key={index} style={{ '--blade': index }} />
          ))}
        </div>
        <div className="bedknife">
          <span>{ends.left}</span>
          <b>BEDKNIFE CONTACT LINE</b>
          <span>{ends.right}</span>
        </div>
      </section>

      <div className={`service-hold ${state.serviceHold.active ? 'active' : ''}`}>
        <span>EDGE PATTERN</span>
        <output aria-label="Service hold status">{state.serviceHold.label}</output>
      </div>

      <section className="swatch-track" aria-label="Five paper stations">
        {stations.map((station) => (
          <PaperSwatch
            key={station.id}
            fixtureId={fixture.id}
            station={station}
            blade={blade}
            results={results}
            onResult={onResult}
          />
        ))}
      </section>

      <section className="adjuster-deck" aria-label="Bedbar adjusters">
        <KnurledAdjuster
          end="drive"
          recommendation={recommendations.drive}
          fixture={fixture}
          unit={unit}
        />
        <div className="deck-note">
          <span>OBSERVATIONS</span>
          <strong aria-label="Completed observations">{release.completed}</strong>
          <small>of {release.expected}</small>
        </div>
        <KnurledAdjuster
          end="nonDrive"
          recommendation={recommendations.nonDrive}
          fixture={fixture}
          unit={unit}
        />
      </section>

      <section className="release-apron" aria-label="Release controls">
        <label>
          <input
            type="checkbox"
            aria-label="Full free-spin check"
            checked={state.freeSpin}
            onChange={(event) => onFreeSpin(event.target.checked)}
          />
          <span>
            <strong>FULL HAND ROTATION</strong>
            Reel turns freely without a hard spot
          </span>
        </label>
        <button
          type="button"
          disabled={!release.ready}
          onClick={onRelease}
        >
          RELEASE CUTTING UNIT
        </button>
        <output aria-label="Release status">
          {released ? 'RELEASED' : release.ready ? 'READY FOR RELEASE' : 'HOLD'}
        </output>
      </section>
    </main>
  );
}
