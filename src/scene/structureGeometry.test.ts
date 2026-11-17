import { describe, expect, it } from 'vitest';
import { rectCorners } from '../contracts/room';
import { doorHinge } from '../contracts/structure';
import type { InteriorWall, Opening, Room } from '../contracts/types';
import { cutWallPieces, doorPlan, drawnWall, openingBox, openingsOnWall, straightenPreview, windowPlanLines } from './structureGeometry';

const wall: InteriorWall = { id: 'w1', a: { x: 3000, z: 0 }, b: { x: 3000, z: 2000 }, thickness: 100 };
const room: Pick<Room, 'corners' | 'walls'> = { corners: rectCorners(5000, 4000), walls: [wall] };
const open = (p: Partial<Opening>): Opening => ({ id: 'o', type: 'door', wall: 0, offset: 0, width: 900, height: 2100, sill: 0, ...p });

describe('cutWallPieces: 벽을 개구부로 자른 조각', () => {
  it('개구부가 없으면 한 조각이고 양 끝을 ext만큼 늘린다', () => {
    expect(cutWallPieces(5000, 2400, [], { ext: 50 })).toEqual([{ t0: -50, t1: 5050, y0: 0, y1: 2400 }]);
  });

  it('평면 뷰: 개구부 구간은 문·창문 모두 높이와 상관없이 통째로 비운다', () => {
    const pieces = cutWallPieces(3000, 2400, [{ t0: 1000, t1: 1900, sill: 0, height: 2100 }, { t0: 2200, t1: 2800, sill: 900, height: 1200 }], { plan: true });
    expect(pieces).toEqual([
      { t0: 0, t1: 1000, y0: 0, y1: 2400 },
      { t0: 1900, t1: 2200, y0: 0, y1: 2400 },
      { t0: 2800, t1: 3000, y0: 0, y1: 2400 },
    ]);
  });

  it('3D 뷰: 문은 바닥부터 높이까지 뚫고 위에 인방(2100 ~ 2400)이 남는다', () => {
    const pieces = cutWallPieces(3000, 2400, [{ t0: 1000, t1: 1900, sill: 0, height: 2100 }]);
    expect(pieces).toContainEqual({ t0: 1000, t1: 1900, y0: 2100, y1: 2400 });
    expect(pieces.filter((p) => p.t0 === 1000 && p.t1 === 1900)).toHaveLength(1);
  });

  it('3D 뷰: 창문은 문턱 아래(0 ~ 900)와 창 위(2100 ~ 2400) 두 조각이 남는다', () => {
    const pieces = cutWallPieces(3000, 2400, [{ t0: 1000, t1: 2200, sill: 900, height: 1200 }]);
    const over = pieces.filter((p) => p.t0 === 1000 && p.t1 === 2200).sort((a, b) => a.y0 - b.y0);
    expect(over).toEqual([
      { t0: 1000, t1: 2200, y0: 0, y1: 900 },
      { t0: 1000, t1: 2200, y0: 2100, y1: 2400 },
    ]);
  });

  it('창 위가 천장을 넘으면 위 조각이 없고, 문턱이 천장 이상이면 구간이 통째로 벽으로 남는다', () => {
    const tall = cutWallPieces(3000, 2400, [{ t0: 1000, t1: 2000, sill: 900, height: 3000 }]);
    expect(tall.filter((p) => p.t0 === 1000)).toEqual([{ t0: 1000, t1: 2000, y0: 0, y1: 900 }]);
    const high = cutWallPieces(3000, 2400, [{ t0: 1000, t1: 2000, sill: 2400, height: 500 }]);
    expect(high.filter((p) => p.t0 === 1000)).toEqual([{ t0: 1000, t1: 2000, y0: 0, y1: 2400 }]);
  });

  it('개구부가 벽 끝에 있으면 바깥 벽의 모서리 조각(ext)은 남는다', () => {
    const pieces = cutWallPieces(3000, 2400, [{ t0: 0, t1: 900, sill: 0, height: 2100 }], { ext: 50, plan: true });
    expect(pieces[0]).toEqual({ t0: -50, t1: 0, y0: 0, y1: 2400 });
    expect(pieces[1]).toEqual({ t0: 900, t1: 3050, y0: 0, y1: 2400 });
  });

  it('벽 길이를 넘는 개구부는 벽 안 범위만 자른다(openingSpan이 잘라 준 범위)', () => {
    const cuts = openingsOnWall(room, [open({ wall: 'w1', offset: 1500, width: 900 })], 'w1');
    expect(cuts).toEqual([{ t0: 1500, t1: 2000, sill: 0, height: 2100 }]);
    const pieces = cutWallPieces(2000, 2400, cuts, { plan: true });
    expect(pieces).toEqual([{ t0: 0, t1: 1500, y0: 0, y1: 2400 }]);
  });

  it('조각의 합이 구멍을 빼고 빈틈·겹침 없이 벽을 덮는다', () => {
    const pieces = cutWallPieces(4000, 2400, [{ t0: 500, t1: 1400, sill: 0, height: 2100 }, { t0: 2000, t1: 3200, sill: 900, height: 1200 }]);
    const area = pieces.reduce((s, p) => s + (p.t1 - p.t0) * (p.y1 - p.y0), 0);
    expect(area).toBe(4000 * 2400 - 900 * 2100 - 1200 * 1200);
  });
});

