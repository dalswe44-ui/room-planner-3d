// 기본 가구 종류별 단순 모양. 부품은 모두 가구의 w×d×h 상자 안에 들어간다. three.js 객체를 만들지 않는 순수 계산이다.
// 좌표는 mm. 부품의 position은 부품 중심이고, 원점은 가구 바닥면 중심이다(x: 폭, y: 바닥에서 위로, z: 깊이).
// 회전 0일 때 뒤쪽(등받이·머리판)은 -z 쪽 변이다.
import type { FurnitureKind } from '../contracts/types';

/**
 * main은 가구 색(을 은은하게 한 것), light는 더 밝게, dark는 더 어둡게 그린다.
 * cream·pillow·blanket·handle은 천이나 손잡이 같은 부분의 색이다(furnitureTones.ts).
 */
export type PartTone = 'main' | 'light' | 'dark' | 'cream' | 'pillow' | 'blanket' | 'handle';

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
}

type Round = { radius?: number; corner?: number };

/** 중심이 아니라 한쪽 끝 범위로 부품을 만든다. x0..x1, y0..y1, z0..z1은 모두 가구 바닥면 중심 기준(y는 바닥 기준). */
function span(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, tone: PartTone = 'main', round: Round = {}): FurniturePart {
  const part: FurniturePart = {
    size: [x1 - x0, y1 - y0, z1 - z0],
    position: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2],
    tone,
  };
  if (round.radius) part.radius = round.radius;
  if (round.corner) part.corner = round.corner;
  return part;
}

/** 네 다리. 높이 0..legH, 모서리에서 inset만큼 안쪽. */
function legs(w: number, d: number, legH: number, thick: number, inset: number): FurniturePart[] {
  const out: FurniturePart[] = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const cx = sx * (w / 2 - inset - thick / 2);
      const cz = sz * (d / 2 - inset - thick / 2);
      out.push(span(cx - thick / 2, cx + thick / 2, 0, legH, cz - thick / 2, cz + thick / 2, 'dark', { radius: thick / 5 }));
    }
  }
  return out;
}

function tableLike(w: number, d: number, h: number): FurniturePart[] {
  const top = Math.min(30, h * 0.15);
  const thick = Math.min(50, w * 0.1, d * 0.1);
  const inset = Math.min(30, w * 0.05, d * 0.05);
  const corner = Math.min(60, w * 0.2, d * 0.2);
  return [span(-w / 2, w / 2, h - top, h, -d / 2, d / 2, 'light', { corner }), ...legs(w, d, h - top, thick, inset)];
}

function chair(w: number, d: number, h: number): FurniturePart[] {
  const seatTop = h * 0.5;
  const seat = Math.min(60, h * 0.12);
  const thick = Math.min(40, w * 0.1, d * 0.1);
  const inset = Math.min(20, w * 0.04, d * 0.04);
  const backDepth = Math.min(50, d * 0.12);
  const corner = Math.min(50, w * 0.2, d * 0.2);
  return [
    ...legs(w, d, seatTop - seat, thick, inset),
    // 좌판 쿠션은 등받이 앞에서 시작해 위에서 보면 둘이 나뉜다.
    span(-w / 2, w / 2, seatTop - seat, seatTop, -d / 2 + backDepth, d / 2, 'light', { corner }),
    span(-w / 2, w / 2, seatTop - seat, h, -d / 2, -d / 2 + backDepth, 'main', { radius: Math.min(25, backDepth / 2.2) }),
  ];
}

function bed(w: number, d: number, h: number): FurniturePart[] {
  const head = Math.min(80, d * 0.05);
  const side = Math.min(25, w * 0.05);
  const front = Math.min(25, d * 0.03);
  const mattressTop = h * 0.72;
  const innerW = w - 2 * side;
  const two = innerW >= 1000;
  const pillowW = two ? Math.min(500, innerW * 0.4) : Math.min(500, innerW * 0.7);
  const pillowD = Math.min(350, d * 0.15);
  const pillowH = h * 0.14;
  const bodyZ0 = -d / 2 + head;
  const pillowZ0 = bodyZ0 + Math.min(60, d * 0.03);
  // 이불은 매트리스 아래쪽 절반 남짓을 덮는다. 옆면이 매트리스와 겹치지 않게 조금 더 넓고 높게 둔다.
  const blanketZ0 = bodyZ0 + (d - head) * 0.4;
  const blanketSide = side * 0.4;
  const parts: FurniturePart[] = [
    span(-w / 2, w / 2, 0, h, -d / 2, bodyZ0, 'main', { radius: Math.min(20, head / 2.5) }),
    span(-w / 2, w / 2, 0, h * 0.4, bodyZ0, d / 2, 'dark', { radius: Math.min(10, w * 0.02) }),
    span(-w / 2 + side, w / 2 - side, h * 0.4, mattressTop, bodyZ0, d / 2 - front, 'cream', { radius: Math.min(40, h * 0.1) }),
    span(-w / 2 + blanketSide, w / 2 - blanketSide, h * 0.46, h * 0.78, blanketZ0, d / 2 - front * 0.4, 'blanket', { radius: Math.min(45, h * 0.1) }),
  ];
  const count = two ? 2 : 1;
  const gap = (innerW - count * pillowW) / (count + 1);
  for (let i = 0; i < count; i++) {
    const x0 = -w / 2 + side + gap + i * (pillowW + gap);
    parts.push(span(x0, x0 + pillowW, mattressTop, mattressTop + pillowH, pillowZ0, pillowZ0 + pillowD, 'pillow', { radius: pillowH / 2.2 }));
  }
  return parts;
}

