// 가구 배치 규칙의 순수 계산. three.js와 React 없이 mm 숫자만 다룬다(docs/SPEC.md 2절).
import { roomBounds, roomNotches, type RoomBounds } from '../contracts/room';
import { doorSwingRect, interiorWallRect } from '../contracts/structure';
import type { DragPreview, FurnitureItem, ItemStatus, Mm, PointMm, Room } from '../contracts/types';

// SPEC 2절의 기준값(mm). 가구 크기 범위와 기본 이름은 src/contracts/limits.ts에 있다.
/** 끌어 놓을 때 바닥 사각형의 왼쪽·위쪽 변을 맞추는 격자 간격 */
export const GRID_MM = 10;
/** 겹침·이탈로 보는 최소 길이. 변이 정확히 맞닿은 것(0)은 겹침·이탈이 아니다. */
export const WARN_MIN_MM = 1;
/** 끄는 동안 변이 벽·다른 가구의 변에 이 거리 이내로 다가오면 딱 붙인다(맞닿음). SNAP_MM은 붙고 SNAP_MM + 1은 안 붙는다. */
export const SNAP_MM = 20;
/** 끄는 동안 자석이 붙는 화면 거리(px). 장면이 mmPerPx를 넘기면 SNAP_PX × mmPerPx(mm)가 자석 거리다. */
export const SNAP_PX = 12;

/** 끄는 동안의 자석 거리(mm). mmPerPx가 없거나 올바르지 않으면 SNAP_MM. */
export function snapDistanceMm(mmPerPx?: number): number {
  return mmPerPx !== undefined && Number.isFinite(mmPerPx) && mmPerPx > 0 ? SNAP_PX * mmPerPx : SNAP_MM;
}
/** 회전 버튼 한 번에 도는 각도(반시계) */
export const ROTATE_STEP_DEG = 90;

type Placed = Pick<FurnitureItem, 'x' | 'z' | 'w' | 'd' | 'rotationDeg'>;

/** 바닥 사각형(회전 반영)의 축 정렬 범위 */
export interface Footprint {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** 회전이 90도의 배수인가 */
export function isQuarterTurn(deg: number): boolean {
  return ((Math.round(deg) % 90) + 90) % 90 === 0;
}

/**
 * 회전을 반영한 바닥 사각형의 x방향·z방향 길이. 90·270도면 폭과 깊이가 바뀐다.
 * 90도 배수가 아닌 회전(2026-11-19 QA 5-6)은 기울어진 사각형을 감싸는 축 정렬 사각형의 길이다.
 * 자석·격자·벽까지 거리·방 이탈은 이 감싸는 사각형으로 따진다(방 이탈은 이것으로 정확하다).
 */
export function footprintSize(item: Pick<FurnitureItem, 'w' | 'd' | 'rotationDeg'>): { sx: Mm; sz: Mm } {
  if (isQuarterTurn(item.rotationDeg)) {
    const quarter = (((Math.round(item.rotationDeg / 90) % 4) + 4) % 4) % 2 === 1;
    return quarter ? { sx: item.d, sz: item.w } : { sx: item.w, sz: item.d };
  }
  const rad = (item.rotationDeg * Math.PI) / 180;
  const c = Math.abs(Math.cos(rad));
  const sn = Math.abs(Math.sin(rad));
  return { sx: item.w * c + item.d * sn, sz: item.w * sn + item.d * c };
}

/** 바닥 사각형의 네 모서리(회전 반영, 위에서 볼 때 반시계가 양수인 three.js rotation.y와 같은 부호) */
export function footprintPolygon(item: Placed, at: PointMm = { x: item.x, z: item.z }): PointMm[] {
  const rad = (item.rotationDeg * Math.PI) / 180;
  const c = Math.cos(rad);
  const sn = Math.sin(rad);
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([kx, kz]) => {
    const lx = (kx * item.w) / 2;
    const lz = (kz * item.d) / 2;
    return { x: at.x + lx * c + lz * sn, z: at.z - lx * sn + lz * c };
  });
}

