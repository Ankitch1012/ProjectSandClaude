import React from 'react';

export default function CourseStrip({ courses, selectedId, onSelect }) {
  const sorted = [...courses].sort((first, second) => first.label.localeCompare(second.label));
  return (
    <nav className="course-strip" aria-label="Recorded cord courses">
      {sorted.map((course, index) => (
        <button
          key={course.id}
          type="button"
          aria-label={`Select ${course.id}`}
          aria-pressed={course.id === selectedId}
          onClick={() => onSelect(courses[index]?.id)}
        >
          <i data-axis={course.classifiedAxis} aria-hidden="true" />
          <span>{course.id}</span>
          <small>{course.label}</small>
        </button>
      ))}
    </nav>
  );
}
