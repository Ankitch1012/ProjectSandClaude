const { STATIONS } = require('./catalog');

const CELL_SHIFT = Math.ceil(Math.log2(STATIONS.length));
let proofSerial = 0;

function cellToken({ blade, station, mode }) {
  const stationBand = STATIONS.findIndex((entry) => entry.id === station);
  const modeBand = mode === 'upright' ? 1 : 0;
  return ((blade - 1) << CELL_SHIFT) | (stationBand << 1) | modeBand;
}

function createProof(fixtureId) {
  proofSerial += 1;
  return {
    proofId: `${fixtureId}:${proofSerial}`,
    fixtureId,
    cells: new Map(),
    freeSpin: false,
    revision: 0,
  };
}

function recordPaper(proof, observation) {
  proof.cells.set(cellToken(observation), observation);
  proof.revision += 1;
}

function recordFreeSpin(proof, checked) {
  proof.freeSpin = checked;
  proof.revision += 1;
}

function observations(proof) {
  return Array.from(proof.cells.values());
}

module.exports = {
  createProof,
  observations,
  recordFreeSpin,
  recordPaper,
};
