import { afterEach, describe, expect, it, vi } from 'vitest';
import { fitWithin, resizePhoto } from './resizePhoto';

afterEach(() => vi.unstubAllGlobals());

describe('fitWithin', () => {
  it('긴 변이 2048을 넘으면 비율을 지켜 줄인다', () => {
    expect(fitWithin(4096, 3072)).toEqual({ width: 2048, height: 1536 });
    expect(fitWithin(3000, 6000)).toEqual({ width: 1024, height: 2048 });
  });
  it('이미 작으면 그대로 둔다(키우지 않는다)', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
  it('극단적으로 긴 사진도 한 변이 0이 되지 않는다', () => {
    expect(fitWithin(100000, 10).height).toBeGreaterThanOrEqual(1);
  });
});

describe('resizePhoto', () => {
  it('브라우저가 이미지를 읽지 못하면 원본을 돌려주고 resized는 false', async () => {
    vi.stubGlobal('createImageBitmap', () => Promise.reject(new Error('형식 모름')));
    const file = new File(['x'], 'a.heic', { type: 'image/heic' });
    const r = await resizePhoto(file);
    expect(r).toEqual({ blob: file, resized: false });
  });
  it('createImageBitmap이 없는 환경에서도 원본을 돌려준다', async () => {
    const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
    expect((await resizePhoto(file)).resized).toBe(false);
  });
});
