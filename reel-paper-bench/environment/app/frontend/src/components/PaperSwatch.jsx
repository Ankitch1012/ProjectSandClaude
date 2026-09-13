import React from 'react';

const CHOICES = {
  lengthwise: [
    ['no-drag', 'No drag'],
    ['light-drag', 'Light even drag'],
    ['binding', 'Binding'],
  ],
  upright: [
    ['clean-cut', 'Clean cut'],
    ['ragged-cut', 'Ragged / partial'],
    ['no-cut', 'No cut'],
  ],
};

function OutcomeGroup({ fixtureId, station, blade, mode, value, onResult }) {
  const title = mode === 'lengthwise' ? 'Draw lengthwise' : 'Present upright';
  return (
    <fieldset aria-label={`${station.label} ${mode} paper`}>
      <legend>{title}</legend>
      <div className="outcome-options">
        {CHOICES[mode].map(([outcome, label]) => (
          <label key={outcome}>
            <input
              type="radio"
              name={`${fixtureId}-${blade}-${station.id}-${mode}`}
              aria-label={`${station.label} ${mode}: ${label}`}
              checked={value === outcome}
              onChange={() => onResult({ blade, station: station.id, mode, outcome })}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function PaperSwatch({ fixtureId, station, blade, results, onResult }) {
  const valueFor = (mode) => results.find(
    (result) => result.blade === blade
      && result.station === station.id
      && result.mode === mode,
  );
  const lengthwise = valueFor('lengthwise');
  const upright = valueFor('upright');
  const complete = Boolean(lengthwise && upright);
  const passing = complete && lengthwise.passing && upright.passing;

  return (
    <article
      className={`paper-swatch ${complete ? 'observed' : ''} ${passing ? 'passing' : ''}`}
      aria-label={`${station.label} paper swatch`}
      data-fixture={fixtureId}
    >
      <div className="paper-grain" aria-hidden="true" />
      <header>
        <span>{station.shortLabel}</span>
        <output aria-label={`${station.label} check status`}>
          {complete ? (passing ? 'PASS' : 'CHECK') : 'OPEN'}
        </output>
      </header>
      <OutcomeGroup
        fixtureId={fixtureId}
        station={station}
        blade={blade}
        mode="lengthwise"
        value={lengthwise?.outcome}
        onResult={onResult}
      />
      <OutcomeGroup
        fixtureId={fixtureId}
        station={station}
        blade={blade}
        mode="upright"
        value={upright?.outcome}
        onResult={onResult}
      />
    </article>
  );
}
