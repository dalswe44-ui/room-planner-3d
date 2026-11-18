// 장면 위에 DOM으로 얹는 것(도구 막대, 벽까지 거리, 방 치수선)의 화면 위치 계산. three.js 장면을 만들지 않는 순수 계산이다.
// 방 좌표(mm)와 장면 좌표의 변환은 coords.ts 함수만 쓴다. 화면 좌표는 장면 영역 왼쪽 위가 원점인 CSS px.
import { Camera, Vector3 } from 'three';
import { mmToWorld } from '../contracts/coords';
import type { FurnitureItem, Mm, PointMm } from '../contracts/types';

export interface PxSize {
  width: number;
  height: number;
}

export interface PxPoint {
  x: number;
  y: number;
}

export interface PxRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** 방 좌표(mm) 한 점(높이 yMm)이 화면의 어디에 그려지는지 */
export function projectToPx(camera: Camera, size: PxSize, point: PointMm, yMm: Mm = 0): PxPoint {
  const ndc = new Vector3(mmToWorld(point.x), mmToWorld(yMm), mmToWorld(point.z)).project(camera);
  return { x: ((ndc.x + 1) / 2) * size.width, y: ((1 - ndc.y) / 2) * size.height };
}

type Footprint = Pick<FurnitureItem, 'x' | 'z' | 'w' | 'd' | 'h' | 'elevation' | 'rotationDeg'>;

/** 가구 발자국의 네 모서리(방 좌표). 회전은 three.js의 rotation.y와 같은 부호(위에서 볼 때 반시계가 양수)다. */
export function footprintCorners(item: Pick<Footprint, 'x' | 'z' | 'w' | 'd' | 'rotationDeg'>): PointMm[] {
  const rad = (item.rotationDeg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([sx, sz]) => {
    const lx = (sx! * item.w) / 2;
    const lz = (sz! * item.d) / 2;
    return { x: item.x + lx * c + lz * s, z: item.z - lx * s + lz * c };
  });
}

/** 가구 상자(발자국 x 높이)가 화면에서 차지하는 경계 사각형 */
export function itemScreenRect(camera: Camera, size: PxSize, item: Footprint): PxRect {
  const rect: PxRect = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
  for (const corner of footprintCorners(item)) {
    for (const y of [item.elevation, item.elevation + item.h]) {
      const p = projectToPx(camera, size, corner, y);
      rect.left = Math.min(rect.left, p.x);
      rect.right = Math.max(rect.right, p.x);
      rect.top = Math.min(rect.top, p.y);
      rect.bottom = Math.max(rect.bottom, p.y);
    }
  }
  return rect;
}

export interface OverlayPlacement {
  /** 도구 막대 왼쪽 위(px) */
  x: number;
  y: number;
  /** 가구 아래쪽에 놓았는지 */
  below: boolean;
}

/**
 * 도구 막대를 가구 경계 위 가운데(gap 띄움)에 놓는다. 위에 자리가 없으면 아래에 놓고, 장면 영역 안으로 가둔다.
 * 장면 영역보다 막대가 크면 왼쪽·위쪽을 우선한다.
 */
export function placeOverlay(rect: PxRect, box: PxSize, view: PxSize, gap = 8, pad = 4): OverlayPlacement {
  const above = rect.top - gap - box.height;
  const below = above < pad;
  const rawY = below ? rect.bottom + gap : above;
  const rawX = (rect.left + rect.right) / 2 - box.width / 2;
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, Math.max(lo, hi)));
  return {
    x: clamp(rawX, pad, view.width - box.width - pad),
    y: clamp(rawY, pad, view.height - box.height - pad),
    below,
  };
}

/** 두 사각형이 겹친 넓이(px²) */
export function overlapArea(a: PxRect, b: PxRect): number {
  return Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
}

