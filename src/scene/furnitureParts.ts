// 기본 가구 종류별 단순 모양. 부품은 모두 가구의 w×d×h 상자 안에 들어간다. three.js 객체를 만들지 않는 순수 계산이다.
// 좌표는 mm. 부품의 position은 부품 중심이고, 원점은 가구 바닥면 중심이다(x: 폭, y: 바닥에서 위로, z: 깊이).
// 회전 0일 때 뒤쪽(등받이·머리판)은 -z 쪽 변이다.
import type { FurnitureKind } from '../contracts/types';

/**
 * main은 가구 색(을 은은하게 한 것), light는 더 밝게, dark는 더 어둡게 그린다.
 * cream·pillow·blanket·handle은 천이나 손잡이 같은 부분의 색, book1~4는 책등 색이다(furnitureTones.ts).
 */
export type PartTone = 'main' | 'light' | 'dark' | 'cream' | 'pillow' | 'blanket' | 'handle' | 'book1' | 'book2' | 'book3' | 'book4';

/** 재질 무늬 종류. 나뭇결(wood)과 직물 결(fabric)은 밝기만 담은 회색 무늬로 부품 색에 곱해진다. */
export type GrainKind = 'wood' | 'fabric';

export interface FurniturePart {
  /** 부품 크기(mm): w(x), h(y), d(z) */
  size: [number, number, number];
  /** 부품 중심(mm). y는 바닥(가구 밑면)에서 잰 높이 */
  position: [number, number, number];
  tone: PartTone;
  /** 모든 모서리를 이 반지름(mm)으로 둥글린다. 없으면 각진 상자. */
  radius?: number;
  /** 위에서 본 네 모서리(세로 모서리)만 이 반지름(mm)으로 둥글린다. 상판처럼 얇은 판용. radius와 함께 쓰지 않는다. */
  corner?: number;
  /** 표면 무늬. 없으면 민무늬. */
  grain?: GrainKind;
}

type Style = { radius?: number; corner?: number; grain?: GrainKind };

/** 중심이 아니라 한쪽 끝 범위로 부품을 만든다. x0..x1, y0..y1, z0..z1은 모두 가구 바닥면 중심 기준(y는 바닥 기준). */
function span(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, tone: PartTone = 'main', style: Style = {}): FurniturePart {
  const part: FurniturePart = {
    size: [x1 - x0, y1 - y0, z1 - z0],
    position: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2],
    tone,
  };
  if (style.radius) part.radius = style.radius;
  if (style.corner) part.corner = style.corner;
  if (style.grain) part.grain = style.grain;
  return part;
}

const WOOD: Style = { grain: 'wood' };
const FABRIC: Style = { grain: 'fabric' };

/** 다리 한 개. 높이 0..legH, 가구 중심에서 (cx, cz)에 놓는다. */
function leg(cx: number, cz: number, legH: number, thick: number): FurniturePart {
  return span(cx - thick / 2, cx + thick / 2, 0, legH, cz - thick / 2, cz + thick / 2, 'dark', { radius: thick / 5 });
}

/** 네 다리. 높이 0..legH, 모서리에서 inset만큼 안쪽. sides로 어느 쪽 다리만 만들지 고른다(기본 둘 다). */
function legs(w: number, d: number, legH: number, thick: number, inset: number, sides: number[] = [-1, 1]): FurniturePart[] {
  const out: FurniturePart[] = [];
  for (const sx of sides) {
    for (const sz of [-1, 1]) {
      out.push(leg(sx * (w / 2 - inset - thick / 2), sz * (d / 2 - inset - thick / 2), legH, thick));
    }
  }
  return out;
}

/** 책상 서랍 단을 넣는 최소 폭(mm). 이보다 좁으면 다리만. */
export const DESK_DRAWER_MIN_W = 900;
/** 서랍 단을 넣는 최소 높이(mm). 너무 낮으면 서랍 면이 안 나온다. */
const DESK_DRAWER_MIN_H = 400;
/** 서랍 단의 서랍 수 */
const DRAWERS = 3;

