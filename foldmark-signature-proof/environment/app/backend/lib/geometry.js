'use strict';

const SHEETS = {
  A3: { width: 420, height: 297 },
  SRA3: { width: 450, height: 320 }
};

const markerCache = new Map();

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function orientedSheet(sheetName, orientation) {
  const source = SHEETS[sheetName] || SHEETS.SRA3;
  if (orientation === 'portrait') {
    return { width: source.height, height: source.width };
  }
  return { width: source.width, height: source.height };
}

function firstAssignedPage(imposition) {
  const firstSheet = imposition.sheets[0];
  const firstSlot = firstSheet && firstSheet.front[0];
  return firstSlot && Number.isFinite(firstSlot.page) ? firstSlot.page : 0;
}

function markerPlan(state, imposition, sheet) {
  const assignmentKey = JSON.stringify(state.assignments || {});
  const cacheKey = `${state.settings.orientation}:${assignmentKey}`;
  if (markerCache.has(cacheKey)) {
    return clone(markerCache.get(cacheKey));
  }

  const pageNudge = firstAssignedPage(imposition) % 2 === 0 ? 2 : -2;
  const foldXs = state.settings.fold === 'parallel'
    ? [sheet.width * 0.25, sheet.width * 0.75]
    : [sheet.width * 0.5];
  const cuts = [
    { id: 'cut-left', xMm: 18 + pageNudge, edge: 'left' },
    { id: 'cut-right', xMm: sheet.width - 18 + pageNudge, edge: 'right' }
  ];
  const folds = foldXs.map((xMm, index) => ({
    id: `fold-${index + 1}`,
    xMm,
    edge: 'vertical'
  }));
  const plan = { cuts, folds };
  markerCache.set(cacheKey, clone(plan));
  return plan;
}

function buildGeometry(state, imposition) {
  const { sheet: sheetName, orientation, bleed } = state.settings;
  const sheet = orientedSheet(sheetName, orientation);
  const marginX = 18;
  const marginY = 24;
  const gutter = 10;
  const trimWidth = (sheet.width - (marginX * 2) - gutter) / 2;
  const trimHeight = sheet.height - (marginY * 2);
  const markers = markerPlan(state, imposition, sheet);

  return {
    sheet: {
      name: sheetName,
      orientation,
      widthMm: sheet.width,
      heightMm: sheet.height
    },
    bleedMm: Number(bleed),
    trimRegions: [
      {
        position: 'left',
        xMm: marginX,
        yMm: marginY,
        widthMm: trimWidth,
        heightMm: trimHeight,
        bleedBox: {
          xMm: marginX - Number(bleed),
          yMm: marginY - Number(bleed),
          widthMm: trimWidth + (Number(bleed) * 2),
          heightMm: trimHeight + (Number(bleed) * 2)
        }
      },
      {
        position: 'right',
        xMm: marginX + trimWidth + gutter,
        yMm: marginY,
        widthMm: trimWidth,
        heightMm: trimHeight,
        bleedBox: {
          xMm: marginX + trimWidth + gutter - Number(bleed),
          yMm: marginY - Number(bleed),
          widthMm: trimWidth + (Number(bleed) * 2),
          heightMm: trimHeight + (Number(bleed) * 2)
        }
      }
    ],
    markers
  };
}

function clearGeometryCache() {
  markerCache.clear();
}

module.exports = {
  buildGeometry,
  clearGeometryCache,
  orientedSheet
};
