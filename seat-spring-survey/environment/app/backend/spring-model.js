function profileMatch(coil, replacement) {
  if (!replacement) return null;
  return coil.profile.freeHeightMm === replacement.profile.freeHeightMm;
}

function coilViews(record, survey, courses) {
  return record.coils.map((coil) => {
    const incident = courses.filter((course) => course.points.includes(coil.id));
    const replacementId = survey.replacement[coil.id];
    const replacement = record.replacements.find((entry) => entry.id === replacementId);
    const webbing = record.webbing.find((entry) => entry.id === coil.webbingId);
    const inspected = incident.filter((course) => (
      survey.contactEvidence[`${coil.id}:${course.id}`] === true
    )).length;
    return {
      ...coil,
      axes: incident.map((course) => course.classifiedAxis),
      complete: incident.length >= 4,
      contactCount: incident.length,
      inspectedContacts: replacement ? incident.length : inspected,
      needsReinspection: 0,
      profileMatch: profileMatch(coil, replacement),
      webbingStatus: webbing?.status ?? null,
      excluded: webbing?.status === 2,
    };
  });
}

module.exports = { coilViews, profileMatch };
