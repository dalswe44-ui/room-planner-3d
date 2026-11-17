// 평면 뷰의 "위에서 내려다본 입체 벽". 카메라는 그대로 직교이고, 보이기 전용 벽 조각의 윗면 꼭짓점만 방 중심에서 바깥으로 민다(가짜 원근).
// 바닥 쪽 꼭짓점은 실제 자리 그대로라 벽 안쪽 면의 바닥선이 실제 치수다. 순수 계산과 geometry 생성만 있고 React는 없다.
import { BufferGeometry, Float32BufferAttribute } from "three";
import { roomToWorld } from "../contracts/coords";
import type { Mm, PointMm } from "../contracts/types";
import { wallRectCorners } from "./structureGeometry";

/** 윗면은 흰색에 가깝게, 안쪽 옆면은 그보다 조금 어둡게. 선은 둘의 경계와 벽 밑선을 또렷하게 한다. */
export const PLAN_WALL_TOP_COLOR = "#fcfbf8";
export const PLAN_WALL_SIDE_COLOR = "#c8c3b6";
export const PLAN_WALL_EDGE_COLOR = "#85806f";
/** 평면 뷰 창문 이중선. 벽을 비운 자리의 바닥·바깥 배경 양쪽에서 읽히는 중간 톤 */
export const PLAN_WINDOW_LINE_COLOR = "#4f7d9c";

/**
 * 윗면을 방 중심에서 미는 비율. 방 치수 글자(평면 뷰 바깥의 치수선)가 기울어진 윗면에 덮이지 않도록 작게 잡았다.
 * 바깥 벽: 5000x4000 방에서 안쪽 옆면 약 75mm(가로 방향) 폭. 칸막이는 가구를 크게 가리지 않게 더 작다.
 */
export const PLAN_TILT_OUTER = 1.03;
export const PLAN_TILT_PARTITION = 1.015;

type Quad = [PointMm, PointMm, PointMm, PointMm];

export interface PlanWallVisual {
  /** 실제 자리(바닥)의 네 꼭짓점. wallRectCorners 순서(변 i는 점 i → i+1) */
  bottom: Quad;
  /** 윗면의 네 꼭짓점. bottom[i]와 같은 순서 */
  top: Quad;
}

/** 점 p를 center에서 ratio배 떨어진 곳으로 민다. */
export function tiltPoint(p: PointMm, center: PointMm, ratio: number): PointMm {
  return {
    x: center.x + (p.x - center.x) * ratio,
    z: center.z + (p.z - center.z) * ratio,
  };
}

/** 방 꼭짓점들의 경계 상자 중심(mm). */
export function roomCenter(corners: readonly PointMm[]): PointMm {
  const xs = corners.map((c) => c.x);
  const zs = corners.map((c) => c.z);
  return {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    z: (Math.min(...zs) + Math.max(...zs)) / 2,
  };
}

/** 벽 조각(중심선 위 t0~t1 구간, 두께 thickness)의 바닥 꼭짓점과 밀어 올린 윗면 꼭짓점. */
export function planWallVisual(
  a: PointMm,
  b: PointMm,
  thickness: Mm,
  center: PointMm,
  ratio: number,
): PlanWallVisual {
  const bottom = wallRectCorners(a, b, thickness) as Quad;
  return {
    bottom,
    top: bottom.map((p) => tiltPoint(p, center, ratio)) as Quad,
  };
}

/** 변 i의 옆면이 위에서 보이는지, 아니면 윗면에 가려지는 쪽인지. 보이면 true. */
export function visibleSides(v: PlanWallVisual): boolean[] {
  const cx = v.bottom.reduce((s, p) => s + p.x, 0) / 4;
  const cz = v.bottom.reduce((s, p) => s + p.z, 0) / 4;
  return v.bottom.map((p, i) => {
    const q = v.bottom[(i + 1) % 4]!;
    const mx = (p.x + q.x) / 2;
    const mz = (p.z + q.z) / 2;
    // 상자 바깥으로 향하는 변의 법선
    let nx = -(q.z - p.z);
    let nz = q.x - p.x;
    if (nx * (mx - cx) + nz * (mz - cz) < 0) {
      nx = -nx;
      nz = -nz;
    }
    const t = v.top[i]!;
    const u = v.top[(i + 1) % 4]!;
    const sx = (t.x - p.x + u.x - q.x) / 2;
    const sz = (t.z - p.z + u.z - q.z) / 2;
    // 윗면이 법선 쪽으로 더 나가면 옆면은 아래를 향해 가려지고, 반대쪽으로 들어가면 위를 향해 보인다.
    return sx * nx + sz * nz < 0;
  });
}

