import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetSampleCache } from '../photo/layoutReader';
import { createDefaultProject, useProjectStore } from '../store/projectStore';
import { answer } from './fixtures';
import { SuggestPanel } from './SuggestPanel';
import { resetSuggestCache } from './suggestReader';

// 방 3600 × 3000. 침대 1000×2000, 책상 1200×600.
const GOOD = answer([
  { id: 1, back: 'top', left: 0, top: 0 },
  { id: 2, back: 'left', left: 2000, top: 100 },
], { reasons: ['창가에 책상을 두었어요.'], tips: ['스탠드를 두면 좋아요.'] });
const OVERLAP = answer([
  { id: 1, back: 'top', left: 0, top: 0 },
  { id: 2, back: 'top', left: 500, top: 0 },
]);

/** 실제 sample과 같은 꼴: 호출할 수 있는 함수에 json·limits가 붙어 있다. */
function mockClaude(json: (...a: unknown[]) => Promise<unknown>) {
  const sample = Object.assign(vi.fn(), { json: vi.fn(json), limits: vi.fn(async () => ({})) });
  window.claude = { use: vi.fn(async () => sample) };
  return sample;
}
const items = () => useProjectStore.getState().project.items;
const pos = () => items().map((i) => [i.x, i.z, i.rotationDeg]);

function setup(withItems = true) {
  const p = createDefaultProject();
  useProjectStore.setState({ project: p, past: [], future: [] });
  if (withItems) {
    const s = useProjectStore.getState();
    s.addItem({ name: '침대', w: 1000, d: 2000, h: 500, x: 500, z: 1000 });
    s.addItem({ name: '책상', w: 1200, d: 600, h: 720, x: 2600, z: 2500 });
  }
}
const goalInput = () => screen.getByTestId('suggest-goal') as HTMLTextAreaElement;
async function enterGoal(user: ReturnType<typeof userEvent.setup>, text = '공부하기 좋게') {
  await user.type(goalInput(), text);
}

beforeEach(() => {
  resetSampleCache();
  resetSuggestCache();
  setup();
});
afterEach(() => {
  cleanup();
  delete window.claude;
  vi.unstubAllGlobals();
});