function tableLike(w: number, d: number, h: number, mode: 'table' | 'drawers' | 'legs'): FurniturePart[] {
  const top = Math.min(30, h * 0.15);
  const thick = Math.min(50, w * 0.1, d * 0.1);
  const inset = Math.min(30, w * 0.05, d * 0.05);
  const corner = Math.min(60, w * 0.2, d * 0.2);
  const legH = h - top;
  const parts: FurniturePart[] = [span(-w / 2, w / 2, legH, h, -d / 2, d / 2, 'light', { corner, ...WOOD })];
  if (mode === 'legs') return [...parts, ...legs(w, d, legH, thick, inset)];
  if (mode === 'table') {
    // 식탁: 다리 사이를 잇는 상판 아래 테(에이프런)
    const apH = Math.min(70, legH * 0.2);
    const apT = Math.min(20, thick * 0.4);
    const x0 = -w / 2 + inset + thick;
    const x1 = w / 2 - inset - thick;
    const z0 = -d / 2 + inset + thick;
    const z1 = d / 2 - inset - thick;
    for (const sz of [-1, 1]) {
      const zc = sz * (d / 2 - inset - thick / 2);
      parts.push(span(x0, x1, legH - apH, legH, zc - apT / 2, zc + apT / 2, 'main', WOOD));
    }
    for (const sx of [-1, 1]) {
      const xc = sx * (w / 2 - inset - thick / 2);
      parts.push(span(xc - apT / 2, xc + apT / 2, legH - apH, legH, z0, z1, 'main', WOOD));
    }
    return [...parts, ...legs(w, d, legH, thick, inset)];
  }
  // 책상: 왼쪽(-x)에 서랍 단, 오른쪽(+x)은 다리 둘
  const dw = Math.min(420, w * 0.35);
  const x0 = -w / 2 + inset;
  const x1 = x0 + dw;
  const frontT = 8;
  const pedZ1 = d / 2 - inset - frontT;
  parts.push(span(x0, x1, 0, legH, -d / 2 + inset, pedZ1, 'dark', { radius: 4, ...WOOD }));
  const gap = 5;
  const fh = (legH - 2 * gap - 10 - (DRAWERS - 1) * gap) / DRAWERS;
  const handleW = Math.min(110, dw * 0.35);
  for (let i = 0; i < DRAWERS; i++) {
    const y0 = gap * 2 + i * (fh + gap);
    // 서랍 앞면(밝은 판)과 손잡이. 위쪽 서랍부터 손잡이 높이는 면 가운데 위쪽.
    parts.push(span(x0 + 4, x1 - 4, y0, y0 + fh, pedZ1, pedZ1 + frontT - 2, 'light', WOOD));
    parts.push(span((x0 + x1) / 2 - handleW / 2, (x0 + x1) / 2 + handleW / 2, y0 + fh * 0.62, y0 + fh * 0.62 + 10, pedZ1 + frontT - 2, pedZ1 + frontT, 'handle'));
  }
  return [...parts, ...legs(w, d, legH, thick, inset, [1])];
}

function chair(w: number, d: number, h: number): FurniturePart[] {
  const seatTop = h * 0.5;
  const cushion = Math.min(45, h * 0.08);
  const plank = Math.min(25, h * 0.05);
  const thick = Math.min(30, w * 0.07, d * 0.07);
  const inset = Math.min(20, w * 0.04, d * 0.04);
  const backDepth = Math.min(36, d * 0.08);
  const side = Math.min(15, w * 0.04);
  const corner = Math.min(50, w * 0.2, d * 0.2);
  const seatBottom = seatTop - cushion - plank;
  return [
    ...legs(w, d, seatBottom, thick, inset),
    // 좌판 널 위에 쿠션. 쿠션은 등받이 앞에서 시작해 위에서 보면 등받이와 나뉜다.
    span(-w / 2, w / 2, seatBottom, seatBottom + plank, -d / 2, d / 2, 'main', { corner, ...WOOD }),
    span(-w / 2 + 8, w / 2 - 8, seatBottom + plank, seatTop, -d / 2 + backDepth, d / 2 - 8, 'light', { radius: cushion / 2.2, ...FABRIC }),
    // 등받이: 얇고 양옆이 살짝 들어가며 둥글다
    span(-w / 2 + side, w / 2 - side, seatBottom, h, -d / 2, -d / 2 + backDepth, 'main', { radius: backDepth / 2.2, ...WOOD }),
  ];
}