/**
 * 보이기 전용 벽을 눌렀을 때도 벽으로 읽히도록, 바닥 꼭짓점과 윗면 꼭짓점을 모두 감싸는 사각형(벽 방향 기준)을 돌려준다.
 * 중심(mm)과 벽 방향 길이, 법선 방향 두께.
 */
export function silhouetteBox(
  v: PlanWallVisual,
  dir: PointMm,
): { center: PointMm; length: Mm; depth: Mm } {
  const pts = [...v.bottom, ...v.top];
  const n = { x: -dir.z, z: dir.x };
  const ts = pts.map((p) => p.x * dir.x + p.z * dir.z);
  const ns = pts.map((p) => p.x * n.x + p.z * n.z);
  const t0 = Math.min(...ts);
  const t1 = Math.max(...ts);
  const n0 = Math.min(...ns);
  const n1 = Math.max(...ns);
  const tm = (t0 + t1) / 2;
  const nm = (n0 + n1) / 2;
  return {
    center: { x: dir.x * tm + n.x * nm, z: dir.z * tm + n.z * nm },
    length: t1 - t0,
    depth: n1 - n0,
  };
}

export interface PlanWallGeometries {
  /** 윗면과 보이는 옆면. 정점 색을 쓴다. */
  fill: BufferGeometry;
  /** 윗면의 긴 변 두 개와 보이는 쪽 바닥 긴 변. 벽 끝(조각이 이어지는 자리)에는 선을 긋지 않는다. */
  edges: BufferGeometry;
}

const hex = (c: string): [number, number, number] =>
  [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];

/** 벽 조각의 면과 선 geometry. 윗면은 높이 heightMm, 바닥은 0. 쓰고 버릴 때 dispose해야 한다. */
export function buildPlanWallGeometries(
  v: PlanWallVisual,
  heightMm: Mm,
): PlanWallGeometries {
  const vis = visibleSides(v);
  const at = (p: PointMm, y: Mm) => roomToWorld(p, y);
  const pos: number[] = [];
  const col: number[] = [];
  const tri = (
    a: number[],
    b: number[],
    c: number[],
    color: [number, number, number],
  ) => {
    pos.push(...a, ...b, ...c);
    col.push(...color, ...color, ...color);
  };
  const quad = (
    p0: number[],
    p1: number[],
    p2: number[],
    p3: number[],
    color: [number, number, number],
  ) => {
    tri(p0, p1, p2, color);
    tri(p0, p2, p3, color);
  };
  const top = hex(PLAN_WALL_TOP_COLOR);
  const side = hex(PLAN_WALL_SIDE_COLOR);
  quad(
    at(v.top[0], heightMm),
    at(v.top[1], heightMm),
    at(v.top[2], heightMm),
    at(v.top[3], heightMm),
    top,
  );
  for (let i = 0; i < 4; i++) {
    if (!vis[i]) continue;
    const j = (i + 1) % 4;
    quad(
      at(v.bottom[i]!, 0),
      at(v.bottom[j]!, 0),
      at(v.top[j]!, heightMm),
      at(v.top[i]!, heightMm),
      side,
    );
  }
  const fill = new BufferGeometry();
  fill.setAttribute("position", new Float32BufferAttribute(pos, 3));
  fill.setAttribute("color", new Float32BufferAttribute(col, 3));

  const lines: number[] = [];
  const seg = (a: number[], b: number[]) => lines.push(...a, ...b);
  for (const i of [0, 2]) {
    const j = i + 1;
    seg(at(v.top[i]!, heightMm), at(v.top[j]!, heightMm));
    if (vis[i]) seg(at(v.bottom[i]!, 0), at(v.bottom[j]!, 0));
  }
  const edges = new BufferGeometry();
  edges.setAttribute("position", new Float32BufferAttribute(lines, 3));
  return { fill, edges };
}
