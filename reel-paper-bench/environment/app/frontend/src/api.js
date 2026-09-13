async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'The bench could not record that check.');
  return body;
}

export function loadFixtures() {
  return request('/api/fixtures');
}

export function startProof(sessionId, fixtureId) {
  return request('/api/start', {
    method: 'POST',
    body: JSON.stringify({ sessionId, fixtureId }),
  });
}

export function recordResult(sessionId, result) {
  return request('/api/result', {
    method: 'POST',
    body: JSON.stringify({ sessionId, ...result }),
  });
}

export function recordFreeSpin(sessionId, checked) {
  return request('/api/free-spin', {
    method: 'POST',
    body: JSON.stringify({ sessionId, checked }),
  });
}
