import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetSampleCache } from '../photo/layoutReader';
import { answer, item, ROOM } from './fixtures';
import { askSuggestion, resetSuggestCache } from './suggestReader';

const ITEMS = [item('a', '침대', 1000, 2000), item('b', '책상', 1200, 600)];
const REQ = { goal: '공부', room: ROOM, items: ITEMS };
const TEXT = answer([{ id: 1, back: 'top', left: 0, top: 0 }]);
const jsonRes = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const signal = () => new AbortController().signal;

function mockClaude(json: (...a: unknown[]) => Promise<unknown>) {
  const sample = Object.assign(vi.fn(), { json: vi.fn(json), limits: vi.fn(async () => null) });
  window.claude = { use: vi.fn(async () => sample) };
  return sample;
}
function mockFetch(post: () => Response = () => jsonRes(200, { text: TEXT }), get: () => Response = () => jsonRes(200, { available: true })) {
  const fn = vi.fn(async (_u: unknown, init?: RequestInit) => (init?.method === 'POST' ? post() : get()));
  vi.stubGlobal('fetch', fn);
  return fn;
}
const posts = (fn: ReturnType<typeof mockFetch>) => fn.mock.calls.filter((c) => (c[1] as RequestInit | undefined)?.method === 'POST');

beforeEach(() => {
  resetSampleCache();
  resetSuggestCache();
});
afterEach(() => {
  delete window.claude;
  vi.unstubAllGlobals();
});

describe('askSuggestion', () => {
  it('sample 경로: 지시문 글을 그대로, 이미지 없이 보낸다', async () => {
    const sample = mockClaude(async () => ({ any: 1 }));
    const r = await askSuggestion(REQ, signal());
    expect(r).toEqual({ ok: true, text: '{"any":1}' });
    const [prompt, opts] = sample.json.mock.calls[0] as [string, Record<string, unknown>];
    expect(prompt).toContain('사용자의 목적: "공부"');
    expect(prompt).toContain('1. 침대');
    expect(opts.modelTier).toBe('complex');
    expect(opts.images).toBeUndefined();
    expect(opts.signal).toBeInstanceOf(AbortSignal);
  });

  it('sample 경로의 고치기 요청은 문제 문장이 든 지시문', async () => {
    const sample = mockClaude(async () => ({}));
    await askSuggestion({ ...REQ, repair: { previous: '{"x":1}', problems: ['1번 가구(침대)가 2번 가구(책상)와 겹칩니다.'] } }, signal());
    const prompt = sample.json.mock.calls[0][0] as string;
    expect(prompt).toContain('{"x":1}');
    expect(prompt).toContain('- 1번 가구(침대)가 2번 가구(책상)와 겹칩니다.');
  });

  it('서버 경로: GET available → POST JSON', async () => {
    const f = mockFetch();
    const r = await askSuggestion({ ...REQ, repair: { previous: 'p', problems: ['q'] } }, signal());
    expect(r).toEqual({ ok: true, text: TEXT, via: 'server' });
    expect(f.mock.calls[0][0]).toBe('./api/suggest-layout');
    const init = posts(f)[0][1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body.goal).toBe('공부');
    expect(Object.keys(body.room).sort()).toEqual(['corners', 'openings', 'walls']);
    expect(body.items[0]).toEqual({ name: '침대', w: 1000, d: 2000, h: 700, x: 1800, z: 1500, rotationDeg: 0 }); // id·color는 보내지 않는다
    expect(body.items[0].name).toBe('침대');
    expect(body.repair).toEqual({ previous: 'p', problems: ['q'] });
  });

  it('sample이 거절 코드를 내면 서버로 한 번 넘어가고 sample은 다시 시도하지 않는다', async () => {
    const sample = mockClaude(() => Promise.reject({ code: 'not_granted' }));
    const f = mockFetch();
    const r1 = await askSuggestion(REQ, signal());
    expect(r1).toEqual({ ok: true, text: TEXT, via: 'server' });
    await askSuggestion(REQ, signal());
    expect(sample.json).toHaveBeenCalledTimes(1);
    expect(posts(f)).toHaveLength(2);
  });

  it('둘 다 없으면 unavailable', async () => {
    expect(await askSuggestion(REQ, signal())).toEqual({ ok: false, kind: 'unavailable' }); // fetch 없음(jsdom)
    resetSuggestCache();
    mockFetch(undefined, () => jsonRes(200, { available: false }));
    expect(await askSuggestion(REQ, signal())).toEqual({ ok: false, kind: 'unavailable' });
  });

  it('서버 503 no_key는 unavailable, 그 밖의 오류 상태는 오류 문구', async () => {
    mockFetch(() => jsonRes(503, { error: 'no_key', message: 'x' }));
    expect(await askSuggestion(REQ, signal())).toMatchObject({ ok: false, kind: 'unavailable' });
    for (const status of [429, 413, 400, 502]) {
      resetSuggestCache();
      mockFetch(() => jsonRes(status, { error: 'e', message: 'm' }));
      const r = await askSuggestion(REQ, signal());
      expect(r).toMatchObject({ ok: false, kind: 'error' });
      expect((r as { message: string }).message.length).toBeGreaterThan(5);
    }
  });

  it('sample의 일반 오류는 서버로 넘어가지 않고 오류', async () => {
    mockClaude(() => Promise.reject({ code: 'rate_limited' }));
    const f = mockFetch();
    const r = await askSuggestion(REQ, signal());
    expect(r).toMatchObject({ ok: false, kind: 'error' });
    expect(posts(f)).toHaveLength(0);
  });

  it('중단하면 cancelled', async () => {
    const ac = new AbortController();
    mockClaude(() => new Promise((_, rej) => ac.signal.addEventListener('abort', () => rej({ code: 'cancelled' }))));
    const p = askSuggestion(REQ, ac.signal);
    await vi.waitFor(() => expect(window.claude!.use).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    ac.abort();
    expect(await p).toEqual({ ok: false, kind: 'cancelled' });
  });

  it('서버 요청 중 중단하면 cancelled', async () => {
    const ac = new AbortController();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_u: unknown, init?: RequestInit) => {
        if (init?.method !== 'POST') return jsonRes(200, { available: true });
        return new Promise<Response>((_, rej) => init.signal!.addEventListener('abort', () => rej(new DOMException('a', 'AbortError'))));
      }),
    );
    const p = askSuggestion(REQ, ac.signal);
    await new Promise((r) => setTimeout(r, 20));
    ac.abort();
    expect(await p).toMatchObject({ ok: false, kind: 'cancelled' });
  });
});
