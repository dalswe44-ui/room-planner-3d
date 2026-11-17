// 테스트용 가구·방 도우미(src/suggest 안에서만 쓴다).
import { rectCorners } from '../contracts/room';
import type { FurnitureItem } from '../contracts/types';

export const ROOM = { corners: rectCorners(3600, 3000), walls: [], openings: [] };

export function item(id: string, name: string, w: number, d: number, x = 1800, z = 1500, rotationDeg = 0): FurnitureItem {
  return { id, name, w, d, h: 700, x, z, rotationDeg, elevation: 0, color: '#000000' };
}

export const answer = (items: object[], extra: object = {}) =>
  JSON.stringify({ format: 'layout-suggestion', version: 1, items, reasons: ['이유'], tips: [], ...extra });
