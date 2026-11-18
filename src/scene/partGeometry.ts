// 가구 부품 하나의 geometry. 크기와 반지름은 mm로 받아 장면 단위(m)로 만든다. 원점은 부품 중심.
import { BoxGeometry, BufferGeometry, ExtrudeGeometry, Float32BufferAttribute, Shape } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mmToWorld } from '../contracts/coords';
import type { FurniturePart } from './furnitureParts';
import { GRAIN_TILE_M } from './furnitureTexture';

/** 모서리 분할 수(휴대폰 성능을 위해 낮게) */
const ROUND_SEGMENTS = 2;
const CORNER_SEGMENTS = 3;

/** 위에서 본 모양이 둥근 사각형인 판. 위(+y)로 h만큼 솟고, 중심이 원점이다. */
function slab(w: number, h: number, d: number, r: number): BufferGeometry {
  const x = w / 2;
  const z = d / 2;
  const shape = new Shape();
  shape.moveTo(-x + r, -z);
  shape.lineTo(x - r, -z);
  shape.absarc(x - r, -z + r, r, -Math.PI / 2, 0, false);
  shape.lineTo(x, z - r);
  shape.absarc(x - r, z - r, r, 0, Math.PI / 2, false);
  shape.lineTo(-x + r, z);
  shape.absarc(-x + r, z - r, r, Math.PI / 2, Math.PI, false);
  shape.lineTo(-x, -z + r);
  shape.absarc(-x + r, -z + r, r, Math.PI, Math.PI * 1.5, false);
  const g = new ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: CORNER_SEGMENTS });
  // 돌리면 모양의 y는 -z가 되고 두께(z)는 위(+y)가 된다. 모양이 좌우·앞뒤 대칭이라 방향은 그대로다.
  g.rotateX(-Math.PI / 2);
  g.translate(0, -h / 2, 0);
  return g;
}

/**
 * 무늬용 UV. 면의 방향(가장 큰 법선 축)에 따라 장면 좌표(m)를 무늬 한 장의 길이로 나눈 값을 UV로 쓴다.
 * 부품 크기와 상관없이 무늬 크기가 같고, 위·옆·앞면 모두 같은 가로 결 방향(가구 폭 방향 우선)이 된다.
 */
function planarUv(g: BufferGeometry, tileM: number): void {
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i));
    const ny = Math.abs(nor.getY(i));
    const nz = Math.abs(nor.getZ(i));
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    let u: number;
    let v: number;
    if (nx >= ny && nx >= nz) { u = z; v = y; } else if (ny >= nz) { u = x; v = z; } else { u = x; v = y; }
    uv[i * 2] = u / tileM;
    uv[i * 2 + 1] = v / tileM;
  }
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
}

/** 같은 모양의 부품이 geometry를 나눠 쓰게 하는 열쇠 */
export function partGeometryKey(part: FurniturePart): string {
  return `${part.size.join('x')}|r${part.radius ?? 0}|c${part.corner ?? 0}|${part.grain ?? ''}`;
}

/** 각진 무늬 없는 부품(radius·corner·grain 없음)은 undefined를 돌려준다. 그리는 쪽이 boxGeometry로 그린다. */
export function makePartGeometry(part: FurniturePart): BufferGeometry | undefined {
  const [w, h, d] = part.size.map(mmToWorld) as [number, number, number];
  let g: BufferGeometry;
  if (part.corner) g = slab(w, h, d, Math.min(mmToWorld(part.corner), w / 2 - 1e-6, d / 2 - 1e-6));
  else if (part.radius) g = new RoundedBoxGeometry(w, h, d, ROUND_SEGMENTS, mmToWorld(part.radius));
  else if (part.grain) g = new BoxGeometry(w, h, d);
  else return undefined;
  if (part.grain) planarUv(g, GRAIN_TILE_M[part.grain]);
  return g;
}
