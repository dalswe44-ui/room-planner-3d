// 가구 재질 무늬(나뭇결, 직물 결). 외부 그림 없이 캔버스에 코드로 그리고, 밝기만 담은 회색조라 부품 색에 곱해진다.
// 종류별로 한 번만 만들어 모든 가구가 함께 쓴다(앱이 사는 동안 유지하므로 dispose하지 않는다).
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import type { GrainKind } from './furnitureParts';

/** 무늬 한 장의 한 변(px). 휴대폰 성능을 위해 작게. */
export const GRAIN_SIZE_PX = 128;
/** 무늬 한 장이 덮는 실제 길이(m). partGeometry가 UV를 이 길이 기준으로 만든다. */
export const GRAIN_TILE_M: Record<GrainKind, number> = { wood: 0.6, fabric: 0.1 };

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const gray = (v: number): string => {
  const c = Math.max(0, Math.min(255, Math.round(v)));
  return `rgb(${c},${c},${c})`;
};

/** 가로 결. 연한 바탕에 줄마다 밝기가 조금 다르고, 가는 어두운 결선이 물결치며 지난다. 좌우·상하로 이어 붙여도 끊기지 않는다. */
function paintWood(ctx: CanvasRenderingContext2D, n: number): void {
  const rand = lcg(7731);
  for (let y = 0; y < n; y++) {
    const wave = Math.sin((y / n) * Math.PI * 2 * 3) * 2 + Math.sin((y / n) * Math.PI * 2 * 7 + 1) * 1.5;
    ctx.fillStyle = gray(246 + wave + (rand() - 0.5) * 4);
    ctx.fillRect(0, y, n, 1);
  }
  for (let i = 0; i < 10; i++) {
    const y0 = rand() * n;
    const amp = 0.3 + rand() * 1;
    const k = 1 + Math.floor(rand() * 3);
    const phase = rand() * Math.PI * 2;
    ctx.strokeStyle = `rgba(60, 40, 20, ${(0.025 + rand() * 0.035).toFixed(3)})`;
    ctx.lineWidth = 1;
    for (const wrapY of [-n, 0, n]) {
      ctx.beginPath();
      for (let x = 0; x <= n; x += 4) {
        const y = y0 + wrapY + Math.sin((x / n) * Math.PI * 2 * k + phase) * amp;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
}

/** 직물 결. 2 px 칸이 바둑판처럼 번갈아 밝고 어두운 올. */
function paintFabric(ctx: CanvasRenderingContext2D, n: number): void {
  const rand = lcg(4417);
  const cell = 2;
  for (let j = 0; j < n / cell; j++) {
    for (let i = 0; i < n / cell; i++) {
      ctx.fillStyle = gray(((i + j) & 1 ? 250 : 241) + (rand() - 0.5) * 4);
      ctx.fillRect(i * cell, j * cell, cell, cell);
    }
  }
}

const cache = new Map<GrainKind, CanvasTexture>();

/** 종류별 공유 텍스처. 캔버스를 못 얻는 환경(jsdom)에서는 그리지 않은 빈 텍스처가 나온다. */
export function getGrainTexture(kind: GrainKind): CanvasTexture {
  const hit = cache.get(kind);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = GRAIN_SIZE_PX;
  canvas.height = GRAIN_SIZE_PX;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = gray(248);
    ctx.fillRect(0, 0, GRAIN_SIZE_PX, GRAIN_SIZE_PX);
    if (kind === 'wood') paintWood(ctx, GRAIN_SIZE_PX);
    else paintFabric(ctx, GRAIN_SIZE_PX);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.anisotropy = 4;
  cache.set(kind, texture);
  return texture;
}