const rectPolygon = (f: Footprint): PointMm[] => [
  { x: f.minX, z: f.minZ },
  { x: f.maxX, z: f.minZ },
  { x: f.maxX, z: f.maxZ },
  { x: f.minX, z: f.maxZ },
];

/** 볼록 다각형 둘이 겹치는지(분리축). 모든 축에서 겹친 길이가 1 mm 이상이어야 겹침이다(맞닿음은 겹침이 아니다). */
export function polygonsOverlap(a: readonly PointMm[], b: readonly PointMm[]): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i];
      const q = poly[(i + 1) % poly.length];
      const len = Math.hypot(q.x - p.x, q.z - p.z);
      if (len === 0) continue;
      const ax = -(q.z - p.z) / len;
      const az = (q.x - p.x) / len;
      const proj = (pts: readonly PointMm[]) => pts.map((v) => v.x * ax + v.z * az);
      const pa = proj(a);
      const pb = proj(b);
      const overlap = Math.min(Math.max(...pa), Math.max(...pb)) - Math.max(Math.min(...pa), Math.min(...pb));
      if (overlap < WARN_MIN_MM - 1e-6) return false;
    }
  }
  return true;
}

/** 가구(기울어질 수 있음)와 다른 사각형이 겹치는지. 둘 다 90도 배수면 감싸는 사각형 비교와 같다. */
function itemOverlaps(item: Placed, at: PointMm, fp: Footprint, other: { fp: Footprint; poly: PointMm[] | null }): boolean {
  if (!footprintsOverlap(fp, other.fp)) return false;
  if (isQuarterTurn(item.rotationDeg) && other.poly === null) return true;
  return polygonsOverlap(footprintPolygon(item, at), other.poly ?? rectPolygon(other.fp));
}

/** 바닥 사각형의 범위. at을 주면 중심을 그 점에 둔 것으로 계산한다(끄는 동안의 임시 위치). */
export function footprint(item: Placed, at: PointMm = { x: item.x, z: item.z }): Footprint {
  const { sx, sz } = footprintSize(item);
  return { minX: at.x - sx / 2, maxX: at.x + sx / 2, minZ: at.z - sz / 2, maxZ: at.z + sz / 2 };
}

/** 두 바닥 사각형이 x·z 두 방향 모두 1 mm 이상 겹치는지. 변이 맞닿기만 하면 겹침이 아니다. */
export function footprintsOverlap(a: Footprint, b: Footprint): boolean {
  const ox = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
  const oz = Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ);
  return ox >= WARN_MIN_MM && oz >= WARN_MIN_MM;
}

/**
 * 바닥 사각형의 일부가 방 경계 밖으로 1 mm 이상 나갔는지. 벽에 정확히 붙은 것은 이탈이 아니다.
 * shape(방 꼭짓점)를 주면 직사각형이 아닌 방(ㄱ자, 2026-11-19 QA 5-4)에서 둘러싼 사각형 안의 빈 곳(roomNotches)과 겹친 것도 이탈이다.
 */
export function isOutsideRoom(f: Footprint, room: RoomBounds, shape?: Pick<Room, 'corners'>): boolean {
  return (
    room.minX - f.minX >= WARN_MIN_MM ||
    f.maxX - room.maxX >= WARN_MIN_MM ||
    room.minZ - f.minZ >= WARN_MIN_MM ||
    f.maxZ - room.maxZ >= WARN_MIN_MM ||
    (shape !== undefined && roomNotches(shape.corners).some((n) => footprintsOverlap(f, n)))
  );
}

/** 상태 계산에 필요한 방 데이터: 바깥 테두리, 칸막이 벽, 문·창문. 천장 높이가 있으면 천장보다 높은 가구도 알린다. */
export type PlacementRoom = Pick<Room, 'corners' | 'walls' | 'openings'> & Partial<Pick<Room, 'ceilingHeight'>>;

/** 칸막이 벽이 바닥에서 차지하는 사각형들(두께 포함) */
export function wallRects(room: Pick<PlacementRoom, 'walls'>): Footprint[] {
  return room.walls.map(interiorWallRect);
}

