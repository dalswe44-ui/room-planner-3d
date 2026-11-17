import { describe, expect, it } from 'vitest';
import { WARNING_COLOR } from './geometry';
import { toneHexes } from './furnitureTones';

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const isRed = (hex: string) => { const [r, g, b] = rgb(hex); return r > g + 70 && r > b + 70; };

describe('toneHexes', () => {
  it('경고가 아니면 크림색 같은 고정 색은 가구 색과 무관하다', () => {
    expect(toneHexes('#7aa2d6', false).cream).toBe(toneHexes('#e8e1d5', false).cream);
  });
  it('밝은 톤은 밝고 어두운 톤은 어둡다', () => {
    const lum = (h: string) => rgb(h).reduce((a, b) => a + b, 0);
    const t = toneHexes('#cdb693', false);
    expect(lum(t.light)).toBeGreaterThan(lum(t.main));
    expect(lum(t.dark)).toBeLessThan(lum(t.main));
  });
  it('경고이면 크림색·베개·이불을 포함한 모든 톤이 붉은 계열이 된다', () => {
    for (const base of ['#e8e1d5', '#7aa2d6', '#a9b0b8']) {
      const t = toneHexes(base, true);
      for (const [k, v] of Object.entries(t)) if (k !== 'handle') expect(isRed(v), `${base} ${k} ${v}`).toBe(true);
    }
    expect(WARNING_COLOR).toBe('#d9482b');
  });
  it('이불은 매트리스(크림)와 다르다', () => {
    for (const base of ['#e8e1d5', '#7aa2d6', '#1c2b39']) {
      const t = toneHexes(base, false);
      expect(t.blanket).not.toBe(t.cream);
    }
  });
});
