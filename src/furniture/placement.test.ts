// 배치 규칙 순수 함수. SPEC 4절의 수치 예(P-2, P-3, W-1 ~ W-6, D-1, D-3)를 숫자로 옮겼다.
import { describe, expect, it } from 'vitest';
import { rectCorners, roomBounds, type RoomBounds } from '../contracts/room';
import type { FurnitureItem } from '../contracts/types';
import {
  computeItemStatuses,
  dragCenter,
  footprint,
  footprintSize,
  findFreeSpot,
  footprintsOverlap,
  grabOffset,
  isOutsideRoom,
  nextRotation,
  settleCenter,
  snapCenter,
  snapToEdges,
  SNAP_MM,
  wallDistances,
} from './placement';

const room = (width: number, depth: number): RoomBounds => roomBounds({ corners: rectCorners(width, depth) });
const ROOM = room(3600, 3000);

function item(id: string, w: number, d: number, x: number, z: number, rotationDeg = 0): FurnitureItem {
  return { id, name: id, w, d, h: 500, x, z, rotationDeg, elevation: 0, color: '#000000' };
}

/** A = 1000·600·700, B = 1000·1000·500, 방 가운데 (1800, 1500) */
const A = (x = 1800, z = 1500, r = 0) => item('A', 1000, 600, x, z, r);
const B = (id = 'B', x = 1800, z = 1500) => item(id, 1000, 1000, x, z);

describe('footprintSize / footprint (회전 후 발자국)', () => {
  it('0·180도는 폭이 x, 깊이가 z', () => {
    expect(footprintSize(A())).toEqual({ sx: 1000, sz: 600 });
    expect(footprintSize(A(1800, 1500, 180))).toEqual({ sx: 1000, sz: 600 });
  });

  it('90·270도는 폭과 깊이가 바뀐다', () => {
    expect(footprintSize(A(1800, 1500, 90))).toEqual({ sx: 600, sz: 1000 });
    expect(footprintSize(A(1800, 1500, 270))).toEqual({ sx: 600, sz: 1000 });
  });

  it('중심 기준 범위, at을 주면 그 위치', () => {
    expect(footprint(A())).toEqual({ minX: 1300, maxX: 2300, minZ: 1200, maxZ: 1800 });
    expect(footprint(A(1800, 1500, 90))).toEqual({ minX: 1500, maxX: 2100, minZ: 1000, maxZ: 2000 });
    expect(footprint(A(), { x: 600, z: 400 })).toEqual({ minX: 100, maxX: 1100, minZ: 100, maxZ: 700 });
  });
});

describe('footprintsOverlap (겹침)', () => {
  it('변이 정확히 맞닿으면 겹침이 아니다 (W-3)', () => {
    // 방 5600에서 B 두 개: x 1300 ~ 2300 과 2300 ~ 3300
    expect(footprintsOverlap(footprint(B('B1', 1800)), footprint(B('B2', 2800)))).toBe(false);
  });

  it('1 mm 겹치면 겹침 (W-3: 둘째 폭 1002 → 1 mm 겹침)', () => {
    const second = { ...B('B2', 2800), w: 1002 };
    expect(footprintsOverlap(footprint(B('B1', 1800)), footprint(second))).toBe(true);
  });

  it('0.5 mm 겹침은 겹침이 아니다(1 mm 미만)', () => {
    const second = { ...B('B2', 2800), w: 1001 };
    expect(footprintsOverlap(footprint(B('B1', 1800)), footprint(second))).toBe(false);
  });

  it('x만 겹치고 z는 떨어져 있으면 겹침이 아니다', () => {
    expect(footprintsOverlap(footprint(B('B1', 1800, 500)), footprint(B('B2', 1800, 1500)))).toBe(false);
    expect(footprintsOverlap(footprint(B('B1', 1800, 500)), footprint(B('B2', 1800, 1499)))).toBe(true);
  });

  it('같은 자리의 두 가구는 겹침 (W-1)', () => {
    expect(footprintsOverlap(footprint(B('B1')), footprint(B('B2')))).toBe(true);
  });
});

