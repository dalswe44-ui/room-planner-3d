// 화면 좌표(CSS px, 뷰포트 기준) ↔ 방 바닥 좌표(mm). 장면 좌표 변환은 coords.ts 함수만 쓴다.
import { Camera, Object3D, Plane, Raycaster, Vector2, Vector3 } from 'three';
import { mmToWorld, worldToRoom } from '../contracts/coords';
import type { PointMm } from '../contracts/types';
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
  // Math.round가 만든 -0을 0으로 맞춘다(값은 같고 저장과 비교에서 다르게 보이지 않게)
  return { x: p.x || 0, z: p.z || 0 };
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
 */
export function pickFurniture(
  scene: Object3D,
  camera: Camera,
  rect: ScreenRect,
  clientX: number,
  clientY: number,
): FurnitureHit | null {
  // 렌더 전에 눌렸을 수도 있으므로 레이캐스트 전에 월드 행렬을 맞춘다
  scene.updateMatrixWorld();
  camera.updateMatrixWorld();
  const candidates: Object3D[] = [];
  scene.traverse((obj) => {
    const kind = sceneDataOf(obj).kind;
    if (kind === 'furniture' || (kind === 'wall' && obj.visible)) candidates.push(obj);
  });
  const raycaster = new Raycaster();
  raycaster.setFromCamera(ndcOf(clientX, clientY, rect), camera);
  const first = raycaster.intersectObjects(candidates, false)[0];
  if (!first) return null;
  const data = sceneDataOf(first.object);
  if (data.kind !== 'furniture' || data.furnitureId === undefined) return null;
  const center = worldToRoom(first.object.position.x, first.object.position.z);
  return { itemId: data.furnitureId, center: { x: center.x || 0, z: center.z || 0 } };
}
