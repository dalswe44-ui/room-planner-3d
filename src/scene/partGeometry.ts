// 가구 부품 하나의 geometry. 크기와 반지름은 mm로 받아 장면 단위(m)로 만든다. 원점은 부품 중심.
import { BufferGeometry, ExtrudeGeometry, Shape } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mmToWorld } from '../contracts/coords';
import type { FurniturePart } from './furnitureParts';

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

/** 각진 부품(radius·corner 없음)은 undefined를 돌려준다. 그리는 쪽이 boxGeometry로 그린다. */
export function makePartGeometry(part: FurniturePart): BufferGeometry | undefined {
  const [w, h, d] = part.size.map(mmToWorld) as [number, number, number];
  if (part.corner) return slab(w, h, d, Math.min(mmToWorld(part.corner), w / 2 - 1e-6, d / 2 - 1e-6));
  if (part.radius) return new RoundedBoxGeometry(w, h, d, ROUND_SEGMENTS, mmToWorld(part.radius));
  return undefined;
}
