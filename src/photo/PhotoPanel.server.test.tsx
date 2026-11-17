import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultProject, useProjectStore } from '../store/projectStore';
import { resetSampleCache } from './layoutReader';
import { PhotoPanel } from './PhotoPanel';
import { usePhotoStore } from './photoStore';

const RESULT = {
  format: 'room-layout',
  version: 1,
  unit: 'cm',
  room: { width: 340, depth: 280, height: 240 },
  items: [{ name: '침대', w: 100, d: 200, h: null, left: 0, top: 0, rotationDeg: 0 }],
};

const jsonRes = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const picture = () => new File(['x'], 'plan.jpg', { type: 'image/jpeg' });

type Handler = (init: RequestInit | undefined) => Response | Promise<Response>;
/** GET은 get(), POST는 post()로 답하는 fetch 모의. */
function mockFetch(get: () => Response | Promise<Response>, post: Handler = () => jsonRes(200, { text: JSON.stringify(RESULT) })) {
  const fn = vi.fn(async (_url: unknown, init?: RequestInit) => (init?.method === 'POST' ? post(init) : get()));
  vi.stubGlobal('fetch', fn);
  return fn;
}
const posts = (fn: ReturnType<typeof mockFetch>) => fn.mock.calls.filter((c) => (c[1] as RequestInit | undefined)?.method === 'POST');
const status = () => screen.queryByTestId('photo-read-status')?.textContent ?? '';

beforeEach(() => {
  resetSampleCache();
  useProjectStore.setState({ project: createDefaultProject() });
  usePhotoStore.setState({ url: null, blob: null, storage: 'none' });
  URL.createObjectURL = vi.fn(() => 'blob:fake');
  URL.revokeObjectURL = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  delete window.claude;
  vi.unstubAllGlobals();
});

