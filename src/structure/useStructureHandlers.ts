// 구조 편집 모드의 포인터 처리: 칸막이 벽 그리기·이동, 문·창문 끌기, 이름표 끌기, 선택.
// 기하는 contracts/structure.ts의 함수만 쓴다. React 없이 테스트하도록 store 접근은 getState로 받는다.
import { useMemo } from 'react';
import { offsetAlongWall, wallSegment } from '../contracts/structure';
import type { Mm, PointMm, StructureHandlers, StructureTarget } from '../contracts/types';
import { straightenWall, useProjectStore, type ProjectState } from '../store/projectStore';

/** 칸막이 벽을 넣는 최소 길이(mm). 이보다 짧게 끌면 넣지 않는다 */
export const MIN_WALL_LENGTH: Mm = 100;
/** 끝점·이동 격자(mm) */
export const GRID_MM: Mm = 10;
/** 끝점 맞춤 거리: 화면 px, mmPerPx를 모를 때는 mm */
export const SNAP_PX = 12;
export const SNAP_FALLBACK_MM: Mm = 20;

const grid = (v: number): Mm => Math.round(v / GRID_MM) * GRID_MM + 0;

/** 후보 중 v에서 tol 안이고 가장 가까운 값. 없으면 null */
function nearest(v: number, candidates: number[], tol: number): number | null {
  let best: number | null = null;
  for (const c of candidates) {
    if (Math.abs(c - v) <= tol && (best === null || Math.abs(c - v) < Math.abs(best - v))) best = c;
  }
  return best;
}

/** 한 축의 값을 (1) 바깥 벽 면, (2) 칸막이 벽 중심선·끝점, (3) 격자 순으로 맞춘다. */
function snapAxis(v: number, outer: number[], inner: number[], tol: number): number {
  return nearest(v, outer, tol) ?? nearest(v, inner, tol) ?? grid(v);
}

export function snapPoint(state: ProjectState, p: PointMm, mmPerPx?: number): PointMm {
  const tol = mmPerPx !== undefined ? SNAP_PX * mmPerPx : SNAP_FALLBACK_MM;
  const { corners, walls } = state.project.room;
  return {
    x: snapAxis(p.x, corners.map((c) => c.x), walls.flatMap((w) => [w.a.x, w.b.x]), tol),
    z: snapAxis(p.z, corners.map((c) => c.z), walls.flatMap((w) => [w.a.z, w.b.z]), tol),
  };
}

type Drag =
  | { kind: 'draw'; a: PointMm; end: { a: PointMm; b: PointMm } | null }
  | { kind: 'wall'; id: string; down: PointMm; a: PointMm; b: PointMm; applied: number }
  | { kind: 'opening'; id: string; down: PointMm; offset: Mm; applied: Mm }
  | { kind: 'label'; id: string; down: PointMm; at: PointMm; applied: PointMm };

export function createStructureHandlers(getState: () => ProjectState): StructureHandlers {
  let drag: Drag | null = null;

  const onTargetPointerDown = (target: StructureTarget, floor: PointMm) => {
    const s = getState();
    s.selectStructure(target);
    const room = s.project.room;
    if (target.kind === 'wall') {
      const w = room.walls.find((x) => x.id === target.id);
      if (!w) return;
      const horizontal = w.a.z === w.b.z;
      drag = { kind: 'wall', id: w.id, down: floor, a: w.a, b: w.b, applied: horizontal ? w.a.z : w.a.x };
    } else if (target.kind === 'opening') {
      const o = room.openings.find((x) => x.id === target.id);
      if (o) drag = { kind: 'opening', id: o.id, down: floor, offset: o.offset, applied: o.offset };
    } else if (target.kind === 'label') {
      const l = room.labels.find((x) => x.id === target.id);
      if (l) drag = { kind: 'label', id: l.id, down: floor, at: l.at, applied: l.at };
    } else {
      // 바깥 벽: 누르면 선택, 그대로 끌면 벽 안쪽 면에서 칸막이를 그리기 시작한다(D-T037-01).
      // 벽 두께 위를 눌렀을 수 있으므로 방 범위 안으로 당긴 뒤 맞춘다.
      const xs = room.corners.map((c) => c.x);
      const zs = room.corners.map((c) => c.z);
      const inside = {
        x: Math.min(Math.max(floor.x, Math.min(...xs)), Math.max(...xs)),
        z: Math.min(Math.max(floor.z, Math.min(...zs)), Math.max(...zs)),
      };
      drag = { kind: 'draw', a: snapPoint(s, inside), end: null };
    }
  };

  const onBackgroundPointerDown = (floor: PointMm) => {
    drag = { kind: 'draw', a: snapPoint(getState(), floor), end: null };
  };

  const onPointerMove = (floor: PointMm, mmPerPx?: number) => {
    if (!drag) return;
    const s = getState();
    if (drag.kind === 'draw') {
      const w = straightenWall(drag.a, snapPoint(s, floor, mmPerPx));
      drag.end = w;
      s.setWallPreview(w);
    } else if (drag.kind === 'wall') {
      // 가로 벽은 z만, 세로 벽은 x만 움직인다(길이 유지)
      const horizontal = drag.a.z === drag.b.z;
      const base = horizontal ? drag.a.z : drag.a.x;
      const delta = horizontal ? floor.z - drag.down.z : floor.x - drag.down.x;
      const v = grid(base + delta);
      if (v === drag.applied) return;
      drag.applied = v;
      s.updateWall(drag.id, {
        a: horizontal ? { x: drag.a.x, z: v } : { x: v, z: drag.a.z },
        b: horizontal ? { x: drag.b.x, z: v } : { x: v, z: drag.b.z },
      });
    } else if (drag.kind === 'opening') {
      const id = drag.id;
      const o = s.project.room.openings.find((x) => x.id === id);
      if (!o) return;
      const seg = wallSegment(s.project.room, o.wall);
      if (!seg) return;
      const shift = offsetAlongWall(seg, floor, o.width) - offsetAlongWall(seg, drag.down, o.width);
      const max = Math.max(0, seg.length - o.width);
      const v = Math.max(0, Math.min(max, grid(drag.offset + shift)));
      if (v === drag.applied) return;
      drag.applied = v;
      s.updateOpening(o.id, { offset: v });
    } else {
      const at = { x: grid(drag.at.x + floor.x - drag.down.x), z: grid(drag.at.z + floor.z - drag.down.z) };
      if (at.x === drag.applied.x && at.z === drag.applied.z) return;
      drag.applied = at;
      s.updateLabel(drag.id, { at });
    }
  };

  const onPointerUp = () => {
    const d = drag;
    drag = null;
    if (d?.kind !== 'draw') return;
    const s = getState();
    s.setWallPreview(null);
    if (!d.end) return;
    const len = Math.abs(d.end.b.x - d.end.a.x) + Math.abs(d.end.b.z - d.end.a.z);
    if (len >= MIN_WALL_LENGTH) s.addWall(d.end);
  };

  const onBackgroundTap = () => {
    getState().selectStructure(null);
  };

  return { onTargetPointerDown, onBackgroundPointerDown, onPointerMove, onPointerUp, onBackgroundTap };
}

export function useStructureHandlers(): StructureHandlers {
  return useMemo(() => createStructureHandlers(useProjectStore.getState), []);
}