describe('isOutsideRoom (방 이탈)', () => {
  it('방과 같은 크기로 벽에 딱 붙은 가구는 이탈이 아니다 (W-4)', () => {
    expect(isOutsideRoom(footprint(item('X', 3600, 3000, 1800, 1500)), ROOM)).toBe(false);
  });

  it('방보다 큰 가구는 이탈 (W-4: 폭 3602, 4000)', () => {
    expect(isOutsideRoom(footprint(item('X', 3602, 3000, 1800, 1500)), ROOM)).toBe(true);
    expect(isOutsideRoom(footprint(item('X', 4000, 600, 1800, 1500)), ROOM)).toBe(true);
  });

  it('방을 줄이면 이탈 (W-5: 2300 → 아님, 2299 → 이탈)', () => {
    const b = footprint(B('B', 1800, 1500));
    expect(isOutsideRoom(b, room(2300, 3000))).toBe(false);
    expect(isOutsideRoom(b, room(2299, 3000))).toBe(true);
    expect(isOutsideRoom(b, room(3600, 3000))).toBe(false);
  });

  it('왼쪽·위쪽으로 나가도 이탈 (W-6: A를 (100, 1500)에)', () => {
    expect(isOutsideRoom(footprint(A(100, 1500)), ROOM)).toBe(true);
    expect(isOutsideRoom(footprint(A(500, 300)), ROOM)).toBe(false);
    expect(isOutsideRoom(footprint(A(500, 299)), ROOM)).toBe(true);
  });

  it('회전하면 바뀐 발자국으로 판정한다', () => {
    // 폭 3000·깊이 600을 90도 돌리면 z방향 3000 → 깊이 3000 방에 딱 맞다
    const long = item('L', 3000, 600, 1800, 1500, 90);
    expect(isOutsideRoom(footprint(long), ROOM)).toBe(false);
    expect(isOutsideRoom(footprint({ ...long, w: 3001 }), ROOM)).toBe(false); // 0.5 mm씩
    expect(isOutsideRoom(footprint({ ...long, w: 3002 }), ROOM)).toBe(true);
  });
});

describe('computeItemStatuses', () => {
  it('W-1: 같은 자리의 B 두 개는 둘 다 overlap', () => {
    const s = computeItemStatuses([B('B1'), B('B2')], ROOM, null);
    expect(s).toEqual({ B1: { overlap: true, outside: false }, B2: { overlap: true, outside: false } });
  });

  it('W-2: 하나를 (600, 600)으로 옮기면 둘 다 경고 없음', () => {
    const s = computeItemStatuses([B('B1'), B('B2', 600, 600)], ROOM, null);
    expect(s.B1).toEqual({ overlap: false, outside: false });
    expect(s.B2).toEqual({ overlap: false, outside: false });
  });

  it('W-7: 겹침과 방 밖이 함께', () => {
    const s = computeItemStatuses([B('B1'), B('B2')], room(2000, 3000), null);
    expect(s.B2).toEqual({ overlap: true, outside: true });
  });

  it('끄는 중이면 dragPreview 위치로 판정한다', () => {
    const items = [B('B1'), B('B2')];
    const s = computeItemStatuses(items, ROOM, { itemId: 'B2', x: 600, z: 600 });
    expect(s.B1.overlap).toBe(false);
    expect(s.B2.overlap).toBe(false);
    const out = computeItemStatuses(items, ROOM, { itemId: 'B2', x: 100, z: 600 });
    expect(out.B2).toEqual({ overlap: false, outside: true });
    expect(out.B1).toEqual({ overlap: false, outside: false });
  });

  it('가구가 하나면 overlap은 false', () => {
    expect(computeItemStatuses([A()], ROOM, null)).toEqual({ A: { overlap: false, outside: false } });
  });
});

