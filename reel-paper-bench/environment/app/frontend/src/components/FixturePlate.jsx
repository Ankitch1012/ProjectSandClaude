import React from 'react';
import { formatDistance } from '../bench-state';

export default function FixturePlate({
  fixtures,
  fixture,
  unit,
  onFixture,
  onUnit,
}) {
  return (
    <section className="fixture-plate" aria-label="Cutting-unit fixture plate">
      <div className="plate-title">
        <span>POST-GRIND PAPER SOP</span>
        <strong aria-label="Active fixture ID">{fixture.id}</strong>
      </div>

      <div className="fixture-choice" role="group" aria-label="Cutting-unit plate">
        {fixtures.map((entry) => (
          <button
            key={entry.id}
            type="button"
            aria-label={`Use ${entry.id}`}
            aria-pressed={entry.id === fixture.id}
            onClick={() => onFixture(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <dl className="plate-specs">
        <div><dt>Blades</dt><dd aria-label="Fixture blade count">{fixture.bladeCount}</dd></div>
        <div><dt>Drive end</dt><dd aria-label="Drive end screen side">{fixture.driveSide}</dd></div>
        <div><dt>Drive / click</dt><dd aria-label="Click pitch">{formatDistance(fixture.adjusters.drive.clickPitchMm, unit)}</dd></div>
        <div><dt>Drive limit</dt><dd aria-label="Click limit">{fixture.adjusters.drive.maxClicks} clicks</dd></div>
        <div><dt>Drive closes</dt><dd aria-label="Drive adjuster closing direction">{fixture.closeDirection.drive}</dd></div>
        <div><dt>Non-drive closes</dt><dd aria-label="Non-drive adjuster closing direction">{fixture.closeDirection.nonDrive}</dd></div>
        <div><dt>ND / click</dt><dd aria-label="Non-drive click pitch">{formatDistance(fixture.adjusters.nonDrive.clickPitchMm, unit)}</dd></div>
        <div><dt>ND limit</dt><dd aria-label="Non-drive click limit">{fixture.adjusters.nonDrive.maxClicks} clicks</dd></div>
        <div><dt>Drive arrived</dt><dd aria-label="Drive last approach">{fixture.adjusters.drive.lastApproach}</dd></div>
        <div><dt>ND arrived</dt><dd aria-label="Non-drive last approach">{fixture.adjusters.nonDrive.lastApproach}</dd></div>
        <div><dt>Reverse take-up</dt><dd aria-label="Drive reversal take-up">{fixture.adjusters.drive.takeupClicks} click</dd></div>
        <div><dt>ND take-up</dt><dd aria-label="Non-drive reversal take-up">{fixture.adjusters.nonDrive.takeupClicks} click</dd></div>
        <div><dt>No drag asks</dt><dd aria-label="No-drag correction">{formatDistance(fixture.correctionMm.noDrag, unit)} close</dd></div>
        <div><dt>Binding asks</dt><dd aria-label="Binding correction">{formatDistance(fixture.correctionMm.binding, unit)} open</dd></div>
      </dl>

      <button className="unit-toggle" type="button" onClick={onUnit}>
        {unit === 'mm' ? 'SHOW INCHES' : 'SHOW MILLIMETRES'}
      </button>
    </section>
  );
}
