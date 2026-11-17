// 바닥의 참나무 널 무늬. 외부 그림 파일 없이 캔버스에 코드로 그린다.
// 한 장은 실제 TILE_W_MM x TILE_H_MM 크기이고, 방 크기와 상관없이 같은 mm 크기로 반복된다.
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import { mmToWorld } from '../contracts/coords';
import { FLOOR_COLOR } from './geometry';

export const PLANK_WIDTH_MM = 150;
export const PLANK_LENGTH_MM = 1200;
export const TILE_W_MM = 2400;
export const TILE_H_MM = PLANK_WIDTH_MM * 8;
const PX_PER_MM = 1024 / TILE_W_MM;
/** 널마다 밝기가 이 비율(±) 안에서 다르다 */
export const SHADE_RANGE = 0.03;
/** 줄마다 이음 위치가 엇갈리는 간격 */
const STAGGER_MM = 300;

export interface Plank {
  row: number;
  /** 널 시작(mm, 한 장 안). 한 장 끝을 넘으면 반대쪽으로 이어 그린다. */
  x0: number;
  length: number;
  /** 밝기 배율 - 1 (-SHADE_RANGE ~ +SHADE_RANGE) */
  shade: number;
}

/** 결정적인 난수(같은 무늬가 항상 나온다) */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** 줄(행)마다 이음이 엇갈리게 널을 배치한다. 각 줄의 널 길이를 합하면 한 장의 너비다. */
export function plankLayout(): Plank[] {
  const rand = lcg(20251117);
  const rows = TILE_H_MM / PLANK_WIDTH_MM;
  const out: Plank[] = [];
  for (let row = 0; row < rows; row++) {
    const offset = (Math.floor(rand() * (PLANK_LENGTH_MM / STAGGER_MM)) * STAGGER_MM) % PLANK_LENGTH_MM;
    for (let x = offset; x < offset + TILE_W_MM; x += PLANK_LENGTH_MM) {
      out.push({ row, x0: x % TILE_W_MM, length: PLANK_LENGTH_MM, shade: (rand() * 2 - 1) * SHADE_RANGE });
    }
  }
  return out;
}

function shadeColor(hex: string, shade: number): string {
  const ch = (i: number) => Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) * (1 + shade))));
  return `rgb(${ch(0)},${ch(1)},${ch(2)})`;
}

/** 널 무늬 텍스처. UV 1 = 1 m(ShapeGeometry의 UV는 장면 좌표 m)이므로 repeat로 mm 크기를 맞춘다. 쓰고 나면 dispose() 한다. */
export function createPlankTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(TILE_W_MM * PX_PER_MM);
  canvas.height = Math.round(TILE_H_MM * PX_PER_MM);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = FLOOR_COLOR;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const h = PLANK_WIDTH_MM * PX_PER_MM;
    for (const p of plankLayout()) {
      const y = p.row * h;
      const w = p.length * PX_PER_MM;
      for (const x of [p.x0 * PX_PER_MM, p.x0 * PX_PER_MM - canvas.width]) {
        if (x + w <= 0 || x >= canvas.width) continue;
        ctx.fillStyle = shadeColor(FLOOR_COLOR, p.shade);
        ctx.fillRect(x, y, w, h);
        // 가는 이음선: 널의 위쪽 변과 왼쪽 끝
        ctx.fillStyle = 'rgba(90, 66, 30, 0.22)';
        ctx.fillRect(x, y, w, 1);
        ctx.fillRect(x, y, 1, h);
      }
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(1 / mmToWorld(TILE_W_MM), 1 / mmToWorld(TILE_H_MM));
  texture.anisotropy = 4;
  return texture;
}
