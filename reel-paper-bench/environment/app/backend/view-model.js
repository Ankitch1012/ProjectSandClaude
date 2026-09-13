const { publicFixture } = require('./catalog');
const { observations } = require('./proof-session');
const { evaluateContact } = require('./contact-engine');
const { releaseGate } = require('./release-gate');

function proofView(proof, fixture) {
  const recorded = observations(proof);
  const contact = evaluateContact(recorded, fixture);
  return {
    proofId: proof.proofId,
    revision: proof.revision,
    fixture: publicFixture(fixture),
    results: contact.results,
    freeSpin: proof.freeSpin,
    serviceHold: contact.serviceHold,
    recommendations: contact.recommendations,
    release: releaseGate(recorded, proof.freeSpin, publicFixture(fixture)),
  };
}

module.exports = { proofView };