describe('벽 기하: contracts/structure.ts 기준', () => {
  it('바깥 벽은 안목선에서 바깥으로 두께의 반만큼 나간 선에 그리고, 칸막이는 중심선 그대로다', () => {
    const top = drawnWall(room, 0)!;
    expect(top.start).toEqual({ x: 0, z: -50 });
    expect(top.thickness).toBe(100);
    const inner = drawnWall(room, 'w1')!;
    expect(inner.start).toEqual({ x: 3000, z: 0 });
    expect(inner.length).toBe(2000);
  });

  it('openingBox 중심은 구간 가운데에서 벽 몸통 쪽으로 옮겨진다', () => {
    const b = openingBox(room, open({ wall: 2, offset: 600 }))!;
    // 벽 2는 (5000,4000) → (0,4000), 구간은 x 4400 ~ 3500, 바깥(+z)으로 50
    expect(b.center).toEqual({ x: 3950, z: 4050 });
    expect(b.length).toBe(900);
  });

  it('문 호: 경첩에서 열림 방향으로 문 폭만큼의 문짝 선, 호는 닫힌 끝에서 열린 끝으로 간다 (doorHinge 기준)', () => {
    const o = open({ wall: 'w1', offset: 500, hinge: 'start', swing: 'normal' });
    const plan = doorPlan(room, o)!;
    const h = doorHinge(room, o)!;
    // 벽 방향 (0,1), normal (-1,0): 열림은 -x쪽. 칸막이는 벽 면(50)만큼 비켜서 시작
    expect(h.openDir).toEqual({ x: -1, z: 0 });
    expect(plan.leaf[0]).toEqual({ x: 2950, z: 500 });
    expect(plan.leaf[1]).toEqual({ x: 2050, z: 500 });
    expect(plan.arc[0].x).toBeCloseTo(2950, 6);
    expect(plan.arc[0].z).toBeCloseTo(1400, 6);
    const last = plan.arc[plan.arc.length - 1];
    expect(last.x).toBeCloseTo(2050, 6);
    expect(last.z).toBeCloseTo(500, 6);
    // 호의 모든 점은 경첩에서 문 폭만큼 떨어져 있다
    for (const p of plan.arc) expect(Math.hypot(p.x - 2950, p.z - 500)).toBeCloseTo(900, 4);
  });

  it('경첩 end·swing opposite이면 경첩과 열림 방향이 바뀐다', () => {
    const plan = doorPlan(room, open({ wall: 'w1', offset: 500, hinge: 'end', swing: 'opposite' }))!;
    expect(plan.leaf[0]).toEqual({ x: 3050, z: 1400 });
    expect(plan.leaf[1]).toEqual({ x: 3950, z: 1400 });
  });

  it('창문이면 doorPlan은 없고, 이중선은 두 선분이다', () => {
    const win = open({ type: 'window', wall: 'w1', offset: 500, width: 1200, sill: 900, height: 1200 });
    expect(doorPlan(room, win)).toBeNull();
    const lines = windowPlanLines(room, win)!;
    expect(lines).toHaveLength(2);
    expect(lines.map((l) => l[0].x).sort()).toEqual([2975, 3025]);
    expect(lines[0][0].z).toBe(500);
    expect(lines[0][1].z).toBe(1700);
  });
});

describe('straightenPreview', () => {
  it('긴 쪽 축에 맞춰 곧게 편다', () => {
    expect(straightenPreview({ x: 500, z: 3000 }, { x: 2500, z: 3100 })).toEqual({ a: { x: 500, z: 3000 }, b: { x: 2500, z: 3000 }, length: 2000 });
    expect(straightenPreview({ x: 500, z: 500 }, { x: 560, z: 2500 }).b).toEqual({ x: 500, z: 2500 });
  });
});
