import React, { useEffect, useRef, useState } from 'react';
import {
  inspectSpringContacts,
  loadRecords,
  markCourse,
  proposeSpring,
  startSurvey,
} from './api';
import RecordTags from './components/RecordTags';
import CourseStrip from './components/CourseStrip';
import UnderseatView from './components/UnderseatView';
import DetailLoupe from './components/DetailLoupe';
import SurveySummary from './components/SurveySummary';

function sessionId() {
  return globalThis.crypto?.randomUUID?.()
    || `survey-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function App() {
  const session = useRef(sessionId());
  const [records, setRecords] = useState([]);
  const [survey, setSurvey] = useState(null);
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [selectedSegmentId, setSelectedSegmentId] = useState(null);
  const [selectedCoilId, setSelectedCoilId] = useState(null);
  const [error, setError] = useState('');
  const [updateCount, setUpdateCount] = useState(0);

  useEffect(() => {
    let active = true;
    loadRecords()
      .then(async ({ records: loaded }) => {
        if (!active) return;
        setRecords(loaded);
        const initial = await startSurvey(session.current, loaded[0].id);
        if (active) setSurvey(initial);
      })
      .catch((reason) => active && setError(reason.message));
    return () => { active = false; };
  }, []);

  async function chooseRecord(recordId) {
    try {
      setError('');
      setSelectedCourseId(null);
      setSelectedSegmentId(null);
      setSelectedCoilId(null);
      setSurvey(await startSurvey(session.current, recordId));
    } catch (reason) {
      setError(reason.message);
    }
  }

  async function update(action) {
    try {
      setError('');
      const next = await action();
      setSurvey(next);
      setUpdateCount((count) => count + 1);
    } catch (reason) {
      setError(reason.message);
    }
  }

  if (error && !survey) return <p role="alert" className="fatal">{error}</p>;
  if (!survey) return <p role="status" className="loading">Opening the underside record…</p>;

  return (
    <div className="survey-shell">
      <header className="survey-header">
        <div>
          <span>PRE-TREATMENT DOCUMENTATION</span>
          <h1>Seat Spring Survey</h1>
        </div>
        <p>
          OBSERVE · MAP · REFER
          <output aria-label="Recorded update number">{updateCount}</output>
        </p>
      </header>

      <RecordTags records={records} activeId={survey.record.id} onChoose={chooseRecord} />
      {error && <p role="alert" className="inline-error">{error}</p>}

      <div className="work-surface">
        <UnderseatView
          survey={survey}
          selectedCourseId={selectedCourseId}
          selectedCoilId={selectedCoilId}
          onSelectCourse={(courseId, segmentId) => {
            setSelectedCourseId(courseId);
            setSelectedSegmentId(segmentId);
            setSelectedCoilId(null);
          }}
          onSelectCoil={(coilId) => {
            setSelectedCoilId(coilId);
            setSelectedCourseId(null);
            setSelectedSegmentId(null);
          }}
        />

        <CourseStrip
          courses={survey.courses}
          selectedId={selectedCourseId}
          onSelect={(courseId) => {
            const course = survey.courses.find((entry) => entry.id === courseId);
            setSelectedCourseId(courseId);
            setSelectedSegmentId(course?.segments[0]?.id || null);
            setSelectedCoilId(null);
          }}
        />

        <SurveySummary survey={survey} />

        <DetailLoupe
          survey={survey}
          selectedCourseId={selectedCourseId}
          selectedSegmentId={selectedSegmentId}
          selectedCoilId={selectedCoilId}
          onMark={(segmentId, state) => update(() => markCourse(session.current, segmentId, state))}
          onReplacement={(coilId, replacementId) => update(() => proposeSpring(session.current, coilId, replacementId))}
          onInspect={(coilId) => update(() => inspectSpringContacts(session.current, coilId))}
          onClose={() => {
            setSelectedCourseId(null);
            setSelectedSegmentId(null);
            setSelectedCoilId(null);
          }}
        />
      </div>
    </div>
  );
}
