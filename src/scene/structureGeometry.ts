// 벽·문·창문을 그리기 위한 순수 계산. three.js 객체를 만들지 않는다. 위치·열림 계산은 contracts/structure.ts만 쓴다.
import { doorHinge, openingSpan, wallSegment } from '../contracts/structure';
import type { Mm, Opening, PointMm, Room, WallRef } from '../contracts/types';
import { WALL_THICKNESS_MM, wallSegments } from './geometry';

type RoomShape = Pick<Room, 'corners' | 'walls'>;

/** 그려지는 벽 하나의 자리. t는 벽 시작에서 잰 거리(mm). */
export interface DrawnWall {
  ref: WallRef;
  /** 그려지는 벽 몸통 중심선의 시작(방 좌표 mm). 바깥 벽은 안목선에서 바깥으로 두께의 반만큼 나간 선이다. */
  start: PointMm;
  dir: PointMm;
  length: Mm;
  thickness: Mm;
  /** 중심선에서 안목선(바깥 벽) 또는 중심선(칸막이)까지의 이동 방향. 바깥 벽의 바깥쪽 단위 방향. 칸막이는 {0,0} */
  outward: PointMm;
  /** 몸통 상자의 y축 회전(라디안). 로컬 x축이 dir 방향이 된다. */
  rotationY: number;
  inner: boolean;
}

/** 벽의 그려지는 자리. 없는 벽이면 null. */
export function drawnWall(room: RoomShape, ref: WallRef): DrawnWall | null {
  const s = wallSegment(room, ref);
  if (!s) return null;
  const rotationY = Math.atan2(-s.dir.z, s.dir.x) + 0;
  if (s.inner) {
    return { ref, start: s.start, dir: s.dir, length: s.length, thickness: s.thickness, outward: { x: 0, z: 0 }, rotationY, inner: true };
  }
  const outward = wallSegments(room.corners)[ref as number].outward;
  const half = WALL_THICKNESS_MM / 2;
  return {
    ref,
    start: { x: s.start.x + outward.x * half, z: s.start.z + outward.z * half },
    dir: s.dir,
    length: s.length,
    thickness: WALL_THICKNESS_MM,
    outward,
    rotationY,
    inner: false,
  };
}

export interface WallPiece {
  t0: Mm;
  t1: Mm;
  /** 바닥에서의 높이(mm) */
  y0: Mm;
  y1: Mm;
}

export interface CutOpening {
  t0: Mm;
  t1: Mm;
  sill: Mm;
  height: Mm;
}

/**
 * 벽을 개구부로 자른 상자 조각들. [-ext, length + ext] 범위를 덮는다(바깥 벽은 양 끝을 두께의 반만큼 늘려 모서리를 채운다).
 * plan이면 개구부 구간을 높이와 상관없이 통째로 비운다(위에서 본 도면). 아니면 문턱 아래·개구부 위 벽을 남긴다.
 */
export function cutWallPieces(length: Mm, ceiling: Mm, openings: readonly CutOpening[], opts: { ext?: Mm; plan?: boolean } = {}): WallPiece[] {
  const ext = (opts.ext ?? 0) + 0;
  const spans = openings
    .map((o) => ({ ...o, t0: Math.max(0, Math.min(o.t0, length)), t1: Math.max(0, Math.min(o.t1, length)) }))
    .filter((o) => o.t1 > o.t0)
    .sort((a, b) => a.t0 - b.t0);
  const out: WallPiece[] = [];
  let cursor = ext === 0 ? 0 : -ext;
  for (const o of spans) {
    const t0 = Math.max(o.t0, cursor);
    if (t0 > cursor) out.push({ t0: cursor, t1: t0, y0: 0, y1: ceiling });
    if (o.t1 > t0) {
      if (!opts.plan) {
        const lo = Math.min(Math.max(o.sill, 0), ceiling);
        const hi = Math.min(Math.max(o.sill + o.height, 0), ceiling);
        if (lo > 0) out.push({ t0, t1: o.t1, y0: 0, y1: lo });
        if (hi < ceiling) out.push({ t0, t1: o.t1, y0: hi, y1: ceiling });
      }
    }
    cursor = Math.max(cursor, o.t1);
  }
  if (length + ext > cursor) out.push({ t0: cursor, t1: length + ext, y0: 0, y1: ceiling });
  return out;
}

/** 방 좌표의 한 벽에 붙은 개구부 구간(벽 시작에서 잰 거리). 벽 길이를 넘으면 openingSpan이 자른 범위다. */
export function openingsOnWall(room: RoomShape, openings: readonly Opening[], ref: WallRef): CutOpening[] {
  const out: CutOpening[] = [];
  for (const o of openings) {
    if (o.wall !== ref) continue;
    const span = openingSpan(room, o);
    if (!span) continue;
    const t0 = Math.hypot(span.from.x - span.segment.start.x, span.from.z - span.segment.start.z);
    const t1 = Math.hypot(span.to.x - span.segment.start.x, span.to.z - span.segment.start.z);
    out.push({ t0, t1, sill: o.sill, height: o.height });
  }
  return out;
}