/**
 * 도구 막대 자리를 고른다(2026-11-19 QA 4-9). 가구 위, 아래, 네 대각선, 왼쪽, 오른쪽 중에서
 * 가구 자신과 avoid(거리 글자, 방 치수 글자, 확대 단추, 다른 가구)를 덜 가리는 자리를 고른다. 같으면 앞의 자리(가구 위가 먼저).
 * 장면 모서리는 후보가 아니다(모서리의 바닥을 덮어 그 자리를 누를 수 없게 된다).
 * 아무것도 가리지 않는 자리가 있으면 그 자리다. 좁은 휴대폰에서 막대가 거리 글자를 덮던 문제를 막는다.
 */
export function chooseOverlayPlacement(item: PxRect, box: PxSize, view: PxSize, avoid: readonly PxRect[], gap = 8, pad = 4): OverlayPlacement {
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, Math.max(lo, hi)));
  const cx = (item.left + item.right) / 2 - box.width / 2;
  const cy = (item.top + item.bottom) / 2 - box.height / 2;
  const raw: [number, number, boolean][] = [
    [cx, item.top - gap - box.height, false],
    [cx, item.bottom + gap, true],
    // 대각선 자리: 거리 글자는 가구 중심을 지나는 가로·세로 줄 위에 있으므로 비스듬한 자리는 대개 비어 있다.
    [item.left - box.width, item.top - gap - box.height, false],
    [item.right, item.top - gap - box.height, false],
    [item.left - box.width, item.bottom + gap, true],
    [item.right, item.bottom + gap, true],
    [item.left - gap - box.width, cy, false],
    [item.right + gap, cy, false],
  ];
  let best: OverlayPlacement | null = null;
  let bestScore = Infinity;
  for (const [x0, y0, below] of raw) {
    const x = clamp(x0, pad, view.width - box.width - pad);
    const y = clamp(y0, pad, view.height - box.height - pad);
    const r = { left: x, top: y, right: x + box.width, bottom: y + box.height };
    // 가구를 가리는 것은 두 배로 센다. 가구에서 멀어질수록 조금씩 손해(같은 점수면 가까운 자리).
    const score = overlapArea(r, item) * 2 + avoid.reduce((sum, a) => sum + overlapArea(r, a), 0);
    if (score < bestScore - 0.5) {
      bestScore = score;
      best = { x, y, below };
    }
    if (bestScore === 0) break;
  }
  return best ?? placeOverlay(item, box, view, gap, pad);
}

/** 한 방향의 치수선: 화면 선분(from → to), 가운데, 화면 단위 방향 */
export interface DimLine {
  from: PxPoint;
  to: PxPoint;
  mid: PxPoint;
  /** 화면에서 from → to 방향의 단위 벡터. 길이 0이면 벽 바깥 방향을 쓴다. */
  dir: PxPoint;
  /** 화면 길이(px) */
  length: number;
}

function dimLine(from: PxPoint, to: PxPoint, fallbackDir: PxPoint): DimLine {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  return {
    from,
    to,
    mid: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 },
    dir: length > 0.001 ? { x: (to.x - from.x) / length, y: (to.y - from.y) / length } : fallbackDir,
    length,
  };
}

/**
 * 선택한 가구에서 각 벽까지의 치수선. 벽 i의 바깥 방향 outward[i](방 좌표 단위 벡터)로, 가구 경계에서 distances[i]만큼 간다.
 * 음수(방 밖으로 나감)는 반대로(가구 안쪽으로) 그어진다.
 */
export function wallDistanceLines(
  camera: Camera,
  size: PxSize,
  item: Pick<Footprint, 'x' | 'z' | 'w' | 'd' | 'rotationDeg'>,
  outward: readonly { x: number; z: number }[],
  distances: readonly Mm[],
): DimLine[] {
  const rad = (item.rotationDeg * Math.PI) / 180;
  const ux = { x: Math.cos(rad), z: -Math.sin(rad) };
  const uz = { x: Math.sin(rad), z: Math.cos(rad) };
  return outward.map((n, i) => {
    // 가구 발자국이 n 방향으로 뻗은 반폭
    const reach = Math.abs(n.x * ux.x + n.z * ux.z) * (item.w / 2) + Math.abs(n.x * uz.x + n.z * uz.z) * (item.d / 2);
    const start = { x: item.x + n.x * reach, z: item.z + n.z * reach };
    const end = { x: start.x + n.x * (distances[i] ?? 0), z: start.z + n.z * (distances[i] ?? 0) };
    const a = projectToPx(camera, size, start);
    const b = projectToPx(camera, size, end);
    const o = projectToPx(camera, size, { x: start.x + n.x, z: start.z + n.z });
    const oLen = Math.hypot(o.x - a.x, o.y - a.y) || 1;
    return dimLine(a, b, { x: (o.x - a.x) / oLen, y: (o.y - a.y) / oLen });
  });
}

