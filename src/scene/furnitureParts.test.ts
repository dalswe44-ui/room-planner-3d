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
        const parts = partsForKind(kind, w, d, h, 'id1');
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
    // 폭 1200이면 서랍 단이 한쪽을 채우므로 다리는 반대쪽 둘
    expect(parts.filter((p) => p.tone === 'dark' && p.size[1] > 600 && p.size[0] < 100)).toHaveLength(2);
  });

  it('책상: 폭 900 mm 이상이면 서랍 단(서랍 앞면 3 + 손잡이 3), 미만이면 서랍 없이 다리 4개', () => {
    const wide = partsForKind('desk', 900, 600, 720);
    expect(wide.filter((p) => p.tone === 'handle')).toHaveLength(3);
    expect(wide.filter((p) => p.tone === 'dark' && p.size[0] < 100)).toHaveLength(2);
    const narrow = partsForKind('desk', 899, 600, 720);
    expect(narrow.filter((p) => p.tone === 'handle')).toHaveLength(0);
    expect(narrow.filter((p) => p.tone === 'dark' && p.size[0] < 100)).toHaveLength(4);
    expect(narrow).toHaveLength(5);
  });

  it('책상 서랍 단은 -x 쪽에 있고 손잡이는 앞면(d/2)에서 끝난다', () => {
    const wide = partsForKind('desk', 1200, 600, 720);
    for (const hd of wide.filter((p) => p.tone === 'handle')) {
      expect(hd.position[0]).toBeLessThan(0);
      expect(hd.position[2] + hd.size[2] / 2).toBeLessThanOrEqual(300 + 1e-6);
    }
  });

  it('식탁: 다리 4개와 상판 아래 테 4개', () => {
    const parts = partsForKind('table', 1200, 800, 720);
    expect(parts.filter((p) => p.tone === 'dark')).toHaveLength(4);
    const top = parts.find((p) => p.size[0] === 1200)!;
    const aprons = parts.filter((p) => p !== top && p.tone === 'main');
    expect(aprons).toHaveLength(4);
    for (const a of aprons) expect(a.position[1] + a.size[1] / 2).toBeCloseTo(top.position[1] - top.size[1] / 2, 6);
  });

  it('책상·식탁 상판과 책장·옷장·침대 틀은 나뭇결, 소파·이불·베개는 직물 결', () => {
    expect(partsForKind('desk', 1200, 600, 720).find((p) => p.size[0] === 1200)!.grain).toBe('wood');
    for (const p of partsForKind('sofa', 1800, 850, 800).filter((q) => q.tone !== 'dark' || q.size[1] > 100)) expect(p.grain).toBe('fabric');
    const bed = partsForKind('bed', 1100, 2000, 450);
    for (const tone of ['blanket', 'cream', 'pillow'] as const) for (const p of bed.filter((q) => q.tone === tone)) expect(p.grain).toBe('fabric');
    expect(bed.filter((p) => p.tone === 'main')[0]!.grain).toBe('wood');
  });

  it('의자 등받이는 -z 쪽 변에, 좌판은 높이의 절반에 있다', () => {
    const parts = partsForKind('chair', 450, 500, 850);
    const back = parts.reduce((a, b) => (a.position[1] + a.size[1] / 2 > b.position[1] + b.size[1] / 2 ? a : b));
    expect(back.position[2]).toBeLessThan(-200);
    expect(back.position[1] + back.size[1] / 2).toBe(850);
    const seat = parts.find((p) => p.tone === 'light')!;
    expect(seat.position[1] + seat.size[1] / 2).toBe(425);
    expect(seat.grain).toBe('fabric');
    // 좌판은 등받이 앞에서 시작해 위에서 보면 둘이 겹치지 않는다.
    expect(seat.position[2] - seat.size[2] / 2).toBeGreaterThanOrEqual(back.position[2] + back.size[2] / 2 - 1e-6);
  });

  it('침대: 폭이 넓으면 베개 2개, 좁으면 1개, 이불은 매트리스와 다른 톤', () => {
    const pillows = (w: number) => partsForKind('bed', w, 2000, 450).filter((p) => p.tone === 'pillow').length;
    expect(pillows(1500)).toBe(2);
    expect(pillows(1100)).toBe(2);
    expect(pillows(900)).toBe(1);
    const tones = new Set(partsForKind('bed', 1500, 2000, 450).map((p) => p.tone));
    expect(tones.has('blanket') && tones.has('cream')).toBe(true);
  });

  it('소파: 폭에 따라 좌석 쿠션 2~3개, 양쪽 팔걸이', () => {
    // 좌석 쿠션만(등 쿠션은 그 위에 따로 있다)
    const cushions = (w: number) => partsForKind('sofa', w, 850, 800).filter((p) => p.tone === 'light' && p.position[1] + p.size[1] / 2 < 800 * 0.6).length;
    expect(cushions(1200)).toBe(2);
    expect(cushions(1600)).toBe(2);
    expect(cushions(1800)).toBe(3);
    expect(cushions(2200)).toBe(3);
    const arms = partsForKind('sofa', 1800, 850, 800).filter((p) => p.size[0] < 200 && p.size[1] > 400 && p.tone === 'main');
    expect(arms).toHaveLength(2);
  });

  it('소파: 짧은 다리 4개, 등 쿠션이 좌석 쿠션 수만큼 좌석 위 등받이 앞에 있다', () => {
    const parts = partsForKind('sofa', 1800, 850, 800);
    const legs = parts.filter((p) => p.tone === 'dark' && !p.grain);
    expect(legs).toHaveLength(4);
    for (const l of legs) expect(l.size[1]).toBeLessThanOrEqual(80);
    const backCush = parts.filter((p) => p.tone === 'light' && p.position[1] - p.size[1] / 2 >= 800 * 0.52 - 1e-6);
    expect(backCush).toHaveLength(3);
    for (const c of backCush) expect(c.position[2]).toBeLessThan(0);
  });

  it('침대: 짧은 다리가 있고 접힌 이불 단이 이불 위로 솟으며 베개는 둥글다', () => {
    const parts = partsForKind('bed', 1500, 2000, 450);
    const blanket = parts.find((p) => p.tone === 'blanket')!;
    const fold = parts.find((p) => p.tone === 'cream' && p.size[2] < 300)!;
    expect(fold.position[1] + fold.size[1] / 2).toBeGreaterThan(blanket.position[1] + blanket.size[1] / 2);
    const feet = parts.filter((p) => p.tone === 'dark' && !p.grain);
    expect(feet.length).toBeGreaterThanOrEqual(2);
    for (const f of feet) expect(f.position[1] - f.size[1] / 2).toBe(0);
    for (const p of parts.filter((q) => q.tone === 'pillow')) expect(p.radius).toBeGreaterThan(p.size[1] * 0.45);
  });

  it('옷장: 걸레받이가 바닥에 있고 문은 그 위부터 시작한다', () => {
    const parts = partsForKind('wardrobe', 900, 600, 2000);
    const plinth = parts.find((p) => p.position[1] - p.size[1] / 2 === 0)!;
    expect(plinth.size[1]).toBeLessThanOrEqual(100);
    expect(plinth.size[0]).toBeLessThan(900);
    for (const d of parts.filter((p) => p.tone === 'light')) expect(d.position[1] - d.size[1] / 2).toBeGreaterThanOrEqual(plinth.size[1] - 1e-6);
  });

  it('의자: 다리 4개는 가늘고(40 mm 이하) 등받이는 얇다', () => {
    const parts = partsForKind('chair', 450, 500, 850);
    const legs = parts.filter((p) => p.tone === 'dark');
    expect(legs).toHaveLength(4);
    for (const l of legs) expect(l.size[0]).toBeLessThanOrEqual(40);
    const back = parts.reduce((a, b) => (a.position[1] + a.size[1] / 2 > b.position[1] + b.size[1] / 2 ? a : b));
    expect(back.size[2]).toBeLessThanOrEqual(40);
    expect(back.radius).toBeGreaterThan(0);
  });

  it('책장: 책은 같은 id에 항상 같고 id가 다르면 달라지며, 선반 위 칸 안에 있다', () => {
    const books = (id: string) => partsForKind('shelf', 800, 300, 1800, id).filter((p) => p.tone.startsWith('book'));
    expect(books('abc')).toEqual(books('abc'));
    expect(books('abc').length).toBeGreaterThan(0);
    expect(JSON.stringify(books('abc'))).not.toEqual(JSON.stringify(books('xyz')));
    const parts = partsForKind('shelf', 800, 300, 1800, 'abc');
    const boards = parts.filter((p) => p.tone === 'light');
    for (const b of books('abc')) {
      const bottom = b.position[1] - b.size[1] / 2;
      // 책 바닥은 어느 선반 윗면과 같다
      expect(boards.some((s) => Math.abs(s.position[1] + s.size[1] / 2 - bottom) < 1e-6)).toBe(true);
    }
  });

  it('책장: 너무 작으면 책이 없다', () => {
    expect(partsForKind('shelf', 150, 300, 600, 'abc').filter((p) => p.tone.startsWith('book'))).toHaveLength(0);
  });

  it('옷장: 문이 2개 이상으로 나뉘고 손잡이가 문마다 있다', () => {
    const narrow = partsForKind('wardrobe', 900, 600, 2000);
    const wide = partsForKind('wardrobe', 1800, 600, 2000);
    expect(narrow.filter((p) => p.tone === 'handle')).toHaveLength(2);
    expect(wide.filter((p) => p.tone === 'handle')).toHaveLength(4);
    // 손잡이는 문 앞면 밖으로 나와 상자 앞면(d/2)에서 끝난다.
    for (const hd of wide.filter((p) => p.tone === 'handle')) expect(hd.position[2] + hd.size[2] / 2).toBeCloseTo(300, 6);
  });

  it('책장: 뒤판(dark)은 -z 쪽 변, 윗판은 윗면에 붙는다', () => {
    const parts = partsForKind('shelf', 800, 300, 1800);
    const back = parts.find((p) => p.tone === 'dark')!;
    expect(back.position[2] - back.size[2] / 2).toBeCloseTo(-150, 6);
    expect(Math.max(...parts.filter((p) => p.tone === 'light').map((p) => p.position[1] + p.size[1] / 2))).toBe(1800);
  });

  it('책상·식탁 상판은 위에서 본 모서리가 둥글다', () => {
    for (const kind of ['desk', 'table'] as const) {
      const top = partsForKind(kind, 1200, 600, 720).find((p) => p.size[0] === 1200)!;
      expect(top.corner).toBeGreaterThan(0);
    }
  });

  it('침대 머리판은 -z 쪽 변에서 가장 높고 높이는 h를 넘지 않는다', () => {
    const parts = partsForKind('bed', 1100, 2000, 450);
    const head = parts.reduce((a, b) => (a.position[1] + a.size[1] / 2 > b.position[1] + b.size[1] / 2 ? a : b));
    expect(head.position[1] + head.size[1] / 2).toBeLessThanOrEqual(450);
    expect(head.position[2]).toBeLessThan(-900);
  });

  it('책장 선반 수는 높이에 따라 늘어난다', () => {
    const shelves = (h: number) => partsForKind('shelf', 800, 300, h, 'x').filter((p) => p.tone === 'light').length;
    expect(shelves(1800)).toBeGreaterThan(shelves(700));
  });
});
