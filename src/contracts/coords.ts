// mm ↔ three.js 장면 좌표 변환은 이 파일의 함수만 쓴다. 장면은 1 unit = 1 m.
import type { Mm, PointMm } from './types';

const MM_PER_METER = 1000;

/** 정수 mm → 장면 좌표(m) */
export function mmToWorld(mm: Mm): number {
  return mm / MM_PER_METER;
}

/** 장면 좌표(m) → 정수 mm. 저장하기 전에 반드시 이 함수를 거친다. */
export function worldToMm(m: number): Mm {
  // + 0 은 Math.round가 만든 -0을 0으로 바꾼다(NaN은 그대로 둔다).
  return Math.round(m * MM_PER_METER) + 0;
}

/**
 * 방 좌표(mm)의 한 점을 장면 좌표 [x, y, z]로 바꾼다.
 * 방 좌표와 장면 좌표는 축 방향이 같다: +x 폭, +y 위, +z 깊이.
 */
export function roomToWorld(point: PointMm, yMm: Mm = 0): [number, number, number] {
  return [mmToWorld(point.x), mmToWorld(yMm), mmToWorld(point.z)];
}

/** 장면 좌표의 바닥 위 한 점을 방 좌표(정수 mm)로 바꾼다. */
export function worldToRoom(x: number, z: number): PointMm {
  return { x: worldToMm(x), z: worldToMm(z) };
}
