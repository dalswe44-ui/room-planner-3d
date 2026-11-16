// 앱 전체가 함께 쓰는 상태. 모듈은 이 store의 값과 액션만으로 서로 연결된다. 이 파일은 헤드만 고친다.
import { create } from 'zustand';
import { rectCorners } from '../contracts/room';
import type {
  DisplayUnit,
  DragPreview,
  FurnitureItem,
  Mm,
  Project,
  ViewMode,
} from '../contracts/types';

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
  setViewMode(mode: ViewMode): void;
  setDragPreview(preview: DragPreview | null): void;
  /** 불러오기용. 프로젝트 전체를 바꾸고 선택과 끌기 상태를 지운다. */
  replaceProject(project: Project): void;
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

  setDisplayUnit: (unit) => set((s) => ({ project: { ...s.project, displayUnit: unit } })),

  setRoomSize: ({ width, depth, ceilingHeight }) =>
    set((s) => ({
      project: {
        ...s.project,
        room: {
          ...s.project.room,
          ceilingHeight: toMm(ceilingHeight),
          corners: rectCorners(toMm(width), toMm(depth)),
        },
      },
    })),

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
    set((s) => ({ project: { ...s.project, items: [...s.project.items, item] }, selectedItemId: id }));
    return id;
  },

  updateItem: (id, patch) =>
    set((s) => ({
      project: {
        ...s.project,
        items: s.project.items.map((it) => (it.id === id ? normalizeItem({ ...it, ...patch, id }) : it)),
      },
    })),

  removeItem: (id) =>
    set((s) => ({
      project: { ...s.project, items: s.project.items.filter((it) => it.id !== id) },
      selectedItemId: s.selectedItemId === id ? null : s.selectedItemId,
      dragPreview: s.dragPreview?.itemId === id ? null : s.dragPreview,
    })),

  selectItem: (id) => set({ selectedItemId: id }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setDragPreview: (preview) => set({ dragPreview: preview }),

  replaceProject: (project) =>
    set({
      project: { ...project, items: project.items.map(normalizeItem) },
      selectedItemId: null,
      dragPreview: null,
    }),
}));