function sofa(w: number, d: number, h: number): FurniturePart[] {
  const arm = Math.min(150, w * 0.12);
  const backDepth = Math.min(230, d * 0.28);
  const baseTop = h * 0.3;
  const cushionTop = h * 0.52;
  const armTop = h * 0.62;
  const inner = w - 2 * arm;
  const count = inner >= 1500 ? 3 : 2;
  const gap = Math.min(12, inner * 0.02);
  const cw = (inner - (count - 1) * gap) / count;
  const trim = Math.min(4, w * 0.01);
  const parts: FurniturePart[] = [
    span(-w / 2 + arm, w / 2 - arm, 0, baseTop, -d / 2 + backDepth, d / 2, 'dark', { radius: Math.min(25, baseTop / 3) }),
    // 등받이는 팔걸이보다 높고 양옆이 살짝 들어가 있어 옆면이 팔걸이와 겹치지 않는다.
    span(-w / 2 + trim, w / 2 - trim, 0, h, -d / 2, -d / 2 + backDepth, 'main', { radius: Math.min(45, backDepth / 3) }),
    span(-w / 2, -w / 2 + arm, 0, armTop, -d / 2 + backDepth * 0.5, d / 2, 'main', { radius: Math.min(40, arm / 3) }),
    span(w / 2 - arm, w / 2, 0, armTop, -d / 2 + backDepth * 0.5, d / 2, 'main', { radius: Math.min(40, arm / 3) }),
  ];
  for (let i = 0; i < count; i++) {
    const x0 = -w / 2 + arm + i * (cw + gap);
    parts.push(span(x0, x0 + cw, baseTop, cushionTop, -d / 2 + backDepth, d / 2 - Math.min(20, d * 0.03), 'light', { radius: Math.min(45, (cushionTop - baseTop) / 2.2) }));
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
  const parts: FurniturePart[] = [
    // 몸통. 문 뒤에서 위까지 이어져 위에서 보면 앞쪽에 문 띠가 따로 보인다.
    span(-w / 2, w / 2, 0, h, -d / 2, doorZ0, 'dark', { radius: Math.min(15, d * 0.03) }),
  ];
  for (let i = 0; i < count; i++) {
    const x0 = -w / 2 + i * (doorW + gap);
    parts.push(span(x0, x0 + doorW, 0, h, doorZ0, doorZ1, 'light'));
    if (i > 0) parts.push(span(x0 - gap, x0, 0, h, doorZ0, doorZ1, 'dark'));
    // 손잡이는 가운데 쪽 가장자리 가까이. 가운데 문(홀수일 때)은 왼쪽.
    const center = x0 + doorW / 2;
    const toRight = center < -1e-6;
    const hx = toRight ? x0 + doorW - handleW * 1.6 : x0 + handleW * 1.6;
    parts.push(span(hx - handleW / 2, hx + handleW / 2, h * 0.4, h * 0.62, doorZ1, d / 2, 'handle'));
  }
  return parts;
}

function shelf(w: number, d: number, h: number): FurniturePart[] {
  const side = Math.min(25, w * 0.1);
  const board = Math.min(20, h * 0.05);
  const back = Math.min(12, d * 0.06);
  const count = Math.max(2, Math.round(h / 350));
  const parts: FurniturePart[] = [
    span(-w / 2, -w / 2 + side, 0, h, -d / 2, d / 2, 'main'),
    span(w / 2 - side, w / 2, 0, h, -d / 2, d / 2, 'main'),
    // 뒤판은 윗판과 색이 달라 위에서 보면 뒤쪽 띠로 구분된다.
    span(-w / 2 + side, w / 2 - side, 0, h, -d / 2, -d / 2 + back, 'dark'),
  ];
  for (let i = 0; i < count; i++) {
    // 맨 아래 선반은 바닥에, 맨 위 선반(윗판)은 윗면에 붙는다.
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
