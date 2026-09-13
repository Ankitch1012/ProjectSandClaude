import React, { useEffect, useMemo, useState } from 'react';

const SESSION_KEY = 'countback-session';
const sessionId = crypto.randomUUID();
sessionStorage.setItem(SESSION_KEY, sessionId);

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-desk-session': sessionId,
      ...(options.headers || {}),
    },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Request failed');
  return body;
}

function CaseButton({ item, selected, onClick }) {
  return (
    <button aria-label={`Select ${item.id}`} aria-current={selected || undefined} onClick={onClick}>
      <span><strong>{item.id}</strong><small>Zone {item.zone}</small></span>
      <span><em>{item.label}</em><b>{item.status}</b></span>
    </button>
  );
}

function App() {
  const [desk, setDesk] = useState({ cases: [], undoCount: 0 });
  const [selectedId, setSelectedId] = useState('CC-104');
  const [filter, setFilter] = useState('all');
  const [recount, setRecount] = useState('');
  const [error, setError] = useState('');

  const refresh = async () => {
    try {
      setDesk(await api('/api/cases'));
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => { refresh(); }, []);

  const selected = desk.cases.find(item => item.id === selectedId) || desk.cases[0];
  const visible = useMemo(() => {
    if (filter === 'all') return desk.cases;
    if (filter === 'serialized') return desk.cases.filter(item => item.serialized);
    return desk.cases.filter(item => item.status === filter);
  }, [desk.cases, filter]);

  const chooseFilter = next => {
    setFilter(next);
    const nextVisible = next === 'all'
      ? desk.cases
      : next === 'serialized'
        ? desk.cases.filter(item => item.serialized)
        : desk.cases.filter(item => item.status === next);
    if (nextVisible[0]) setSelectedId(nextVisible[0].id);
  };

  const mutate = async (path, options = {}) => {
    try {
      setDesk(await api(path, options));
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  if (!selected) {
    return <main className="loading"><h1>COUNTBACK</h1><p>{error || 'Loading variance desk…'}</p></main>;
  }

  const submitRecount = async event => {
    event.preventDefault();
    await mutate(`/api/cases/${selected.id}/recount`, {
      method: 'POST',
      body: JSON.stringify({ quantity: Number(recount) }),
    });
    setRecount('');
  };

  const decide = kind => mutate(`/api/cases/${selected.id}/decision`, {
    method: 'POST',
    body: JSON.stringify({ kind }),
  });

  return (
    <>
      <header className="mast">
        <div><span className="eyebrow">Inventory control</span><h1>COUNTBACK</h1></div>
        <div className="shift"><span>Cycle 18</span><strong>North mezzanine</strong></div>
      </header>
      {error && <div className="error" role="alert">{error}</div>}
      <div className="desk">
        <nav className="queue" aria-label="Variance queue">
          <div className="queue-head">
            <div><span className="eyebrow">Decision queue</span><h2>Count variances</h2></div>
            <output aria-label="Visible case count">{visible.length}</output>
          </div>
          <div className="filters" role="group" aria-label="Queue filters">
            {['all', 'open', 'resolved', 'serialized'].map(value => (
              <button key={value} aria-pressed={filter === value} onClick={() => chooseFilter(value)}>
                {value.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="case-list">
            {visible.map(item => (
              <CaseButton key={item.id} item={item} selected={item.id === selected.id}
                onClick={() => setSelectedId(item.id)} />
            ))}
          </div>
        </nav>

        <main className="workspace">
          <section className="case-head">
            <div>
              <span className="eyebrow">Selected variance</span>
              <h2><output aria-label="Selected case ID">{selected.id}</output> ·{' '}
                <output aria-label="Selected case label">{selected.label}</output></h2>
            </div>
            <output className="status-pill" aria-label="Case status">{selected.status}</output>
          </section>

          <section className="metric-strip" aria-label="Inventory summary">
            {[
              ['On hand', 'On hand total', selected.summary.onHand],
              ['In transit', 'In transit total', selected.summary.inTransit],
              ['Available', 'Available total', selected.summary.available],
              ['Latest count', 'Latest count total', selected.summary.latest],
              ['Variance', 'Variance total', selected.summary.variance],
            ].map(([caption, label, value]) => (
              <div key={label}><span>{caption}</span><output aria-label={label}>{value}</output></div>
            ))}
          </section>

          <section className="sheet" aria-label="Reconciliation sheet">
            <div className="sheet-head">
              <div><span className="eyebrow">System side</span><strong>Expected stock</strong></div>
              <div><span className="eyebrow">Count side</span><strong>Physical evidence</strong></div>
            </div>
            {selected.rows.map(row => (
              <div className="recon-row" key={row.sku}>
                <div className="system-cell" aria-label={`System row ${row.sku}`}>
                  <strong>{row.sku}</strong><span>{row.bin}</span>
                  <dl>
                    <div><dt>On hand</dt><dd>{row.onHand}</dd></div>
                    <div><dt>In transit</dt><dd>{row.inTransit}</dd></div>
                    <div><dt>Available</dt><dd>{row.onHand + row.inTransit}</dd></div>
                  </dl>
                </div>
                <div className="count-cell" aria-label={`Count row ${row.sku}`}>
                  <strong>{row.latest}</strong><span>latest physical count</span>
                  <dl>
                    <div><dt>Variance</dt><dd>{row.variance}</dd></div>
                    <div><dt>Attempts</dt><dd>{row.counts.length}</dd></div>
                    <div><dt>Threshold</dt><dd>±{selected.threshold}</dd></div>
                  </dl>
                </div>
              </div>
            ))}
          </section>

          <section className="evidence" aria-label="Count evidence">
            <div><span className="eyebrow">Recount history</span>
              <output aria-label="Recount history">
                {selected.rows.map(row => `${row.sku}: ${row.counts.join(' → ')}`).join(' · ')}
              </output>
            </div>
            <form onSubmit={submitRecount}>
              <label>Post another count
                <input aria-label="New recount quantity" type="number" min="0" step="1"
                  value={recount} onChange={event => setRecount(event.target.value)} />
              </label>
              <button>POST RECOUNT</button>
            </form>
            <div className="serial-block">
              <span className="eyebrow">Serial evidence</span>
              <output aria-label="Serial scan coverage">
                {selected.serialized ? `${selected.scanned}/${selected.requiredScans} scanned` : 'Not required'}
              </output>
              <button disabled={!selected.serialized || selected.scanned >= selected.requiredScans}
                onClick={() => mutate(`/api/cases/${selected.id}/scan`, { method: 'POST' })}>
                SCAN MISSING SERIAL
              </button>
            </div>
          </section>

          <section className="audit" aria-label="Decision audit">
            <span className="eyebrow">Last decision</span>
            <output aria-label="Decision summary">
              {selected.decision ? `${selected.decision} · ${selected.id}` : 'No decision recorded'}
            </output>
          </section>

          <section className="decision-dock" aria-label="Decision controls">
            <div><span className="eyebrow">Adjudicate selected case</span>
              <strong>Use the evidence, not the queue position.</strong></div>
            <div className="decision-actions">
              <button disabled={!selected.canLink || selected.status === 'resolved'} onClick={() => decide('link')}>LINK TRANSPOSE</button>
              <button disabled={!selected.canAdjust || selected.status === 'resolved'} onClick={() => decide('adjust')}>ADJUST</button>
              <button onClick={() => decide('hold')}>HOLD</button>
              <button disabled={!desk.undoCount} onClick={() => mutate('/api/undo', { method: 'POST' })}>UNDO</button>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}

export default App;