describe('snapCenter (왼쪽·위쪽 변을 10 mm 격자에)', () => {
  it('P-2: A를 (2456, 1994), (707, 2213)에 놓으면 중심이 10의 배수', () => {
    // 왼쪽 변 1956 → 1960, 위쪽 변 1694 → 1690
    expect(snapCenter(A(), { x: 2456, z: 1994 })).toEqual({ x: 2460, z: 1990 });
    // 왼쪽 변 207 → 210, 위쪽 변 1913 → 1910
    expect(snapCenter(A(), { x: 707, z: 2213 })).toEqual({ x: 710, z: 2210 });
  });

  it('P-2: 450·450 가구를 (500, 500) 근처에 놓으면 center - 225가 10의 배수', () => {
    const small = item('S', 450, 450, 1800, 1500);
    for (const at of [
      { x: 500, z: 500 },
      { x: 503, z: 497 },
      { x: 494, z: 508 },
    ]) {
      const c = snapCenter(small, at);
      expect((c.x - 225) % 10).toBe(0);
      expect((c.z - 225) % 10).toBe(0);
    }
    expect(snapCenter(small, { x: 500, z: 500 })).toEqual({ x: 505, z: 505 });
  });

  it('450 가구를 벽에 붙일 수 있다(왼쪽 변 0)', () => {
    expect(snapCenter(item('S', 450, 450, 0, 0), { x: 227, z: 222 })).toEqual({ x: 225, z: 225 });
  });

  it('회전 90도면 바뀐 발자국의 변을 맞춘다', () => {
    // 90도: x방향 600, z방향 1000. 왼쪽 변 1003-300=703 → 700, 위쪽 변 1003-500=503 → 500
    expect(snapCenter(A(1800, 1500, 90), { x: 1003, z: 1003 })).toEqual({ x: 1000, z: 1000 });
  });

  it('홀수 치수는 중심을 정수 mm로 반올림한다(변이 0.5 mm 어긋나는 알려진 한계)', () => {
    const odd = item('O', 455, 455, 0, 0);
    const c = snapCenter(odd, { x: 500, z: 500 });
    expect(Number.isInteger(c.x) && Number.isInteger(c.z)).toBe(true);
    // 왼쪽 변 272.5 → 270, 중심 497.5 → 498
    expect(c).toEqual({ x: 498, z: 498 });
  });

  it('방 밖(음수 좌표)에서도 격자에 맞고 -0을 만들지 않는다', () => {
    const c = snapCenter(item('S', 100, 100, 0, 0), { x: 52, z: 48 });
    expect(c).toEqual({ x: 50, z: 50 });
    const neg = snapCenter(item('S', 100, 100, 0, 0), { x: -73, z: 47 });
    expect(neg).toEqual({ x: -70, z: 50 });
    // 폭 19: 왼쪽 변 -10.5 → -10, 중심 -0.5 → Math.round는 -0을 만든다
    const zero = snapCenter(item('S', 19, 19, 0, 0), { x: -1, z: -1 });
    expect(Object.is(zero.x, -0)).toBe(false);
    expect(zero).toEqual({ x: 0, z: 0 });
  });
});

describe('grabOffset / dragCenter (잡은 지점 유지)', () => {
  it('P-3: 중심에서 (+300, +200) 떨어진 점을 잡아 (+500, +300) 끌면 중심이 (2300, 1800)', () => {
    const offset = grabOffset({ x: 1800, z: 1500 }, { x: 2100, z: 1700 });
    expect(offset).toEqual({ x: -300, z: -200 });
    // 누른 자리 그대로면 가구도 그대로(점프 없음)
    expect(dragCenter({ x: 2100, z: 1700 }, offset)).toEqual({ x: 1800, z: 1500 });
    const at = dragCenter({ x: 2600, z: 2000 }, offset);
    expect(at).toEqual({ x: 2300, z: 1800 });
    expect(snapCenter(A(), at)).toEqual({ x: 2300, z: 1800 });
  });
});

describe('nextRotation', () => {
  it('P-4: 0 → 90 → 180 → 270 → 0', () => {
    expect([0, 90, 180, 270].map(nextRotation)).toEqual([90, 180, 270, 0]);
  });
});

