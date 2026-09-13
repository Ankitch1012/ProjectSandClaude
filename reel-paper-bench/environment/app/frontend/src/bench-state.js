export function acceptSnapshot(current, incoming) {
  const received = [current, incoming].filter(Boolean);
  return received[received.length - 1];
}

export function orderedStations(fixture) {
  return fixture.stations;
}

export function screenEnds() {
  return { left: 'DRIVE END', right: 'NON-DRIVE END' };
}

export function formatDistance(mm, unit, digits = 3) {
  const value = unit === 'in' ? mm / 25.4 : mm;
  return `${value.toFixed(unit === 'in' ? 4 : digits)} ${unit}`;
}

export function displayRecommendation(recommendation, fixture, unit) {
  if (unit !== 'in' || !recommendation.clicks) return recommendation;
  const displayedMovement = recommendation.movementMm / 25.4;
  return {
    ...recommendation,
    clicks: Math.ceil(displayedMovement / fixture.clickPitchMm),
  };
}
