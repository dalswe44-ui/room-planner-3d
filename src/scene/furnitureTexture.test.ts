import { describe, expect, it, vi } from 'vitest';
import { GRAIN_SIZE_PX, GRAIN_TILE_M, getGrainTexture } from './furnitureTexture';
import { materialSpec } from './furnitureTones';
import { makePartGeometry, partGeometryKey } from './partGeometry';

describe('가구 재질 무늬', () => {
  // jsdom에는 캔버스가 없다. 그리기를 건너뛰는 경로(빈 텍스처)를 쓰게 하고 경고 출력을 막는다.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  it('종류별로 한 번만 만들어 공유하고 256 px 이하다', () => {
    for (const kind of ['wood', 'fabric'] as const) {
      expect(getGrainTexture(kind)).toBe(getGrainTexture(kind));
    }
    expect(getGrainTexture('wood')).not.toBe(getGrainTexture('fabric'));
    expect(GRAIN_SIZE_PX).toBeLessThanOrEqual(256);
  });
  it('무늬가 있는 부품은 UV를 갖고, 같은 모양은 같은 열쇠를 갖는다', () => {
    const part = { size: [400, 30, 300] as [number, number, number], position: [0, 0, 0] as [number, number, number], tone: 'light' as const, grain: 'wood' as const };
    const g = makePartGeometry(part)!;
    expect(g.getAttribute('uv').count).toBe(g.getAttribute('position').count);
    // 윗면 UV는 장면 좌표(m)를 무늬 길이로 나눈 값: 0.4 m 폭 / 0.6 m
    const uv = g.getAttribute('uv');
    const nor = g.getAttribute('normal');
    let maxU = -Infinity;
    for (let i = 0; i < uv.count; i++) if (nor.getY(i) > 0.9) maxU = Math.max(maxU, uv.getX(i));
    expect(maxU).toBeCloseTo(0.2 / GRAIN_TILE_M.wood, 6);
    expect(partGeometryKey(part)).toBe(partGeometryKey({ ...part, position: [5, 5, 5] }));
    expect(partGeometryKey(part)).not.toBe(partGeometryKey({ ...part, grain: 'fabric' }));
    g.dispose();
  });
  it('민무늬 각진 부품은 geometry를 만들지 않는다', () => {
    expect(makePartGeometry({ size: [10, 10, 10], position: [0, 0, 0], tone: 'main' })).toBeUndefined();
  });
  it('손잡이는 금속처럼, 천은 거칠게', () => {
    expect(materialSpec('handle', undefined).metalness).toBeGreaterThan(0.3);
    expect(materialSpec('main', 'fabric').roughness).toBeGreaterThan(materialSpec('main', 'wood').roughness);
  });
});
