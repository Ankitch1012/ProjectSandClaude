async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'The survey could not record that evidence.');
  return body;
}

export const loadRecords = () => request('/api/records');

export const startSurvey = (sessionId, recordId) => request('/api/start', {
  method: 'POST',
  body: JSON.stringify({ sessionId, recordId }),
});

export const markCourse = (sessionId, segmentId, state) => request('/api/course-finding', {
  method: 'POST',
  body: JSON.stringify({ sessionId, segmentId, state }),
});

export const proposeSpring = (sessionId, coilId, replacementId) => request('/api/replacement', {
  method: 'POST',
  body: JSON.stringify({ sessionId, coilId, replacementId }),
});

export const inspectSpringContacts = (sessionId, coilId) => request('/api/inspect-contacts', {
  method: 'POST',
  body: JSON.stringify({ sessionId, coilId }),
});