/**
 * 가구가 붙거나 거리를 잴 벽 면들: 칸막이 벽과, ㄱ자 방에서 둘러싼 사각형 안의 방이 아닌 칸(2026-11-19 QA 5-4).
 * 자석 맞춤·벽까지 거리·통로 폭·빈 자리 찾기에 쓴다. 겹침 경고(wall)는 칸막이만이다(빠진 칸은 방 밖으로 센다).
 */
export function obstacleRects(room: Pick<PlacementRoom, 'walls' | 'corners'>): Footprint[] {
  return [...wallRects(room), ...roomNotches(room.corners)];
}

/** 문이 열리는 자리의 사각형들. 창문·문틈은 없다. */
export function doorRects(room: Pick<PlacementRoom, 'corners' | 'walls' | 'openings'>): Footprint[] {
  return room.openings.flatMap((o) => doorSwingRect(room, o) ?? []);
}

/** 지금 그려지는 위치(끄는 중이면 임시 위치)의 바닥 사각형 */
export function currentFootprint(item: Placed & Pick<FurnitureItem, 'id'>, preview: DragPreview | null): Footprint {
  return preview && preview.itemId === item.id ? footprint(item, preview) : footprint(item);
}

/** 천장 높이보다 높은 가구(바닥에서 띄운 높이 포함, 2026-11-19 QA 4-8)면 { ceiling: true }, 아니면 빈 객체 */
function ceilingFlag(item: Pick<FurnitureItem, 'h' | 'elevation'>, room: Partial<Pick<Room, 'ceilingHeight'>>): { ceiling?: true } {
  return room.ceilingHeight !== undefined && item.h + item.elevation > room.ceilingHeight ? { ceiling: true } : {};
}

/** 가구마다 겹침·이탈 상태. 겹침은 높이를 따지지 않는다. 천장보다 높으면 ceiling. */
export function computeItemStatuses(
  items: FurnitureItem[],
  room: PlacementRoom,
  preview: DragPreview | null,
): Record<string, ItemStatus> {
  const bounds = roomBounds(room);
  const walls = wallRects(room).map((fp) => ({ fp, poly: null }));
  const doors = doorRects(room).map((fp) => ({ fp, poly: null }));
  const ats = items.map((it) => (preview && preview.itemId === it.id ? { x: preview.x, z: preview.z } : { x: it.x, z: it.z }));
  const fps = items.map((it, i) => footprint(it, ats[i]));
  const shapes = items.map((it, i) => ({ fp: fps[i], poly: isQuarterTurn(it.rotationDeg) ? null : footprintPolygon(it, ats[i]) }));
  const result: Record<string, ItemStatus> = {};
  items.forEach((it, i) => {
    const overlap = shapes.some((other, j) => j !== i && itemOverlaps(it, ats[i], fps[i], other));
    result[it.id] = {
      overlap,
      outside: isOutsideRoom(fps[i], bounds, room),
      wall: walls.some((w) => itemOverlaps(it, ats[i], fps[i], w)),
      door: doors.some((d) => itemOverlaps(it, ats[i], fps[i], d)),
      ...ceilingFlag(it, room),
    };
  });
  return result;
}

/** 미리보기 가구 하나의 상태. 확정된 가구·칸막이 벽·문 열림 자리와 겹쳤는지, 방 밖인지(끄는 중이면 임시 위치). 확정 가구의 상태에는 영향을 주지 않는다. */
export function computeDraftStatus(
  draft: FurnitureItem,
  items: FurnitureItem[],
  room: PlacementRoom,
  preview: DragPreview | null,
): ItemStatus {
  const at = preview && preview.itemId === draft.id ? { x: preview.x, z: preview.z } : { x: draft.x, z: draft.z };
  const fp = footprint(draft, at);
  const shape = (it: FurnitureItem) => ({ fp: footprint(it), poly: isQuarterTurn(it.rotationDeg) ? null : footprintPolygon(it) });
  return {
    overlap: items.some((it) => itemOverlaps(draft, at, fp, shape(it))),
    outside: isOutsideRoom(fp, roomBounds(room), room),
    wall: wallRects(room).some((w) => itemOverlaps(draft, at, fp, { fp: w, poly: null })),
    door: doorRects(room).some((d) => itemOverlaps(draft, at, fp, { fp: d, poly: null })),
    ...ceilingFlag(draft, room),
  };
}

