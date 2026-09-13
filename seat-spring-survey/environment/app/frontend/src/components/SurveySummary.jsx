import React from 'react';
import { recordedFindingCount } from '../evidence';

export default function SurveySummary({ survey }) {
  return (
    <section className="survey-summary" aria-label="Survey summary">
      <div>
        <span>PHYSICAL CORD COURSES</span>
        <strong aria-label="Unique cord course count">{survey.uniqueCourseCount}</strong>
      </div>
      <div>
        <span>RECORDED FINDINGS</span>
        <strong aria-label="Recorded finding count">{recordedFindingCount(survey.record.initial.courseFindings)}</strong>
      </div>
      <div>
        <span>TOPOLOGY GROUPS</span>
        <strong aria-label="Independent topology group count">{survey.crossingGroups}</strong>
      </div>
      <div>
        <span>FRAME-ANCHORED</span>
        <strong aria-label="Anchored cord course count">{survey.anchoredCourseCount}</strong>
      </div>
      <div>
        <span>FRONT EVIDENCE</span>
        <strong aria-label="Front-edge evidence status">{survey.front.complete ? 'COMPLETE' : 'MISSING'}</strong>
      </div>
      <div className="summary-wide">
        <span>DOCUMENTATION</span>
        <strong aria-label="Survey completion status">{survey.surveyComplete ? 'SURVEY COMPLETE' : 'SURVEY OPEN'}</strong>
      </div>
      <div className="summary-wide">
        <span>CONSERVATOR REVIEW</span>
        <strong aria-label="Conservator review status">{survey.reviewRequired ? 'REQUIRED' : 'NOT INDICATED'}</strong>
        <small aria-label="Conservator review reasons">{survey.reviewReasons.join(', ') || 'none recorded'}</small>
      </div>
    </section>
  );
}
