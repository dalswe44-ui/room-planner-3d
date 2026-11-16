// AI가 돌려준 배치도 JSON을 검사하고 Project로 바꾸는 순수 함수. 숫자 → mm 변환은 lengthToMm만 쓴다.
import type { LayoutImport } from '../contracts/layoutImport';
import { guessKindFromName } from '../contracts/furniturePresets';
import { rectCorners } from '../contracts/room';
import type { DisplayUnit, FurnitureItem, Mm, Project } from '../contracts/types';
import { lengthToMm } from '../contracts/units';
import { DEFAULT_COLORS } from '../store/projectStore';

export const ROOM_SIZE_MIN: Mm = 500;
export const ROOM_SIZE_MAX: Mm = 20000;
export const CEILING_MIN: Mm = 1800;
export const CEILING_MAX: Mm = 5000;
export const ITEM_SIZE_MIN: Mm = 10;
export const ITEM_SIZE_MAX: Mm = 10000;
export const DEFAULT_ITEM_HEIGHT: Mm = 600;
export const DEFAULT_ITEM_NAME = '가구';

/** 가구 색 순환은 store와 같은 팔레트를 쓴다. */
const COLORS = DEFAULT_COLORS;

export interface ParseBase {
  /** 현재 표시 단위. 결과 project에 그대로 유지한다. */
  displayUnit: DisplayUnit;
  /** 현재 천장 높이. JSON의 height가 null이면 이 값을 쓴다. */
  ceilingHeight: Mm;
}

export type ParseResult =
  | { ok: true; project: Project; warnings: string[]; notes: string[] }
  | { ok: false; errors: string[] };

const UNITS: readonly string[] = ['mm', 'cm', 'm'];
const ROTATIONS: readonly number[] = [0, 90, 180, 270];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** 첫 '{'부터 마지막 '}'까지. AI가 붙인 코드 블록 표시나 설명 문장을 버린다. */
function extractJson(text: string): string | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

