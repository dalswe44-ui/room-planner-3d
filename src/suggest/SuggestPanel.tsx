// AI 추천 배치 패널. 목적을 적으면 AI가 지금 있는 가구를 옮기고 돌려 배치를 추천한다(가구를 더하거나 빼지 않는다).
import { useEffect, useRef, useState } from 'react';
import { buildSuggestPrompt, SUGGEST_GOAL_MAX, SUGGEST_ITEMS_MAX } from '../contracts/layoutSuggest';
import type { FurnitureItem } from '../contracts/types';
import { getSample, hasClaudeHost } from '../photo/layoutReader';
import { useProjectStore } from '../store/projectStore';
import { checkArrangement } from './checkArrangement';
import { parseSuggestion, type ArrangementMove, type ParsedSuggestion } from './parseSuggestion';
import { askSuggestion, checkSuggestServer } from './suggestReader';
import './suggest.css';

const EXAMPLES = ['공부에 집중하기 좋게', '넓어 보이게', '편하게 쉬기 좋게', '손님이 와도 좋게'];

type Phase = { kind: 'idle' } | { kind: 'asking' } | { kind: 'failed'; message: string; details: string[] };
type Outcome =
  | { kind: 'applied'; reasons: string[]; tips: string[]; warnings: string[]; before: ArrangementMove[] }
  | { kind: 'reverted' };

