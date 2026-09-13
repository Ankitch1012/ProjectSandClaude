let serial = 0;
const { buildSegments } = require('./topology');

function createSurvey(record) {
  serial += 1;
  return {
    surveyId: `${record.id}:${serial}`,
    recordId: record.id,
    affectedSegments: new Set(),
    contactEvidence: { ...(record.initial.contactEvidence || {}) },
    replacement: { ...(record.initial.replacement || {}) },
  };
}

function markSegment(survey, record, segmentId, state) {
  if (state === 'affected') {
    survey.affectedSegments.add(segmentId);
    const course = record.courses.find((entry) => (
      buildSegments(record, entry).some((segment) => segment.id === segmentId)
    ));
    const crossing = record.crossings.find((entry) => entry.courseIds.includes(course?.id));
    const neighborId = crossing?.courseIds.find((id) => id !== course?.id);
    const neighbor = record.courses.find((entry) => entry.id === neighborId);
    const neighborSegment = neighbor && buildSegments(record, neighbor)[0];
    if (neighborSegment) survey.affectedSegments.add(neighborSegment.id);
  } else {
    survey.affectedSegments.delete(segmentId);
  }
}

function proposeReplacement(survey, coilId, replacementId) {
  survey.replacement[coilId] = replacementId;
}

function inspectContacts(survey, record, coilId) {
  for (const course of record.courses.filter((entry) => entry.points.includes(coilId))) {
    survey.contactEvidence[`${coilId}:${course.id}`] = true;
  }
}

module.exports = {
  createSurvey,
  inspectContacts,
  markSegment,
  proposeReplacement,
};
