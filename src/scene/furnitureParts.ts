// 기본 가구 종류별 단순 모양. 부품은 모두 가구의 w×d×h 상자 안에 들어간다. three.js 객체를 만들지 않는 순수 계산이다.
// 좌표는 mm. 부품의 position은 부품 중심이고, 원점은 가구 바닥면 중심이다(x: 폭, y: 바닥에서 위로, z: 깊이).
// 회전 0일 때 뒤쪽(등받이·머리판)은 -z 쪽 변이다.
import type { FurnitureKind } from '../contracts/types';

/** main은 가구 색 그대로, light는 더 밝게, dark는 더 어둡게 그린다. */
export type PartTone = 'main' | 'light' | 'dark';

export interface FurniturePart {
  /** 부품 크기(mm): w(x), h(y), d(z) */
  size: [number, number, number];
  /** 부품 중심(mm). y는 바닥(가구 밑면)에서 잰 높이 */
  position: [number, number, number];
  tone: PartTone;
}

/** 중심이 아니라 한쪽 끝 범위로 부품을 만든다. x0..x1, y0..y1, z0..z1은 모두 가구 바닥면 중심 기준(y는 바닥 기준). */
function span(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, tone: PartTone = 'main'): FurniturePart {
  return {
    size: [x1 - x0, y1 - y0, z1 - z0],
    position: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2],
    tone,
  };
}

/** 네 다리. 높이 0..legH, 모서리에서 inset만큼 안쪽. */
function legs(w: number, d: number, legH: number, thick: number, inset: number): FurniturePart[] {
  const out: FurniturePart[] = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const cx = sx * (w / 2 - inset - thick / 2);
      const cz = sz * (d / 2 - inset - thick / 2);
      out.push(span(cx - thick / 2, cx + thick / 2, 0, legH, cz - thick / 2, cz + thick / 2, 'dark'));
    }
  }
  return out;
}

function tableLike(w: number, d: number, h: number): FurniturePart[] {
  const top = Math.min(30, h * 0.15);
  const thick = Math.min(50, w * 0.1, d * 0.1);
  const inset = Math.min(30, w * 0.05, d * 0.05);
  return [span(-w / 2, w / 2, h - top, h, -d / 2, d / 2, 'light'), ...legs(w, d, h - top, thick, inset)];
}

function chair(w: number, d: number, h: number): FurniturePart[] {
  const seatTop = h * 0.5;
  const seat = Math.min(40, h * 0.1);
  const thick = Math.min(40, w * 0.1, d * 0.1);
  const inset = Math.min(20, w * 0.04, d * 0.04);
  const backDepth = Math.min(40, d * 0.12);
  return [
    span(-w / 2, w / 2, seatTop - seat, seatTop, -d / 2, d / 2, 'light'),
    ...legs(w, d, seatTop - seat, thick, inset),
    span(-w / 2, w / 2, seatTop, h, -d / 2, -d / 2 + backDepth),
  ];
}

function bed(w: number, d: number, h: number): FurniturePart[] {
  const head = Math.min(80, d * 0.05);
  const side = Math.min(25, w * 0.05);
  const front = Math.min(25, d * 0.03);
  const pillowH = h * 0.15;
  const pillowW = Math.min(500, (w - 2 * side) * 0.42);
  const pillowD = Math.min(350, d * 0.15);
  const mattressTop = h * 0.75;
  const pillowZ0 = -d / 2 + head + Math.min(60, d * 0.03);
  const parts: FurniturePart[] = [
    span(-w / 2, w / 2, 0, h, -d / 2, -d / 2 + head, 'dark'),
    span(-w / 2, w / 2, 0, h * 0.4, -d / 2 + head, d / 2, 'dark'),
    span(-w / 2 + side, w / 2 - side, h * 0.4, mattressTop, -d / 2 + head, d / 2 - front, 'light'),
  ];
  const gap = (w - 2 * side - 2 * pillowW) / 3;
  for (const i of [0, 1]) {
    const x0 = -w / 2 + side + gap + i * (pillowW + gap);
    parts.push(span(x0, x0 + pillowW, mattressTop, mattressTop + pillowH, pillowZ0, pillowZ0 + pillowD));
  }
  return parts;
}

