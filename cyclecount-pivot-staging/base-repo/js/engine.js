export function latestCount(row) {
  return row.counts[0];
}

export function rowVariance(row) {
  return latestCount(row) - row.onHand;
}

export function summarize(item) {
  const onHand = item.rows.reduce((sum, row) => sum + row.onHand, 0);
  const inTransit = item.rows.reduce((sum, row) => sum + row.inTransit, 0);
  const latest = item.rows.reduce((sum, row) => sum + latestCount(row), 0);
  return {
    onHand,
    inTransit,
    available: onHand,
    latest,
    variance: latest - onHand - inTransit,
  };
}

export function canLinkTransposition(item) {
  if (item.rows.length !== 2) return false;
  return item.rows[0].sku === item.rows[1].sku &&
    rowVariance(item.rows[0]) + rowVariance(item.rows[1]) === 0;
}

export function requiredSerialScans(item) {
  return item.serialized ? 0 : item.rows.reduce((sum, row) => sum + Math.max(0, -rowVariance(row)), 0);
}

export function scannedSerials(item) {
  return item.rows.reduce((sum, row) => sum + (row.scanned?.length || 0), 0);
}

export function canAdjust(item) {
  return item.rows.every(row => Math.abs(rowVariance(row)) < item.threshold);
}