describe('wallDistances (벽 0 ~ 3)', () => {
  it('D-1: A를 방 가운데에 → 1200, 1300, 1200, 1300', () => {
    expect(wallDistances(footprint(A()), ROOM)).toEqual([1200, 1300, 1200, 1300]);
  });

  it('D-1: 한 번 돌리면 → 1000, 1500, 1000, 1500', () => {
    expect(wallDistances(footprint(A(1800, 1500, 90)), ROOM)).toEqual([1000, 1500, 1000, 1500]);
  });

  it('D-2: (1000, 800)에 놓은 A', () => {
    // 범위 x 500 ~ 1500, z 500 ~ 1100
    expect(wallDistances(footprint(A(1000, 800)), ROOM)).toEqual([500, 2100, 1900, 500]);
  });

  it('D-3: 방과 같은 크기 → 0, 폭 3700 → 벽 1·3이 -50', () => {
    expect(wallDistances(footprint(item('X', 3600, 3000, 1800, 1500)), ROOM)).toEqual([0, 0, 0, 0]);
    expect(wallDistances(footprint(item('X', 3700, 3000, 1800, 1500)), ROOM)).toEqual([0, -50, 0, -50]);
  });
});

// ---------- 자석 맞춤(T-008) ----------
describe('snapToEdges', () => {
  const box = { w: 1000, d: 600, rotationDeg: 0 }; // 반폭 500, 반깊이 300
  const snap = (at: { x: number; z: number }, others: ReturnType<typeof footprint>[] = [], r = ROOM, it = box) =>
    snapToEdges(it, at, r, others);

  const near = SNAP_MM - 5; // 자석 범위 안쪽

  it('SNAP_MM은 20', () => {
    expect(SNAP_MM).toBe(20);
  });

  it('벽 4개 각각에 붙는다', () => {
    expect(snap({ x: 500 + near, z: 1500 })).toMatchObject({ x: 500, snappedX: true, snappedZ: false }); // 왼쪽 벽, 변 near
    expect(snap({ x: 3100 - near, z: 1500 })).toMatchObject({ x: 3100, snappedX: true }); // 오른쪽 벽
    expect(snap({ x: 1800, z: 300 + near })).toMatchObject({ z: 300, snappedZ: true, snappedX: false }); // 위쪽 벽
    expect(snap({ x: 1800, z: 2700 - near })).toMatchObject({ z: 2700, snappedZ: true }); // 아래쪽 벽
  });

  it('SNAP_MM은 붙고 SNAP_MM + 1은 붙지 않는다', () => {
    expect(snap({ x: 500 + SNAP_MM, z: 1500 })).toMatchObject({ x: 500, snappedX: true });
    expect(snap({ x: 500 + SNAP_MM + 1, z: 1500 })).toMatchObject({ x: 500 + SNAP_MM + 1, snappedX: false });
    expect(snap({ x: 3100 - SNAP_MM, z: 1500 })).toMatchObject({ x: 3100, snappedX: true });
    expect(snap({ x: 3100 - SNAP_MM - 1, z: 1500 })).toMatchObject({ x: 3100 - SNAP_MM - 1, snappedX: false });
  });

  it('방 밖에 나간 가구도 벽 가까이면 안쪽으로 붙는다', () => {
    expect(snap({ x: 500 - near, z: 1500 })).toMatchObject({ x: 500, snappedX: true }); // 변 -near
    expect(snap({ x: 3100 + near, z: 1500 })).toMatchObject({ x: 3100, snappedX: true });
    expect(snap({ x: 100, z: 1500 }).snappedX).toBe(false); // 변 -400은 너무 멀다
  });

  it('다른 가구의 반대쪽 변에 좌우로 붙는다', () => {
    const o = footprint(item('o', 1000, 600, 1800, 1500)); // x 1300 ~ 2300
    expect(snap({ x: 2800 + near, z: 1500 }, [o])).toMatchObject({ x: 2800, snappedX: true }); // 내 왼쪽 2300 + near -> 그 가구 오른쪽 2300
    expect(snap({ x: 800 - near, z: 1500 }, [o])).toMatchObject({ x: 800, snappedX: true }); // 내 오른쪽 1300 - near -> 그 가구 왼쪽 1300
    // 같은 쪽 변끼리는 붙지 않는다(내 왼쪽 ↔ 그 가구 왼쪽)
    expect(snap({ x: 1850, z: 1500 }, [o]).snappedX).toBe(false);
  });

  it('다른 가구의 반대쪽 변에 위아래로 붙는다', () => {
    const o = footprint(item('o', 1000, 600, 1800, 1500)); // z 1200 ~ 1800
    expect(snap({ x: 1800, z: 2100 + near }, [o])).toMatchObject({ z: 2100, snappedZ: true });
    expect(snap({ x: 1800, z: 900 - near }, [o])).toMatchObject({ z: 900, snappedZ: true });
  });

  it('다른 축으로 먼 가구는 무시한다', () => {
    const o = footprint(item('o', 1000, 600, 1800, 1500)); // z 1200 ~ 1800
    // 내 z 범위 200 ~ 800 는 그 가구와 400 떨어져 있다. x가 가까워도 끌려가지 않는다
    expect(snap({ x: 2800 + near, z: 500 }, [o]).snappedX).toBe(false);
    // 간격이 정확히 SNAP_MM이면 후보, SNAP_MM + 1이면 아니다 (내 z 끝 = 1200 - 간격)
    expect(snap({ x: 2800 + near, z: 900 - SNAP_MM }, [o]).snappedX).toBe(true);
    expect(snap({ x: 2800 + near, z: 900 - SNAP_MM - 1 }, [o]).snappedX).toBe(false);
  });

  it('회전 90도 가구는 바뀐 발자국으로 붙는다', () => {
    const rot = { w: 1000, d: 600, rotationDeg: 90 }; // x방향 600, z방향 1000
    expect(snap({ x: 300 + near, z: 1500 }, [], ROOM, rot)).toMatchObject({ x: 300, snappedX: true });
    expect(snap({ x: 1800, z: 500 + near }, [], ROOM, rot)).toMatchObject({ z: 500, snappedZ: true });
  });

  it('후보가 여럿이면 가장 가까운 것, 같은 거리면 벽', () => {
    const o = footprint(item('o', 400, 600, 650, 1500)); // x 450 ~ 850
    // 내 왼쪽 변 -near 가 벽(0)에서 near, 가구 오른쪽 850에서는 멀다 -> 벽
    expect(snap({ x: 500 - near, z: 1500 }, [o]).x).toBe(500);
    // 가구 변이 더 가깝다: 내 왼쪽 850 + near -> 850, 오른쪽 벽과는 멀다
    expect(snap({ x: 1350 + near, z: 1500 }, [o]).x).toBe(1350);
    // 같은 거리: 내 왼쪽 SNAP_MM/2 에서 벽 0과 가구 오른쪽 변 SNAP_MM 이 SNAP_MM/2씩 -> 벽
    const o2 = footprint(item('o2', 100, 600, SNAP_MM - 50, 1500)); // x SNAP_MM-100 ~ SNAP_MM
    expect(snap({ x: 500 + SNAP_MM / 2, z: 1500 }, [o2]).x).toBe(500);
  });

  it('방보다 큰 가구도 오류 없이 처리한다', () => {
    expect(snap({ x: 1800, z: 1500 }, [], room(800, 800))).toMatchObject({ snappedX: false });
  });
});

