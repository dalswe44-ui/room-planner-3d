// AI가 돌려준 추천 배치 글을 검사해 가구별 이동으로 바꾼다. 순수 함수(three.js·React 없음).
import {
  BACK_TO_ROTATION,
  footprintOfBack,
  type BackSide,
  type LayoutSuggestion,
} from '../contracts/layoutSuggest';
import { roomBounds } from '../contracts/room';
import type { FurnitureItem, Room } from '../contracts/types';
import { GRID_MM } from '../furniture/placement';

export interface ArrangementMove {
  /** 가구의 실제 id(번호가 아니다) */
  id: string;
  x: number;
  z: number;
  rotationDeg: number;
}

export type ParsedSuggestion =
  | { ok: true; moves: ArrangementMove[]; reasons: string[]; tips: string[] }
  | { ok: false; errors: string[] };

const BACKS = new Set<string>(Object.keys(BACK_TO_ROTATION));
const isBack = (v: unknown): v is BackSide => typeof v === 'string' && BACKS.has(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string' && s.trim() !== '').map((s) => s.trim()) : [];

const toGrid = (v: number) => Math.round(v / GRID_MM) * GRID_MM;
/** 0 ≤ v ≤ max로 당겨 넣는다. max가 0보다 작으면(가구가 방보다 큼) 0. */
const pull = (v: number, max: number) => (max < 0 ? 0 : Math.min(Math.max(v, 0), max));

/** 답 글에서 첫 '{'부터 마지막 '}'까지를 꺼내 검사한다. */
export function parseSuggestion(
  text: string,
  items: readonly Pick<FurnitureItem, 'id' | 'w' | 'd'>[],
  room: Pick<Room, 'corners'>,
): ParsedSuggestion {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) return { ok: false, errors: ['답에서 JSON을 찾을 수 없어요.'] };
  let raw: Partial<LayoutSuggestion> & Record<string, unknown>;
  try {
    raw = JSON.parse(text.slice(start, end + 1)) as typeof raw;
  } catch {
    return { ok: false, errors: ['답이 JSON 형식이 아니에요.'] };
  }
  if (typeof raw !== 'object' || raw === null) return { ok: false, errors: ['답이 JSON 형식이 아니에요.'] };

  const errors: string[] = [];
  if (raw.format !== 'layout-suggestion') errors.push('format이 "layout-suggestion"이 아니에요.');
  if (raw.version !== 1) errors.push('version이 1이 아니에요.');
  if (!Array.isArray(raw.items)) {
    errors.push('items가 목록이 아니에요.');
    return { ok: false, errors };
  }

  const byNumber = new Map<number, { back: BackSide; left: number; top: number }>();
  raw.items.forEach((entry: unknown, i) => {
    const e = (typeof entry === 'object' && entry !== null ? entry : {}) as Record<string, unknown>;
    const label = `items[${i}]`;
    if (!Number.isInteger(e.id) || (e.id as number) < 1 || (e.id as number) > items.length) {
      errors.push(`${label}: 가구 번호(id)가 1~${items.length} 안의 정수가 아니에요.`);
      return;
    }
    const id = e.id as number;
    if (byNumber.has(id)) {
      errors.push(`${id}번 가구가 두 번 나와요.`);
      return;
    }
    if (!isBack(e.back)) {
      errors.push(`${id}번 가구의 back이 top, left, bottom, right 중 하나가 아니에요.`);
      return;
    }
    if (!isNum(e.left) || !isNum(e.top)) {
      errors.push(`${id}번 가구의 left나 top이 숫자가 아니에요.`);
      return;
    }
    byNumber.set(id, { back: e.back, left: e.left, top: e.top });
  });
  const missing = items.map((_, i) => i + 1).filter((n) => !byNumber.has(n));
  if (missing.length > 0 && errors.length === 0) errors.push(`${missing.join(', ')}번 가구가 빠졌어요.`);
  if (errors.length > 0) return { ok: false, errors };

  const bounds = roomBounds(room);
  const moves = items.map((item, i): ArrangementMove => {
    const a = byNumber.get(i + 1)!;
    const { fw, fd } = footprintOfBack(item, a.back);
    const left = pull(toGrid(a.left), bounds.width - fw);
    const top = pull(toGrid(a.top), bounds.depth - fd);
    return {
      id: item.id,
      x: Math.round(bounds.minX + left + fw / 2) + 0,
      z: Math.round(bounds.minZ + top + fd / 2) + 0,
      rotationDeg: BACK_TO_ROTATION[a.back],
    };
  });
  return { ok: true, moves, reasons: strings(raw.reasons), tips: strings(raw.tips) };
}