/**
 * 손을 뗄 때 확정할 중심. 바닥 사각형의 왼쪽 변(x가 작은 쪽)과 위쪽 변(z가 작은 쪽)을 가장 가까운 10 mm 배수에 맞추고,
 * 중심을 정수 mm로 반올림한다. 절반이 정수가 아닌 치수(홀수 mm)는 변이 0.5 mm 어긋난다(docs/DECISIONS.md 알려진 한계).
 */
export function snapCenter(item: Pick<FurnitureItem, 'w' | 'd' | 'rotationDeg'>, at: PointMm): PointMm {
  const { sx, sz } = footprintSize(item);
  const left = Math.round((at.x - sx / 2) / GRID_MM) * GRID_MM;
  const top = Math.round((at.z - sz / 2) / GRID_MM) * GRID_MM;
  return { x: Math.round(left + sx / 2) + 0, z: Math.round(top + sz / 2) + 0 };
}

/** 한 축의 자석 후보 하나를 고른다. 가장 가까운 것, 같은 거리면 먼저 넣은 것(벽). 없으면 null(이동량이 아니라 붙은 위치 차이). */
function nearestShift(
  lo: number,
  hi: number,
  targets: { lo: number | null; hi: number | null }[],
  snapMm: number,
): number | null {
  let best: number | null = null;
  const consider = (delta: number) => {
    if (Math.abs(delta) <= snapMm && (best === null || Math.abs(delta) < Math.abs(best))) best = delta;
  };
  for (const t of targets) {
    if (t.lo !== null) consider(t.lo - lo);
    if (t.hi !== null) consider(t.hi - hi);
  }
  return best;
}

/** 두 구간의 간격. 겹치면 0 이하. */
const gap = (aMin: number, aMax: number, bMin: number, bMax: number) => Math.max(aMin, bMin) - Math.min(aMax, bMax);

export interface EdgeSnap {
  /** 자석 맞춤을 반영한 중심(정수 아닐 수 있다) */
  x: number;
  z: number;
  /** 그 축이 벽·가구에 붙었는지. 붙은 축은 격자를 적용하지 않는다. */
  snappedX: boolean;
  snappedZ: boolean;
}

/**
 * 자석 맞춤. at에 중심을 둔 발자국의 변이 벽 또는 다른 가구의 반대쪽 변과 snapMm(기본 SNAP_MM) 이내면 그 값에 붙인다.
 * 왼쪽 변은 왼쪽 벽·다른 가구의 오른쪽 변에, 오른쪽 변은 오른쪽 벽·다른 가구의 왼쪽 변에(z도 같다).
 * 칸막이 벽(walls, 사각형의 네 면)과 다른 가구는 다른 축에서 겹치거나 snapMm 이내일 때만 후보다.
 * 같은 거리면 바깥 벽, 칸막이 벽, 가구 순으로 이긴다.
 * 방 밖에 있어도 벽 가까이면 안쪽 변이 벽에 붙는다. others에 끄는 가구 자신을 넣지 않는다.
 */
export function snapToEdges(
  item: Pick<FurnitureItem, 'w' | 'd' | 'rotationDeg'>,
  at: PointMm,
  room: RoomBounds,
  others: Footprint[],
  snapMm: number = SNAP_MM,
  walls: Footprint[] = [],
): EdgeSnap {
  const f = footprint({ ...item, x: at.x, z: at.z });
  const nearZ = [...walls, ...others].filter((o) => gap(f.minZ, f.maxZ, o.minZ, o.maxZ) <= snapMm);
  const nearX = [...walls, ...others].filter((o) => gap(f.minX, f.maxX, o.minX, o.maxX) <= snapMm);
  const dx = nearestShift(f.minX, f.maxX, [
    { lo: room.minX, hi: room.maxX },
    ...nearZ.map((o) => ({ lo: o.maxX, hi: o.minX })),
  ], snapMm);
  const dz = nearestShift(f.minZ, f.maxZ, [
    { lo: room.minZ, hi: room.maxZ },
    ...nearX.map((o) => ({ lo: o.maxZ, hi: o.minZ })),
  ], snapMm);
  return { x: at.x + (dx ?? 0), z: at.z + (dz ?? 0), snappedX: dx !== null, snappedZ: dz !== null };
}

