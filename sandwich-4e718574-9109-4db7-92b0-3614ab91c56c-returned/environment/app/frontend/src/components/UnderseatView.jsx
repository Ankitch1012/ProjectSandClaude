import React, { useRef } from 'react';
import { nearestSegment, pointerPoint, projectPoint } from '../projection';

const axisColor = {
  crosswise: '#d95d39',
  lengthwise: '#287271',
  falling: '#6c5ce7',
  rising: '#b8860b',
};

export default function UnderseatView({
  survey,
  selectedCourseId,
  selectedCoilId,
  onSelectCourse,
  onSelectCoil,
}) {
  const svgRef = useRef(null);
  const { record, courses, coils } = survey;

  function projected(point) {
    return projectPoint(record, point);
  }

  function handlePointer(event) {
    const point = pointerPoint(svgRef.current, event);
    const hit = nearestSegment(point, courses);
    if (hit) onSelectCourse(hit.courseId, hit.segmentId);
  }

  const framePoints = record.frame
    .map(([x, y]) => projected({ x, y }))
    .map((point) => `${point.x},${point.y}`)
    .join(' ');

  return (
    <section className="underseat-stage" aria-label="Underside spring record">
      <div className="orientation-stamp">
        <span aria-label="Recorded front edge">FRONT · {record.orientation.front}</span>
        <span aria-label="Recorded chair-left edge">CHAIR LEFT · {record.orientation.chairLeft}</span>
      </div>
      <svg
        ref={svgRef}
        viewBox="0 0 1000 740"
        role="img"
        aria-label="Spring deck underside"
        onPointerDown={handlePointer}
      >
        <defs>
          <pattern id="webbing" width="18" height="18" patternUnits="userSpaceOnUse">
            <rect width="18" height="18" fill="#91826d" />
            <path d="M0 4H18M0 13H18" stroke="#b7a891" strokeWidth="3" />
          </pattern>
          <filter id="shadow">
            <feDropShadow dx="4" dy="5" stdDeviation="3" floodOpacity=".25" />
          </filter>
        </defs>

        <polygon points={framePoints} fill="#5a392a" stroke="#2b1b15" strokeWidth="18" filter="url(#shadow)" />
        <polygon points={framePoints} fill="#d8c7aa" stroke="#8b654b" strokeWidth="5" />

        {record.webbing.map((webbing, index) => (
          <rect
            key={webbing.id}
            x={index % 2 ? 545 : 185}
            y="95"
            width="250"
            height="560"
            fill="url(#webbing)"
            opacity=".64"
            aria-label={`${webbing.label} status ${webbing.status}`}
          />
        ))}

        {courses.map((course) => (
          <g
            key={course.id}
            aria-label={`${course.id} course path`}
            opacity={selectedCourseId && selectedCourseId !== course.id ? .44 : 1}
          >
            {course.segments.map((segment) => {
              const from = projected(segment.from);
              const to = projected(segment.to);
              return (
                <line
                  key={segment.id}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={segment.affected || course.affected ? '#c62828' : axisColor[course.classifiedAxis]}
                  strokeWidth={selectedCourseId === course.id ? 13 : 8}
                  strokeDasharray={course.classifiedAxis === 'rising' ? '18 8' : undefined}
                  strokeLinecap="round"
                  data-segment={segment.id}
                />
              );
            })}
          </g>
        ))}

        {record.crossings.map((crossing) => {
          const point = projected(crossing);
          return (
            <g key={crossing.id} aria-label={`${crossing.type} ${crossing.id}`}>
              <circle
                cx={point.x}
                cy={point.y}
                r={crossing.type === 'lashing' ? 15 : 11}
                fill={crossing.type === 'lashing' ? '#111' : '#f5efe3'}
                stroke="#2b1b15"
                strokeWidth="4"
              />
              {crossing.type === 'free' && <path d={`M${point.x - 8} ${point.y}H${point.x + 8}`} stroke="#2b1b15" strokeWidth="3" />}
            </g>
          );
        })}

        {record.anchors.map((anchor) => {
          const point = projected(anchor);
          return (
            <g key={anchor.id} aria-label={`Frame anchor ${anchor.id}`}>
              <circle cx={point.x} cy={point.y} r="12" fill="#efe6d2" stroke="#2b1b15" strokeWidth="5" />
              <text x={point.x + 15} y={point.y - 10}>{anchor.id}</text>
            </g>
          );
        })}

        {coils.map((coil) => {
          const point = projected(coil);
          return (
            <g
              key={coil.id}
              role="button"
              tabIndex="0"
              aria-label={`Select coil ${coil.id}`}
              onClick={(event) => {
                event.stopPropagation();
                onSelectCoil(coil.id);
              }}
              opacity={selectedCoilId && selectedCoilId !== coil.id ? .55 : 1}
            >
              <circle cx={point.x} cy={point.y} r="62" fill="#ece2cf" stroke="#4e5f53" strokeWidth="9" />
              <circle cx={point.x} cy={point.y} r="39" fill="none" stroke="#768a7b" strokeWidth="6" strokeDasharray="9 6" />
              <text x={point.x} y={point.y + 6} textAnchor="middle">{coil.id}</text>
            </g>
          );
        })}
      </svg>
    </section>
  );
}
