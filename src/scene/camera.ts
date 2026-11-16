// 카메라 자세와 벽 가림 규칙. 값 계산만 하고 three.js 장면은 만들지 않는다.
import { Camera, MathUtils, Object3D, Vector3 } from 'three';
import { mmToWorld } from '../contracts/coords';
import type { Mm, ViewMode } from '../contracts/types';
import { sceneDataOf } from './geometry';

export const FOV_DEG = 45;
/** 평면 뷰의 카메라 높이(m). 방 위에 떠 있을 뿐이고 근·원 평면 안에 들어가면 된다. */
const ORTHO_HEIGHT_M = 20;
/** 방이 화면을 가득 채우지 않도록 두는 여백 배율 */
const FIT_MARGIN = 1.15;
/** 3D 뷰의 처음 시선 방향(카메라 쪽은 +x, +z, 위). 이 쪽의 벽은 가려진다. */
const PERSP_DIRECTION = new Vector3(0.55, 0.75, 0.85).normalize();

export interface RoomExtent {
  width: Mm;
  depth: Mm;
  ceilingHeight: Mm;
}

/** 평면 뷰: 방 중심 위에서 내려다본다. 위쪽이 -z(벽 0 쪽), 오른쪽이 +x다. */
export function orthoView(extent: RoomExtent): { target: Vector3; position: Vector3; up: Vector3 } {
  const cx = mmToWorld(extent.width) / 2;
  const cz = mmToWorld(extent.depth) / 2;
  return {
    target: new Vector3(cx, 0, cz),
    position: new Vector3(cx, ORTHO_HEIGHT_M, cz),
    up: new Vector3(0, 0, -1),
  };
}

/** 평면 뷰의 확대율(px/m). 프러스텀을 캔버스 픽셀 크기로 잡았을 때 방이 여백과 함께 들어가는 값이다. */
export function orthoZoomToFit(viewportW: number, viewportH: number, extent: RoomExtent): number {
  const w = Math.max(mmToWorld(extent.width), 0.5) * FIT_MARGIN;
  const d = Math.max(mmToWorld(extent.depth), 0.5) * FIT_MARGIN;
  return Math.max(1, Math.min(viewportW / w, viewportH / d));
}

/**
 * 3D 뷰의 처음 자세. 방 전체를 감싸는 구가 두 시야각 안에 들어가도록 거리를 잡는다.
 * 구는 바닥 네 모서리와 천장 높이를 모두 포함하므로 방 전체가 보인다.
 */
export function perspectiveView(
  extent: RoomExtent,
  aspect: number,
): { target: Vector3; position: Vector3; distance: number } {
  const w = mmToWorld(extent.width);
  const d = mmToWorld(extent.depth);
  const h = mmToWorld(extent.ceilingHeight);
  const target = new Vector3(w / 2, h / 2, d / 2);
  const radius = Math.hypot(w / 2, d / 2, h / 2);
  const vHalf = MathUtils.degToRad(FOV_DEG) / 2;
  const hHalf = Math.atan(Math.tan(vHalf) * Math.max(aspect, 0.01));
  const distance = (radius / Math.sin(Math.min(vHalf, hHalf))) * 1.1;
  return {
    target,
    position: target.clone().addScaledVector(PERSP_DIRECTION, distance),
    distance,
  };
}

/**
 * 벽 가림. 3D 뷰에서 카메라가 벽의 바깥쪽에 있으면 그 벽을 숨긴다(카메라 쪽 벽이 방 안을 가리지 않게).
 * 평면 뷰에서는 모든 벽을 보인다. 벽은 장면의 userData(kind: 'wall')로 찾는다.
 */
export function applyWallVisibility(scene: Object3D, camera: Camera, viewMode: ViewMode): void {
  const cx = camera.position.x;
  const cz = camera.position.z;
  scene.traverse((obj) => {
    const data = sceneDataOf(obj);
    if (data.kind !== 'wall' || !data.edgeMid || !data.outward) return;
    const beyond =
      (cx - data.edgeMid.x) * data.outward.x + (cz - data.edgeMid.z) * data.outward.z > 0;
    obj.visible = !(viewMode === '3d' && beyond);
  });
}
