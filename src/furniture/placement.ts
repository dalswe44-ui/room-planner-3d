// 가구 배치 규칙의 순수 계산. three.js와 React 없이 mm 숫자만 다룬다(docs/SPEC.md 2절).
import type { RoomBounds } from '../contracts/room';
import type { DragPreview, FurnitureItem, ItemStatus, Mm, PointMm } from '../contracts/types';

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

/** 회전을 반영한 바닥 사각형의 x방향·z방향 길이. 90·270도면 폭과 깊이가 바뀐다. */
export function footprintSize(item: Pick<FurnitureItem, 'w' | 'd' | 'rotationDeg'>): { sx: Mm; sz: Mm } {
  const quarter = (((Math.round(item.rotationDeg / 90) % 4) + 4) % 4) % 2 === 1;
  return quarter ? { sx: item.d, sz: item.w } : { sx: item.w, sz: item.d };
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

/** 바닥 사각형의 일부가 방 경계 밖으로 1 mm 이상 나갔는지. 벽에 정확히 붙은 것은 이탈이 아니다. */
export function isOutsideRoom(f: Footprint, room: RoomBounds): boolean {
  return (
    room.minX - f.minX >= WARN_MIN_MM ||
    f.maxX - room.maxX >= WARN_MIN_MM ||
    room.minZ - f.minZ >= WARN_MIN_MM ||
    f.maxZ - room.maxZ >= WARN_MIN_MM
  );
}

/** 지금 그려지는 위치(끄는 중이면 임시 위치)의 바닥 사각형 */
export function currentFootprint(item: Placed & Pick<FurnitureItem, 'id'>, preview: DragPreview | null): Footprint {
  return preview && preview.itemId === item.id ? footprint(item, preview) : footprint(item);
}

/** 가구마다 겹침·이탈 상태. 높이는 따지지 않는다. */
export function computeItemStatuses(
  items: FurnitureItem[],
  room: RoomBounds,
  preview: DragPreview | null,
): Record<string, ItemStatus> {
  const fps = items.map((it) => currentFootprint(it, preview));
  const result: Record<string, ItemStatus> = {};
  items.forEach((it, i) => {
    const overlap = fps.some((other, j) => j !== i && footprintsOverlap(fps[i], other));
    result[it.id] = { overlap, outside: isOutsideRoom(fps[i], room), wall: false, door: false };
  });
  return result;
}

/** 미리보기 가구 하나의 상태. 확정된 가구와 겹쳤는지, 방 밖인지(끄는 중이면 임시 위치). 확정 가구의 상태에는 영향을 주지 않는다. */
export function computeDraftStatus(
  draft: FurnitureItem,
  items: FurnitureItem[],
  room: RoomBounds,
  preview: DragPreview | null,
): ItemStatus {
  const fp = currentFootprint(draft, preview);
  return {
    overlap: items.some((it) => footprintsOverlap(fp, footprint(it))),
    outside: isOutsideRoom(fp, room),
    wall: false,
    door: false,
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
 * 다른 가구는 다른 축에서 겹치거나 snapMm 이내일 때만 후보다. 벽이 가구와 같은 거리면 벽이 이긴다.
 * 방 밖에 있어도 벽 가까이면 안쪽 변이 벽에 붙는다. others에 끄는 가구 자신을 넣지 않는다.
 */
export function snapToEdges(
  item: Pick<FurnitureItem, 'w' | 'd' | 'rotationDeg'>,
  at: PointMm,
  room: RoomBounds,
  others: Footprint[],
  snapMm: number = SNAP_MM,
): EdgeSnap {
  const f = footprint({ ...item, x: at.x, z: at.z });
  const nearZ = others.filter((o) => gap(f.minZ, f.maxZ, o.minZ, o.maxZ) <= snapMm);
  const nearX = others.filter((o) => gap(f.minX, f.maxX, o.minX, o.maxX) <= snapMm);
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
): PointMm {
  const s = snapToEdges(item, at, room, others, snapMm);
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
 * 바닥 사각형에서 벽 0 ~ 3까지의 거리. 벽 0은 z=minZ, 벽 1은 x=maxX, 벽 2는 z=maxZ, 벽 3은 x=minX(rectCorners 순서).
 * 벽 밖으로 나간 쪽은 음수다.
 */
export function wallDistances(f: Footprint, room: RoomBounds): [number, number, number, number] {
  return [f.minZ - room.minZ, room.maxX - f.maxX, room.maxZ - f.maxZ, f.minX - room.minX];
}

/** 새 가구를 찾을 때 방 가운데에서 바깥으로 훑는 간격 */
const FREE_SPOT_STEP_MM = 100;

/**
 * 새 가구(회전 0)를 놓을 빈 자리의 중심. 방 가운데에서 100 mm 격자로 바깥으로 훑어,
 * 다른 가구와 겹치지 않고 방 안에 들어가는 가장 가까운 자리를 고른다. 왼쪽·위쪽 변은 10 mm 격자에 맞춘다.
 * 같은 거리면 위쪽, 그다음 왼쪽을 먼저 고른다. 빈 자리가 없으면 시작점(겹침·이탈은 경고로 보인다).
 * from을 주면 방 가운데 대신 그 점에서 훑는다(복제본을 원본 옆에 놓을 때). 기본값은 방 가운데.
 */
export function findFreeSpot(
  size: Pick<FurnitureItem, 'w' | 'd'>,
  room: RoomBounds,
  others: Footprint[],
  from?: PointMm,
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
    return at;
  }
  return { x: cx, z: cz };
}
