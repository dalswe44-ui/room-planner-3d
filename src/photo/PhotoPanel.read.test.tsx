import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  notes: ['침대 높이는 적혀 있지 않음'],
};

type Json = (prompt: string, opts: { images: Blob[]; modelTier: string; signal: AbortSignal }) => Promise<unknown>;

function mockClaude(json: Json, limits: () => Promise<unknown> = async () => ({ images: { max: 1 } })) {
  const sample = { json: vi.fn(json), limits: vi.fn(limits) };
  window.claude = { use: vi.fn(async () => sample) };
  return sample;
}

const reject = (code: string) => Promise.reject({ code, message: code });
const picture = () => new File(['x'], 'plan.jpg', { type: 'image/jpeg' });

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
});

describe('배치도 사진 자동 읽기', () => {
  it('사진을 고르면 1번 읽고 → 미리보기 → 사용자가 눌러야 적용', async () => {
    const sample = mockClaude(async () => RESULT);
    render(<PhotoPanel />);
    const user = userEvent.setup();
    await user.upload(screen.getByTestId('photo-file'), picture());
    await screen.findByTestId('layout-preview');
    expect(sample.json).toHaveBeenCalledTimes(1);
    const [prompt, opts] = sample.json.mock.calls[0];
    expect(prompt).toContain('규칙');
    expect(prompt).toContain('room-layout');
    expect(opts.images).toHaveLength(1);
    expect(opts.images[0]).toBeInstanceOf(Blob);
    expect(opts.signal).toBeInstanceOf(AbortSignal);
    expect(screen.getByTestId('layout-preview').textContent).toContain('침대');
    // 읽기만으로는 적용되지 않는다
    expect(useProjectStore.getState().project.items).toHaveLength(0);
    // 문구 복사 / 붙여넣기는 접혀 있다
    expect(screen.getByTestId<HTMLDetailsElement>('layout-manual').open).toBe(false);
    await user.click(screen.getByTestId('layout-apply'));
    await user.click(screen.getByTestId('layout-apply-confirm'));
    const p = useProjectStore.getState().project;
    expect(p.room.corners[2]).toEqual({ x: 3400, z: 2800 });
    expect(p.items).toHaveLength(1);
  });

  it('not_granted면 자동 읽기를 숨기고 대체 경로를 보인다', async () => {
    mockClaude(() => reject('not_granted'));
    render(<PhotoPanel />);
    await userEvent.setup().upload(screen.getByTestId('photo-file'), picture());
    await waitFor(() => expect(screen.getByTestId('photo-read-status').textContent).toContain('바로 읽을 수 없어요'));
    expect(screen.queryByTestId('layout-manual')).toBeNull();
    expect(screen.getByTestId('layout-json')).toBeTruthy();
    expect(screen.getByTestId('layout-prompt-copy')).toBeTruthy();
    expect(screen.queryByTestId('photo-read-retry')).toBeNull();
  });

  it('limits에 images가 없으면 대체 경로', async () => {
    const sample = mockClaude(async () => RESULT, async () => ({}));
    render(<PhotoPanel />);
    await userEvent.setup().upload(screen.getByTestId('photo-file'), picture());
    await waitFor(() => expect(screen.getByTestId('photo-read-status').textContent).toContain('바로 읽을 수 없어요'));
    expect(sample.json).not.toHaveBeenCalled();
  });

  it('rate_limited면 오류와 다시 읽기. 자동 재시도는 없고, 누르면 다시 읽는다', async () => {
    let n = 0;
    const sample = mockClaude(() => (n++ === 0 ? reject('rate_limited') : Promise.resolve(RESULT)));
    render(<PhotoPanel />);
    const user = userEvent.setup();
    await user.upload(screen.getByTestId('photo-file'), picture());
    await waitFor(() => expect(screen.getByTestId('photo-read-status').textContent).toContain('너무 많아'));
    expect(sample.json).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('layout-manual')).toBeTruthy();
    await user.click(screen.getByTestId('photo-read-retry'));
    await screen.findByTestId('layout-preview');
    expect(sample.json).toHaveBeenCalledTimes(2);
  });

  it('읽은 결과가 형식에 맞지 않으면 오류를 보이고 다시 읽기를 준다', async () => {
    mockClaude(async () => ({ hello: 'world' }));
    render(<PhotoPanel />);
    await userEvent.setup().upload(screen.getByTestId('photo-file'), picture());
    await screen.findByTestId('layout-error');
    expect(screen.getByTestId('photo-read-retry')).toBeTruthy();
    expect(screen.getByTestId<HTMLButtonElement>('layout-apply').disabled).toBe(true);
  });

  it('읽는 중에는 상태와 중지 버튼. 중지하면 조용히 멈추고 결과를 버린다', async () => {
    let signal: AbortSignal | undefined;
    mockClaude((_p, o) => {
      signal = o.signal;
      return new Promise((_res, rej) => o.signal.addEventListener('abort', () => rej({ code: 'cancelled', message: 'cancelled' })));
    });
    render(<PhotoPanel />);
    const user = userEvent.setup();
    await user.upload(screen.getByTestId('photo-file'), picture());
    await waitFor(() => expect(screen.getByTestId('photo-read-status').textContent).toContain('읽는 중'));
    await user.click(screen.getByTestId('photo-read-stop'));
    expect(signal?.aborted).toBe(true);
    await waitFor(() => expect(screen.queryByTestId('photo-read-stop')).toBeNull());
    expect(screen.queryByTestId('layout-error')).toBeNull();
    expect(screen.queryByTestId('photo-read-retry')).toBeNull();
    expect(screen.getByTestId('photo-read-again')).toBeTruthy();
  });

  it('window.claude가 없으면 지금 화면(복사·붙여넣기)과 이유 한 줄', () => {
    render(<PhotoPanel />);
    expect(screen.getByTestId('photo-read-status').textContent).toBe('이 화면에서는 사진을 바로 읽을 수 없어요. 아래 방법으로 읽어 주세요.');
    expect(screen.queryByTestId('layout-manual')).toBeNull();
    expect(screen.getByTestId('layout-prompt-copy')).toBeTruthy();
    expect(screen.getByTestId('layout-json')).toBeTruthy();
  });

  it('use가 null이면 확인 중 → 대체 경로', async () => {
    let done!: (v: unknown) => void;
    window.claude = { use: () => new Promise((r) => (done = r)) };
    render(<PhotoPanel />);
    expect(screen.getByTestId('photo-read-status').textContent).toContain('확인하는 중');
    await act(async () => done(null));
    expect(screen.getByTestId('photo-read-status').textContent).toContain('바로 읽을 수 없어요');
  });

  it('복원된 사진은 자동으로 읽지 않고, "이 사진 읽기"를 누르면 읽는다', async () => {
    const sample = mockClaude(async () => RESULT);
    usePhotoStore.setState({ url: 'blob:fake', blob: new Blob(['x'], { type: 'image/jpeg' }), storage: 'saved' });
    render(<PhotoPanel />);
    await waitFor(() => expect(screen.getByTestId('photo-read-again')).toBeTruthy());
    expect(sample.json).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('photo-read-again'));
    await screen.findByTestId('layout-preview');
    expect(sample.json).toHaveBeenCalledTimes(1);
  });
});
