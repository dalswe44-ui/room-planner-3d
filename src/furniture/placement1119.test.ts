// 2026-11-19 QA 4-4, 4-8, 5-4, 5-5, 5-6의 배치 계산
import { describe, expect, it } from 'vitest';
import { rectCorners, roomBounds, roomNotches } from '../contracts/room';
import type { FurnitureItem } from '../contracts/types';
import { bringInsideCenter, clearances, computeItemStatuses, footprint, footprintSize, narrowSides, polygonsOverlap, footprintPolygon } from './placement';

const item = (p: Partial<FurnitureItem>): FurnitureItem => ({ id: 'a', name: 'a', w: 1000, d: 600, h: 700, x: 1800, z: 1500, rotationDeg: 0, elevation: 0, color: '#fff', ...p });
const room = { corners: rectCorners(3600, 3000), walls: [], openings: [], ceilingHeight: 2400 };

describe('방 안으로 가져오기', () => {
  it('밖으로 나간 가구를 가장 가까운 벽 안쪽으로 옮긴다', () => {
    expect(bringInsideCenter(item({ x: -900, z: 1500 }), roomBounds(room))).toEqual({ x: 500, z: 1500 });
    expect(bringInsideCenter(item({ x: 4000, z: 3200 }), roomBounds(room))).toEqual({ x: 3100, z: 2700 });
  });
  it('방보다 큰 쪽은 방 가운데', () => {
    expect(bringInsideCenter(item({ w: 5000, x: 9000 }), roomBounds(room))).toEqual({ x: 1800, z: 1500 });
  });
});

describe('천장보다 높은 가구', () => {
  it('높이 + 띄운 높이가 천장보다 크면 ceiling', () => {
    expect(computeItemStatuses([item({ h: 2400 })], room, null).a.ceiling).toBeUndefined();
    expect(computeItemStatuses([item({ h: 2401 })], room, null).a.ceiling).toBe(true);
    expect(computeItemStatuses([item({ h: 2000, elevation: 500 })], room, null).a.ceiling).toBe(true);
  });
});

describe('자유 회전', () => {
  it('45도 가구의 감싸는 사각형', () => {
    const { sx, sz } = footprintSize(item({ w: 1000, d: 1000, rotationDeg: 45 }));
    expect(sx).toBeCloseTo(1414.2, 0);
    expect(sz).toBeCloseTo(1414.2, 0);
  });
  it('감싸는 사각형은 겹쳐도 실제로 떨어진 비스듬한 가구는 겹침이 아니다', () => {
    const a = item({ id: 'a', w: 1000, d: 200, x: 1000, z: 1000, rotationDeg: 45 });
    const b = item({ id: 'b', w: 1000, d: 200, x: 1500, z: 1500, rotationDeg: 45 });
    expect(footprint(a).maxX > footprint(b).minX).toBe(true);
    const st = computeItemStatuses([a, b], room, null);
    expect(st.a.overlap).toBe(false);
    const c = item({ id: 'c', w: 1000, d: 200, x: 1050, z: 1050, rotationDeg: 45 });
    expect(computeItemStatuses([a, c], room, null).a.overlap).toBe(true);
  });
  it('맞닿은 사각형은 겹침이 아니다(분리축)', () => {
    const p = footprintPolygon(item({ x: 500, z: 300 }));
    const q = footprintPolygon(item({ x: 1500, z: 300 }));
    expect(polygonsOverlap(p, q)).toBe(false);
  });
});

describe('통로 폭', () => {
  it('벽이나 다른 가구까지 0 < 틈 < 600이면 좁은 방향으로 알린다', () => {
    const a = item({ x: 500, z: 1500 }); // 왼쪽 벽에 붙음(0), 위 1200, 아래 1200
    const b = item({ id: 'b', x: 1900, z: 1500 }); // a 오른쪽 변 1000, b 왼쪽 변 1400 → 400
    const gaps = clearances(footprint(a), roomBounds(room), [], [footprint(b)]);
    expect(gaps).toEqual([1200, 400, 1200, 0]);
    expect(narrowSides(gaps)).toEqual([{ side: 1, gap: 400 }]);
  });
});

describe('ㄱ자 방', () => {
  const L = [
    { x: 0, z: 0 },
    { x: 4000, z: 0 },
    { x: 4000, z: 2000 },
    { x: 2000, z: 2000 },
    { x: 2000, z: 3000 },
    { x: 0, z: 3000 },
  ];
  it('둘러싼 사각형에서 빠진 칸', () => {
    expect(roomNotches(L)).toEqual([{ minX: 2000, maxX: 4000, minZ: 2000, maxZ: 3000 }]);
    expect(roomNotches(rectCorners(3600, 3000))).toEqual([]);
  });
  it('빠진 칸에 놓인 가구는 방 밖', () => {
    const lroom = { corners: L, walls: [], openings: [] };
    expect(computeItemStatuses([item({ x: 3000, z: 2500 })], lroom, null).a.outside).toBe(true);
    expect(computeItemStatuses([item({ x: 1000, z: 2500 })], lroom, null).a.outside).toBe(false);
  });
});
