import React from 'react';

export default function DetailLoupe({
  survey,
  selectedCourseId,
  selectedSegmentId,
  selectedCoilId,
  onMark,
  onReplacement,
  onInspect,
  onClose,
}) {
  const course = survey.courses.find((entry) => entry.id === selectedCourseId);
  const coil = survey.coils.find((entry) => entry.id === selectedCoilId);

  return (
    <aside className="detail-loupe" aria-label="Survey detail loupe">
      <button className="loupe-close" type="button" aria-label="Close detail loupe" onClick={onClose}>×</button>
      <div className="loupe-lens" aria-hidden="true">
        <i /><i /><i />
      </div>

      {!course && !coil && (
        <div className="loupe-empty">
          <span>DETAIL LOUPE</span>
          <strong>Select a cord or coil</strong>
        </div>
      )}

      {course && (
        <div className="loupe-copy">
          <span>CORD COURSE</span>
          <h2>{course.id}</h2>
          <dl>
            <div><dt>Recorded axis</dt><dd aria-label="Selected course axis">{course.classifiedAxis}</dd></div>
            <div><dt>Physical run</dt><dd aria-label="Selected course identity">{course.canonicalId}</dd></div>
            <div><dt>Spans</dt><dd aria-label="Selected course span count">{course.segments.length}</dd></div>
            <div><dt>Affected spans</dt><dd aria-label="Selected course affected span count">{course.affectedSpanCount || 0}</dd></div>
            <div><dt>Finding</dt><dd aria-label="Selected course finding">{course.affected ? 'AFFECTED' : 'CLEAR'}</dd></div>
          </dl>
          <div className="loupe-actions">
            <button type="button" onClick={() => onMark(selectedSegmentId || course.segments[0]?.id, 'affected')}>MARK COURSE AFFECTED</button>
            <button type="button" onClick={() => onMark(selectedSegmentId || course.segments[0]?.id, 'clear')}>MARK COURSE CLEAR</button>
          </div>
        </div>
      )}

      {coil && (
        <div className="loupe-copy">
          <span>COIL RECORD</span>
          <h2>{coil.id}</h2>
          <dl>
            <div><dt>Axes</dt><dd aria-label={`${coil.id} axis families`}>{[...new Set(coil.axes)].join(', ')}</dd></div>
            <div><dt>Restraint</dt><dd aria-label={`${coil.id} restraint status`}>{coil.complete ? 'COMPLETE' : 'INCOMPLETE'}</dd></div>
            <div><dt>Webbing</dt><dd aria-label={`${coil.id} webbing status`}>{coil.webbingStatus === 2 ? 'FAILED' : 'SOUND'}</dd></div>
            <div><dt>Contacts</dt><dd aria-label={`${coil.id} inspected contacts`}>{coil.inspectedContacts} / {coil.contactCount}</dd></div>
            <div><dt>Reinspect</dt><dd aria-label={`${coil.id} reinspection count`}>{coil.needsReinspection}</dd></div>
            <div><dt>Profile</dt><dd aria-label={`${coil.id} replacement profile status`}>{coil.profileMatch == null ? 'NOT PROPOSED' : coil.profileMatch ? 'RECORDED MATCH' : 'REVIEW'}</dd></div>
          </dl>
          <div className="profile-buttons" role="group" aria-label={`${coil.id} replacement profiles`}>
            {survey.record.replacements.map((replacement) => (
              <button key={replacement.id} type="button" onClick={() => onReplacement(coil.id, replacement.id)}>
                {replacement.label}
              </button>
            ))}
          </div>
          <button className="inspect-button" type="button" onClick={() => onInspect(coil.id)}>
            RECORD ALL CONTACTS INSPECTED
          </button>
        </div>
      )}
    </aside>
  );
}
