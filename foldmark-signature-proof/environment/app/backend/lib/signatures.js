'use strict';

function signatureRanges(pageCount, binding) {
  const sectionSize = binding === 'section-sewn' ? 8 : pageCount;
  const ranges = [];

  for (let start = 1; start <= pageCount; start += sectionSize) {
    ranges.push({
      start,
      end: Math.min(start + sectionSize - 1, pageCount)
    });
  }

  return ranges;
}

function assignedPage(assignments, slotId, fallback) {
  return Object.prototype.hasOwnProperty.call(assignments, slotId)
    ? assignments[slotId]
    : fallback;
}

function slot(signatureIndex, sheetIndex, side, position, page, assignments) {
  const id = `signature-${signatureIndex + 1}-sheet-${sheetIndex + 1}-${side}-${position}`;
  return {
    id,
    signature: signatureIndex + 1,
    sheet: sheetIndex + 1,
    side,
    position,
    page: assignedPage(assignments, id, page)
  };
}

function buildImposition(state) {
  const { pageCount, binding, orientation } = state.settings;
  const assignments = state.assignments || {};
  const ranges = signatureRanges(pageCount, binding);
  const sheets = [];

  ranges.forEach((range, signatureIndex) => {
    const pagesInSignature = range.end - range.start + 1;
    const sheetCount = Math.ceil(pagesInSignature / 4);

    for (let sheetIndex = 0; sheetIndex < sheetCount; sheetIndex += 1) {
      const frontOuter = range.end - (sheetIndex * 2);
      const frontInner = range.start + (sheetIndex * 2);
      const backInner = range.start + 1 + (sheetIndex * 2);
      const backOuter = range.end - 1 - (sheetIndex * 2);

      sheets.push({
        signature: signatureIndex + 1,
        sheet: sheetIndex + 1,
        front: [
          slot(signatureIndex, sheetIndex, 'front', 'left', frontInner, assignments),
          slot(signatureIndex, sheetIndex, 'front', 'right', frontOuter, assignments)
        ],
        back: [
          slot(signatureIndex, sheetIndex, 'back', 'left', backOuter, assignments),
          slot(signatureIndex, sheetIndex, 'back', 'right', backInner, assignments)
        ]
      });
    }
  });

  return {
    binding,
    duplexTurn: orientation === 'landscape' ? 'long-edge' : 'long-edge',
    signatureCount: ranges.length,
    sheets
  };
}

module.exports = {
  buildImposition,
  signatureRanges
};