/**
 * 손을 뗄 때 확정할 중심: 자석 맞춤을 먼저 하고, 붙지 않은 축만 10 mm 격자에 맞춘다. 붙은 축은 정수 mm로만 반올림한다.
 */
export function settleCenter(
  item: Pick<FurnitureItem, 'w' | 'd' | 'rotationDeg'>,
  at: PointMm,
  room: RoomBounds,
  others: Footprint[],
  snapMm: number = SNAP_MM,
  walls: Footprint[] = [],
): PointMm {
  const s = snapToEdges(item, at, room, others, snapMm, walls);
  const grid = snapCenter(item, at);
  return { x: Math.round(s.snappedX ? s.x : grid.x) + 0, z: Math.round(s.snappedZ ? s.z : grid.z) + 0 };
}

/** 누른 지점과 가구 중심의 차이. 끄는 동안 이 차이를 유지해 가구가 포인터 밑으로 튀지 않게 한다. */
export function grabOffset(center: PointMm, pressed: PointMm): PointMm {
  return { x: center.x - pressed.x, z: center.z - pressed.z };
}

/** 포인터가 floor에 있을 때 가구 중심의 임시 위치 */
export function dragCenter(floor: PointMm, offset: PointMm): PointMm {
  return { x: floor.x + offset.x, z: floor.z + offset.z };
}

/** 회전 버튼: 반시계 90도. 0 → 90 → 180 → 270 → 0 */
export function nextRotation(deg: number): number {
  return (((deg + ROTATE_STEP_DEG) % 360) + 360) % 360;
}

/**
 * 위·오른쪽·아래·왼쪽(벽 0 ~ 3 순서, 평면 뷰 기준) 방향으로 가장 가까운 벽 면까지의 거리.
 * 바깥 벽(z=minZ, x=maxX, z=maxZ, x=minX)과, 그 방향에 있으면서 다른 축에서 1 mm 이상 겹치는 칸막이 벽(walls)의 가까운 면 중 작은 값이다.
 * 바깥 벽 밖으로 나간 쪽은 음수다. 칸막이와 겹친 가구는 그 칸막이를 그 방향의 벽으로 세지 않는다.
 */
export function wallDistances(f: Footprint, room: RoomBounds, walls: Footprint[] = []): [number, number, number, number] {
  const d: [number, number, number, number] = [f.minZ - room.minZ, room.maxX - f.maxX, room.maxZ - f.maxZ, f.minX - room.minX];
  for (const w of walls) {
    const overX = gap(f.minX, f.maxX, w.minX, w.maxX) <= -WARN_MIN_MM;
    const overZ = gap(f.minZ, f.maxZ, w.minZ, w.maxZ) <= -WARN_MIN_MM;
    if (overX) {
      if (w.maxZ <= f.minZ) d[0] = Math.min(d[0], f.minZ - w.maxZ);
      if (w.minZ >= f.maxZ) d[2] = Math.min(d[2], w.minZ - f.maxZ);
    }
    if (overZ) {
      if (w.minX >= f.maxX) d[1] = Math.min(d[1], w.minX - f.maxX);
      if (w.maxX <= f.minX) d[3] = Math.min(d[3], f.minX - w.maxX);
    }
  }
  return d;
}

/** 방 밖에 있는 가구를 방 안으로 들이는 가장 가까운 중심(정수 mm, 2026-11-19 QA 4-4). 방보다 큰 쪽은 방 가운데에 맞춘다. */
export function bringInsideCenter(item: Placed, room: RoomBounds): PointMm {
  const { sx, sz } = footprintSize(item);
  const axis = (c: number, size: number, min: number, max: number) => {
    if (size >= max - min) return (min + max) / 2;
    return Math.min(Math.max(c, min + size / 2), max - size / 2);
  };
  return { x: Math.round(axis(item.x, sx, room.minX, room.maxX)) + 0, z: Math.round(axis(item.z, sz, room.minZ, room.maxZ)) + 0 };
}

