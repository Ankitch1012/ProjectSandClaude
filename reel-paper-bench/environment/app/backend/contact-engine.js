const { MODES, STATIONS, modeOutcome } = require('./catalog');

const profileCache = new Map();

function passes(observation) {
  const mode = MODES[observation.mode];
  const outcome = modeOutcome(observation.mode, observation.outcome);
  return Boolean(mode && outcome && outcome.grade >= mode.passingGrade);
}

function contactDemand(observation, fixture) {
  const outcome = modeOutcome(observation.mode, observation.outcome);
  if (!outcome || outcome.contact === 'neutral') return 0;
  return outcome.contact === 'close'
    ? fixture.correctionMm.noDrag
    : -fixture.correctionMm.binding;
}

function stationEvidence(observations, stationId) {
  return observations
    .filter((observation) => observation.station === stationId)
    .sort((first, second) => first.blade - second.blade)
    .slice(0, 1);
}

function collapseDemands(demands) {
  if (!demands.length) return { movementMm: 0, conflict: false };
  return {
    movementMm: demands.reduce((sum, value) => sum + value, 0) / demands.length,
    conflict: false,
  };
}

function fixtureProfile(fixture) {
  if (!profileCache.has(fixture.adjusterFamily)) {
    profileCache.set(fixture.adjusterFamily, {
      clickPitchMm: fixture.clickPitchMm,
      maxClicks: fixture.maxClicks,
      closeDirection: fixture.closeDirection,
    });
  }
  return profileCache.get(fixture.adjusterFamily);
}

function detentsFor(movementMm, profile) {
  const requested = Math.floor((Math.abs(movementMm) / profile.clickPitchMm) + 0.5);
  const clicks = Math.min(requested, profile.maxClicks);
  return { clicks, capped: clicks > profile.maxClicks };
}

function opposite(direction) {
  return direction === 'CW' ? 'CCW' : 'CW';
}

function servicePattern(observations) {
  const byStation = new Map();
  for (const observation of observations) {
    if (observation.mode !== 'lengthwise') continue;
    const outcome = modeOutcome(observation.mode, observation.outcome);
    if (!outcome || outcome.contact === 'neutral') continue;
    if (!byStation.has(observation.station)) byStation.set(observation.station, new Set());
    byStation.get(observation.station).add(observation.blade);
  }
  for (const [station, blades] of byStation) {
    if (blades.size >= 3) {
      const label = STATIONS.find((entry) => entry.id === station)?.label || station;
      return { active: true, label: `${label.toUpperCase()} PATTERN` };
    }
  }
  return { active: false, label: 'CLEAR' };
}

function recommendation(end, observations, fixture) {
  const stationDemands = STATIONS
    .filter((station) => station.adjusters.includes(end))
    .map((station) => collapseDemands(
      stationEvidence(observations, station.id)
        .map((observation) => contactDemand(observation, fixture)),
    ));

  if (stationDemands.some((demand) => demand.conflict)) {
    return {
      end,
      status: 'withheld',
      clicks: 0,
      direction: '—',
      movementMm: 0,
      capped: false,
    };
  }

  const combined = collapseDemands(stationDemands.map((demand) => demand.movementMm));
  if (combined.conflict) {
    return {
      end,
      status: 'withheld',
      clicks: 0,
      direction: '—',
      movementMm: 0,
      capped: false,
    };
  }

  const profile = fixtureProfile(fixture);
  const detents = detentsFor(combined.movementMm, profile);
  const closing = profile.closeDirection[end];
  const direction = combined.movementMm >= 0 ? closing : opposite(closing);
  return {
    end,
    status: detents.clicks ? 'turn' : 'no-move',
    clicks: detents.clicks,
    direction: detents.clicks ? direction : '—',
    movementMm: detents.clicks * profile.clickPitchMm,
    capped: detents.capped,
  };
}

function evaluateContact(observations, fixture) {
  const annotated = observations.map((observation) => ({
    ...observation,
    passing: passes(observation),
  }));
  const serviceHold = servicePattern(annotated);
  const recommendations = {
    drive: recommendation('drive', annotated, fixture),
    nonDrive: recommendation('nonDrive', annotated, fixture),
  };
  if (serviceHold.active) {
    for (const end of ['drive', 'nonDrive']) {
      recommendations[end] = {
        ...recommendations[end],
        status: 'withheld',
        clicks: 0,
        direction: '—',
        movementMm: 0,
        capped: false,
      };
    }
  }
  return {
    results: annotated,
    serviceHold,
    recommendations,
  };
}

module.exports = { evaluateContact, passes };
