// 방 다각형을 다루는 공용 함수. 이번 버전의 UI는 직사각형 방만 만들지만 저장은 corners(다각형)로 한다.
import type { Mm, PointMm, Room } from './types';

/**
 * 직사각형 방의 꼭짓점 4개. 순서는 원점 → +x → +x+z → +z.
 * 벽 0은 z=0 변, 벽 1은 x=width 변, 벽 2는 z=depth 변, 벽 3은 x=0 변이 된다.
 */
export function rectCorners(width: Mm, depth: Mm): PointMm[] {
  return [
    { x: 0, z: 0 },
    { x: width, z: 0 },
    { x: width, z: depth },
    { x: 0, z: depth },
  ];
}

export interface RoomBounds {
  minX: Mm;
  maxX: Mm;
  minZ: Mm;
  maxZ: Mm;
  /** x방향 크기(폭) */
  width: Mm;
  /** z방향 크기(깊이) */
  depth: Mm;
}

/** 방 다각형을 둘러싸는 축 정렬 사각형. 직사각형 방에서는 방 자체와 같다. */
export function roomBounds(room: Pick<Room, 'corners'>): RoomBounds {
  const xs = room.corners.map((c) => c.x);
  const zs = room.corners.map((c) => c.z);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  return { minX, maxX, minZ, maxZ, width: maxX - minX, depth: maxZ - minZ };
}