/** 통로로 보는 최소 폭(mm, 2026-11-19 QA 5-5). 이보다 좁은 틈은 사람이 지나가기 어렵다. */
export const WALKWAY_MIN_MM = 600;

/**
 * 가구 둘레(위·오른쪽·아래·왼쪽, 벽 0 ~ 3 순서)의 빈 틈. 그 방향의 가장 가까운 벽 면이나 다른 가구까지의 거리다.
 * 다른 가구는 다른 축에서 1 mm 이상 겹칠 때만 그 방향의 이웃이다. 맞닿은(0) 쪽과 방 밖으로 나간 쪽(음수)은 그대로 돌려준다.
 */
export function clearances(f: Footprint, room: RoomBounds, walls: Footprint[], others: Footprint[]): [number, number, number, number] {
  return wallDistances(f, room, [...walls, ...others]);
}

/** 통로가 좁은 방향: 틈이 0보다 크고 WALKWAY_MIN_MM보다 작은 방향의 번호와 틈 */
export function narrowSides(gaps: readonly number[]): { side: number; gap: number }[] {
  return gaps.flatMap((gap, side) => (gap > 0 && gap < WALKWAY_MIN_MM ? [{ side, gap: Math.round(gap) }] : []));
}

/** 새 가구를 찾을 때 방 가운데에서 바깥으로 훑는 간격 */
const FREE_SPOT_STEP_MM = 100;

/**
 * 새 가구(회전 0)를 놓을 빈 자리의 중심. 방 가운데에서 100 mm 격자로 바깥으로 훑어,
 * 다른 가구와 겹치지 않고 방 안에 들어가는 가장 가까운 자리를 고른다. 왼쪽·위쪽 변은 10 mm 격자에 맞춘다.
 * 같은 거리면 위쪽, 그다음 왼쪽을 먼저 고른다. 빈 자리가 없으면 시작점(겹침·이탈은 경고로 보인다).
 * avoid(칸막이 벽, 문 열림 자리)와도 겹치지 않는 자리를 고른다.
 * from을 주면 방 가운데 대신 그 점에서 훑는다(복제본을 원본 옆에 놓을 때). 기본값은 방 가운데.
 */
export function findFreeSpot(
  size: Pick<FurnitureItem, 'w' | 'd'>,
  room: RoomBounds,
  others: Footprint[],
  from?: PointMm,
  avoid: Footprint[] = [],
): PointMm {
  const cx = Math.round(from?.x ?? (room.minX + room.maxX) / 2);
  const cz = Math.round(from?.z ?? (room.minZ + room.maxZ) / 2);
  const shape = { w: size.w, d: size.d, rotationDeg: 0, x: 0, z: 0 };
  if (size.w > room.width || size.d > room.depth) return { x: cx, z: cz };
  // 가운데 자리가 가능하려면 가구 절반이 방 안이므로, 더 멀리 가야 할 일은 방 크기의 절반을 넘지 않는다.
  // 시작점이 가운데가 아니면 방 끝까지 가야 할 수 있으므로 방 크기 전체를 훑는다.
  const span = from ? 1 : 2;
  const stepsX = Math.ceil(room.width / span / FREE_SPOT_STEP_MM);
  const stepsZ = Math.ceil(room.depth / span / FREE_SPOT_STEP_MM);
  const offsets: { i: number; j: number }[] = [];
  for (let j = -stepsZ; j <= stepsZ; j++) for (let i = -stepsX; i <= stepsX; i++) offsets.push({ i, j });
  const dist = (o: { i: number; j: number }) => o.i * o.i + o.j * o.j;
  offsets.sort((a, b) => dist(a) - dist(b) || a.j - b.j || a.i - b.i);
  for (const o of offsets) {
    const at = snapCenter(shape, { x: cx + o.i * FREE_SPOT_STEP_MM, z: cz + o.j * FREE_SPOT_STEP_MM });
    const f = footprint(shape, at);
    if (isOutsideRoom(f, room)) continue;
    if (others.some((other) => footprintsOverlap(f, other))) continue;
    if (avoid.some((a) => footprintsOverlap(f, a))) continue;
    return at;
  }
  return { x: cx, z: cz };
}