function bed(w: number, d: number, h: number): FurniturePart[] {
  const head = Math.min(80, d * 0.05);
  const side = Math.min(25, w * 0.05);
  const front = Math.min(25, d * 0.03);
  const legH = Math.min(50, h * 0.12);
  const frameTop = h * 0.4;
  const mattressTop = h * 0.72;
  const innerW = w - 2 * side;
  const two = innerW >= 1000;
  const pillowW = two ? Math.min(500, innerW * 0.4) : Math.min(500, innerW * 0.7);
  const pillowD = Math.min(350, d * 0.15);
  const pillowH = h * 0.17;
  const bodyZ0 = -d / 2 + head;
  const pillowZ0 = bodyZ0 + Math.min(60, d * 0.03);
  // 이불은 매트리스 아래쪽 절반 남짓을 덮는다. 옆면이 매트리스와 겹치지 않게 조금 더 넓고 높게 둔다.
  const blanketZ0 = bodyZ0 + (d - head) * 0.4;
  const blanketSide = side * 0.4;
  const blanketTop = h * 0.8;
  const foldD = Math.min(260, (d - head) * 0.14);
  const foot = Math.min(60, w * 0.08);
  const parts: FurniturePart[] = [
    span(-w / 2, w / 2, 0, h, -d / 2, bodyZ0, 'main', { radius: Math.min(20, head / 2.5), ...WOOD }),
    // 틀 아래 짧은 다리(발)
    ...[-1, 1].map((sx) => leg(sx * (w / 2 - foot / 2 - 5), d / 2 - foot / 2 - 5, legH, foot)),
    span(-w / 2, w / 2, legH, frameTop, bodyZ0, d / 2, 'dark', { radius: Math.min(10, w * 0.02), ...WOOD }),
    span(-w / 2 + side, w / 2 - side, frameTop, mattressTop, bodyZ0, d / 2 - front, 'cream', { radius: Math.min(40, h * 0.1), ...FABRIC }),
    span(-w / 2 + blanketSide, w / 2 - blanketSide, h * 0.46, blanketTop, blanketZ0, d / 2 - front * 0.4, 'blanket', { radius: Math.min(55, h * 0.12), ...FABRIC }),
    // 이불 윗단을 접어 젖힌 두툼한 띠(안쪽이 보이는 천)
    span(-w / 2 + blanketSide + 10, w / 2 - blanketSide - 10, h * 0.7, h * 0.86, blanketZ0, blanketZ0 + foldD, 'cream', { radius: Math.min(50, h * 0.07), ...FABRIC }),
  ];
  const count = two ? 2 : 1;
  const gap = (innerW - count * pillowW) / (count + 1);
  for (let i = 0; i < count; i++) {
    const x0 = -w / 2 + side + gap + i * (pillowW + gap);
    parts.push(span(x0, x0 + pillowW, mattressTop, mattressTop + pillowH, pillowZ0, pillowZ0 + pillowD, 'pillow', { radius: pillowH / 2.05, ...FABRIC }));
  }
  return parts;
}