const lerp = (a: PointMm, b: PointMm, t: number): PointMm => ({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });

export interface DoorPlan {
  /** 문짝이 열린 모습(경첩에서 열림 방향으로 문 폭만큼)의 두 끝 */
  leaf: [PointMm, PointMm];
  /** 닫힌 문짝 끝에서 열린 문짝 끝까지 가는 사분원 */
  arc: PointMm[];
  /** 열림 방향 단위 벡터 */
  openDir: PointMm;
  /** 문짝 폭(mm) */
  width: Mm;
}

/** 평면 뷰의 문짝 선과 열림 호. 경첩은 벽 면(칸막이는 두께의 반만큼 열림 쪽)에 있다(doorSwingRect와 같은 기준). 문이 아니면 null. */
export function doorPlan(room: RoomShape, o: Opening, steps = 18): DoorPlan | null {
  const h = doorHinge(room, o);
  const span = openingSpan(room, o);
  if (!h || !span) return null;
  const face = span.segment.thickness / 2;
  const hinge = { x: h.hinge.x + h.openDir.x * face, z: h.hinge.z + h.openDir.z * face };
  const width = Math.hypot(span.to.x - span.from.x, span.to.z - span.from.z);
  const sx = h.free.x - h.hinge.x;
  const sz = h.free.z - h.hinge.z;
  const sl = Math.hypot(sx, sz) || 1;
  const s = { x: sx / sl, z: sz / sl };
  const arc: PointMm[] = [];
  for (let i = 0; i <= steps; i++) {
    const phi = (i / steps) * (Math.PI / 2);
    arc.push({
      x: hinge.x + (s.x * Math.cos(phi) + h.openDir.x * Math.sin(phi)) * width,
      z: hinge.z + (s.z * Math.cos(phi) + h.openDir.z * Math.sin(phi)) * width,
    });
  }
  return { leaf: [hinge, { x: hinge.x + h.openDir.x * width, z: hinge.z + h.openDir.z * width }], arc, openDir: h.openDir, width };
}

/** 평면 뷰의 창문 이중선: 벽 몸통 중심선에서 양쪽으로 두께의 1/4씩 떨어진 두 선분. */
export function windowPlanLines(room: RoomShape, o: Opening): [PointMm, PointMm][] | null {
  const span = openingSpan(room, o);
  const w = drawnWall(room, o.wall);
  if (!span || !w) return null;
  const n = span.segment.normal;
  const shift = { x: w.outward.x * (w.thickness / 2), z: w.outward.z * (w.thickness / 2) };
  const q = w.thickness / 4;
  return [1, -1].map((side) => {
    const dx = shift.x + n.x * q * side;
    const dz = shift.z + n.z * q * side;
    return [
      { x: span.from.x + dx, z: span.from.z + dz },
      { x: span.to.x + dx, z: span.to.z + dz },
    ] as [PointMm, PointMm];
  });
}

/** 개구부 구간이 벽 몸통에서 차지하는 사각형의 중심·길이·두께(선택 테두리, 눌림 상자용). */
export function openingBox(room: RoomShape, o: Opening): { center: PointMm; length: Mm; thickness: Mm; rotationY: number; wall: DrawnWall } | null {
  const span = openingSpan(room, o);
  const w = drawnWall(room, o.wall);
  if (!span || !w) return null;
  const mid = lerp(span.from, span.to, 0.5);
  return {
    center: { x: mid.x + w.outward.x * (w.thickness / 2), z: mid.z + w.outward.z * (w.thickness / 2) },
    length: Math.hypot(span.to.x - span.from.x, span.to.z - span.from.z),
    thickness: w.thickness,
    rotationY: w.rotationY,
    wall: w,
  };
}

/** 그리는 중인 벽의 미리보기: 가로·세로로 곧게 편 두 끝(긴 쪽 축에 맞춘다, addWall과 같은 규칙). */
export function straightenPreview(a: PointMm, b: PointMm): { a: PointMm; b: PointMm; length: Mm } {
  const dx = Math.abs(b.x - a.x);
  const dz = Math.abs(b.z - a.z);
  const end = dx >= dz ? { x: b.x, z: a.z } : { x: a.x, z: b.z };
  return { a, b: end, length: Math.max(dx, dz) };
}

/** 선 하나를 두께만큼 부풀린 사각형의 네 모서리(닫힌 선으로 그리려면 첫 점을 한 번 더 붙인다). */
export function wallRectCorners(a: PointMm, b: PointMm, thickness: Mm): PointMm[] {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len = Math.hypot(dx, dz) || 1;
  const nx = (-dz / len) * (thickness / 2);
  const nz = (dx / len) * (thickness / 2);
  return [
    { x: a.x + nx, z: a.z + nz },
    { x: b.x + nx, z: b.z + nz },
    { x: b.x - nx, z: b.z - nz },
    { x: a.x - nx, z: a.z - nz },
  ];
}
