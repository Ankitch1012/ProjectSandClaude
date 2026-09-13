function pointFor(record, id) {
  const anchor = record.anchors.find((entry) => entry.id === id);
  if (anchor) return { ...anchor, kind: 'anchor' };
  const coil = record.coils.find((entry) => entry.id === id);
  if (coil) return { ...coil, kind: 'coil' };
  const crossing = record.crossings.find((entry) => entry.id === id);
  if (crossing) return { ...crossing, kind: crossing.type };
  return null;
}

function buildSegments(record, course) {
  const points = course.points.map((id) => pointFor(record, id)).filter(Boolean);
  return points.slice(0, -1).map((from, index) => ({
    id: `${course.id}:S${index + 1}`,
    courseId: course.id,
    from,
    to: points[index + 1],
  }));
}

function decodeFindings(record) {
  return (record.initial.courseFindings || [])
    .filter((entry) => entry.code)
    .map((entry) => ({ ...entry, state: entry.code ? 'affected' : 'clear' }));
}

function classifyAxis(record, course) {
  const first = pointFor(record, course.points[0]);
  const last = pointFor(record, course.points[course.points.length - 1]);
  const angle = Math.atan2(last.y - first.y, last.x - first.x) * 180 / Math.PI;
  const folded = ((angle % 180) + 180) % 180;
  if (folded < 25 || folded > 155) return 'crosswise';
  if (folded > 65 && folded < 115) return 'lengthwise';
  return folded < 90 ? 'falling' : 'rising';
}

function canonicalCourse(course) {
  const endpoints = [course.points[0], course.points[course.points.length - 1]].sort();
  return `${endpoints[0]}:${endpoints[1]}:${course.axis}`;
}

function anchorStatus(record, course) {
  const xs = record.frame.map(([x]) => x);
  const ys = record.frame.map(([, y]) => y);
  const bounds = {
    left: Math.min(...xs),
    right: Math.max(...xs),
    top: Math.min(...ys),
    bottom: Math.max(...ys),
  };
  return [course.points[0], course.points[course.points.length - 1]].every((id) => {
    const point = pointFor(record, id);
    return point && (
      point.x === bounds.left || point.x === bounds.right
      || point.y === bounds.top || point.y === bounds.bottom
    );
  });
}

function courseViews(record, survey) {
  const decoded = decodeFindings(record);
  return record.courses.map((course, sortedIndex) => {
    const segments = buildSegments(record, course);
    const affected = segments.some((segment) => (
      survey.affectedSegments.has(segment.id)
      || decoded.some((entry) => entry.courseId === course.id && entry.state === 'affected')
    ));
    return {
      ...course,
      sortedIndex,
      canonicalId: canonicalCourse(course),
      classifiedAxis: classifyAxis(record, course),
      segments: segments.map((segment) => ({
        ...segment,
        affected: survey.affectedSegments.has(segment.id),
      })),
      affected,
    };
  });
}

module.exports = {
  anchorStatus,
  buildSegments,
  courseViews,
  decodeFindings,
  pointFor,
};
