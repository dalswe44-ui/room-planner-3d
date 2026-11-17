import { describe, expect, it } from 'vitest';
import { PLANK_LENGTH_MM, PLANK_WIDTH_MM, SHADE_RANGE, TILE_H_MM, TILE_W_MM, plankLayout } from './floorTexture';
import { DEFAULT_COLORS } from '../store/projectStore';
import { FLOOR_COLOR, WARNING_COLOR, WARNING_MIX, mixHex } from './geometry';

describe('바닥 널 무늬', () => {
  const planks = plankLayout();
  it('한 장은 실제 mm 크기이고 널 폭 150 mm, 길이 1200 mm다', () => {
    expect(PLANK_WIDTH_MM).toBe(150);
    expect(PLANK_LENGTH_MM).toBe(1200);
    expect(TILE_H_MM % PLANK_WIDTH_MM).toBe(0);
    expect(TILE_W_MM % PLANK_LENGTH_MM).toBe(0);
  });
  it('줄마다 널 길이를 합하면 한 장의 너비다(이어 붙여도 빈틈이 없다)', () => {
    const rows = TILE_H_MM / PLANK_WIDTH_MM;
    for (let r = 0; r < rows; r++) {
      expect(planks.filter((p) => p.row === r).reduce((sum, p) => sum + p.length, 0)).toBe(TILE_W_MM);
    }
  });
  it('널마다 밝기 차이는 ±3% 안이고, 줄마다 이음 위치가 엇갈린다', () => {
    expect(planks.every((p) => Math.abs(p.shade) <= SHADE_RANGE)).toBe(true);
    const seams = new Set(planks.filter((p) => p.row < 4).map((p) => (p.x0 % PLANK_LENGTH_MM) + '@' + p.row));
    const offsets = new Set([...seams].map((s) => s.split('@')[0]));
    expect(offsets.size).toBeGreaterThan(1);
  });
  it('같은 무늬가 항상 나온다', () => {
    expect(plankLayout()).toEqual(planks);
  });
});

describe('색 섞기', () => {
  it('0은 앞 색, 1은 뒤 색, 중간은 sRGB 값의 가중 평균', () => {
    expect(mixHex('#102030', '#f0e0d0', 0)).toBe('#102030');
    expect(mixHex('#102030', '#f0e0d0', 1)).toBe('#f0e0d0');
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
  });
  it('경고색을 섞어도 가구 색이 남는다(서로 다른 가구는 다른 색)', () => {
    expect(mixHex('#3b82c4', WARNING_COLOR, 0.6)).not.toBe(mixHex('#6bbf59', WARNING_COLOR, 0.6));
    expect(mixHex(FLOOR_COLOR, WARNING_COLOR, 0.6)).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('기본 가구 색 어느 것이든 경고 색은 붉은 계열이 분명하다(R이 G·B보다 70 넘게 크다, e2e C-1 기준)', () => {
    for (const color of DEFAULT_COLORS) {
      const mixed = mixHex(color, WARNING_COLOR, WARNING_MIX);
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(mixed.slice(i, i + 2), 16));
      expect(r! - g!, color).toBeGreaterThan(70);
      expect(r! - b!, color).toBeGreaterThan(70);
    }
  });
});
