export function latestCount(row) {
  return row.counts.at(-1);
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
    available: onHand + inTransit,
    latest,
    variance: latest - onHand,
  };
}

function binParts(bin) {
  const match = /^([A-Z]+)-(\d+)$/.exec(bin);
  return match ? { aisle: match[1], position: Number(match[2]) } : null;
}

export function canLinkTransposition(item) {
  if (item.rows.length !== 2) return false;
  const [left, right] = item.rows;
  const a = binParts(left.bin);
  const b = binParts(right.bin);
  const variances = item.rows.map(rowVariance);
  return Boolean(
    a && b &&
    a.aisle === b.aisle &&
    Math.abs(a.position - b.position) === 1 &&
    left.sku !== right.sku &&
    variances[0] !== 0 &&
    variances[0] + variances[1] === 0
  );
}

export function requiredSerialScans(item) {
  if (!item.serialized) return 0;
  return item.rows.reduce(
    (sum, row) => sum + (row.serialRequired ?? Math.max(0, -rowVariance(row))),
    0,
  );
}

export function scannedSerials(item) {
  return item.rows.reduce((sum, row) => sum + (row.scanned?.length || 0), 0);
}

export function canAdjust(item) {
  const withinThreshold = item.rows.every(row => Math.abs(rowVariance(row)) <= item.threshold);
  return withinThreshold && scannedSerials(item) >= requiredSerialScans(item);
}