describe('settleCenter', () => {
  const near = SNAP_MM - 5; // 자석 범위 안쪽
  const box = { w: 450, d: 450, rotationDeg: 0 };

  it('붙은 축은 격자를 적용하지 않고, 붙지 않은 축은 왼쪽·위쪽 변을 10 mm 격자에 맞춘다', () => {
    // 오른쪽 벽: 변이 벽 3605 에서 near 앞이면 붙어 center 3380(변 3155)은 격자에 안 맞아도 된다. z는 변 1003 -> 1000(중심 1225)
    const a = settleCenter(box, { x: 3380 - near, z: 1228 }, room(3605, 3000), []);
    expect(a).toEqual({ x: 3380, z: 1225 }); // 왼쪽 변 3155는 격자 밖이다
    expect((a.x - 225) % 10).not.toBe(0);
  });

  it('붙은 가구 옆에 놓아도 맞닿음이고 겹침·이탈 경고가 없다', () => {
    const o = item('o', 1000, 600, 800, 1500); // x 300 ~ 1300
    const mine = item('m', 1000, 600, 0, 0);
    const at = settleCenter(mine, { x: 1800 + near, z: 1500 }, ROOM, [footprint(o)]);
    expect(at).toEqual({ x: 1800, z: 1500 });
    const st = computeItemStatuses([o, { ...mine, ...at }], ROOM, null);
    expect(st.o).toEqual({ overlap: false, outside: false });
    expect(st.m).toEqual({ overlap: false, outside: false });
  });

  it('벽에 붙은 홀수 치수 가구는 반올림해도 이탈 경고가 없다', () => {
    const odd = item('odd', 451, 301, 0, 0);
    const at = settleCenter(odd, { x: 225 + near, z: 150 + near }, ROOM, []); // 변 14.5, 벽에 붙는다
    const st = computeItemStatuses([{ ...odd, ...at }], ROOM, null);
    expect(st.odd.outside).toBe(false);
  });

  it('붙지 않으면 기존 snapCenter와 같다', () => {
    expect(settleCenter(box, { x: 2456, z: 1994 }, ROOM, [])).toEqual(snapCenter(box, { x: 2456, z: 1994 }));
  });
});

