// 앱 전체가 함께 쓰는 상태. 모듈은 이 store의 값과 액션만으로 서로 연결된다. 이 파일은 헤드만 고친다.
import { create } from 'zustand';
import { rectCorners, roomBounds } from '../contracts/room';
import type {
  AreaLabel,
  DisplayUnit,
  DragPreview,
  FurnitureItem,
  InteriorWall,
  Mm,
  Opening,
  PointMm,
  Project,
  StructureTarget,
  ViewMode,
} from '../contracts/types';

/** 고를 수 있는 구조물: 칸막이 벽, 문·창문(개구부), 구역 이름표 */
export type StructureSelection = StructureTarget | null;
/** 'furniture': 가구 배치(기본). 'structure': 벽·문·이름표 편집(빈 곳을 끌면 벽을 그린다) */
export type EditMode = 'furniture' | 'structure';

export const DEFAULT_WALL_THICKNESS: Mm = 100;
export const DEFAULT_DOOR = { width: 900, height: 2100, sill: 0 } as const;
export const DEFAULT_WINDOW = { width: 1200, height: 1200, sill: 900 } as const;

export interface NewWallInput {
  a: PointMm;
  b: PointMm;
  thickness?: Mm;
}
export type NewOpeningInput = Pick<Opening, 'type' | 'wall' | 'offset'> & Partial<Omit<Opening, 'id' | 'type' | 'wall' | 'offset'>>;

export interface RoomSizeInput {
  width: Mm;
  depth: Mm;
  ceilingHeight: Mm;
}

export type NewFurnitureInput = Pick<FurnitureItem, 'name' | 'w' | 'd' | 'h'> &
  Partial<Pick<FurnitureItem, 'x' | 'z' | 'rotationDeg' | 'elevation' | 'color' | 'kind'>>;

export type FurniturePatch = Partial<Omit<FurnitureItem, 'id'>>;

export interface ProjectState {
  project: Project;
  selectedItemId: string | null;
  viewMode: ViewMode;
  /** 끄는 동안의 임시 위치. 저장되지 않는다. */
  dragPreview: DragPreview | null;

  setDisplayUnit(unit: DisplayUnit): void;
  /** 직사각형 방의 크기를 정한다. 저장은 corners(다각형)로 한다. */
  setRoomSize(size: RoomSizeInput): void;
  /** 가구를 추가하고 새 id를 돌려준다. 위치를 주지 않으면 방 가운데에 놓는다. */
  addItem(input: NewFurnitureInput): string;
  updateItem(id: string, patch: FurniturePatch): void;
  removeItem(id: string): void;
  selectItem(id: string | null): void;

  /**
   * 아직 확정하지 않은 가구(기본 가구 버튼으로 고른 미리보기, 2026-11-17 사용자 요청).
   * 프로젝트에 들어 있지 않다: 저장·되돌리기·겹침 대상 목록에 없다. ✓(commitDraft)로 확정하거나 ✗(cancelDraft)로 버린다.
   * 미리보기가 있는 동안 selectedItemId는 null이다.
   */
  draft: FurnitureItem | null;
  /** 미리보기를 새로 만든다(이미 있으면 바꾼다). 선택은 풀린다. 만든 미리보기의 id를 돌려준다. */
  startDraft(input: NewFurnitureInput): string;
  /** 미리보기의 위치·회전·치수·이름·색·종류를 고친다. 기록하지 않는다. */
  updateDraft(patch: Partial<Omit<FurnitureItem, 'id'>>): void;
  /** 미리보기를 프로젝트에 넣는다(되돌리기 한 단계). 넣은 가구가 선택된다. 넣은 id, 미리보기가 없으면 null. */
  commitDraft(): string | null;
  cancelDraft(): void;
  setViewMode(mode: ViewMode): void;
  setDragPreview(preview: DragPreview | null): void;
  /** 불러오기용. 프로젝트 전체를 바꾸고 선택과 끌기 상태를 지운다. */
  replaceProject(project: Project): void;

