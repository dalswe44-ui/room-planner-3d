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
  /** 아래를 내려다보는 각도(도, 음수가 아래). 바닥과 가구가 화면에 들어오게 한다. */
  pitchDeg: number;
}

/** 들어갈 때 벽에서 띄우는 거리(mm) */
export const WALK_START_MARGIN_MM: Mm = 600;
/** 들어갈 때 내려다보는 각도(도) */
export const WALK_START_PITCH_DEG = -12;

/** 사람이 설 수 없는 곳(가구 발자국, 축 정렬 사각형 mm) */
export interface Blocked {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/**
 * 들어갈 때의 자리와 방향(2026-11-19 QA 4-3: 방 가운데에서 벽만 보이던 것을 고침).
 * 문이 있으면 그 문 안쪽 600 mm, 없으면 방 모서리(왼쪽 아래 → 왼쪽 위 → 오른쪽 아래 → 오른쪽 위)에서 벽 600 mm 안쪽에 서서
 * 방 가운데를 대각선으로 바라보고 12도 내려다본다. 가구 위(발자국에서 200 mm 이내)인 자리는 건너뛴다.
 * 설 곳이 없으면 예전처럼 방 가운데에서 긴 쪽을 본다.
 */
export function walkStart(corners: readonly PointMm[], doors: readonly { at: PointMm; inward: PointMm }[] = [], blocked: readonly Blocked[] = []): WalkStart {
  const b = roomBounds({ corners: [...corners] });
  const center = { x: Math.round((b.minX + b.maxX) / 2), z: Math.round((b.minZ + b.maxZ) / 2) };
  const mean = {
    x: Math.round(corners.reduce((s, c) => s + c.x, 0) / corners.length),
    z: Math.round(corners.reduce((s, c) => s + c.z, 0) / corners.length),
  };
  const look = [center, mean].find((p) => pointInPolygon(p, corners)) ?? corners[0];
  const m = WALK_START_MARGIN_MM;
  const candidates: PointMm[] = [
    ...doors.map((d) => ({ x: d.at.x + d.inward.x * m, z: d.at.z + d.inward.z * m })),
    { x: b.minX + m, z: b.maxZ - m },
    { x: b.minX + m, z: b.minZ + m },
    { x: b.maxX - m, z: b.maxZ - m },
    { x: b.maxX - m, z: b.minZ + m },
  ].map((p) => ({ x: Math.round(p.x), z: Math.round(p.z) }));
  const free = (p: PointMm) => !blocked.some((r) => p.x > r.minX - 200 && p.x < r.maxX + 200 && p.z > r.minZ - 200 && p.z < r.maxZ + 200);
  const at = candidates.find((p) => pointInPolygon(p, corners) && free(p) && Math.hypot(look.x - p.x, look.z - p.z) > 300);
  if (!at) return { x: look.x, z: look.z, headingDeg: b.width >= b.depth ? 270 : 0, pitchDeg: WALK_START_PITCH_DEG };
  return { x: at.x, z: at.z, headingDeg: headingDegOf(look.x - at.x, look.z - at.z), pitchDeg: WALK_START_PITCH_DEG };
}

/** 키 하나에 움직이는 거리(mm)와 도는 각도(도) */
export const WALK_KEY_STEP_MM: Mm = 300;
export const WALK_KEY_TURN_DEG = 15;

/**
 * 사람 뷰의 키 조작(2026-11-19 QA 4-3). ↑·W 앞으로, ↓·S 뒤로, A 왼쪽으로 비켜 걷기, D 오른쪽, ←·Q 왼쪽으로 돌기, →·E 오른쪽으로 돌기.
 * 키가 아니면 null.
 */
export function walkKeyAction(key: string): { forward: number; side: number; turnDeg: number } | null {
  switch (key.length === 1 ? key.toLowerCase() : key) {
    case 'ArrowUp':
    case 'w':
      return { forward: WALK_KEY_STEP_MM, side: 0, turnDeg: 0 };
    case 'ArrowDown':
    case 's':
      return { forward: -WALK_KEY_STEP_MM, side: 0, turnDeg: 0 };
    case 'a':
      return { forward: 0, side: -WALK_KEY_STEP_MM, turnDeg: 0 };
    case 'd':
      return { forward: 0, side: WALK_KEY_STEP_MM, turnDeg: 0 };
    case 'ArrowLeft':
    case 'q':
      return { forward: 0, side: 0, turnDeg: WALK_KEY_TURN_DEG };
    case 'ArrowRight':
    case 'e':
      return { forward: 0, side: 0, turnDeg: -WALK_KEY_TURN_DEG };
    default:
      return null;
  }
}

/** headingDeg 방향으로 forward, 오른쪽으로 side만큼 간 자리(mm). heading 0은 -z, 반시계가 양수. */
export function stepFrom(p: PointMm, headingDeg: number, forward: number, side: number): PointMm {
  const h = MathUtils.degToRad(headingDeg);
  const f = { x: -Math.sin(h), z: -Math.cos(h) };
  const r = { x: Math.cos(h), z: -Math.sin(h) };
  return { x: Math.round(p.x + f.x * forward + r.x * side), z: Math.round(p.z + f.z * forward + r.z * side) };
}
