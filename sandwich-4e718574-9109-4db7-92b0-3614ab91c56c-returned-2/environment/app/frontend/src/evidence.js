export function recordedFindingCount(entries = []) {
  return entries.filter((entry) => entry.code).length;
}

export function recordedFindings(entries = []) {
  return entries
    .filter((entry) => entry.code)
    .map((entry) => ({
      courseId: entry.courseId,
      state: entry.code === 1 ? 'affected' : 'clear',
    }));
}