  // ---- 벽·문·이름표 (2026-11-17 사용자 요청) ----
  editMode: EditMode;
  setEditMode(mode: EditMode): void;
  /** 고른 구조물. 가구 선택·미리보기와 함께 있을 수 없다(하나를 고르면 다른 쪽이 풀린다). */
  selectedStructure: StructureSelection;
  selectStructure(sel: StructureSelection): void;
  /** 칸막이 벽을 넣는다. 가로·세로가 아니면 긴 쪽 축에 맞춰 곧게 편다. 길이가 0이면 넣지 않고 null. 넣은 벽이 선택된다. */
  addWall(input: NewWallInput): string | null;
  updateWall(id: string, patch: Partial<Omit<InteriorWall, 'id'>>): void;
  /** 벽을 지우면 그 벽에 붙은 문·창문도 지운다(되돌리기 한 단계). */
  removeWall(id: string): void;
  addOpening(input: NewOpeningInput): string;
  updateOpening(id: string, patch: Partial<Omit<Opening, 'id'>>): void;
  removeOpening(id: string): void;
  addLabel(input: { name: string; at: PointMm }): string;
  updateLabel(id: string, patch: Partial<Omit<AreaLabel, 'id'>>): void;
  removeLabel(id: string): void;
  /** 그리는 중인 벽(아직 넣지 않음). 장면이 점선으로 그린다. 기록하지 않는다. */
  wallPreview: { a: PointMm; b: PointMm } | null;
  setWallPreview(p: { a: PointMm; b: PointMm } | null): void;

  /** 되돌리기용 이전 상태들(가장 최근이 끝). 표시 단위·선택·뷰·끌기 미리보기는 기록하지 않는다. */
  past: Project[];
  future: Project[];
  undo(): void;
  redo(): void;
}

/** 되돌리기 기록의 최대 개수 */
export const HISTORY_LIMIT = 100;
/** 같은 가구의 위치만 바뀌는 연속 변경(방향키 반복 등)을 한 단계로 묶는 시간(ms) */
const MERGE_WINDOW_MS = 1000;
let lastCommit: { key: string; at: number } | null = null;

/** 프로젝트를 바꾸며 이전 상태를 기록한다. mergeKey가 직전과 같고 시간이 짧으면 새 단계를 만들지 않는다. */
function commit(s: ProjectState, next: Project, mergeKey: string | null = null): Pick<ProjectState, 'project' | 'past' | 'future'> {
  const now = Date.now();
  const merge = mergeKey !== null && lastCommit !== null && lastCommit.key === mergeKey && now - lastCommit.at < MERGE_WINDOW_MS;
  lastCommit = mergeKey === null ? null : { key: mergeKey, at: now };
  if (merge) return { project: next, past: s.past, future: [] };
  return { project: next, past: [...s.past, s.project].slice(-HISTORY_LIMIT), future: [] };
}

export const DEFAULT_COLORS = ['#7aa2d6', '#e0a458', '#8fbf8f', '#c98bb9', '#d97c6c', '#9c9ad6'];

export function createDefaultProject(): Project {
  return {
    version: 1,
    displayUnit: 'mm',
    room: {
      ceilingHeight: 2400,
      corners: rectCorners(3600, 3000),
      openings: [],
      walls: [],
      labels: [],
      photos: [],
    },
    items: [],
  };
}

/** 길이를 정수 mm로 맞춘다. 저장되는 모든 길이는 이 함수를 거친다. */
function toMm(value: number): Mm {
  return Math.round(value);
}

/** 회전을 0 이상 360 미만의 정수 도로 맞춘다. */
function normalizeDeg(value: number): number {
  return ((Math.round(value) % 360) + 360) % 360;
}

function newId(): string {
  return crypto.randomUUID();
}

