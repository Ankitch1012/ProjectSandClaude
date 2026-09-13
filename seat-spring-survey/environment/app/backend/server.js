const express = require('express');
const { RECORDS, recordById } = require('./records');
const { adjudicate, buildSegments } = require('./topology');
const {
  createSurvey,
  inspectContacts,
  markSegment,
  proposeReplacement,
} = require('./survey-state');

const app = express();
const sessions = new Map();

app.use(express.json());

function sendSurvey(res, survey) {
  const record = recordById(survey.recordId);
  res.json({ surveyId: survey.surveyId, ...adjudicate(record, survey) });
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/records', (_req, res) => {
  res.json({
    records: RECORDS.map(({ id, label, orientation, edgePolicy }) => ({
      id,
      label,
      orientation,
      edgePolicy,
    })),
  });
});

app.post('/api/start', (req, res) => {
  const { sessionId, recordId } = req.body || {};
  const record = recordById(recordId);
  if (!sessionId || !record) {
    res.status(400).json({ error: 'Choose a survey record before documenting evidence.' });
    return;
  }
  const survey = createSurvey(record);
  sessions.set(sessionId, survey);
  sendSurvey(res, survey);
});

app.post('/api/course-finding', (req, res) => {
  const { sessionId, segmentId, state } = req.body || {};
  const survey = sessions.get(sessionId);
  const record = survey && recordById(survey.recordId);
  const valid = record && record.courses.some((course) => (
    buildSegments(record, course).some((segment) => segment.id === segmentId)
  ));
  if (!survey || !valid || !['clear', 'affected'].includes(state)) {
    res.status(400).json({ error: 'That cord span is not part of this underside record.' });
    return;
  }
  markSegment(survey, record, segmentId, state);
  sendSurvey(res, survey);
});

app.post('/api/replacement', (req, res) => {
  const { sessionId, coilId, replacementId } = req.body || {};
  const survey = sessions.get(sessionId);
  const record = survey && recordById(survey.recordId);
  const validCoil = record?.coils.some((coil) => coil.id === coilId);
  const validReplacement = record?.replacements.some((entry) => entry.id === replacementId);
  if (!survey || !validCoil || !validReplacement) {
    res.status(400).json({ error: 'Choose a recorded coil and a documented comparison profile.' });
    return;
  }
  proposeReplacement(survey, coilId, replacementId);
  sendSurvey(res, survey);
});

app.post('/api/inspect-contacts', (req, res) => {
  const { sessionId, coilId } = req.body || {};
  const survey = sessions.get(sessionId);
  const record = survey && recordById(survey.recordId);
  if (!survey || !record?.coils.some((coil) => coil.id === coilId)) {
    res.status(400).json({ error: 'Choose a recorded coil before inspecting its contacts.' });
    return;
  }
  inspectContacts(survey, record, coilId);
  sendSurvey(res, survey);
});

const port = Number(process.env.PORT || 5000);
app.listen(port, '0.0.0.0', () => {
  console.log(`seat spring survey backend listening on ${port}`);
});