describe('SuggestPanel', () => {
  it('SG-1/2: 추천을 적용하고 이유를 보이며 원래대로 돌린다', async () => {
    const sample = mockClaude(async () => JSON.parse(GOOD));
    render(<SuggestPanel />);
    const user = userEvent.setup();
    const before = pos();
    const run = screen.getByTestId('suggest-run') as HTMLButtonElement;
    await waitFor(() => expect(sample.json).not.toHaveBeenCalled());
    await enterGoal(user);
    await waitFor(() => expect(run.disabled).toBe(false));
    await user.click(run);
    await screen.findByTestId('suggest-result');
    expect(sample.json).toHaveBeenCalledTimes(1);
    expect(pos()).toEqual([[500, 1000, 0], [2300, 700, 90]]); // 책상: 가로 600 × 세로 1200
    expect(items().map((i) => [i.name, i.w, i.d])).toEqual([['침대', 1000, 2000], ['책상', 1200, 600]]);
    expect(screen.getByTestId('suggest-reasons').textContent).toContain('창가');
    expect(screen.getByTestId('suggest-tips').textContent).toContain('스탠드');
    expect(screen.queryByTestId('suggest-warnings')).toBeNull();

    await user.click(screen.getByTestId('suggest-revert'));
    expect(pos()).toEqual(before);
    expect(screen.queryByTestId('suggest-result')).toBeNull();
  });

  it('원래대로는 그 사이 지워진 가구를 무시하고 자리만 돌린다', async () => {
    mockClaude(async () => JSON.parse(GOOD));
    render(<SuggestPanel />);
    const user = userEvent.setup();
    await enterGoal(user);
    await user.click(screen.getAllByTestId('suggest-example')[0]); // 칩이 입력 칸을 채운다
    expect(goalInput().value).toBe('공부에 집중하기 좋게');
    await waitFor(() => expect((screen.getByTestId('suggest-run') as HTMLButtonElement).disabled).toBe(false));
    await user.click(screen.getByTestId('suggest-run'));
    await screen.findByTestId('suggest-result');
    const [bed, desk] = items();
    useProjectStore.getState().removeItem(desk.id);
    await user.click(screen.getByTestId('suggest-revert'));
    expect(items()).toHaveLength(1);
    expect([items()[0].x, items()[0].z]).toEqual([500, 1000]);
    expect(items()[0].id).toBe(bed.id);
  });

  it('이대로 둘게요는 결과 카드만 닫는다', async () => {
    mockClaude(async () => JSON.parse(GOOD));
    render(<SuggestPanel />);
    const user = userEvent.setup();
    await enterGoal(user);
    await waitFor(() => expect((screen.getByTestId('suggest-run') as HTMLButtonElement).disabled).toBe(false));
    await user.click(screen.getByTestId('suggest-run'));
    await screen.findByTestId('suggest-result');
    const after = pos();
    await user.click(screen.getByTestId('suggest-keep'));
    expect(screen.queryByTestId('suggest-result')).toBeNull();
    expect(pos()).toEqual(after);
  });

  it('SG-3: 겹치면 한 번만 다시 묻고 고친 답을 적용한다(호출 2회)', async () => {
    const sample = mockClaude(async () => JSON.parse(sample.json.mock.calls.length === 1 ? OVERLAP : GOOD));
    render(<SuggestPanel />);
    const user = userEvent.setup();
    await enterGoal(user);
    await waitFor(() => expect((screen.getByTestId('suggest-run') as HTMLButtonElement).disabled).toBe(false));
    await user.click(screen.getByTestId('suggest-run'));
    await screen.findByTestId('suggest-result');
    expect(sample.json).toHaveBeenCalledTimes(2);
    expect(sample.json.mock.calls[1][0]).toContain('1번 가구(침대)가 2번 가구(책상)와 겹칩니다.');
    expect(pos()[1]).toEqual([2300, 700, 90]);
    expect(screen.queryByTestId('suggest-warnings')).toBeNull();
  });

  it('SG-3: 두 번째 답에도 문제가 있으면 적용하고 경고를 보이며 3번째 호출은 없다', async () => {
    const sample = mockClaude(async () => JSON.parse(OVERLAP));
    render(<SuggestPanel />);
    const user = userEvent.setup();
    await enterGoal(user);
    await waitFor(() => expect((screen.getByTestId('suggest-run') as HTMLButtonElement).disabled).toBe(false));
    await user.click(screen.getByTestId('suggest-run'));
    await screen.findByTestId('suggest-warnings');
    expect(sample.json).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('suggest-warnings').textContent).toContain('겹칩니다');
    expect(screen.getByTestId('suggest-warnings').textContent).toContain('끌어서 고치거나 다시 추천받으세요');
    expect(pos()).toEqual([[500, 1000, 0], [1100, 300, 0]]);
    await new Promise((r) => setTimeout(r, 50));
    expect(sample.json).toHaveBeenCalledTimes(2);
  });

  it('SG-4: 가구가 없거나 목적이 비면 추천받기가 비활성이고 안내가 보인다', async () => {
    setup(false);
    mockClaude(async () => JSON.parse(GOOD));
    render(<SuggestPanel />);
    const user = userEvent.setup();
    await enterGoal(user);
    await waitFor(() => expect(screen.getByTestId('suggest-blocker').textContent).toContain('가구'));
    expect((screen.getByTestId('suggest-run') as HTMLButtonElement).disabled).toBe(true);
    cleanup();
    setup();
    render(<SuggestPanel />);
    await waitFor(() => expect(screen.getByTestId('suggest-blocker').textContent).toContain('목적'));
    expect((screen.getByTestId('suggest-run') as HTMLButtonElement).disabled).toBe(true);
  });

  it('가구가 40개를 넘으면 안내하고 비활성', async () => {
    const s = useProjectStore.getState();
    for (let i = 0; i < 39; i++) s.addItem({ name: `상자${i}`, w: 100, d: 100, h: 100 });
    mockClaude(async () => JSON.parse(GOOD));
    render(<SuggestPanel />);
    await enterGoal(userEvent.setup());
    await waitFor(() => expect(screen.getByTestId('suggest-blocker').textContent).toContain('40개'));
    expect((screen.getByTestId('suggest-run') as HTMLButtonElement).disabled).toBe(true);
  });

  it('SG-4: 형식이 틀린 답은 적용하지 않고 오류와 다시 추천받기를 보인다', async () => {
    const bad = answer([{ id: 1, back: 'top', left: 'x', top: 0 }, { id: 7, back: 'top', left: 0, top: 0 }]);
    const sample = mockClaude(async () => JSON.parse(bad));
    render(<SuggestPanel />);
    const user = userEvent.setup();
    const before = pos();
    await enterGoal(user);
    await waitFor(() => expect((screen.getByTestId('suggest-run') as HTMLButtonElement).disabled).toBe(false));
    await user.click(screen.getByTestId('suggest-run'));
    await screen.findByTestId('suggest-error');
    expect(pos()).toEqual(before);
    expect(sample.json).toHaveBeenCalledTimes(1); // 형식 오류는 다시 묻지 않는다
    expect(screen.queryByTestId('suggest-result')).toBeNull();
    expect(screen.getByTestId('suggest-retry')).toBeTruthy();
  });

  it('SG-7: 그만을 누르면 아무것도 바뀌지 않는다', async () => {
    const sample = mockClaude((_p, opts) => new Promise((_, rej) => (opts as { signal: AbortSignal }).signal.addEventListener('abort', () => rej({ code: 'cancelled' }))));
    render(<SuggestPanel />);
    const user = userEvent.setup();
    const before = pos();
    await enterGoal(user);
    await waitFor(() => expect((screen.getByTestId('suggest-run') as HTMLButtonElement).disabled).toBe(false));
    await user.click(screen.getByTestId('suggest-run'));
    expect(screen.getByTestId('suggest-status').textContent).toContain('추천을 만드는 중이에요');
    await waitFor(() => expect(sample.json).toHaveBeenCalled());
    await user.click(screen.getByTestId('suggest-stop'));
    expect(pos()).toEqual(before);
    expect(screen.queryByTestId('suggest-stop')).toBeNull();
    expect(screen.queryByTestId('suggest-result')).toBeNull();
    expect(screen.queryByTestId('suggest-error')).toBeNull();
  });

  it('SG-5: AI를 쓸 수 없으면 문구 복사·붙여넣기 경로가 보이고, 붙여 넣은 답도 같은 검사를 거친다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x', { status: 404 })));
    render(<SuggestPanel />);
    const user = userEvent.setup(); // userEvent가 clipboard를 자기 것으로 바꾸므로 그 뒤에 모의한다
    const write = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: write }, configurable: true });
    await screen.findByTestId('suggest-manual');
    expect(screen.queryByTestId('suggest-run')).toBeNull();
    await enterGoal(user, '넓어 보이게');
    await user.click(screen.getByTestId('suggest-copy'));
    expect(write).toHaveBeenCalledTimes(1);
    expect((write.mock.calls[0] as unknown[])[0]).toContain('사용자의 목적: "넓어 보이게"');

    const paste = screen.getByTestId('suggest-paste') as HTMLTextAreaElement;
    const before = pos();
    await user.click(paste);
    await user.paste('{"format": "nope"}');
    await user.click(screen.getByTestId('suggest-paste-apply'));
    expect(screen.getByTestId('suggest-error')).toBeTruthy();
    expect(pos()).toEqual(before);

    await user.clear(paste);
    await user.click(paste);
    await user.paste('답이에요 ```' + GOOD + '```');
    await user.click(screen.getByTestId('suggest-paste-apply'));
    expect(screen.getByTestId('suggest-reasons')).toBeTruthy();
    expect(pos()[1]).toEqual([2300, 700, 90]);
    await user.click(screen.getByTestId('suggest-revert'));
    expect(pos()).toEqual(before);
  });

  it('복사가 실패하면 문구를 보여 직접 복사하게 한다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x', { status: 404 })));
    render(<SuggestPanel />);
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn(async () => { throw new Error('denied'); }) }, configurable: true });
    await screen.findByTestId('suggest-manual');
    await enterGoal(user);
    await user.click(screen.getByTestId('suggest-copy'));
    expect((await screen.findByTestId('suggest-prompt-text') as HTMLTextAreaElement).value).toContain('공부하기 좋게');
  });

  it('SG-6: 서버 경로로 묻고 적용한다', async () => {
    const f = vi.fn(async (_u: unknown, init?: RequestInit) =>
      init?.method === 'POST'
        ? new Response(JSON.stringify({ text: GOOD }), { status: 200 })
        : new Response(JSON.stringify({ available: true }), { status: 200 }),
    );
    vi.stubGlobal('fetch', f);
    render(<SuggestPanel />);
    const user = userEvent.setup();
    await enterGoal(user);
    await waitFor(() => expect((screen.getByTestId('suggest-run') as HTMLButtonElement).disabled).toBe(false));
    await user.click(screen.getByTestId('suggest-run'));
    await screen.findByTestId('suggest-result');
    expect(f.mock.calls.filter((c) => c[1]?.method === 'POST')).toHaveLength(1);
    expect(pos()[1]).toEqual([2300, 700, 90]);
  });
});
