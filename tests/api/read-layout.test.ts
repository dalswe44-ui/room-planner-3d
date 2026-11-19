import { describe, expect, it, vi } from 'vitest';
import { LAYOUT_READER_PROMPT } from '../../src/contracts/layoutImport';
import { handle, rateLimited } from '../../api/read-layout';

const URL_ = 'https://app.example/api/read-layout';
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const post = (body: BodyInit, headers: Record<string, string> = {}) =>
  new Request(URL_, { method: 'POST', body, headers: { 'content-type': 'image/jpeg', ...headers } });
const ok = (text: string) => new Response(JSON.stringify({ content: [{ type: 'text', text }] }), { status: 200 });

describe('배치도 읽기 서버 함수', () => {
  it('GET은 키 설정 여부만 알려 준다(키 값은 내보내지 않는다)', async () => {
    const r1 = await handle(new Request(URL_), {});
    expect(await r1.json()).toEqual({ available: false });
    const r2 = await handle(new Request(URL_), { ANTHROPIC_API_KEY: 'sk-test' });
    const body = await r2.text();
    expect(JSON.parse(body)).toEqual({ available: true });
    expect(body).not.toContain('sk-test');
  });

  it('키가 없으면 503 no_key', async () => {
    const r = await handle(post(jpeg), {});
    expect(r.status).toBe(503);
    expect((await r.json()).error).toBe('no_key');
  });

  it('사진과 앱의 읽기 규칙을 Claude API로 보내고 답의 글을 돌려준다', async () => {
    const f = vi.fn(async () => ok('{"format":"room-layout"}'));
    const r = await handle(post(jpeg), { ANTHROPIC_API_KEY: 'sk-test' }, f as unknown as typeof fetch, 1);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ text: '{"format":"room-layout"}' });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect((init.headers as Record<string, string>)['x-api-key']).toBe('sk-test');
    const sent = JSON.parse(String(init.body));
    expect(sent.model).toBe('claude-sonnet-5-5');
    expect(sent.messages[0].content[0]).toMatchObject({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg' } });
    expect(sent.messages[0].content[1].text).toBe(LAYOUT_READER_PROMPT);
  });

  it('사진이 아니거나 비었으면 415, 다른 사이트에서 오면 403', async () => {
    const env = { ANTHROPIC_API_KEY: 'k' };
    const f = vi.fn();
    expect((await handle(post('x', { 'content-type': 'text/plain' }), env, f, 2)).status).toBe(415);
    expect((await handle(post(new Uint8Array()), env, f, 3)).status).toBe(415);
    expect((await handle(post(jpeg, { origin: 'https://evil.example' }), env, f, 4)).status).toBe(403);
    expect(f).not.toHaveBeenCalled();
  });

  it('너무 큰 사진은 413', async () => {
    const big = new Uint8Array(4 * 1024 * 1024 + 1);
    const r = await handle(post(big), { ANTHROPIC_API_KEY: 'k' }, vi.fn(), 5);
    expect(r.status).toBe(413);
  });

  it('AI 쪽 429는 429로, 그 밖의 실패는 502로', async () => {
    const env = { ANTHROPIC_API_KEY: 'k' };
    const h = { 'x-forwarded-for': '10.0.0.9' };
    expect((await handle(post(jpeg, h), env, vi.fn(async () => new Response('', { status: 429 })) as unknown as typeof fetch, 6)).status).toBe(429);
    expect((await handle(post(jpeg, h), env, vi.fn(async () => new Response('', { status: 500 })) as unknown as typeof fetch, 7)).status).toBe(502);
    expect((await handle(post(jpeg, h), env, vi.fn(async () => { throw new Error('net'); }) as unknown as typeof fetch, 8)).status).toBe(502);
    expect((await handle(post(jpeg, h), env, vi.fn(async () => ok('   ')) as unknown as typeof fetch, 9)).status).toBe(502);
  });

  it('같은 주소에서 한 시간에 정한 횟수를 넘으면 429', () => {
    const store = new Map<string, number[]>();
    for (let i = 0; i < 3; i += 1) expect(rateLimited('a', 3, 1000 + i, store)).toBe(false);
    expect(rateLimited('a', 3, 2000, store)).toBe(true);
    expect(rateLimited('b', 3, 2000, store)).toBe(false);
    expect(rateLimited('a', 3, 1000 + 60 * 60 * 1000 + 5, store)).toBe(false);
  });
});
