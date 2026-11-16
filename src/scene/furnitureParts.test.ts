import { describe, expect, it } from 'vitest';
import { FURNITURE_PRESETS } from '../contracts/furniturePresets';
import type { FurnitureKind } from '../contracts/types';
import { partsForKind } from './furnitureParts';

const EPS = 1e-6;
const KINDS: FurnitureKind[] = ['desk', 'chair', 'bed', 'sofa', 'wardrobe', 'table', 'shelf'];
const SIZES: [number, number, number][] = [
  [1200, 600, 720],
  [450, 500, 850],
  [300, 200, 100],
  [3000, 1500, 2500],
  [40, 30, 20],
];

function bounds(w: number, d: number, h: number) {
  return (p: ReturnType<typeof partsForKind>[number]) => {
    const [sw, sh, sd] = p.size;
    const [px, py, pz] = p.position;
    return (
      sw > 0 && sh > 0 && sd > 0 &&
      px - sw / 2 >= -w / 2 - EPS && px + sw / 2 <= w / 2 + EPS &&
      py - sh / 2 >= -EPS && py + sh / 2 <= h + EPS &&
      pz - sd / 2 >= -d / 2 - EPS && pz + sd / 2 <= d / 2 + EPS
    );
  };
}

describe('partsForKind', () => {
  it('box나 종류 없음은 부품이 없다(상자 하나로 그린다)', () => {
    expect(partsForKind('box', 1000, 500, 500)).toEqual([]);
    expect(partsForKind(undefined, 1000, 500, 500)).toEqual([]);
  });

  for (const kind of KINDS) {
    it(`${kind}: 어떤 크기에서도 모든 부품이 w×d×h 상자 안에 있다`, () => {
      for (const [w, d, h] of SIZES) {
        const parts = partsForKind(kind, w, d, h);
        expect(parts.length).toBeGreaterThan(1);
        expect(parts.every(bounds(w, d, h))).toBe(true);
      }
    });

    it(`${kind}: 크기를 바꾸면 부품이 따라 변하고 바깥 범위는 상자를 채운다`, () => {
      const a = partsForKind(kind, 1000, 600, 800);
      const b = partsForKind(kind, 1500, 900, 1200);
      expect(JSON.stringify(a)).not.toEqual(JSON.stringify(b));
      for (const [w, d, h, parts] of [[1000, 600, 800, a], [1500, 900, 1200, b]] as const) {
        const maxX = Math.max(...parts.map((p) => p.position[0] + p.size[0] / 2));
        const maxY = Math.max(...parts.map((p) => p.position[1] + p.size[1] / 2));
        const minZ = Math.min(...parts.map((p) => p.position[2] - p.size[2] / 2));
        expect(maxX).toBeCloseTo(w / 2, 6);
        expect(maxY).toBeGreaterThan(h * 0.85);
        expect(minZ).toBeCloseTo(-d / 2, 6);
      }
    });
  }

  it('기본 가구 프리셋 치수에서도 상자 안에 들어간다', () => {
    for (const p of FURNITURE_PRESETS) {
      expect(partsForKind(p.kind, p.w, p.d, p.h).every(bounds(p.w, p.d, p.h))).toBe(p.kind === 'box' ? false : true);
    }
  });

  it('책상 상판은 맨 위에 두께 30 mm, 다리는 4개', () => {
    const parts = partsForKind('desk', 1200, 600, 720);
    const top = parts.find((p) => p.size[0] === 1200)!;
    expect(top.size[1]).toBe(30);
    expect(top.position[1] + top.size[1] / 2).toBe(720);
    expect(parts.filter((p) => p.size[0] < 100)).toHaveLength(4);
  });

  it('의자 등받이는 -z 쪽 변에, 좌판은 높이의 절반에 있다', () => {
    const parts = partsForKind('chair', 450, 500, 850);
    const back = parts.reduce((a, b) => (a.position[1] > b.position[1] ? a : b));
    expect(back.position[2]).toBeLessThan(-200);
    expect(back.position[1] + back.size[1] / 2).toBe(850);
    const seat = parts.find((p) => p.size[0] === 450 && p.position[2] === 0)!;
    expect(seat.position[1] + seat.size[1] / 2).toBe(425);
  });

  it('침대 머리판은 -z 쪽 변에서 가장 높고 높이는 h를 넘지 않는다', () => {
    const parts = partsForKind('bed', 1100, 2000, 450);
    const head = parts.reduce((a, b) => (a.position[1] + a.size[1] / 2 > b.position[1] + b.size[1] / 2 ? a : b));
    expect(head.position[1] + head.size[1] / 2).toBeLessThanOrEqual(450);
    expect(head.position[2]).toBeLessThan(-900);
  });

  it('책장 선반 수는 높이에 따라 늘어난다', () => {
    const shelves = (h: number) => partsForKind('shelf', 800, 300, h).filter((p) => p.tone === 'light').length;
    expect(shelves(1800)).toBeGreaterThan(shelves(700));
  });
});
