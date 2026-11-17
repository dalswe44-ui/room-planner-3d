// 화면 좌표(CSS px, 뷰포트 기준) ↔ 방 바닥 좌표(mm). 장면 좌표 변환은 coords.ts 함수만 쓴다.
import { Camera, Object3D, Plane, Raycaster, Vector2, Vector3 } from 'three';
import { mmToWorld, worldToRoom } from '../contracts/coords';
import type { PointMm, StructureTarget } from '../contracts/types';
import { sceneDataOf } from './geometry';

export interface ScreenRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface FurnitureHit {
  itemId: string;
  /** 가구 중심의 바닥 좌표(mm). 바닥과 교차하지 않을 때의 대체 값으로 쓴다. */
  center: PointMm;
}

/** y = 0 바닥 평면 */
const FLOOR = new Plane(new Vector3(0, 1, 0), 0);

export function screenRectOf(element: Element): ScreenRect {
  const r = element.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

function ndcOf(clientX: number, clientY: number, rect: ScreenRect): Vector2 {
  return new Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1,
  );
}

/** 화면의 한 점이 가리키는 바닥 위 점(정수 mm). 광선이 바닥과 만나지 않으면 null. */
export function clientToFloor(
  camera: Camera,
  rect: ScreenRect,
  clientX: number,
  clientY: number,
): PointMm | null {
  camera.updateMatrixWorld();
  const raycaster = new Raycaster();
  raycaster.setFromCamera(ndcOf(clientX, clientY, rect), camera);
  const hit = new Vector3();
  if (!raycaster.ray.intersectPlane(FLOOR, hit)) return null;
  const p = worldToRoom(hit.x, hit.z);
  return p;
}

function floorWorld(camera: Camera, rect: ScreenRect, clientX: number, clientY: number): Vector3 | null {
  const raycaster = new Raycaster();
  raycaster.setFromCamera(ndcOf(clientX, clientY, rect), camera);
  const hit = new Vector3();
  return raycaster.ray.intersectPlane(FLOOR, hit) ? hit : null;
}

/**
 * 화면의 한 점에서 화면 1 px 이동이 바닥 위 몇 mm인지(오른쪽 1 px, 아래쪽 1 px 두 거리의 평균).
 * 바닥과 만나지 않거나 값이 유한하지 않으면 undefined. 반올림하지 않은 실수 mm다.
 */
export function mmPerPxAt(camera: Camera, rect: ScreenRect, clientX: number, clientY: number): number | undefined {
  camera.updateMatrixWorld();
  const o = floorWorld(camera, rect, clientX, clientY);
  const dx = floorWorld(camera, rect, clientX + 1, clientY);
  const dy = floorWorld(camera, rect, clientX, clientY + 1);
  if (!o || !dx || !dy) return undefined;
  const mm = (o.distanceTo(dx) + o.distanceTo(dy)) / 2 / mmToWorld(1);
  return Number.isFinite(mm) && mm > 0 ? mm : undefined;
}

/** 방 바닥의 한 점이 화면의 어디에 그려지는지(뷰포트 기준 CSS px) */
export function floorToClient(camera: Camera, rect: ScreenRect, point: PointMm): { x: number; y: number } {
  camera.updateMatrixWorld();
  const ndc = new Vector3(mmToWorld(point.x), 0, mmToWorld(point.z)).project(camera);
  return {
    x: rect.left + ((ndc.x + 1) / 2) * rect.width,
    y: rect.top + ((1 - ndc.y) / 2) * rect.height,
  };
}

/**
 * 화면의 한 점 아래에 있는 가구를 찾는다. 가구보다 가까운 보이는 벽이 있으면 벽이 먼저 맞은 것으로 보고 null이다.
 * 가구가 겹쳐 있으면 맨 위(가장 가까운) 가구를 고르되, selectedId인 가구가 벽보다 앞의 그 자리에 있으면 그 가구를 고른다.
 */
export function pickFurniture(
  scene: Object3D,
  camera: Camera,
  rect: ScreenRect,
  clientX: number,
  clientY: number,
  selectedId?: string | null,
): FurnitureHit | null {
  // 렌더 전에 눌렸을 수도 있으므로 레이캐스트 전에 월드 행렬을 맞춘다
  scene.updateMatrixWorld();
  camera.updateMatrixWorld();
  const candidates: Object3D[] = [];
  scene.traverse((obj) => {
    const kind = sceneDataOf(obj).kind;
    if (kind === 'furniture' || ((kind === 'wall' || kind === 'partition') && obj.visible)) candidates.push(obj);
  });
  const raycaster = new Raycaster();
  raycaster.setFromCamera(ndcOf(clientX, clientY, rect), camera);
  // 가까운 순으로 보다가 벽을 만나면 그 뒤는 가려진 것이다.
  const hits: Object3D[] = [];
  for (const h of raycaster.intersectObjects(candidates, false)) {
    if (sceneDataOf(h.object).kind !== 'furniture') break;
    hits.push(h.object);
  }
  const chosen = hits.find((o) => sceneDataOf(o).furnitureId === selectedId) ?? hits[0];
  if (!chosen) return null;
  const itemId = sceneDataOf(chosen).furnitureId;
  if (itemId === undefined) return null;
  return { itemId, center: worldToRoom(chosen.position.x, chosen.position.z) };
}

export interface StructureRayHit {
  distance: number;
  /** 구조물이면 눌린 대상. 가구(누를 수 없지만 앞을 가린다)면 undefined */
  target?: StructureTarget;
}

/** 문·창문이 같은 자리의 벽보다 우선하는 거리 여유(m). 개구부 상자와 벽 조각의 면이 맞닿는 자리에서 벽이 먼저 맞는 것을 막는다. */
export const OPENING_PRIORITY_SLACK_M = 0.15;

/**
 * 광선이 맞은 것들(가까운 순)에서 눌린 구조물을 고른다. 가장 가까운 것이 가구면 누를 수 있는 것이 없다(빈 곳).
 * 가장 가까운 것에서 여유 거리 안에 문·창문이 있으면 그것이 우선이고, 아니면 가장 가까운 구조물이다.
 */
export function chooseStructureHit(hits: readonly StructureRayHit[]): StructureTarget | null {
  const sorted = [...hits].sort((a, b) => a.distance - b.distance);
  const first = sorted[0];
  if (!first || !first.target) return null;
  const opening = sorted.find((h) => h.target?.kind === 'opening' && h.distance <= first.distance + OPENING_PRIORITY_SLACK_M);
  return (opening ?? first).target ?? null;
}

/** 화면의 한 점 아래에서 구조 편집 모드로 눌리는 구조물(문·창문 > 칸막이 벽 > 바깥 벽). 보이지 않는 벽은 제외한다. */
export function pickStructure(
  scene: Object3D,
  camera: Camera,
  rect: ScreenRect,
  clientX: number,
  clientY: number,
): StructureTarget | null {
  scene.updateMatrixWorld();
  camera.updateMatrixWorld();
  const candidates: Object3D[] = [];
  scene.traverse((obj) => {
    const d = sceneDataOf(obj);
    if (d.kind === 'furniture' || (d.structure !== undefined && obj.visible)) candidates.push(obj);
  });
  const raycaster = new Raycaster();
  raycaster.setFromCamera(ndcOf(clientX, clientY, rect), camera);
  const hits = raycaster.intersectObjects(candidates, false).map((h) => ({ distance: h.distance, target: sceneDataOf(h.object).structure }));
  return chooseStructureHit(hits);
}