export interface RoomDimLines {
  /** 폭 치수선(방 위쪽 바깥, 왼쪽 → 오른쪽) */
  width: DimLine;
  /** 깊이 치수선(방 왼쪽 바깥, 위 → 아래) */
  depth: DimLine;
  /** 치수선을 벽 바깥 면에서 띄우는 거리(px) */
  offsetPx: number;
  /** 방의 안쪽 모서리(왼쪽 위)의 화면 위치와 벽 바깥 면까지의 화면 거리 */
  wallOuterTop: number;
  wallOuterLeft: number;
}

/** 방 바깥 위쪽의 폭 치수선과 왼쪽의 깊이 치수선. 위쪽이 -z, 왼쪽이 -x인 평면 뷰 기준이다. */
export function roomDimLines(
  camera: Camera,
  size: PxSize,
  bounds: { minX: Mm; maxX: Mm; minZ: Mm; maxZ: Mm },
  wallThickness: Mm,
  offsetPx: number,
): RoomDimLines {
  const tl = projectToPx(camera, size, { x: bounds.minX, z: bounds.minZ });
  const tr = projectToPx(camera, size, { x: bounds.maxX, z: bounds.minZ });
  const bl = projectToPx(camera, size, { x: bounds.minX, z: bounds.maxZ });
  const outer = projectToPx(camera, size, { x: bounds.minX - wallThickness, z: bounds.minZ - wallThickness });
  const lineY = outer.y - offsetPx;
  const lineX = outer.x - offsetPx;
  return {
    width: dimLine({ x: tl.x, y: lineY }, { x: tr.x, y: lineY }, { x: 1, y: 0 }),
    depth: dimLine({ x: lineX, y: tl.y }, { x: lineX, y: bl.y }, { x: 0, y: 1 }),
    offsetPx,
    wallOuterTop: outer.y,
    wallOuterLeft: outer.x,
  };
}

export interface WallDim {
  line: DimLine;
  /** 벽 위의 두 끝(화면). 보조선(벽 → 치수선)을 긋는 데 쓴다 */
  a: PxPoint;
  b: PxPoint;
}

/**
 * 벽 하나의 길이 치수선. 벽 선분(start → end)을 normal 쪽으로 faceMm만큼 옮긴 선(벽 면)에서 화면 기준 offsetPx 더 띄운다.
 * normal은 방 좌표 단위 벡터. 화면에서 그 방향이 어디인지는 카메라로 알아낸다.
 */
export function wallDimLine(camera: Camera, size: PxSize, start: PointMm, end: PointMm, normal: PointMm, faceMm: Mm, offsetPx: number): WallDim {
  const shift = (p: PointMm): PointMm => ({ x: p.x + normal.x * faceMm, z: p.z + normal.z * faceMm });
  const a = projectToPx(camera, size, shift(start));
  const b = projectToPx(camera, size, shift(end));
  const n = projectToPx(camera, size, { x: shift(start).x + normal.x * 1000, z: shift(start).z + normal.z * 1000 });
  const nl = Math.hypot(n.x - a.x, n.y - a.y) || 1;
  const px = { x: (n.x - a.x) / nl, y: (n.y - a.y) / nl };
  const from = { x: a.x + px.x * offsetPx, y: a.y + px.y * offsetPx };
  const to = { x: b.x + px.x * offsetPx, y: b.y + px.y * offsetPx };
  return { line: dimLine(from, to, { x: 1, y: 0 }), a, b };
}