describe('배치도 사진 서버 읽기', () => {
  it('available true: 사진 고르면 POST 1회(몸체 Blob) → 미리보기 → 적용', async () => {
    const f = mockFetch(() => jsonRes(200, { available: true }));
    render(<PhotoPanel />);
    const user = userEvent.setup();
    await screen.findByText(/이 앱의 서버를 거쳐/);
    expect(f.mock.calls[0][0]).toBe('./api/read-layout');
    await user.upload(screen.getByTestId('photo-file'), picture());
    await screen.findByTestId('layout-preview');
    expect(posts(f)).toHaveLength(1);
    const init = posts(f)[0][1] as RequestInit;
    expect(init.body).toBeInstanceOf(Blob);
    expect((init.headers as Record<string, string>)['content-type']).toBe('image/jpeg');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(screen.getByText(/이 앱의 서버를 거쳐 Claude로 보내고, 저장하지 않습니다/)).toBeTruthy();
    expect(screen.getByTestId<HTMLDetailsElement>('layout-manual').open).toBe(false);
    expect(useProjectStore.getState().project.items).toHaveLength(0);
    await user.click(screen.getByTestId('layout-apply'));
    await user.click(screen.getByTestId('layout-apply-confirm'));
    const p = useProjectStore.getState().project;
    expect(p.room.corners[2]).toEqual({ x: 3400, z: 2800 });
    expect(p.items).toHaveLength(1);
  });

  it('available false면 대체 경로(복사·붙여넣기), 사진을 골라도 POST 없음', async () => {
    const f = mockFetch(() => jsonRes(200, { available: false }));
    render(<PhotoPanel />);
    await waitFor(() => expect(status()).toContain('바로 읽을 수 없어요'));
    expect(screen.getByTestId('layout-json')).toBeTruthy();
    await userEvent.setup().upload(screen.getByTestId('photo-file'), picture());
    await screen.findByTestId('photo-preview');
    expect(posts(f)).toHaveLength(0);
  });

  it('404면 대체 경로', async () => {
    mockFetch(() => new Response('<html></html>', { status: 404 }));
    render(<PhotoPanel />);
    await waitFor(() => expect(status()).toContain('바로 읽을 수 없어요'));
    expect(screen.getByTestId('layout-prompt-copy')).toBeTruthy();
  });

  it('JSON이 아닌 200 응답(정적 호스팅의 index.html)도 서버 없음', async () => {
    mockFetch(() => new Response('<html></html>', { status: 200 }));
    render(<PhotoPanel />);
    await waitFor(() => expect(status()).toContain('바로 읽을 수 없어요'));
  });

  it('429: 안내와 다시 읽기. 자동 재시도 없음, 누르면 한 번 더', async () => {
    let n = 0;
    const f = mockFetch(
      () => jsonRes(200, { available: true }),
      () => (n++ === 0 ? jsonRes(429, { error: 'rate_limited', message: 'x' }) : jsonRes(200, { text: JSON.stringify(RESULT) })),
    );
    render(<PhotoPanel />);
    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByText(/이 앱의 서버를 거쳐/)).toBeTruthy());
    await user.upload(screen.getByTestId('photo-file'), picture());
    await waitFor(() => expect(status()).toContain('잠시 뒤에 다시'));
    await new Promise((r) => setTimeout(r, 50));
    expect(posts(f)).toHaveLength(1);
    await user.click(screen.getByTestId('photo-read-retry'));
    await screen.findByTestId('layout-preview');
    expect(posts(f)).toHaveLength(2);
  });

  it.each([
    [413, 'too_large', '너무 큽니다'],
    [415, 'bad_type', 'JPEG, PNG, WebP'],
    [502, 'upstream', '읽지 못했어요'],
  ])('%i는 알맞은 안내와 다시 읽기', async (code, error, text) => {
    mockFetch(() => jsonRes(200, { available: true }), () => jsonRes(code, { error, message: 'x' }));
    render(<PhotoPanel />);
    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByText(/이 앱의 서버를 거쳐/)).toBeTruthy());
    await user.upload(screen.getByTestId('photo-file'), picture());
    await waitFor(() => expect(status()).toContain(text));
    expect(screen.getByTestId('photo-read-retry')).toBeTruthy();
  });

  it('503 no_key는 서버 없음으로 보고 대체 경로', async () => {
    mockFetch(() => jsonRes(200, { available: true }), () => jsonRes(503, { error: 'no_key', message: 'x' }));
    render(<PhotoPanel />);
    await waitFor(() => expect(screen.getByText(/이 앱의 서버를 거쳐/)).toBeTruthy());
    await userEvent.setup().upload(screen.getByTestId('photo-file'), picture());
    await waitFor(() => expect(status()).toContain('바로 읽을 수 없어요'));
    expect(screen.getByTestId('layout-json')).toBeTruthy();
    expect(screen.queryByTestId('photo-read-retry')).toBeNull();
  });

  it('sample과 서버가 둘 다 있으면 sample 우선(POST 없음)', async () => {
    const f = mockFetch(() => jsonRes(200, { available: true }));
    const sample = { json: vi.fn(async () => RESULT), limits: vi.fn(async () => ({ images: { max: 1 } })) };
    window.claude = { use: vi.fn(async () => sample) };
    render(<PhotoPanel />);
    await userEvent.setup().upload(screen.getByTestId('photo-file'), picture());
    await screen.findByTestId('layout-preview');
    expect(sample.json).toHaveBeenCalledTimes(1);
    expect(posts(f)).toHaveLength(0);
    expect(screen.queryByText(/이 앱의 서버를 거쳐/)).toBeNull();
  });

  it('sample이 없으면(use가 null) 서버를 쓴다', async () => {
    const f = mockFetch(() => jsonRes(200, { available: true }));
    window.claude = { use: vi.fn(async () => null) };
    render(<PhotoPanel />);
    await userEvent.setup().upload(screen.getByTestId('photo-file'), picture());
    await screen.findByTestId('layout-preview');
    expect(posts(f)).toHaveLength(1);
  });
});