describe('findFreeSpot (새 가구의 빈 자리)', () => {
  const bed = { w: 1100, d: 2000 };
  const fp = (s: { w: number; d: number }, x: number, z: number) => footprint({ ...s, x, z, rotationDeg: 0 });

  it('가구가 없으면 방 가운데(왼쪽·위쪽 변은 10 mm 격자)', () => {
    expect(findFreeSpot({ w: 1200, d: 600 }, ROOM, [])).toEqual({ x: 1800, z: 1500 });
    // 폭 450: 왼쪽 변 1575 -> 1580, 중심 1805
    expect(findFreeSpot({ w: 450, d: 500 }, ROOM, [])).toEqual({ x: 1805, z: 1500 });
  });

  it('가운데가 차 있으면 가장 가까운 빈 자리, 겹치지 않고 방 안', () => {
    const others = [fp(bed, 1800, 1500)];
    const at = findFreeSpot({ w: 600, d: 600 }, ROOM, others);
    const f = fp({ w: 600, d: 600 }, at.x, at.z);
    expect(footprintsOverlap(f, others[0])).toBe(false);
    expect(isOutsideRoom(f, ROOM)).toBe(false);
    expect(at).not.toEqual({ x: 1800, z: 1500 });
    // 위쪽 먼저, 같은 거리면 왼쪽 먼저: 침대 왼쪽 변(1250)에 붙는 가장 가까운 자리
    expect(at).toEqual({ x: 900, z: 1500 });
  });

  it('1 mm 겹치는 자리는 고르지 않고 정확히 맞닿는 자리는 고른다', () => {
    const wall = fp({ w: 1000, d: 3000 }, 1800, 1500); // x 1300 ~ 2300, 방 전체 깊이
    const at = findFreeSpot({ w: 1000, d: 1000 }, ROOM, [wall]);
    const f = fp({ w: 1000, d: 1000 }, at.x, at.z);
    expect(footprintsOverlap(f, wall)).toBe(false);
    expect(f.maxX <= 1300 || f.minX >= 2300).toBe(true);
  });

  it('빈 자리가 없으면 방 가운데', () => {
    const full = [fp({ w: 3600, d: 3000 }, 1800, 1500)];
    expect(findFreeSpot({ w: 600, d: 600 }, ROOM, full)).toEqual({ x: 1800, z: 1500 });
  });

  it('방보다 큰 가구는 방 가운데', () => {
    expect(findFreeSpot({ w: 4000, d: 500 }, ROOM, [])).toEqual({ x: 1800, z: 1500 });
    expect(findFreeSpot({ w: 500, d: 3100 }, ROOM, [])).toEqual({ x: 1800, z: 1500 });
  });

  it('방과 같은 크기면 가운데에 딱 맞는다', () => {
    expect(findFreeSpot({ w: 3600, d: 3000 }, ROOM, [])).toEqual({ x: 1800, z: 1500 });
  });

  it('원점이 아닌 방(경계가 0에서 시작하지 않음)도 따른다', () => {
    const r = roomBounds({
      corners: [
        { x: 1000, z: 1000 },
        { x: 3000, z: 1000 },
        { x: 3000, z: 2000 },
        { x: 1000, z: 2000 },
      ],
    });
    expect(findFreeSpot({ w: 500, d: 500 }, r, [])).toEqual({ x: 2000, z: 1500 });
  });
});
