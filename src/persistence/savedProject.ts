// localStorage에 저장하는 형식과, 불러올 때 경계에서 하는 검사.
// 모양·범위·단위가 맞지 않으면 null을 돌려주고, 호출한 쪽은 기본 방으로 시작한다.
import {
  CEILING_MAX,
  CEILING_MIN,
  ITEM_SIZE_MAX,
  ITEM_SIZE_MIN,
  ROOM_SIDE_MAX,
  ROOM_SIDE_MIN,
} from '../contracts/limits';
import { roomBounds } from '../contracts/room';
import type { FurnitureItem, FurnitureKind, Opening, PointMm, Project } from '../contracts/types';

export const STORAGE_KEY = 'room-planner-3d/project';
export const SAVE_FORMAT = 'room-planner-project';
export const SAVE_VERSION = 1;

export interface SavedProject {
  format: typeof SAVE_FORMAT;
  version: typeof SAVE_VERSION;
  project: Project;
}

export function serializeProject(project: Project): string {
  const saved: SavedProject = { format: SAVE_FORMAT, version: SAVE_VERSION, project };
  return JSON.stringify(saved);
}

const KINDS: readonly string[] = ['box', 'desk', 'chair', 'bed', 'sofa', 'wardrobe', 'table', 'shelf'];
const UNITS: readonly string[] = ['mm', 'cm', 'm'];
const OPENING_TYPES: readonly string[] = ['door', 'window', 'opening'];

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const inRange = (v: unknown, min: number, max: number): v is number => isInt(v) && v >= min && v <= max;

function parseCorner(v: unknown): PointMm | null {
  if (!isRec(v) || !isInt(v.x) || !isInt(v.z)) return null;
  return { x: v.x, z: v.z };
}

function parseOpening(v: unknown): Opening | null {
  if (!isRec(v)) return null;
  if (typeof v.id !== 'string' || typeof v.type !== 'string' || !OPENING_TYPES.includes(v.type)) return null;
  if (!isInt(v.wall) || !isInt(v.offset) || !isInt(v.width) || !isInt(v.height) || !isInt(v.sill)) return null;
  return { id: v.id, type: v.type as Opening['type'], wall: v.wall, offset: v.offset, width: v.width, height: v.height, sill: v.sill };
}

function parseItem(v: unknown): FurnitureItem | null {
  if (!isRec(v)) return null;
  if (typeof v.id !== 'string' || typeof v.name !== 'string' || typeof v.color !== 'string') return null;
  if (!inRange(v.w, ITEM_SIZE_MIN, ITEM_SIZE_MAX) || !inRange(v.d, ITEM_SIZE_MIN, ITEM_SIZE_MAX) || !inRange(v.h, ITEM_SIZE_MIN, ITEM_SIZE_MAX)) {
    return null;
  }
  if (!isInt(v.x) || !isInt(v.z) || !isInt(v.rotationDeg) || !isInt(v.elevation)) return null;
  if (v.kind !== undefined && (typeof v.kind !== 'string' || !KINDS.includes(v.kind))) return null;
  return {
    id: v.id,
    name: v.name,
    ...(v.kind !== undefined ? { kind: v.kind as FurnitureKind } : {}),
    w: v.w,
    d: v.d,
    h: v.h,
    x: v.x,
    z: v.z,
    rotationDeg: v.rotationDeg,
    elevation: v.elevation,
    color: v.color,
  };
}

/** 모든 원소가 parse를 통과해야 배열을 돌려준다. 하나라도 틀리면 null. */
function parseAll<T>(v: unknown, parse: (x: unknown) => T | null): T[] | null {
  if (!Array.isArray(v)) return null;
  const out: T[] = [];
  for (const entry of v) {
    const p = parse(entry);
    if (p === null) return null;
    out.push(p);
  }
  return out;
}

/** 저장된 글자를 Project로. 형식·범위가 맞지 않으면 null. 길이는 정수 mm여야 한다(단위가 섞인 값은 범위에서 걸린다). */
export function parseSavedProject(text: string): Project | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRec(raw) || raw.format !== SAVE_FORMAT || raw.version !== SAVE_VERSION) return null;
  const p = raw.project;
  if (!isRec(p) || p.version !== 1) return null;
  if (typeof p.displayUnit !== 'string' || !UNITS.includes(p.displayUnit)) return null;
  const room = p.room;
  if (!isRec(room) || !inRange(room.ceilingHeight, CEILING_MIN, CEILING_MAX)) return null;
  const corners = parseAll(room.corners, parseCorner);
  if (corners === null || corners.length < 3) return null;
  const { width, depth, minX, minZ } = roomBounds({ corners });
  // 원점은 방 바닥의 한 모서리이므로 꼭짓점은 음수가 될 수 없다.
  if (minX < 0 || minZ < 0) return null;
  if (!inRange(width, ROOM_SIDE_MIN, ROOM_SIDE_MAX) || !inRange(depth, ROOM_SIDE_MIN, ROOM_SIDE_MAX)) return null;
  const openings = parseAll(room.openings, parseOpening);
  if (openings === null) return null;
  const items = parseAll(p.items, parseItem);
  if (items === null) return null;
  return {
    version: 1,
    displayUnit: p.displayUnit as Project['displayUnit'],
    room: { ceilingHeight: room.ceilingHeight, corners, openings, walls: [], labels: [], photos: [] }, // 칸막이 벽·이름표 저장은 T-034에서
    items,
  };
}
