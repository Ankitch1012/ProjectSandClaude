import React from 'react';

export default function RecordTags({ records, activeId, onChoose }) {
  return (
    <nav className="record-tags" aria-label="Underside records">
      {records.map((record) => (
        <button
          key={record.id}
          type="button"
          aria-label={`Open ${record.id}`}
          aria-pressed={record.id === activeId}
          onClick={() => onChoose(record.id)}
        >
          <span>{record.id}</span>
          <strong>{record.label}</strong>
        </button>
      ))}
    </nav>
  );
}
