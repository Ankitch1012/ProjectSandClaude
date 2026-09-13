const {
  anchorStatus,
  buildSegments,
  courseViews,
} = require('./course-model');
const { coilViews } = require('./spring-model');
const { crossingGroups } = require('./network-model');
const { frontStatus } = require('./frame-policy');

function adjudicate(record, survey) {
  const courses = courseViews(record, survey);
  const coils = coilViews(record, survey, courses);
  const front = frontStatus(record, courses);
  const reviewReasons = [];
  if (coils.some((coil) => coil.profileMatch === false)) reviewReasons.push('replacement profile');
  if (coils.some((coil) => coil.needsReinspection > 0)) reviewReasons.push('contact reinspection');
  if (!front.complete) reviewReasons.push('front-edge evidence');
  const visibleCoils = coils.filter((coil) => !coil.excluded);
  const surveyComplete = visibleCoils.every((coil) => coil.complete) && front.complete;

  return {
    record,
    courses,
    coils,
    uniqueCourseCount: courses.reduce((sum, course) => sum + course.segments.length, 0),
    crossingGroups: crossingGroups(record),
    anchoredCourseCount: courses.filter((course) => anchorStatus(record, course)).length,
    front,
    surveyComplete,
    reviewRequired: reviewReasons.length > 0,
    reviewReasons,
  };
}

module.exports = { adjudicate, buildSegments };