function sofa(w: number, d: number, h: number): FurniturePart[] {
  const arm = Math.min(150, w * 0.12);
  const backDepth = Math.min(230, d * 0.28);
  const legH = Math.min(60, h * 0.1);
  const baseTop = h * 0.3;
  const cushionTop = h * 0.52;
  const armTop = h * 0.62;
  const inner = w - 2 * arm;
  const count = inner >= 1500 ? 3 : 2;
  const gap = Math.min(12, inner * 0.02);
  const cw = (inner - (count - 1) * gap) / count;
  const trim = Math.min(4, w * 0.01);
  const legT = Math.min(50, w * 0.05, d * 0.05);
  const backCushD = Math.min(150, d * 0.18);
  const backCushTop = h * 0.9;
  const parts: FurniturePart[] = [
    ...legs(w, d, legH, legT, Math.min(20, w * 0.03)),
    span(-w / 2 + arm, w / 2 - arm, legH, baseTop, -d / 2 + backDepth, d / 2, 'dark', { radius: Math.min(25, (baseTop - legH) / 3), ...FABRIC }),
    // 등받이는 팔걸이보다 높고 양옆이 살짝 들어가 있어 옆면이 팔걸이와 겹치지 않는다.
    span(-w / 2 + trim, w / 2 - trim, legH, h, -d / 2, -d / 2 + backDepth, 'main', { radius: Math.min(45, backDepth / 3), ...FABRIC }),
    // 팔걸이 윗면은 둥글게(반지름을 폭의 절반에 가깝게)
    span(-w / 2, -w / 2 + arm, legH, armTop, -d / 2 + backDepth * 0.5, d / 2, 'main', { radius: Math.min(60, arm / 2.2), ...FABRIC }),
    span(w / 2 - arm, w / 2, legH, armTop, -d / 2 + backDepth * 0.5, d / 2, 'main', { radius: Math.min(60, arm / 2.2), ...FABRIC }),
  ];
  for (let i = 0; i < count; i++) {
    const x0 = -w / 2 + arm + i * (cw + gap);
    const z0 = -d / 2 + backDepth;
    parts.push(span(x0, x0 + cw, baseTop, cushionTop, z0, d / 2 - Math.min(20, d * 0.03), 'light', { radius: Math.min(45, (cushionTop - baseTop) / 2.2), ...FABRIC }));
    // 등 쿠션: 좌석 쿠션 위, 등받이 앞면에 기대어 선다.
    parts.push(span(x0 + 6, x0 + cw - 6, cushionTop, backCushTop, z0, z0 + backCushD, 'light', { radius: Math.min(50, backCushD / 2.2), ...FABRIC }));
  }
  return parts;
}

function wardrobe(w: number, d: number, h: number): FurniturePart[] {
  const handleT = Math.min(24, d * 0.05);
  const doorT = Math.min(20, d * 0.04);
  const gap = Math.min(10, w * 0.012);
  const count = Math.min(4, Math.max(2, Math.round(w / 450)));
  const doorW = (w - (count - 1) * gap) / count;
  const doorZ1 = d / 2 - handleT;
  const doorZ0 = doorZ1 - doorT;
  const handleW = Math.min(16, doorW * 0.15);
  const plinth = Math.min(80, h * 0.05);
  const pin = Math.min(20, w * 0.02, d * 0.04);
  const parts: FurniturePart[] = [
    // 몸통. 문 뒤에서 위까지 이어져 위에서 보면 앞쪽에 문 띠가 따로 보인다.
    span(-w / 2, w / 2, plinth, h, -d / 2, doorZ0, 'dark', { radius: Math.min(15, d * 0.03), ...WOOD }),
    // 걸레받이: 몸통보다 안쪽으로 들어간 어두운 받침
    span(-w / 2 + pin, w / 2 - pin, 0, plinth, -d / 2 + pin, doorZ1 - pin, 'dark'),
  ];
  for (let i = 0; i < count; i++) {
    const x0 = -w / 2 + i * (doorW + gap);
    parts.push(span(x0, x0 + doorW, plinth, h, doorZ0, doorZ1, 'light', WOOD));
    if (i > 0) parts.push(span(x0 - gap, x0, plinth, h, doorZ0, doorZ1, 'dark'));
    // 손잡이는 가운데 쪽 가장자리 가까이. 가운데 문(홀수일 때)은 왼쪽.
    const center = x0 + doorW / 2;
    const toRight = center < -1e-6;
    const hx = toRight ? x0 + doorW - handleW * 1.6 : x0 + handleW * 1.6;
    parts.push(span(hx - handleW / 2, hx + handleW / 2, h * 0.4, h * 0.62, doorZ1, d / 2, 'handle'));
  }
  return parts;
}