function sofa(w: number, d: number, h: number): FurniturePart[] {
  const arm = Math.min(150, w * 0.12);
  const backDepth = Math.min(250, d * 0.3);
  const baseTop = h * 0.4;
  const cushionTop = h * 0.55;
  const armTop = h * 0.65;
  return [
    span(-w / 2, -w / 2 + arm, 0, armTop, -d / 2, d / 2, 'dark'),
    span(w / 2 - arm, w / 2, 0, armTop, -d / 2, d / 2, 'dark'),
    span(-w / 2 + arm, w / 2 - arm, 0, baseTop, -d / 2, d / 2, 'dark'),
    span(-w / 2 + arm, w / 2 - arm, baseTop, cushionTop, -d / 2 + backDepth, d / 2, 'light'),
    span(-w / 2 + arm, w / 2 - arm, baseTop, h, -d / 2, -d / 2 + backDepth),
  ];
}

function wardrobe(w: number, d: number, h: number): FurniturePart[] {
  const gap = Math.min(10, w * 0.02);
  const recess = Math.min(8, d * 0.05);
  return [
    span(-w / 2, -gap / 2, 0, h, -d / 2, d / 2 - recess),
    span(gap / 2, w / 2, 0, h, -d / 2, d / 2 - recess),
    // 두 문 사이의 틈. 문보다 안쪽으로 들어가 있어 어두운 선으로 보인다.
    span(-gap / 2, gap / 2, 0, h, -d / 2, d / 2 - recess * 2, 'dark'),
    // 문 앞면 가운데 쪽 손잡이 자리: 문 앞면(d/2 - recess)과 상자 앞면(d/2) 사이의 얇은 띠
    span(-gap / 2 - Math.min(20, w * 0.04), -gap / 2, h * 0.4, h * 0.6, d / 2 - recess, d / 2, 'dark'),
    span(gap / 2, gap / 2 + Math.min(20, w * 0.04), h * 0.4, h * 0.6, d / 2 - recess, d / 2, 'dark'),
  ];
}

function shelf(w: number, d: number, h: number): FurniturePart[] {
  const side = Math.min(25, w * 0.1);
  const board = Math.min(20, h * 0.05);
  const back = Math.min(8, d * 0.05);
  const count = Math.max(2, Math.round(h / 350));
  const parts: FurniturePart[] = [
    span(-w / 2, -w / 2 + side, 0, h, -d / 2, d / 2, 'dark'),
    span(w / 2 - side, w / 2, 0, h, -d / 2, d / 2, 'dark'),
    span(-w / 2 + side, w / 2 - side, 0, h, -d / 2, -d / 2 + back, 'dark'),
  ];
  for (let i = 0; i < count; i++) {
    // 맨 아래 선반은 바닥에, 맨 위 선반은 윗면에 붙는다.
    const y0 = ((h - board) * i) / (count - 1);
    parts.push(span(-w / 2 + side, w / 2 - side, y0, y0 + board, -d / 2 + back, d / 2, 'light'));
  }
  return parts;
}

/** 종류별 부품 목록. 'box'(또는 알 수 없는 종류)는 빈 목록이며 호출한 쪽이 상자 하나로 그린다. */
export function partsForKind(kind: FurnitureKind | undefined, w: number, d: number, h: number): FurniturePart[] {
  switch (kind) {
    case 'desk':
    case 'table':
      return tableLike(w, d, h);
    case 'chair':
      return chair(w, d, h);
    case 'bed':
      return bed(w, d, h);
    case 'sofa':
      return sofa(w, d, h);
    case 'wardrobe':
      return wardrobe(w, d, h);
    case 'shelf':
      return shelf(w, d, h);
    default:
      return [];
  }
}
