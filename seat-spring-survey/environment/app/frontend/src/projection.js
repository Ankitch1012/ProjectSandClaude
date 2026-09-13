export function projectPoint(_record, point) {
  return { x: point.x, y: point.y };
}

export function pointerPoint(svg, event) {
  const rect = svg.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function distanceToSegment(point, segment) {
  const vx = segment.to.x - segment.from.x;
  const vy = segment.to.y - segment.from.y;
  const wx = point.x - segment.from.x;
  const wy = point.y - segment.from.y;
  const lengthSquared = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, ((wx * vx) + (wy * vy)) / lengthSquared));
  const dx = point.x - (segment.from.x + t * vx);
  const dy = point.y - (segment.from.y + t * vy);
  return Math.hypot(dx, dy);
}

export function nearestSegment(point, courses) {
  let nearest = null;
  for (const course of courses) {
    for (const segment of course.segments) {
      const distance = distanceToSegment(point, segment);
      if (!nearest || distance < nearest.distance) {
        nearest = { courseId: course.id, segmentId: segment.id, distance };
      }
    }
  }
  return nearest && nearest.distance <= 34 ? nearest : null;
}
