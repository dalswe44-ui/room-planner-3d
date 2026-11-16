// 가구 배치 규칙의 순수 계산. three.js와 React 없이 mm 숫자만 다룬다(docs/SPEC.md 2절).
import type { RoomBounds } from '../contracts/room';
import type { DragPreview, FurnitureItem, ItemStatus, Mm, PointMm } from '../contracts/types';

// SPEC 2절의 기준값(mm)
/** 끌어 놓을 때 바닥 사각형의 왼쪽·위쪽 변을 맞추는 격자 간격 */
export const GRID_MM = 10;
/** 가구 폭·깊이·높이의 허용 범위 */
export const ITEM_SIZE_MIN = 10;
export const ITEM_SIZE_MAX = 10000;
/** 겹침·이탈로 보는 최소 길이. 변이 정확히 맞닿은 것(0)은 겹침·이탈이 아니다. */
export const WARN_MIN_MM = 1;
/** 이름을 비우고 추가하면 쓰는 이름 */
export const DEFAULT_ITEM_NAME = '가구';
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
    result[it.id] = { overlap, outside: isOutsideRoom(fps[i], room) };
  });
  return result;
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
