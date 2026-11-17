// 벽·문·창문의 기하 계산. 장면(그리기), 가구(문 앞·벽 겹침 판정), 구조 편집(문 놓기)이 모두 이 함수를 쓴다.
// 좌표는 방 좌표(mm). 칸막이 벽은 가로·세로만 있다(InteriorWall 주석).
import type { InteriorWall, Mm, Opening, PointMm, Room, WallRef } from './types';

export interface WallSegment {
  ref: WallRef;
  /** 중심선의 시작과 끝. 바깥 벽은 방 안쪽 면(안목치수 선) */
  start: PointMm;
  end: PointMm;
  length: Mm;
  /** 시작 → 끝 단위 방향 */
  dir: PointMm;
  /** 'normal' 쪽 단위 법선 (−dz, dx). 직사각형 방의 바깥 벽에서는 방 안쪽 */
  normal: PointMm;
  /** 칸막이 벽 두께. 바깥 벽은 0(안목치수 선 위) */
  thickness: Mm;
  inner: boolean;
}

export interface Rect {
  minX: Mm;
  maxX: Mm;
  minZ: Mm;
  maxZ: Mm;
}

function seg(ref: WallRef, start: PointMm, end: PointMm, thickness: Mm, inner: boolean): WallSegment {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const length = Math.hypot(dx, dz);
  const dir = length > 0 ? { x: dx / length, z: dz / length } : { x: 1, z: 0 };
  return { ref, start, end, length, dir, normal: { x: -dir.z + 0, z: dir.x + 0 }, thickness, inner };
}

/** 벽 하나의 선분. 없는 벽이면 null. */
export function wallSegment(room: Pick<Room, 'corners' | 'walls'>, ref: WallRef): WallSegment | null {
  if (typeof ref === 'number') {
    const n = room.corners.length;
    if (!Number.isInteger(ref) || ref < 0 || ref >= n) return null;
    return seg(ref, room.corners[ref], room.corners[(ref + 1) % n], 0, false);
  }
  const w = room.walls.find((x) => x.id === ref);
  return w ? seg(ref, w.a, w.b, w.thickness, true) : null;
}

/** 모든 벽(바깥 벽 0 ~ n−1, 그다음 칸막이 벽). */
export function allWallSegments(room: Pick<Room, 'corners' | 'walls'>): WallSegment[] {
  const outer = room.corners.map((_, i) => wallSegment(room, i) as WallSegment);
  const inner = room.walls.map((w) => wallSegment(room, w.id) as WallSegment);
  return [...outer, ...inner];
}

/** 칸막이 벽이 바닥에서 차지하는 사각형(두께 포함). */
export function interiorWallRect(w: InteriorWall): Rect {
  const h = w.thickness / 2;
  return {
    minX: Math.min(w.a.x, w.b.x) - (w.a.x === w.b.x ? h : 0),
    maxX: Math.max(w.a.x, w.b.x) + (w.a.x === w.b.x ? h : 0),
    minZ: Math.min(w.a.z, w.b.z) - (w.a.z === w.b.z ? h : 0),
    maxZ: Math.max(w.a.z, w.b.z) + (w.a.z === w.b.z ? h : 0),
  };
}

const at = (s: WallSegment, t: Mm): PointMm => ({ x: s.start.x + s.dir.x * t, z: s.start.z + s.dir.z * t });

/** 개구부가 벽 위에서 차지하는 구간의 두 끝(벽 시작 쪽이 from). offset·폭은 벽 길이 안으로 자른다. 벽이 없으면 null. */
export function openingSpan(
  room: Pick<Room, 'corners' | 'walls'>,
  o: Pick<Opening, 'wall' | 'offset' | 'width'>,
): { from: PointMm; to: PointMm; segment: WallSegment } | null {
  const s = wallSegment(room, o.wall);
  if (!s) return null;
  const t0 = Math.max(0, Math.min(o.offset, s.length));
  const t1 = Math.max(t0, Math.min(o.offset + o.width, s.length));
  return { from: at(s, t0), to: at(s, t1), segment: s };
}

/** 개구부가 벽 길이 안에 다 들어가는지. */
export function openingFits(room: Pick<Room, 'corners' | 'walls'>, o: Pick<Opening, 'wall' | 'offset' | 'width'>): boolean {
  const s = wallSegment(room, o.wall);
  return !!s && o.offset >= 0 && o.width > 0 && o.offset + o.width <= s.length + 0.5;
}

/**
 * 문짝이 열리며 쓰는 자리: 경첩에서 문 폭만큼의 사분원을 감싸는 정사각형(가로·세로 벽 기준).
 * 문이 아니거나 벽이 없으면 null. 칸막이 벽은 벽 면(두께의 반)에서부터 잰다.
 */
export function doorSwingRect(room: Pick<Room, 'corners' | 'walls'>, o: Opening): Rect | null {
  if (o.type !== 'door') return null;
  const span = openingSpan(room, o);
  if (!span) return null;
  const { segment: s } = span;
  const side = (o.swing ?? 'normal') === 'normal' ? 1 : -1;
  const n = { x: s.normal.x * side, z: s.normal.z * side };
  const face = s.thickness / 2;
  const w = Math.hypot(span.to.x - span.from.x, span.to.z - span.from.z);
  const p0 = { x: span.from.x + n.x * face, z: span.from.z + n.z * face };
  const p1 = { x: span.to.x + n.x * face, z: span.to.z + n.z * face };
  const q0 = { x: p0.x + n.x * w, z: p0.z + n.z * w };
  const q1 = { x: p1.x + n.x * w, z: p1.z + n.z * w };
  const xs = [p0.x, p1.x, q0.x, q1.x];
  const zs = [p0.z, p1.z, q0.z, q1.z];
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
}

/** 문의 경첩 위치와 닫힌 문짝이 놓인 쪽 끝(평면 뷰에서 문짝 선과 열림 호를 그리는 데 쓴다). */
export function doorHinge(room: Pick<Room, 'corners' | 'walls'>, o: Opening): { hinge: PointMm; free: PointMm; openDir: PointMm } | null {
  if (o.type !== 'door') return null;
  const span = openingSpan(room, o);
  if (!span) return null;
  const side = (o.swing ?? 'normal') === 'normal' ? 1 : -1;
  const startHinge = (o.hinge ?? 'start') === 'start';
  return {
    hinge: startHinge ? span.from : span.to,
    free: startHinge ? span.to : span.from,
    openDir: { x: span.segment.normal.x * side, z: span.segment.normal.z * side },
  };
}

/** 벽 위의 한 점에 가장 가까운 offset(개구부를 끌 때). 개구부 가운데가 그 점에 오도록, 벽 안으로 자른다. */
export function offsetAlongWall(s: WallSegment, p: PointMm, width: Mm): Mm {
  const t = (p.x - s.start.x) * s.dir.x + (p.z - s.start.z) * s.dir.z;
  return Math.round(Math.max(0, Math.min(s.length - width, t - width / 2))) + 0;
}

/** 두 사각형이 x, z 모두 1 mm 이상 겹치는지(가구 겹침과 같은 기준). */
export function rectsOverlap(a: Rect, b: Rect, minMm = 1): boolean {
  const ox = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
  const oz = Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ);
  return ox >= minMm && oz >= minMm;
}
