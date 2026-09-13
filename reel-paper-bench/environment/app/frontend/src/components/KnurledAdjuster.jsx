import React from 'react';
import { displayRecommendation, formatDistance } from '../bench-state';

export default function KnurledAdjuster({ end, recommendation, fixture, unit }) {
  const name = end === 'drive' ? 'Drive-end' : 'Non-drive';
  const shown = displayRecommendation(recommendation, fixture, unit);
  const statusText = shown.status === 'withheld'
    ? 'WITHHOLD'
    : shown.status === 'turn'
      ? 'TURN'
      : 'NO MOVE';

  return (
    <article className={`adjuster adjuster-${end}`} aria-label={`${name} adjuster`}>
      <div className="knurl" aria-hidden="true">
        <i /><i /><i /><i /><i /><i /><i /><i />
      </div>
      <div className="adjuster-copy">
        <span>{name.toUpperCase()}</span>
        <strong aria-label={`${name} recommendation status`}>{statusText}</strong>
        <div className="adjuster-values">
          <output aria-label={`${name} click count`}>{shown.clicks}</output>
          <span>clicks</span>
          <output aria-label={`${name} turn direction`}>{shown.direction}</output>
          <output aria-label={`${name} movement`}>
            {formatDistance(shown.movementMm, unit)}
          </output>
        </div>
        {shown.capped && <b aria-label={`${name} limit status`}>LIMIT REACHED</b>}
      </div>
    </article>
  );
}
