import React, { useEffect, useRef, useState } from 'react';
import { loadFixtures, recordFreeSpin, recordResult, startProof } from './api';
import FixturePlate from './components/FixturePlate';
import ServiceMat from './components/ServiceMat';
import { acceptSnapshot } from './bench-state';

function newSessionId() {
  return globalThis.crypto?.randomUUID?.()
    || `bench-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function App() {
  const sessionId = useRef(newSessionId());
  const [fixtures, setFixtures] = useState([]);
  const [state, setState] = useState(null);
  const [blade, setBlade] = useState(1);
  const [unit, setUnit] = useState('mm');
  const [released, setReleased] = useState(false);
  const [error, setError] = useState('');
  const [pendingResults, setPendingResults] = useState({});

  useEffect(() => {
    let active = true;
    loadFixtures()
      .then(async ({ fixtures: loaded }) => {
        if (!active) return;
        setFixtures(loaded);
        const initial = await startProof(sessionId.current, loaded[0].id);
        if (active) setState(initial);
      })
      .catch((reason) => active && setError(reason.message));
    return () => { active = false; };
  }, []);

  async function chooseFixture(fixtureId) {
    try {
      setError('');
      setBlade(1);
      setReleased(false);
      setPendingResults({});
      setState(await startProof(sessionId.current, fixtureId));
    } catch (reason) {
      setError(reason.message);
    }
  }

  async function chooseResult(result) {
    const key = `${result.blade}:${result.station}:${result.mode}`;
    const optimistic = {
      ...result,
      passing: result.mode === 'lengthwise'
        ? result.outcome === 'light-drag'
        : result.outcome === 'clean-cut',
    };
    setPendingResults((current) => ({ ...current, [key]: optimistic }));
    try {
      setError('');
      setReleased(false);
      const incoming = await recordResult(sessionId.current, result);
      setState((current) => acceptSnapshot(current, incoming));
    } catch (reason) {
      setError(reason.message);
    } finally {
      setPendingResults((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    }
  }

  async function chooseFreeSpin(checked) {
    setState((current) => current ? { ...current, freeSpin: checked } : current);
    try {
      setError('');
      setReleased(false);
      const incoming = await recordFreeSpin(sessionId.current, checked);
      setState((current) => acceptSnapshot(current, incoming));
    } catch (reason) {
      setError(reason.message);
    }
  }

  if (error && !state) {
    return <p className="fatal-error" role="alert">{error}</p>;
  }

  if (!state) {
    return <p className="loading" role="status">Laying out the paper bench…</p>;
  }

  const visibleResults = [...state.results];
  for (const pending of Object.values(pendingResults)) {
    const index = visibleResults.findIndex((result) => (
      result.blade === pending.blade
      && result.station === pending.station
      && result.mode === pending.mode
    ));
    if (index === -1) visibleResults.push(pending);
    else visibleResults[index] = pending;
  }
  const visibleState = { ...state, results: visibleResults };

  return (
    <div className="app-shell">
      <header className="shop-header">
        <div>
          <span>GRIND ROOM · BAY 03</span>
          <h1>Reel Paper Bench</h1>
        </div>
        <p>
          <b>LIGHT CONTACT</b>
          Five-station blade witness
        </p>
      </header>

      {error && <p className="inline-error" role="alert">{error}</p>}

      <div className="bench-layout">
        <FixturePlate
          fixtures={fixtures}
          fixture={state.fixture}
          unit={unit}
          onFixture={chooseFixture}
          onUnit={() => setUnit((current) => current === 'mm' ? 'in' : 'mm')}
        />
        <ServiceMat
          state={visibleState}
          blade={blade}
          unit={unit}
          released={released}
          onBlade={(next) => {
            setBlade(next);
            setReleased(false);
          }}
          onResult={chooseResult}
          onFreeSpin={chooseFreeSpin}
          onRelease={() => setReleased(true)}
        />
      </div>
    </div>
  );
}
