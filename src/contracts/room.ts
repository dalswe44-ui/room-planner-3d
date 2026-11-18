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

/** 점이 다각형 안(경계 제외)에 있는지. 짝수-홀수 규칙. */
export function pointInRoom(p: PointMm, corners: readonly PointMm[]): boolean {
  let inside = false;
  for (let i = 0, j = corners.length - 1; i < corners.length; j = i++) {
    const a = corners[i];
    const b = corners[j];
    if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

/**
 * 방을 둘러싼 사각형 안에서 방이 아닌 곳(직사각형 조각들, 2026-11-19 QA 5-4). 직사각형 방이면 빈 배열이다.
 * 벽이 가로·세로뿐인 방에서 꼭짓점의 x·z 값으로 나눈 칸 중 가운데가 방 밖인 칸을 모은다.
 */
export function roomNotches(corners: readonly PointMm[]): { minX: Mm; maxX: Mm; minZ: Mm; maxZ: Mm }[] {
  if (corners.length <= 4) return [];
  const xs = [...new Set(corners.map((c) => c.x))].sort((a, b) => a - b);
  const zs = [...new Set(corners.map((c) => c.z))].sort((a, b) => a - b);
  const out: { minX: Mm; maxX: Mm; minZ: Mm; maxZ: Mm }[] = [];
  for (let i = 0; i + 1 < xs.length; i++) {
    for (let j = 0; j + 1 < zs.length; j++) {
      const mid = { x: (xs[i] + xs[i + 1]) / 2, z: (zs[j] + zs[j + 1]) / 2 };
      if (!pointInRoom(mid, corners)) out.push({ minX: xs[i], maxX: xs[i + 1], minZ: zs[j], maxZ: zs[j + 1] });
    }
  }
  return out;
}
