// AI가 돌려준 배치도 JSON을 검사하고 Project로 바꾸는 순수 함수. 숫자 → mm 변환은 lengthToMm만 쓴다.
import type { LayoutImport, LayoutUnit } from '../contracts/layoutImport';
import { guessKindFromName, KIND_LABEL, presetFor } from '../contracts/furniturePresets';
import {
  CEILING_MAX,
  CEILING_MIN,
  DEFAULT_ITEM_NAME,
  ITEM_SIZE_MAX,
  ITEM_SIZE_MIN,
  ROOM_SIDE_MAX,
  ROOM_SIDE_MIN,
} from '../contracts/limits';
import { rectCorners } from '../contracts/room';
import type { DisplayUnit, FurnitureItem, Mm, Project } from '../contracts/types';
import { lengthToMm } from '../contracts/units';
import { DEFAULT_COLORS } from '../store/projectStore';

/** 높이가 없고 종류 기본 높이도 없을 때(상자) 쓰는 높이 */
const BOX_DEFAULT_HEIGHT: Mm = 600;
/** 가로·세로가 적혀 있지 않고 종류 기본 크기도 없을 때(상자) 쓰는 길이 */
const BOX_DEFAULT_SIZE: Mm = 600;

export interface ParseBase {
  /** 현재 표시 단위. 결과 project에 그대로 유지한다. */
  displayUnit: DisplayUnit;
  /** 현재 천장 높이. JSON의 height가 null이면 이 값을 쓴다. */
  ceilingHeight: Mm;
}

export type ParseResult =
  | { ok: true; project: Project; warnings: string[]; notes: string[]; /** JSON의 길이 단위. 미리보기가 이 단위로 보여 준다. */ unit: LayoutUnit }
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
    if (w === null || w < ROOM_SIDE_MIN || w > ROOM_SIDE_MAX) {
      errors.push(`room.width: ${rangeMsg('값', ROOM_SIDE_MIN, ROOM_SIDE_MAX)} 단위(${u})를 확인하세요.`);
    } else width = w;
    if (d === null || d < ROOM_SIDE_MIN || d > ROOM_SIDE_MAX) {
      errors.push(`room.depth: ${rangeMsg('값', ROOM_SIDE_MIN, ROOM_SIDE_MAX)} 단위(${u})를 확인하세요.`);
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
      const kind = guessKindFromName(name);
      const preset = presetFor(kind);
      // 그림에 적혀 있지 않은 가로·세로(null)는 오류가 아니다. 기본 크기로 두고 알린다. 사용자가 적용 뒤 고친다.
      const missing = (v: unknown) => v === null || v === undefined;
      const sizeOf = (v: unknown, key: 'w' | 'd', word: string): Mm | null => {
        if (!missing(v)) return toMm(v);
        const fallback = preset?.[key] ?? BOX_DEFAULT_SIZE;
        const why = preset ? `${KIND_LABEL[kind]} 기본 크기` : '기본값';
        warnings.push(`${label}: ${word} 길이가 적혀 있지 않아 ${why} ${fallback} mm로 둠. 적용한 뒤 가구에서 고쳐 주세요.`);
        return fallback;
      };
      const w = sizeOf(entry.w, 'w', '가로');
      const d = sizeOf(entry.d, 'd', '세로');
      let ok = true;
      if (w === null || w < ITEM_SIZE_MIN || w > ITEM_SIZE_MAX) {
        errors.push(`${label}.w: ${rangeMsg('값', ITEM_SIZE_MIN, ITEM_SIZE_MAX)} 단위(${u})를 확인하세요.`);
        ok = false;
      }
      if (d === null || d < ITEM_SIZE_MIN || d > ITEM_SIZE_MAX) {
        errors.push(`${label}.d: ${rangeMsg('값', ITEM_SIZE_MIN, ITEM_SIZE_MAX)} 단위(${u})를 확인하세요.`);
        ok = false;
      }
      let h: Mm = preset?.h ?? BOX_DEFAULT_HEIGHT;
      if (entry.h === null || entry.h === undefined) {
        const why = kind === 'box' ? '기본값' : `${KIND_LABEL[kind]} 기본 높이`;
        warnings.push(`${label}: 높이가 없어 ${why} ${h} mm로 둠`);
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
      const has = (v: unknown) => v !== null && v !== undefined;
      const left = has(entry.left) ? toMm(entry.left) : null;
      const top = has(entry.top) ? toMm(entry.top) : null;
      if ((has(entry.left) && left === null) || (has(entry.top) && top === null)) {
        errors.push(`${label}: left, top은 숫자여야 합니다.`);
        ok = false;
      }
      if (!ok || w === null || d === null) return;

      const turned = rot === 90 || rot === 270;
      const fw = turned ? d : w;
      const fd = turned ? w : d;
      const x: Mm = left !== null ? Math.round(left + fw / 2) : Math.round(width / 2);
      const z: Mm = top !== null ? Math.round(top + fd / 2) : Math.round(depth / 2);
      if (left === null && top === null) warnings.push(`${label}: 위치가 없어 가운데에 둠`);
      else if (left === null) warnings.push(`${label}: left(왼쪽 벽에서의 거리)가 없어 가로 방향은 가운데에 둠`);
      else if (top === null) warnings.push(`${label}: top(위쪽 벽에서의 거리)이 없어 세로 방향은 가운데에 둠`);
      if (width > 0 && depth > 0 && (x - fw / 2 < 0 || z - fd / 2 < 0 || x + fw / 2 > width || z + fd / 2 > depth)) {
        warnings.push(`${label}: 방 밖으로 나갑니다.`);
      }
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
        color: DEFAULT_COLORS[items.length % DEFAULT_COLORS.length],
      });
    });
  }

  if (errors.length > 0) return { ok: false, errors };
  const notes = Array.isArray(raw.notes) ? raw.notes.filter((n): n is string => typeof n === 'string') : [];
  return {
    ok: true,
    warnings,
    notes,
    unit: u,
    project: {
      version: 1,
      displayUnit: base.displayUnit,
      room: { ceilingHeight, corners: rectCorners(width, depth), openings: [], walls: [], labels: [], photos: [] },
      items,
    },
  };
}
