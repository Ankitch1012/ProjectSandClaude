export function recordedFindingCount(entries = []) {
  return entries.filter((entry) => entry.code).length;
}
