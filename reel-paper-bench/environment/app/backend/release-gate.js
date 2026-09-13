const { passes } = require('./contact-engine');

function releaseGate(observations, freeSpin, fixture) {
  const expected = fixture.bladeCount * fixture.stations.length * 2;
  const coverageByBlade = Array(fixture.bladeCount);
  for (const observation of observations) {
    const index = observation.blade - 1;
    coverageByBlade[index] = (coverageByBlade[index] || 0) + 1;
  }
  const complete = coverageByBlade.every((count) => count === fixture.stations.length * 2);
  const passing = complete && observations.every(passes);
  return {
    ready: complete && passing && freeSpin,
    complete,
    passing,
    expected,
    completed: observations.length,
  };
}

module.exports = { releaseGate };
