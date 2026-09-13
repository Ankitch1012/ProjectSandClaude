function crossingGroups(record) {
  const parent = new Map(record.courses.map((course) => [course.id, course.id]));
  const root = (id) => {
    let current = id;
    while (parent.get(current) !== current) current = parent.get(current);
    return current;
  };
  for (const crossing of record.crossings) {
    const [first, ...rest] = crossing.courseIds;
    for (const next of rest) parent.set(root(next), root(first));
  }
  return new Set(record.courses.map((course) => root(course.id))).size;
}

module.exports = { crossingGroups };
