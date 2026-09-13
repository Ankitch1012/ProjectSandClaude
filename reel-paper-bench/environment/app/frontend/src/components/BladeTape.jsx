import React from 'react';

export default function BladeTape({ bladeCount, selected, onSelect }) {
  return (
    <nav className="blade-tape" aria-label="Reel blade index">
      <span className="tape-caption">ROTATE REEL TO</span>
      <div>
        {Array.from({ length: bladeCount }, (_, index) => index + 1).map((blade) => (
          <button
            key={blade}
            type="button"
            aria-label={`Blade ${blade}`}
            aria-pressed={blade === selected}
            onClick={() => onSelect(blade)}
          >
            <span>{String(blade).padStart(2, '0')}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