/** 같은 문자열이면 같은 난수열을 주는 결정적 난수(FNV-1a 해시 + LCG). 그릴 때마다 달라지지 않게 한다. */
function seeded(seed: string): () => number {
  let s = 2166136261;
  for (let i = 0; i < seed.length; i++) s = Math.imul(s ^ seed.charCodeAt(i), 16777619);
  s >>>= 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const BOOK_TONES: PartTone[] = ['book1', 'book2', 'book3', 'book4'];
/** 책 폭·높이 비율은 몇 가지로 한정해 같은 모양의 geometry를 서로 쓰게 한다. */
const BOOK_WIDTHS = [22, 30, 40];
const BOOK_HEIGHT_RATIOS = [0.6, 0.75, 0.88];
const BOOKS_PER_BAY = 3;

function shelf(w: number, d: number, h: number, seed: string): FurniturePart[] {
  const side = Math.min(25, w * 0.1);
  const board = Math.min(20, h * 0.05);
  const back = Math.min(12, d * 0.06);
  const count = Math.max(2, Math.round(h / 350));
  const parts: FurniturePart[] = [
    span(-w / 2, -w / 2 + side, 0, h, -d / 2, d / 2, 'main', WOOD),
    span(w / 2 - side, w / 2, 0, h, -d / 2, d / 2, 'main', WOOD),
    // 뒤판은 윗판과 색이 달라 위에서 보면 뒤쪽 띠로 구분된다.
    span(-w / 2 + side, w / 2 - side, 0, h, -d / 2, -d / 2 + back, 'dark', WOOD),
  ];
  for (let i = 0; i < count; i++) {
    // 맨 아래 선반은 바닥에, 맨 위 선반(윗판)은 윗면에 붙는다.
    const y0 = ((h - board) * i) / (count - 1);
    parts.push(span(-w / 2 + side, w / 2 - side, y0, y0 + board, -d / 2 + back, d / 2, 'light', WOOD));
  }
  // 칸마다 책 몇 권. 칸이 충분히 클 때만 놓고, 위치·색·크기는 seed로만 정해진다.
  const rand = seeded(seed);
  const bayW = w - 2 * side;
  const bookD = Math.min(d - back - 40, 240);
  if (bookD >= 60 && bayW >= 200) {
    for (let i = 0; i < count - 1; i++) {
      const floor = ((h - board) * i) / (count - 1) + board;
      const ceil = ((h - board) * (i + 1)) / (count - 1);
      const room = ceil - floor;
      if (room < 150) continue;
      let x = -w / 2 + side + 20 + rand() * bayW * 0.3;
      const limit = w / 2 - side - 10;
      const z0 = -d / 2 + back + 8;
      const books = 1 + Math.floor(rand() * BOOKS_PER_BAY);
      for (let b = 0; b < books; b++) {
        const bw = BOOK_WIDTHS[Math.floor(rand() * BOOK_WIDTHS.length)]!;
        const bh = room * BOOK_HEIGHT_RATIOS[Math.floor(rand() * BOOK_HEIGHT_RATIOS.length)]! - 15;
        const tone = BOOK_TONES[Math.floor(rand() * BOOK_TONES.length)]!;
        const gapB = 2 + rand() * 6;
        if (x + bw > limit) break;
        parts.push(span(x, x + bw, floor, floor + bh, z0, z0 + bookD, tone, { radius: 3 }));
        x += bw + gapB;
      }
    }
  }
  return parts;
}

/**
 * 종류별 부품 목록. 'box'(또는 알 수 없는 종류)는 빈 목록이며 호출한 쪽이 상자 하나로 그린다.
 * seed는 책장의 책처럼 "가구마다 다르되 매번 같은" 모양을 정할 때 쓴다(가구 id).
 */
export function partsForKind(kind: FurnitureKind | undefined, w: number, d: number, h: number, seed = ''): FurniturePart[] {
  switch (kind) {
    case 'desk':
      return tableLike(w, d, h, w >= DESK_DRAWER_MIN_W && h >= DESK_DRAWER_MIN_H ? 'drawers' : 'legs');
    case 'table':
      return tableLike(w, d, h, 'table');
    case 'chair':
      return chair(w, d, h);
    case 'bed':
      return bed(w, d, h);
    case 'sofa':
      return sofa(w, d, h);
    case 'wardrobe':
      return wardrobe(w, d, h);
    case 'shelf':
      return shelf(w, d, h, seed);
    default:
      return [];
  }
}
