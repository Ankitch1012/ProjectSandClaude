'use strict';

const BASE = process.env.PROBE_BASE || 'http://localhost:5061/api';

async function call(path, body) {
  const options = body === undefined
    ? {}
    : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
  const response = await fetch(`${BASE}${path}`, options);
  return { status: response.status, payload: await response.json().catch(() => null) };
}

const UP_TO_STAIR_HEAD = [
  { chamber: 'wharf-tail', operation: 'open-tail-gate' },
  { operation: 'boat-up' },
  { chamber: 'wharf-tail', operation: 'shut-tail-gate' },
  { chamber: 'wharf-tail', operation: 'raise-head-paddle' },
  { chamber: 'wharf-tail', operation: 'drop-head-paddle' },
  { chamber: 'wharf-tail', operation: 'open-head-gate' },
  { operation: 'boat-up' },
  { chamber: 'wharf-tail', operation: 'shut-head-gate' },
  { chamber: 'stair-foot', operation: 'open-tail-gate' },
  { operation: 'boat-up' },
  { chamber: 'stair-foot', operation: 'shut-tail-gate' },
  { chamber: 'stair-head', operation: 'raise-head-paddle' },
  { chamber: 'stair-head', operation: 'drop-head-paddle' },
  { chamber: 'stair-foot', operation: 'raise-head-paddle' },
  { chamber: 'stair-foot', operation: 'drop-head-paddle' },
  { chamber: 'stair-foot', operation: 'open-head-gate' },
  { operation: 'boat-up' }
];

function levels(view) {
  return view.chambers.map((c) => `${c.id}=${c.levelIn}`).join(' ');
}

function pounds(view) {
  return view.pounds
    .filter((p) => p.banded)
    .map((p) => `${p.id} ${p.drawnIn}in/${p.permittedDrawIn}in band=${p.withinBand}`)
    .join(' | ');
}

async function main() {
  await call('/test/reset', {});
  await call('/test/boat-name', { name: 'Sundial' });

  console.log('=== a legal passage up to the stair head ===');
  let r = await call('/test/plan', { passage: 'a', steps: UP_TO_STAIR_HEAD });
  let v = r.payload;
  console.log('refusal:', v.refusal ? JSON.stringify(v.refusal) : 'none');
  console.log('boat:', v.boat.id, '| worked:', v.worked.join(',') || '(none)', '| complete:', v.complete);
  console.log('levels:', levels(v));
  console.log('pounds:', pounds(v));
  console.log('account:', JSON.stringify(v.account));
  console.log('lockfuls:', v.chambers.map((c) => `${c.id}=${c.lockfulCuFt}`).join(' '));

  console.log('\n=== the staircase head gate with a head of water on it ===');
  r = await call('/test/plan', {
    passage: 'b',
    steps: [
      { chamber: 'stair-foot', operation: 'open-head-gate' }
    ]
  });
  v = r.payload;
  console.log('opening stair-foot head gate from rest ->', v.refusal ? v.refusal.reason : 'ALLOWED');

  console.log('\n=== a paddle raised with the far gate open ===');
  r = await call('/test/plan', {
    passage: 'c',
    steps: [
      { chamber: 'wharf-tail', operation: 'open-tail-gate' },
      { chamber: 'wharf-tail', operation: 'raise-head-paddle' }
    ]
  });
  v = r.payload;
  console.log('raising head paddle with tail gate open ->', v.refusal ? v.refusal.reason : 'ALLOWED');

  console.log('\n=== a gate opened with a paddle still raised ===');
  r = await call('/test/plan', {
    passage: 'd',
    steps: [
      { chamber: 'wharf-tail', operation: 'raise-head-paddle' },
      { chamber: 'wharf-tail', operation: 'open-head-gate' }
    ]
  });
  v = r.payload;
  console.log('opening head gate with head paddle raised ->', v.refusal ? v.refusal.reason : 'ALLOWED');

  console.log('\n=== the summit drawn to exactly its permitted depth, then past it ===');
  const fillBankTop = [
    { chamber: 'bank-top', operation: 'raise-head-paddle' },
    { chamber: 'bank-top', operation: 'drop-head-paddle' },
    { chamber: 'bank-top', operation: 'raise-tail-paddle' },
    { chamber: 'bank-top', operation: 'drop-tail-paddle' }
  ];
  for (const rounds of [1, 2, 3]) {
    const steps = [];
    for (let i = 0; i < rounds; i += 1) {
      steps.push(...fillBankTop);
    }
    r = await call('/test/plan', { passage: `s${rounds}`, steps });
    v = r.payload;
    const summit = v.pounds.find((p) => p.id === 'summit');
    console.log(`${rounds} lockful(s):`, `summit down ${summit.drawnIn} in, within band ${summit.withinBand}`,
      '| low pounds:', v.lowPounds.join(',') || 'none', '| balances:', v.account.balances);
  }

  console.log('\n=== the shared wall with water standing on both sides ===');
  r = await call('/test/plan', {
    passage: 'both',
    steps: [
      { chamber: 'stair-head', operation: 'raise-head-paddle' },
      { chamber: 'stair-head', operation: 'drop-head-paddle' },
      { chamber: 'stair-foot', operation: 'raise-head-paddle' },
      { chamber: 'stair-foot', operation: 'drop-head-paddle' },
      { chamber: 'stair-head', operation: 'raise-head-paddle' },
      { chamber: 'stair-head', operation: 'drop-head-paddle' },
      { chamber: 'stair-foot', operation: 'open-head-gate' }
    ]
  });
  v = r.payload;
  console.log('levels:', levels(v));
  console.log('opening the shared gate with both chambers full ->',
    v.steps[6].worked ? 'ALLOWED' : v.steps[6].reason);

  console.log('\n=== a chamber counted as worked without the boat leaving ===');
  r = await call('/test/plan', {
    passage: 'worked',
    steps: [
      { chamber: 'wharf-tail', operation: 'raise-head-paddle' },
      { chamber: 'wharf-tail', operation: 'drop-head-paddle' },
      { chamber: 'wharf-tail', operation: 'open-head-gate' }
    ]
  });
  v = r.payload;
  console.log('boat:', v.boat.id, '| worked:', v.worked.join(',') || '(none)');

  console.log('\n=== the first refusal, and nothing after it ===');
  r = await call('/test/plan', {
    passage: 'e',
    steps: [
      { chamber: 'wharf-tail', operation: 'open-head-gate' },
      { chamber: 'wharf-tail', operation: 'open-tail-gate' },
      { chamber: 'wharf-tail', operation: 'raise-head-paddle' }
    ]
  });
  v = r.payload;
  console.log('refusal at:', v.refusal ? `${v.refusal.at} (${v.refusal.reason})` : 'none');
  console.log('steps:', v.steps.map((s) => `${s.at}:${s.worked ? 'worked' : s.reason}`).join(' | '));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
