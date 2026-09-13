function anchor(id, x, y, rail = 'frame') {
  return { id, x, y, rail };
}

function coil(id, x, y, profile, webbingId) {
  return { id, x, y, profile, webbingId };
}

function course(id, label, axis, start, contacts, finish, options = {}) {
  const points = [start, ...contacts, finish];
  return {
    id,
    label,
    axis,
    points: options.reversed ? [...points].reverse() : points,
    reversed: Boolean(options.reversed),
    frontSupport: Boolean(options.frontSupport),
  };
}

const standardProfile = {
  form: 'double-cone',
  freeHeightMm: 118,
  wireGaugeMm: 3.1,
  topDiameterMm: 92,
  bottomDiameterMm: 104,
  turns: 6,
};

const RECORDS = [
  {
    id: 'CHAIR-41',
    label: 'Chamfered armchair',
    orientation: { front: 'south', chairLeft: 'east', mirrorX: true },
    frame: [
      [100, 70], [900, 70], [970, 145], [930, 640],
      [760, 700], [240, 700], [70, 640], [30, 145],
    ],
    edgePolicy: { type: 'hard-edge', requiredFrontCourses: 2 },
    anchors: [
      anchor('A-W1', 55, 245), anchor('A-E1', 945, 245),
      anchor('A-W2', 70, 505), anchor('A-E2', 930, 505),
      anchor('A-N1', 300, 78), anchor('A-S1', 300, 680, 'front'),
      anchor('A-N2', 700, 78), anchor('A-S2', 700, 680, 'front'),
      anchor('A-NW', 125, 105), anchor('A-SE', 815, 675, 'front'),
      anchor('A-NE', 875, 105), anchor('A-SW', 185, 675, 'front'),
      anchor('A-NC', 500, 72), anchor('A-SC', 500, 695, 'front'),
    ],
    webbing: [
      { id: 'W-LEFT', label: 'Left webbing', status: 0, coilIds: ['C1', 'C3'] },
      { id: 'W-RIGHT', label: 'Right webbing', status: 2, coilIds: ['C2', 'C4'] },
    ],
    coils: [
      coil('C1', 300, 255, standardProfile, 'W-LEFT'),
      coil('C2', 700, 255, standardProfile, 'W-RIGHT'),
      coil('C3', 300, 500, standardProfile, 'W-LEFT'),
      coil('C4', 700, 500, standardProfile, 'W-RIGHT'),
    ],
    courses: [
      course('R-H1', '01 upper cross course', 'crosswise', 'A-W1', ['C1', 'C2'], 'A-E1'),
      course('R-H2', '02 lower cross course', 'crosswise', 'A-W2', ['C3', 'C4'], 'A-E2', { frontSupport: true }),
      course('R-V1', '03 left length course', 'lengthwise', 'A-N1', ['C1', 'C3'], 'A-S1', { frontSupport: true }),
      course('R-V2', '04 right length course', 'lengthwise', 'A-N2', ['C2', 'C4'], 'A-S2', { reversed: true, frontSupport: true }),
      course('R-D1A', 'C1 falling diagonal', 'falling', 'A-NW', ['C1'], 'A-SC'),
      course('R-D1B', 'C2 falling diagonal', 'falling', 'A-NC', ['C2'], 'A-SE'),
      course('R-D2A', 'C1 rising diagonal', 'rising', 'A-NE', ['C1'], 'A-SC'),
      course('R-D2B', 'C2 rising diagonal', 'rising', 'A-NC', ['C2'], 'A-SW'),
      course('R-D1C', 'C3 falling diagonal', 'falling', 'A-NW', ['C3'], 'A-SE'),
      course('R-D1D', 'C4 falling diagonal', 'falling', 'A-NC', ['C4'], 'A-SE'),
      course('R-D2C', 'C3 rising diagonal', 'rising', 'A-NE', ['C3'], 'A-SW'),
      course('R-D2D', 'C4 rising diagonal', 'rising', 'A-NE', ['C4'], 'A-SC'),
    ],
    crossings: [
      { id: 'X-FREE', x: 500, y: 370, type: 'free', courseIds: ['R-D1C', 'R-D2B'] },
      { id: 'X-LASH', x: 500, y: 430, type: 'lashing', courseIds: ['R-D1D', 'R-D2C'] },
    ],
    replacements: [
      { id: 'P-EXACT', label: 'Profile A', profile: { ...standardProfile } },
      { id: 'P-GAUGE', label: 'Gauge comparison', profile: { ...standardProfile, wireGaugeMm: 2.7 } },
      { id: 'P-TURNS', label: 'Turn-count comparison', profile: { ...standardProfile, turns: 5 } },
      { id: 'P-BOTTOM', label: 'Bottom-diameter comparison', profile: { ...standardProfile, bottomDiameterMm: 96 } },
      { id: 'P-FORM', label: 'Form comparison', profile: { ...standardProfile, form: 'cylindrical' } },
    ],
    initial: {
      courseFindings: [
        { courseId: 'R-H1', code: 0 },
        { courseId: 'R-V1', code: false },
      ],
      contactEvidence: {},
      replacement: {},
    },
  },
  {
    id: 'SETTEE-08',
    label: 'Wire-edge settee',
    orientation: { front: 'north', chairLeft: 'west', mirrorX: false },
    frame: [[55, 65], [945, 65], [960, 665], [40, 665]],
    edgePolicy: { type: 'wire-edge', requiredFrontCourses: 0, wireEvidence: 'E-WIRE' },
    anchors: [
      anchor('B-W', 45, 360), anchor('B-E', 955, 360),
      anchor('B-N', 500, 70, 'front'), anchor('B-S', 500, 660),
      anchor('B-NW', 70, 90, 'front'), anchor('B-SE', 930, 640),
      anchor('B-NE', 930, 90, 'front'), anchor('B-SW', 70, 640),
    ],
    webbing: [{ id: 'W-FIELD', label: 'Main webbing', status: 0, coilIds: ['S1'] }],
    coils: [coil('S1', 500, 360, { ...standardProfile, freeHeightMm: 106 }, 'W-FIELD')],
    courses: [
      course('B-H', 'Cross course', 'crosswise', 'B-W', ['S1'], 'B-E'),
      course('B-V', 'Length course', 'lengthwise', 'B-N', ['S1'], 'B-S'),
      course('B-D1', 'Falling course', 'falling', 'B-NW', ['S1'], 'B-SE'),
      course('B-D2', 'Rising course', 'rising', 'B-NE', ['S1'], 'B-SW'),
    ],
    crossings: [
      { id: 'B-LASH', x: 500, y: 270, type: 'lashing', courseIds: ['B-D1', 'B-D2'] },
    ],
    replacements: [
      { id: 'B-EXACT', label: 'Settee profile', profile: { ...standardProfile, freeHeightMm: 106 } },
    ],
    edgeEvidence: [{ id: 'E-WIRE', label: 'Front wire continuity', value: true }],
    initial: { courseFindings: [], contactEvidence: {}, replacement: {} },
  },
  {
    id: 'CHAIR-63',
    label: 'Skew-rail side chair',
    orientation: { front: 'east', chairLeft: 'north', mirrorX: false },
    frame: [[90, 100], [830, 55], [960, 180], [880, 650], [180, 690], [45, 510]],
    edgePolicy: { type: 'hard-edge', requiredFrontCourses: 1 },
    anchors: [
      anchor('K-W', 180, 200), anchor('K-E', 850, 620, 'front'),
      anchor('K-N', 500, 75), anchor('K-S', 500, 670),
      anchor('K-CH', 110, 115), anchor('K-SE', 850, 640),
      anchor('K-NE', 820, 80), anchor('K-SW', 155, 650),
    ],
    webbing: [{ id: 'W-SKEW', label: 'Skew webbing', status: 0, coilIds: ['K1'] }],
    coils: [coil('K1', 505, 355, { ...standardProfile, turns: 5 }, 'W-SKEW')],
    courses: [
      course('K-H', '01 skew cross course', 'crosswise', 'K-W', ['K1'], 'K-E', { frontSupport: true }),
      course('K-V', '02 skew length course', 'lengthwise', 'K-N', ['K1'], 'K-S'),
      course('K-D1', '03 chamfer falling course', 'falling', 'K-CH', ['K1'], 'K-SE', { reversed: true }),
      course('K-D2', '04 second falling course', 'falling', 'K-NE', ['K1'], 'K-SW'),
    ],
    crossings: [],
    replacements: [
      { id: 'K-EXACT', label: 'Five-turn profile', profile: { ...standardProfile, turns: 5 } },
      { id: 'K-DIAMETER', label: 'Narrow profile', profile: { ...standardProfile, turns: 5, topDiameterMm: 84 } },
    ],
    initial: { courseFindings: [], contactEvidence: {}, replacement: {} },
  },
];

function recordById(id) {
  return RECORDS.find((record) => record.id === id);
}

module.exports = { RECORDS, recordById };
