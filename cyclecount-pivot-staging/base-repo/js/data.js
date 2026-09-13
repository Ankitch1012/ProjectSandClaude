export const CASES = [
  {
    id: 'CC-104', zone: 'A', label: 'Adjacent-bin exchange', threshold: 5, serialized: false,
    rows: [
      { sku: 'AX-14', bin: 'A-01', onHand: 10, inTransit: 0, counts: [7] },
      { sku: 'BZ-22', bin: 'A-02', onHand: 7, inTransit: 0, counts: [10] },
    ],
  },
  {
    id: 'CC-207', zone: 'B', label: 'Second count received', threshold: 5, serialized: false,
    rows: [
      { sku: 'MK-08', bin: 'B-11', onHand: 50, inTransit: 0, counts: [44, 48] },
    ],
  },
  {
    id: 'CC-318', zone: 'C', label: 'Serialized shortage', threshold: 5, serialized: true,
    rows: [
      { sku: 'SN-440', bin: 'C-03', onHand: 4, inTransit: 0, counts: [3], scanned: [], serialRequired: 1 },
    ],
  },
  {
    id: 'CC-421', zone: 'D', label: 'Boundary write-off', threshold: 5, serialized: false,
    rows: [
      { sku: 'PK-50', bin: 'D-09', onHand: 20, inTransit: 0, counts: [15] },
    ],
  },
  {
    id: 'CC-509', zone: 'E', label: 'Inbound stock', threshold: 5, serialized: false,
    rows: [
      { sku: 'TR-16', bin: 'E-02', onHand: 12, inTransit: 4, counts: [12] },
    ],
  },
  {
    id: 'CC-610', zone: 'F', label: 'Large unresolved loss', threshold: 5, serialized: false,
    rows: [
      { sku: 'QP-90', bin: 'F-14', onHand: 40, inTransit: 0, counts: [31] },
    ],
  },
];

export function freshCases() {
  return structuredClone(CASES).map(item => ({ ...item, status: 'open', decision: null }));
}