export function parseLayoutImport(text: string, base: ParseBase): ParseResult {
  if (text.trim() === '') return { ok: false, errors: ['붙여 넣은 내용이 없습니다.'] };
  const json = extractJson(text);
  if (json === null) return { ok: false, errors: ['JSON을 찾을 수 없습니다. { 로 시작해 } 로 끝나야 합니다.'] };
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, errors: ['JSON 형식이 깨져 읽을 수 없습니다. 쉼표나 따옴표가 빠졌는지 확인하세요.'] };
  }
  if (!isRecord(raw)) return { ok: false, errors: ['JSON 최상위가 객체가 아닙니다.'] };

  const errors: string[] = [];
  const warnings: string[] = [];
  if (raw.format !== 'room-layout') errors.push('format이 "room-layout"이 아닙니다.');
  if (raw.version !== 1) errors.push('version이 1이 아닙니다.');
  const unit = raw.unit;
  if (typeof unit !== 'string' || !UNITS.includes(unit)) errors.push('unit은 "mm", "cm", "m" 중 하나여야 합니다.');
  if (errors.length > 0) return { ok: false, errors };
  const u = unit as LayoutImport['unit'];

  // 숫자를 mm로. 숫자가 아니면 null.
  const toMm = (v: unknown): Mm | null => (typeof v === 'number' ? lengthToMm(v, u) : null);
  const rangeMsg = (label: string, min: Mm, max: Mm) => `${label}은(는) ${min} ~ ${max} mm 범위여야 합니다.`;

  // 방
  const room = isRecord(raw.room) ? raw.room : null;
  let width: Mm = 0;
  let depth: Mm = 0;
  let ceilingHeight = base.ceilingHeight;
  if (room === null) {
    errors.push('room이 없습니다.');
  } else {
    const w = toMm(room.width);
    const d = toMm(room.depth);
    if (w === null || w < ROOM_SIZE_MIN || w > ROOM_SIZE_MAX) {
      errors.push(`room.width: ${rangeMsg('값', ROOM_SIZE_MIN, ROOM_SIZE_MAX)} 단위(${u})를 확인하세요.`);
    } else width = w;
    if (d === null || d < ROOM_SIZE_MIN || d > ROOM_SIZE_MAX) {
      errors.push(`room.depth: ${rangeMsg('값', ROOM_SIZE_MIN, ROOM_SIZE_MAX)} 단위(${u})를 확인하세요.`);
    } else depth = d;
    if (room.height === null || room.height === undefined) {
      warnings.push('천장 높이가 없어 현재 값을 유지합니다.');
    } else {
      const h = toMm(room.height);
      if (h === null || h < CEILING_MIN || h > CEILING_MAX) {
        errors.push(`room.height: ${rangeMsg('값', CEILING_MIN, CEILING_MAX)} 단위(${u})를 확인하세요.`);
      } else ceilingHeight = h;
    }
  }

  // 가구
  const items: FurnitureItem[] = [];
  if (!Array.isArray(raw.items)) {
    errors.push('items가 배열이 아닙니다.');
  } else {
    raw.items.forEach((entry: unknown, i: number) => {
      const tag = `${i + 1}번 가구`;
      if (!isRecord(entry)) {
        errors.push(`${tag}: 객체가 아닙니다.`);
        return;
      }
      const name = typeof entry.name === 'string' && entry.name.trim() !== '' ? entry.name.trim() : DEFAULT_ITEM_NAME;
      const label = `${tag}(${name})`;
      const w = toMm(entry.w);
      const d = toMm(entry.d);
      let ok = true;
      if (w === null || w < ITEM_SIZE_MIN || w > ITEM_SIZE_MAX) {
        errors.push(`${label}.w: ${rangeMsg('값', ITEM_SIZE_MIN, ITEM_SIZE_MAX)} 단위(${u})를 확인하세요.`);
        ok = false;
      }
      if (d === null || d < ITEM_SIZE_MIN || d > ITEM_SIZE_MAX) {
        errors.push(`${label}.d: ${rangeMsg('값', ITEM_SIZE_MIN, ITEM_SIZE_MAX)} 단위(${u})를 확인하세요.`);
        ok = false;
      }
      let h: Mm = DEFAULT_ITEM_HEIGHT;
      if (entry.h === null || entry.h === undefined) {
        warnings.push(`${label}: 높이가 없어 ${DEFAULT_ITEM_HEIGHT} mm로 둠`);
      } else {
        const hv = toMm(entry.h);
        if (hv === null || hv < ITEM_SIZE_MIN || hv > ITEM_SIZE_MAX) {
          errors.push(`${label}.h: ${rangeMsg('값', ITEM_SIZE_MIN, ITEM_SIZE_MAX)} 단위(${u})를 확인하세요.`);
          ok = false;
        } else h = hv;
      }
      const rot = entry.rotationDeg === null || entry.rotationDeg === undefined ? 0 : entry.rotationDeg;
      if (typeof rot !== 'number' || !ROTATIONS.includes(rot)) {
        errors.push(`${label}.rotationDeg: 0, 90, 180, 270 중 하나여야 합니다.`);
        ok = false;
      }
      const left = entry.left === null || entry.left === undefined ? null : toMm(entry.left);
      const top = entry.top === null || entry.top === undefined ? null : toMm(entry.top);
      const hasPos = entry.left !== null && entry.left !== undefined && entry.top !== null && entry.top !== undefined;
      if (hasPos && (left === null || top === null)) {
        errors.push(`${label}: left, top은 숫자여야 합니다.`);
        ok = false;
      }
      if (!ok || w === null || d === null) return;

      const turned = rot === 90 || rot === 270;
      const fw = turned ? d : w;
      const fd = turned ? w : d;
      let x: Mm;
      let z: Mm;
      if (hasPos && left !== null && top !== null) {
        x = Math.round(left + fw / 2);
        z = Math.round(top + fd / 2);
      } else {
        x = Math.round(width / 2);
        z = Math.round(depth / 2);
        warnings.push(`${label}: 위치가 없어 가운데에 둠`);
      }
      if (width > 0 && depth > 0 && (x - fw / 2 < 0 || z - fd / 2 < 0 || x + fw / 2 > width || z + fd / 2 > depth)) {
        warnings.push(`${label}: 방 밖으로 나갑니다.`);
      }
      const kind = guessKindFromName(name);
      items.push({
        id: crypto.randomUUID(),
        name,
        ...(kind !== 'box' ? { kind } : {}),
        w,
        d,
        h,
        x,
        z,
        rotationDeg: rot as number,
        elevation: 0,
        color: COLORS[items.length % COLORS.length],
      });
    });
  }

  if (errors.length > 0) return { ok: false, errors };
  const notes = Array.isArray(raw.notes) ? raw.notes.filter((n): n is string => typeof n === 'string') : [];
  return {
    ok: true,
    warnings,
    notes,
    project: {
      version: 1,
      displayUnit: base.displayUnit,
      room: { ceilingHeight, corners: rectCorners(width, depth), openings: [], photos: [] },
      items,
    },
  };
}