export function SuggestPanel() {
  const items = useProjectStore((s) => s.project.items);
  const room = useProjectStore((s) => s.project.room);
  const applyArrangement = useProjectStore((s) => s.applyArrangement);
  const [goal, setGoal] = useState('');
  const [auto, setAuto] = useState<'checking' | 'sample' | 'server' | 'unavailable'>('checking');
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [paste, setPaste] = useState('');
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'fallback'>('idle');
  const abortRef = useRef<AbortController | null>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let alive = true;
    const server = checkSuggestServer();
    void (async () => {
      const sample = hasClaudeHost() ? await getSample() : null;
      const next = sample ? 'sample' : (await server) ? 'server' : 'unavailable';
      if (alive) setAuto(next);
    })();
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => () => abortRef.current?.abort(), []);

  const trimmed = goal.trim();
  const tooMany = items.length > SUGGEST_ITEMS_MAX;
  const asking = phase.kind === 'asking';
  let blocker: string | null = null;
  if (items.length === 0) blocker = '가구를 먼저 추가해 주세요.';
  else if (tooMany) blocker = `가구가 ${SUGGEST_ITEMS_MAX}개를 넘어서 추천받을 수 없어요.`;
  else if (trimmed === '') blocker = '목적을 적어 주세요.';
  const canRun = blocker === null && auto !== 'checking' && !asking;

  /** 검사를 통과한 답을 적용하고 결과 카드를 만든다. 적용 직전 자리를 기억해 둔다. */
  function applyParsed(snapshot: readonly FurnitureItem[], p: Extract<ParsedSuggestion, { ok: true }>) {
    const before = snapshot.map((it) => ({ id: it.id, x: it.x, z: it.z, rotationDeg: it.rotationDeg }));
    const warnings = checkArrangement(snapshot, p.moves, room);
    applyArrangement(p.moves);
    setOutcome({ kind: 'applied', reasons: p.reasons, tips: p.tips, warnings, before });
    setPhase({ kind: 'idle' });
  }

  function formatFailed(errors: string[]) {
    setOutcome(null);
    setPhase({ kind: 'failed', message: 'AI의 답이 형식에 맞지 않아 적용하지 않았어요. 다시 추천받아 보세요.', details: errors });
  }

  // 한 번의 추천받기에서 AI 호출은 최대 2회(처음 + 고쳐 달라고 한 번).
  async function run() {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setOutcome(null);
    setPhase({ kind: 'asking' });
    const snapshot = items;
    const base = { goal: trimmed, room, items: snapshot };
    const stale = () => abortRef.current !== ac;

    const first = await askSuggestion(base, ac.signal);
    if (stale()) return;
    if (first.via === 'server') setAuto('server');
    if (!first.ok) {
      abortRef.current = null;
      if (first.kind === 'unavailable') setAuto('unavailable');
      if (first.kind === 'error') setPhase({ kind: 'failed', message: first.message, details: [] });
      else setPhase({ kind: 'idle' });
      return;
    }
    const p1 = parseSuggestion(first.text, snapshot, room);
    if (!p1.ok) {
      abortRef.current = null;
      formatFailed(p1.errors);
      return;
    }
    let final = p1;
    const problems = checkArrangement(snapshot, p1.moves, room);
    if (problems.length > 0) {
      const second = await askSuggestion({ ...base, repair: { previous: first.text, problems } }, ac.signal);
      if (stale()) return;
      if (!second.ok && second.kind === 'cancelled') {
        abortRef.current = null;
        setPhase({ kind: 'idle' });
        return;
      }
      // 두 번째 답을 못 받았거나 형식이 틀리면 처음 답을 경고와 함께 적용한다.
      if (second.ok) {
        const p2 = parseSuggestion(second.text, snapshot, room);
        if (p2.ok) final = p2;
      }
    }
    abortRef.current = null;
    applyParsed(snapshot, final);
  }

  function stop() {
    abortRef.current?.abort();
    abortRef.current = null;
    setPhase({ kind: 'idle' });
  }

  function applyPasted() {
    const p = parseSuggestion(paste, items, room);
    if (!p.ok) return formatFailed(p.errors);
    applyParsed(items, p);
  }

  function revert() {
    if (outcome?.kind !== 'applied') return;
    applyArrangement(outcome.before);
    setOutcome({ kind: 'reverted' });
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(buildSuggestPrompt(trimmed, room, items));
      setCopyState('copied');
    } catch {
      setCopyState('fallback');
      setTimeout(() => promptRef.current?.select(), 0);
    }
  }

  const manualReady = items.length > 0 && !tooMany && trimmed !== '';

  return (
    <div className="suggest-panel" data-testid="suggest-panel">
      <section className="suggest-section">
        <h3 className="suggest-title">AI 추천 배치</h3>
        <p className="suggest-hint">
          어떤 방으로 쓰고 싶은지 적으면 AI가 지금 있는 가구를 옮기고 돌려서 배치를 추천해요. 가구를 더하거나 빼지는 않아요.
        </p>
        <p className="suggest-hint">
          방 크기와 벽·문·창문 위치, 가구의 이름과 크기·자리만 Claude에 보내요. 사진은 보내지 않아요.
        </p>
        <label className="suggest-label" htmlFor="suggest-goal">원하는 배치</label>
        <textarea
          id="suggest-goal"
          className="suggest-textarea"
          rows={3}
          maxLength={SUGGEST_GOAL_MAX}
          value={goal}
          placeholder="예: 공부하는 환경처럼 배치하고 싶어요"
          data-testid="suggest-goal"
          onChange={(e) => setGoal(e.target.value)}
        />
        <div className="suggest-examples">
          {EXAMPLES.map((text) => (
            <button key={text} type="button" className="chip" data-testid="suggest-example" onClick={() => setGoal(text)}>
              {text}
            </button>
          ))}
        </div>
        {blocker && <p className="suggest-hint" data-testid="suggest-blocker">{blocker}</p>}
        {auto === 'unavailable' ? (
          <p className="suggest-hint" role="status" data-testid="suggest-status">
            이 화면에서는 AI를 바로 부를 수 없어요. 아래 방법으로 추천을 받아 적용해 주세요.
          </p>
        ) : asking ? (
          <p className="suggest-hint" role="status" data-testid="suggest-status">
            추천을 만드는 중이에요. 수십 초 걸릴 수 있어요.
          </p>
        ) : auto === 'checking' ? (
          <p className="suggest-hint" role="status" data-testid="suggest-status">AI를 쓸 수 있는지 확인하는 중이에요.</p>
        ) : null}
        {auto !== 'unavailable' && (
          <div className="suggest-actions">
            <button type="button" className="btn btn--primary" data-testid="suggest-run" disabled={!canRun} onClick={() => void run()}>
              추천받기
            </button>
            {asking && (
              <button type="button" className="btn" data-testid="suggest-stop" onClick={stop}>
                그만
              </button>
            )}
          </div>
        )}
        {phase.kind === 'failed' && (
          <div className="suggest-error" role="alert" data-testid="suggest-error">
            <p>{phase.message}</p>
            {phase.details.length > 0 && (
              <ul>
                {phase.details.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            )}
            {auto !== 'unavailable' && (
              <button type="button" className="btn" data-testid="suggest-retry" disabled={!canRun} onClick={() => void run()}>
                다시 추천받기
              </button>
            )}
          </div>
        )}
      </section>

      {outcome?.kind === 'applied' && (
        <section className="card suggest-result" data-testid="suggest-result">
          <p className="suggest-label">추천대로 배치했어요</p>
          {outcome.reasons.length > 0 && (
            <ul data-testid="suggest-reasons">
              {outcome.reasons.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          )}
          {outcome.tips.length > 0 && (
            <div className="suggest-tips" data-testid="suggest-tips">
              <p className="suggest-label">덧붙이는 말</p>
              <ul>
                {outcome.tips.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
          )}
          {outcome.warnings.length > 0 && (
            <div className="suggest-warn" data-testid="suggest-warnings">
              <p className="suggest-label">남은 문제</p>
              <ul>
                {outcome.warnings.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
              <p>끌어서 고치거나 다시 추천받으세요.</p>
            </div>
          )}
          <div className="suggest-actions">
            <button type="button" className="btn" data-testid="suggest-revert" onClick={revert}>
              원래대로
            </button>
            <button type="button" className="btn btn--quiet" data-testid="suggest-keep" onClick={() => setOutcome(null)}>
              이대로 둘게요
            </button>
          </div>
        </section>
      )}
      {outcome?.kind === 'reverted' && (
        <p className="suggest-hint" role="status" data-testid="suggest-reverted">
          추천 전 자리로 돌려놓았어요.
        </p>
      )}

      {auto === 'unavailable' && (
        <section className="suggest-section" data-testid="suggest-manual">
          <p className="suggest-hint">아래 문구를 다른 AI 도구에 보내고, 돌려받은 답을 붙여 넣어 적용하세요.</p>
          <button type="button" className="btn" data-testid="suggest-copy" disabled={!manualReady} onClick={() => void copyPrompt()}>
            AI에게 줄 문구 복사
          </button>
          {copyState === 'copied' && <p className="suggest-hint" role="status">복사했어요.</p>}
          {copyState === 'fallback' && (
            <div>
              <p className="suggest-hint">자동 복사가 안 돼요. 아래 문구를 길게 눌러 직접 복사하세요.</p>
              <textarea
                ref={promptRef}
                className="suggest-textarea"
                readOnly
                rows={6}
                value={buildSuggestPrompt(trimmed, room, items)}
                data-testid="suggest-prompt-text"
                onFocus={(e) => e.currentTarget.select()}
              />
            </div>
          )}
          <label className="suggest-label" htmlFor="suggest-paste">AI가 준 답</label>
          <textarea
            id="suggest-paste"
            className="suggest-textarea"
            rows={8}
            spellCheck={false}
            autoComplete="off"
            value={paste}
            data-testid="suggest-paste"
            onChange={(e) => setPaste(e.target.value)}
          />
          <button
            type="button"
            className="btn btn--primary"
            data-testid="suggest-paste-apply"
            disabled={paste.trim() === '' || items.length === 0}
            onClick={applyPasted}
          >
            적용
          </button>
        </section>
      )}
    </div>
  );
}
