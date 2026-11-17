import { describe, expect, it } from 'vitest';
import { rectCorners } from './room';
import {
  allWallSegments,
  doorHinge,
  doorSwingRect,
  interiorWallRect,
  offsetAlongWall,
  openingFits,
  openingSpan,
  rectsOverlap,
  wallSegment,
} from './structure';
import type { Opening, Room } from './types';

const room = (walls: Room['walls'] = []): Pick<Room, 'corners' | 'walls'> => ({ corners: rectCorners(3600, 3000), walls });
const door = (p: Partial<Opening>): Opening => ({ id: 'd', type: 'door', wall: 0, offset: 500, width: 900, height: 2100, sill: 0, ...p });

describe('벽 선분', () => {
  it('바깥 벽의 법선(normal)은 방 안쪽이다', () => {
    const r = room();
    expect(wallSegment(r, 0)?.normal).toEqual({ x: 0, z: 1 });
    expect(wallSegment(r, 1)?.normal).toEqual({ x: -1, z: 0 });
    expect(wallSegment(r, 2)?.normal).toEqual({ x: 0, z: -1 });
    expect(wallSegment(r, 3)?.normal).toEqual({ x: 1, z: 0 });
    expect(wallSegment(r, 4)).toBeNull();
  });

  it('칸막이 벽과 그 바닥 사각형', () => {
    const w = { id: 'w', a: { x: 1800, z: 0 }, b: { x: 1800, z: 2000 }, thickness: 100 };
    const r = room([w]);
    expect(wallSegment(r, 'w')).toMatchObject({ length: 2000, thickness: 100, inner: true, dir: { x: 0, z: 1 } });
    expect(interiorWallRect(w)).toEqual({ minX: 1750, maxX: 1850, minZ: 0, maxZ: 2000 });
    expect(allWallSegments(r)).toHaveLength(5);
    expect(wallSegment(r, 'x')).toBeNull();
  });
});

describe('개구부와 문', () => {
  it('구간은 벽 시작에서 offset만큼, 벽 길이 안으로 자른다', () => {
    const r = room();
    expect(openingSpan(r, door({}))).toMatchObject({ from: { x: 500, z: 0 }, to: { x: 1400, z: 0 } });
    expect(openingFits(r, door({ offset: 2700 }))).toBe(true);
    expect(openingFits(r, door({ offset: 2701 }))).toBe(false);
    expect(openingSpan(r, door({ offset: 3500 }))).toMatchObject({ from: { x: 3500, z: 0 }, to: { x: 3600, z: 0 } });
  });

  it('위쪽 바깥 벽의 문은 방 안쪽(아래)으로 문 폭만큼 열린다', () => {
    expect(doorSwingRect(room(), door({}))).toEqual({ minX: 500, maxX: 1400, minZ: 0, maxZ: 900 });
    expect(doorSwingRect(room(), door({ swing: 'opposite' }))).toEqual({ minX: 500, maxX: 1400, minZ: -900, maxZ: 0 });
    expect(doorSwingRect(room(), door({ type: 'window' }))).toBeNull();
  });

  it('칸막이 벽의 문은 벽 면(두께의 반)에서부터', () => {
    const r = room([{ id: 'w', a: { x: 1800, z: 0 }, b: { x: 1800, z: 3000 }, thickness: 100 }]);
    // 방향 (0,1)의 normal은 (−1, 0): 왼쪽
    expect(doorSwingRect(r, door({ wall: 'w', offset: 1000, width: 800 }))).toEqual({ minX: 950, maxX: 1750, minZ: 1000, maxZ: 1800 });
  });

  it('경첩과 열리는 방향', () => {
    expect(doorHinge(room(), door({}))).toEqual({ hinge: { x: 500, z: 0 }, free: { x: 1400, z: 0 }, openDir: { x: 0, z: 1 } });
    expect(doorHinge(room(), door({ hinge: 'end' }))?.hinge).toEqual({ x: 1400, z: 0 });
  });

  it('벽 위 한 점으로 offset 구하기(가운데 맞춤, 벽 안으로)', () => {
    const s = wallSegment(room(), 0)!;
    expect(offsetAlongWall(s, { x: 1800, z: 40 }, 900)).toBe(1350);
    expect(offsetAlongWall(s, { x: 100, z: 0 }, 900)).toBe(0);
    expect(offsetAlongWall(s, { x: 3590, z: 0 }, 900)).toBe(2700);
  });

  it('사각형 겹침은 1 mm 기준', () => {
    const a = { minX: 0, maxX: 100, minZ: 0, maxZ: 100 };
    expect(rectsOverlap(a, { minX: 100, maxX: 200, minZ: 0, maxZ: 100 })).toBe(false);
    expect(rectsOverlap(a, { minX: 99, maxX: 200, minZ: 0, maxZ: 100 })).toBe(true);
  });
});