function normalizeItem(item: FurnitureItem): FurnitureItem {
  return {
    ...item,
    w: toMm(item.w),
    d: toMm(item.d),
    h: toMm(item.h),
    x: toMm(item.x),
    z: toMm(item.z),
    elevation: toMm(item.elevation),
    rotationDeg: normalizeDeg(item.rotationDeg),
  };
}

export const useProjectStore = create<ProjectState>()((set, get) => ({
  project: createDefaultProject(),
  selectedItemId: null,
  viewMode: '2d',
  dragPreview: null,
  draft: null,
  editMode: 'furniture',
  selectedStructure: null,
  wallPreview: null,
  past: [],
  future: [],

  setDisplayUnit: (unit) => set((s) => ({ project: { ...s.project, displayUnit: unit } })),

  setRoomSize: ({ width, depth, ceilingHeight }) =>
    set((s) =>
      commit(s, {
        ...s.project,
        room: {
          ...s.project.room,
          ceilingHeight: toMm(ceilingHeight),
          corners: rectCorners(toMm(width), toMm(depth)),
        },
      }),
    ),

  addItem: (input) => {
    const id = newId();
    const { project } = get();
    const xs = project.room.corners.map((c) => c.x);
    const zs = project.room.corners.map((c) => c.z);
    const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
    const centerZ = (Math.min(...zs) + Math.max(...zs)) / 2;
    const item = normalizeItem({
      id,
      name: input.name,
      w: input.w,
      d: input.d,
      h: input.h,
      x: input.x ?? centerX,
      z: input.z ?? centerZ,
      rotationDeg: input.rotationDeg ?? 0,
      elevation: input.elevation ?? 0,
      color: input.color ?? DEFAULT_COLORS[project.items.length % DEFAULT_COLORS.length],
      ...(input.kind && input.kind !== 'box' ? { kind: input.kind } : {}),
    });
    set((s) => ({ ...commit(s, { ...s.project, items: [...s.project.items, item] }), selectedItemId: id }));
    return id;
  },

  updateItem: (id, patch) =>
    set((s) => {
      const moveOnly = Object.keys(patch).every((k) => k === 'x' || k === 'z');
      return commit(
        s,
        { ...s.project, items: s.project.items.map((it) => (it.id === id ? normalizeItem({ ...it, ...patch, id }) : it)) },
        moveOnly ? `move:${id}` : null,
      );
    }),

  removeItem: (id) =>
    set((s) => ({
      ...commit(s, { ...s.project, items: s.project.items.filter((it) => it.id !== id) }),
      selectedItemId: s.selectedItemId === id ? null : s.selectedItemId,
      dragPreview: s.dragPreview?.itemId === id ? null : s.dragPreview,
    })),

  // 다른 가구를 고르면 확정하지 않은 미리보기는 버린다. 가구를 고르면 구조물 선택은 풀린다.
  selectItem: (id) =>
    set((s) => ({
      selectedItemId: id,
      draft: id !== null ? null : s.draft,
      selectedStructure: id !== null ? null : s.selectedStructure,
    })),

  startDraft: (input) => {
    const id = newId();
    const { project } = get();
    const b = roomBounds(project.room);
    const draft = normalizeItem({
      id,
      name: input.name,
      w: input.w,
      d: input.d,
      h: input.h,
      x: input.x ?? (b.minX + b.maxX) / 2,
      z: input.z ?? (b.minZ + b.maxZ) / 2,
      rotationDeg: input.rotationDeg ?? 0,
      elevation: input.elevation ?? 0,
      color: input.color ?? DEFAULT_COLORS[project.items.length % DEFAULT_COLORS.length],
      ...(input.kind && input.kind !== 'box' ? { kind: input.kind } : {}),
    });
    set({ draft, selectedItemId: null, selectedStructure: null, dragPreview: null });
    return id;
  },

  updateDraft: (patch) =>
    set((s) => (s.draft ? { draft: normalizeItem({ ...s.draft, ...patch, id: s.draft.id }) } : {})),

  commitDraft: () => {
    const d = get().draft;
    if (!d) return null;
    set((s) => ({
      ...commit(s, { ...s.project, items: [...s.project.items, d] }),
      selectedItemId: d.id,
      draft: null,
      dragPreview: null,
    }));
    return d.id;
  },

  cancelDraft: () => set((s) => ({ draft: null, dragPreview: s.dragPreview && s.draft && s.dragPreview.itemId === s.draft.id ? null : s.dragPreview })),

  setEditMode: (mode) => set({ editMode: mode, selectedStructure: null, wallPreview: null, selectedItemId: null, draft: null, dragPreview: null }),
  setWallPreview: (p) => set({ wallPreview: p }),

  selectStructure: (sel) =>
    set((s) => ({
      selectedStructure: sel,
      selectedItemId: sel ? null : s.selectedItemId,
      draft: sel ? null : s.draft,
    })),

  addWall: ({ a, b, thickness }) => {
    const w = straightenWall(a, b);
    if (!w) return null;
    const id = newId();
    const wall: InteriorWall = { id, a: w.a, b: w.b, thickness: toMm(thickness ?? DEFAULT_WALL_THICKNESS) };
    set((s) => ({
      ...commit(s, { ...s.project, room: { ...s.project.room, walls: [...s.project.room.walls, wall] } }),
      selectedStructure: { kind: 'wall', id },
      selectedItemId: null,
      draft: null,
    }));
    return id;
  },

  updateWall: (id, patch) =>
    set((s) => {
      const walls = s.project.room.walls.map((w) => {
        if (w.id !== id) return w;
        const next = { ...w, ...patch, id };
        const st = straightenWall(next.a, next.b);
        return st ? { ...next, a: st.a, b: st.b, thickness: toMm(next.thickness) } : w;
      });
      const moveOnly = Object.keys(patch).every((k) => k === 'a' || k === 'b');
      return commit(s, { ...s.project, room: { ...s.project.room, walls } }, moveOnly ? `wall:${id}` : null);
    }),

  removeWall: (id) =>
    set((s) => ({
      ...commit(s, {
        ...s.project,
        room: {
          ...s.project.room,
          walls: s.project.room.walls.filter((w) => w.id !== id),
          openings: s.project.room.openings.filter((o) => o.wall !== id),
        },
      }),
      selectedStructure: s.selectedStructure && 'id' in s.selectedStructure && s.selectedStructure.id === id ? null : s.selectedStructure,
    })),

  addOpening: (input) => {
    const id = newId();
    const base = input.type === 'window' ? DEFAULT_WINDOW : DEFAULT_DOOR;
    const opening: Opening = {
      id,
      type: input.type,
      wall: input.wall,
      offset: toMm(input.offset),
      width: toMm(input.width ?? base.width),
      height: toMm(input.height ?? base.height),
      sill: toMm(input.sill ?? base.sill),
      ...(input.type === 'door' ? { hinge: input.hinge ?? 'start', swing: input.swing ?? 'normal' } : {}),
    };
    set((s) => ({
      ...commit(s, { ...s.project, room: { ...s.project.room, openings: [...s.project.room.openings, opening] } }),
      selectedStructure: { kind: 'opening', id },
      selectedItemId: null,
      draft: null,
    }));
    return id;
  },

  updateOpening: (id, patch) =>
    set((s) => {
      const openings = s.project.room.openings.map((o) => {
        if (o.id !== id) return o;
        const n = { ...o, ...patch, id };
        return { ...n, offset: toMm(n.offset), width: toMm(n.width), height: toMm(n.height), sill: toMm(n.sill) };
      });
      const moveOnly = Object.keys(patch).every((k) => k === 'offset');
      return commit(s, { ...s.project, room: { ...s.project.room, openings } }, moveOnly ? `opening:${id}` : null);
    }),

  removeOpening: (id) =>
    set((s) => ({
      ...commit(s, { ...s.project, room: { ...s.project.room, openings: s.project.room.openings.filter((o) => o.id !== id) } }),
      selectedStructure: s.selectedStructure && 'id' in s.selectedStructure && s.selectedStructure.id === id ? null : s.selectedStructure,
    })),

  addLabel: ({ name, at }) => {
    const id = newId();
    const label: AreaLabel = { id, name: name.trim() || '구역', at: { x: toMm(at.x), z: toMm(at.z) } };
    set((s) => ({
      ...commit(s, { ...s.project, room: { ...s.project.room, labels: [...s.project.room.labels, label] } }),
      selectedStructure: { kind: 'label', id },
      selectedItemId: null,
      draft: null,
    }));
    return id;
  },

  updateLabel: (id, patch) =>
    set((s) => {
      const labels = s.project.room.labels.map((l) => {
        if (l.id !== id) return l;
        const n = { ...l, ...patch, id };
        return { ...n, name: n.name.trim() || '구역', at: { x: toMm(n.at.x), z: toMm(n.at.z) } };
      });
      const moveOnly = Object.keys(patch).every((k) => k === 'at');
      return commit(s, { ...s.project, room: { ...s.project.room, labels } }, moveOnly ? `label:${id}` : null);
    }),

  removeLabel: (id) =>
    set((s) => ({
      ...commit(s, { ...s.project, room: { ...s.project.room, labels: s.project.room.labels.filter((l) => l.id !== id) } }),
      selectedStructure: s.selectedStructure && 'id' in s.selectedStructure && s.selectedStructure.id === id ? null : s.selectedStructure,
    })),
  setViewMode: (mode) => set({ viewMode: mode }),
  setDragPreview: (preview) => set({ dragPreview: preview }),

  replaceProject: (project) =>
    set((s) => ({
      ...commit(s, { ...project, items: project.items.map(normalizeItem) }),
      selectedItemId: null,
      dragPreview: null,
      draft: null,
    })),

  undo: () =>
    set((s) => {
      const prev = s.past[s.past.length - 1];
      if (!prev) return {};
      lastCommit = null;
      return { project: prev, past: s.past.slice(0, -1), future: [s.project, ...s.future], ...clearMissing(s, prev) };
    }),

  redo: () =>
    set((s) => {
      const next = s.future[0];
      if (!next) return {};
      lastCommit = null;
      return { project: next, past: [...s.past, s.project], future: s.future.slice(1), ...clearMissing(s, next) };
    }),
}));

