// 사람 뷰의 순수 계산: 방향 <-> headingDeg, 처음 자리, 이동할 자리를 벽에서 띄우기, 시야각. three.js 장면은 만들지 않는다.
import { Camera, MathUtils } from 'three';
import { roomBounds } from '../contracts/room';
import type { Mm, PointMm } from '../contracts/types';

/** 사람 뷰 카메라를 다른 원근 카메라(3D 뷰)와 구별하는 표시. sceneProbe가 이것으로 view를 정한다. */
export function isWalkCamera(camera: Camera): boolean {
  return (camera.userData as { walk?: boolean }).walk === true;
}

/** 탭으로 옮겨 갈 자리를 벽 안쪽 면에서 띄우는 거리(mm) */
export const WALK_WALL_MARGIN_MM: Mm = 400;
/** 위아래로 둘러볼 수 있는 한계(도) */
export const WALK_PITCH_LIMIT_DEG = 70;
/** 사람 뷰의 세로 시야각 상한(도). 가로로 긴 화면의 기준값이기도 하다. */
export const WALK_FOV_DEG = 70;
/** 이동 시간(초) */
export const WALK_MOVE_SECONDS = 0.45;

/**
 * 시야각. 가로가 긴 화면은 세로 70도, 세로가 긴 화면(휴대폰)은 가로가 70도가 되도록 세로를 키운다(상한 100도).
 */
export function walkFovDeg(aspect: number): number {
  if (!(aspect > 0) || aspect >= 1) return WALK_FOV_DEG;
  const h = MathUtils.degToRad(WALK_FOV_DEG) / 2;
  const v = 2 * Math.atan(Math.tan(h) / aspect);
  return Math.min(100, MathUtils.radToDeg(v));
}

/**
 * 바라보는 방향(장면 xz 성분)에서 headingDeg(0 이상 360 미만 정수).
 * 0이면 -z(평면 뷰의 위쪽 벽)를 보고 위에서 볼 때 반시계가 양수다. 카메라의 rotation.y(YXZ 순서)와 같은 값이다.
 */
export function headingDegOf(forwardX: number, forwardZ: number): number {
  const deg = MathUtils.radToDeg(Math.atan2(-forwardX, -forwardZ));
  return ((Math.round(deg) % 360) + 360) % 360;
}

export function clampPitchRad(pitch: number): number {
  const limit = MathUtils.degToRad(WALK_PITCH_LIMIT_DEG);
  return Math.min(limit, Math.max(-limit, pitch));
}

/** 다각형 안(경계 포함하지 않음)인지. 짝수-홀수 규칙. */
export function pointInPolygon(p: PointMm, corners: readonly PointMm[]): boolean {
  let inside = false;
  for (let i = 0, j = corners.length - 1; i < corners.length; j = i++) {
    const a = corners[i];
    const b = corners[j];
    if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

function closestOnSegment(p: PointMm, a: PointMm, b: PointMm): { x: number; z: number; dist: number } {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len2 = dx * dx + dz * dz;
  const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2));
  const x = a.x + t * dx;
  const z = a.z + t * dz;
  return { x, z, dist: Math.hypot(p.x - x, p.z - z) };
}

/**
 * 방 안의 한 점을 모든 벽에서 margin 이상 떨어지게 안쪽으로 당긴다(정수 mm).
 * 방 밖이거나, 당긴 결과가 방 밖이 되면(방이 margin의 두 배보다 좁은 곳) null이다.
 */
export function pullInside(point: PointMm, corners: readonly PointMm[], margin: Mm = WALK_WALL_MARGIN_MM): PointMm | null {
  if (!pointInPolygon(point, corners)) return null;
  let x = point.x;
  let z = point.z;
  for (let pass = 0; pass < 6; pass++) {
    let worst: { x: number; z: number; dist: number } | null = null;
    for (let i = 0; i < corners.length; i++) {
      const c = closestOnSegment({ x, z }, corners[i], corners[(i + 1) % corners.length]);
      if (c.dist < margin && (!worst || c.dist < worst.dist)) worst = c;
    }
    if (!worst) break;
    // 가장 가까운 벽 점에서 멀어지는 쪽으로 밀어 margin을 채운다. 점이 이미 안쪽이므로 방향이 안쪽이다.
    const away = worst.dist > 0 ? { x: (x - worst.x) / worst.dist, z: (z - worst.z) / worst.dist } : { x: 0, z: 0 };
    x += away.x * (margin - worst.dist);
    z += away.z * (margin - worst.dist);
  }
  const out = { x: Math.round(x), z: Math.round(z) };
  return pointInPolygon(out, corners) ? out : null;
}

export interface WalkStart {
  x: Mm;
  z: Mm;
  headingDeg: number;
}

/** 들어갈 때의 자리와 방향: 방 가운데에서 방의 긴 쪽을 본다(폭이 깊이 이상이면 +x 쪽, 아니면 -z 쪽). */
export function walkStart(corners: readonly PointMm[]): WalkStart {
  const b = roomBounds({ corners: [...corners] });
  const center = { x: Math.round((b.minX + b.maxX) / 2), z: Math.round((b.minZ + b.maxZ) / 2) };
  const mean = {
    x: Math.round(corners.reduce((s, c) => s + c.x, 0) / corners.length),
    z: Math.round(corners.reduce((s, c) => s + c.z, 0) / corners.length),
  };
  const at = [center, mean].find((p) => pointInPolygon(p, corners)) ?? corners[0];
  return { x: at.x, z: at.z, headingDeg: b.width >= b.depth ? 270 : 0 };
}
