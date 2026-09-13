'use strict';

const BASE = process.env.PROBE_BASE || 'http://localhost:3051/api';

async function call(path, body) {
  const response = await fetch(`${BASE}${path}`, body === undefined
    ? {}
    : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const payload = await response.json().catch(() => null);
  return { status: response.status, payload };
}

const reset = () => call('/test/reset', {});
const view = (hand) => call(`/hands/${hand}`).then((r) => r.payload);
const script = (hand, steps) => call('/test/script', { hand, steps }).then((r) => r.payload);

function stand(v) {
  return `canopy ${v.standings.canopy} standing ${v.standings.standing} deadwood ${v.standings.deadwood}`;
}
function cards(v) {
  return v.board.map((c) => `${c.stock}[${c.state},hold ${c.hold}]`).join(' ');
}
function statuses(v, ids) {
  return ids.map((id) => `${id}=${v.visits.find((x) => x.id === id).status}`).join(' ');
}
function touches(v) {
  return (v.currentVisit ? v.currentVisit.touches : []).map((t) => `${t.stock}[${t.state},hold ${t.hold}]`).join(' ');
}
function options(v) {
  return (v.currentVisit ? v.currentVisit.options : []).map((o) => o.id).join(' ');
}
function history(v, stock) {
  const card = v.board.find((c) => c.stock === stock);
  return card ? card.history.map((h) => `${h.act}@d${h.day}`).join(' ') : '(no card)';
}
function eligible(v) {
  return v.records.filter((r) => r.eligible).map((r) => r.id).join(' ') || '(none)';
}
function order(v) {
  return v.seasonRecord.map((e) => `${e.visit}:${e.act}`).join(' ');
}

async function heading(name) {
  console.log(`\n=== ${name} ===`);
}

async function main() {
  await reset();

  await heading('opening');
  let v = await view('a');
  console.log(stand(v), '| grafts', v.graftCount, '|', statuses(v, ['west-row', 'nursery-bed', 'bud-swell']));

  await heading('D4 lag: bind west-4, then bud-swell should open at once');
  await reset();
  v = await script('a', [{ visit: 'west-row', option: 'bind-west' }]);
  console.log('after bind:', cards(v), '|', stand(v), '|', statuses(v, ['bud-swell', 'tape-run', 'scion-crate']));

  await heading('D1 identity: bind west-4 at west-row, re-wrap it at scion-crate');
  await reset();
  v = await script('a', [
    { visit: 'west-row', option: 'bind-west' },
    { visit: 'scion-crate', option: 'rewrap-west' },
    { visit: 'nursery-bed', option: 'leave-stools' }
  ]);
  console.log('board:', cards(v), '| count', v.graftCount, '|', stand(v), '|', statuses(v, ['spare-stock']));

  await heading('D11 + D3: cut west-4 back');
  await reset();
  v = await script('a', [
    { visit: 'west-row', option: 'bind-west' },
    { visit: 'bud-swell', option: 'cut-west-back' }
  ]);
  console.log(stand(v), '| board:', cards(v));
  console.log('west-4 history:', history(v, 'west-4'));
  console.log(statuses(v, ['windthrow', 'stump-work', 'tape-run']));

  await heading('D3b: re-wrap a cut-back stock');
  v = await script('a', [{ visit: 'scion-crate', option: 'rewrap-west' }]);
  console.log('board:', cards(v), '| history:', history(v, 'west-4'), '|', statuses(v, ['stump-work']));

  await heading('D2: release west-4, then look at what a later visit sees');
  await reset();
  v = await script('a', [
    { visit: 'west-row', option: 'bind-west' },
    { visit: 'bud-swell', option: 'release-west' },
    { visit: 'tape-run', option: 'bind-east' },
    { visit: 'nursery-bed', option: 'leave-stools' }
  ]);
  console.log('board:', cards(v), '|', stand(v), '|', statuses(v, ['spare-stock', 'last-round']));
  await call('/hands/a/visit', { visitId: 'last-round' });
  v = await view('a');
  console.log('last-round touches:', touches(v));
  console.log('last-round options:', options(v));

  await heading('D7: records never come back off the list');
  await reset();
  v = await script('a', [
    { visit: 'west-row', option: 'bind-west' },
    { visit: 'nursery-bed', option: 'bind-nursery' },
    { visit: 'bud-swell', option: 'release-west' },
    { visit: 'tape-run', option: 'bind-east' }
  ]);
  console.log('warm season:', stand(v), '| eligible:', eligible(v));
  v = await script('a', [{ visit: 'nursery-check', option: 'pull-nursery' }]);
  console.log('after pulling the nursery stool:', stand(v), '| eligible:', eligible(v));

  await heading('D9 + D6 + D8: pages');
  await reset();
  v = await script('a', [
    { visit: 'west-row', option: 'bind-west' },
    { visit: 'bud-swell', option: 'release-west' },
    { visit: 'tape-run', option: 'bind-east' }
  ]);
  console.log('live order:', order(v));
  await call('/hands/a/pages', { pageId: 'p1', label: 'p1' });
  v = await script('a', [{ visit: 'nursery-bed', option: 'bind-nursery' }]);
  console.log('after another visit:', stand(v), '| day', v.day, v.light);
  const loaded = await call('/hands/a/load', { pageId: 'p1' });
  v = loaded.payload;
  console.log('after loading p1:', stand(v), '| day', v.day, v.light, '| board:', cards(v));
  console.log('loaded order:', order(v));
  console.log('page revisions:', v.pages.map((p) => `${p.id}@${p.revision}`).join(' '));

  await heading('D8: two hands from the same page both save');
  await reset();
  await script('a', [
    { visit: 'west-row', option: 'bind-west' },
    { visit: 'nursery-bed', option: 'bind-nursery' }
  ]);
  await call('/hands/a/pages', { pageId: 'shared', label: 'shared' });
  await call('/hands/b/load', { pageId: 'shared' });
  await script('a', [{ visit: 'bud-swell', option: 'release-west' }]);
  const saveA = await call('/hands/a/pages', { pageId: 'shared' });
  console.log('hand a saved:', saveA.status, '| revision', saveA.payload.baseRevision);
  await script('b', [{ visit: 'bud-swell', option: 'cut-west-back' }]);
  const saveB = await call('/hands/b/pages', { pageId: 'shared' });
  console.log('hand b saved:', saveB.status, '| revision', saveB.payload.baseRevision || '-');
  await call('/hands/c/load', { pageId: 'shared' });
  const c = await view('c');
  console.log('what the page now holds:', cards(c));

  await heading('D5: re-read a visit through the same route the button uses');
  await reset();
  v = await script('a', [{ visit: 'west-row', option: 'bind-west' }]);
  console.log('before re-read:', cards(v), '|', stand(v), '| day', v.day, v.light);
  await script('a', [{ visit: 'nursery-bed', option: 'bind-nursery' }]);
  const viaReread = await call('/hands/a/reread', { visitId: 'west-row' });
  const viaChoose = await call('/hands/a/choose', { visitId: 'west-row', optionId: 'bind-west' });
  console.log('reread route:', viaReread.status, '| choose-again route:', viaChoose.status, viaChoose.payload.error || '');
  v = viaReread.status === 200 ? viaReread.payload : viaChoose.payload;
  console.log('after re-read:', cards(v), '|', stand(v), '| day', v.day, v.light);
  console.log('record:', order(v));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