/** 두 점을 가로 또는 세로 벽으로 곧게 편다(긴 쪽 축을 따른다). 정수 mm. 길이가 0이면 null. */
export function straightenWall(a: PointMm, b: PointMm): { a: PointMm; b: PointMm } | null {
  const ax = toMm(a.x);
  const az = toMm(a.z);
  const bx = toMm(b.x);
  const bz = toMm(b.z);
  const horizontal = Math.abs(bx - ax) >= Math.abs(bz - az);
  const end = horizontal ? { x: bx, z: az } : { x: ax, z: bz };
  if (end.x === ax && end.z === az) return null;
  return { a: { x: ax, z: az }, b: end };
}

/** 되돌린 상태에 없는 가구를 가리키는 선택·끌기 상태를 지운다. */
function clearMissing(s: ProjectState, p: Project): Partial<ProjectState> {
  const has = (id: string | null | undefined) => id != null && p.items.some((it) => it.id === id);
  const sel = s.selectedStructure;
  const structureExists =
    sel !== null &&
    (sel.kind === 'outerWall'
      ? sel.index < p.room.corners.length
      : sel.kind === 'wall'
        ? p.room.walls.some((w) => w.id === sel.id)
        : sel.kind === 'opening'
          ? p.room.openings.some((o) => o.id === sel.id)
          : p.room.labels.some((l) => l.id === sel.id));
  return {
    selectedItemId: has(s.selectedItemId) ? s.selectedItemId : null,
    selectedStructure: structureExists ? sel : null,
    dragPreview: null,
  };
}
