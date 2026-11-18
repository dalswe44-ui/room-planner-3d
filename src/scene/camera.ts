// 카메라 자세와 벽 가림 규칙. 값 계산만 하고 three.js 장면은 만들지 않는다.
import { Camera, MathUtils, Object3D, Vector3 } from 'three';
import { mmToWorld } from '../contracts/coords';
import type { Mm, ViewMode } from '../contracts/types';
import { WALL_THICKNESS_MM, sceneDataOf } from './geometry';

export const FOV_DEG = 45;
/** 평면 뷰의 카메라 높이(m). 방 위에 떠 있을 뿐이고 근·원 평면 안에 들어가면 된다. */
const ORTHO_HEIGHT_M = 20;
/** 평면 뷰에서 화면 가장자리에 남기는 여백(px). 위쪽은 폭 치수선, 왼쪽은 깊이 치수선이 들어갈 자리다. */
export const PLAN_MARGIN_PX = { left: 60, top: 52, right: 60, bottom: 16 } as const;
/** 벽 두께(m)는 방 바깥으로 덧붙으므로 맞춤 범위에 양쪽 두께를 더한다. */
const WALL_EXTRA_M = mmToWorld(WALL_THICKNESS_MM) * 2;
/** 3D 뷰의 처음 시선 방향(카메라 쪽은 +x, +z, 위). 이 쪽의 벽은 가려진다. */
const PERSP_DIRECTION = new Vector3(0.55, 0.75, 0.85).normalize();

export interface RoomExtent {
  width: Mm;
  depth: Mm;
  ceilingHeight: Mm;
}

/** 평면 뷰: 방 중심 위에서 내려다본다. 위쪽이 -z(벽 0 쪽), 오른쪽이 +x다. */
export function orthoView(
  extent: RoomExtent,
  shift: { x: number; z: number } = { x: 0, z: 0 },
): { target: Vector3; position: Vector3; up: Vector3 } {
  const cx = mmToWorld(extent.width) / 2 + shift.x;
  const cz = mmToWorld(extent.depth) / 2 + shift.z;
  return {
    target: new Vector3(cx, 0, cz),
    position: new Vector3(cx, ORTHO_HEIGHT_M, cz),
    up: new Vector3(0, 0, -1),
  };
}

/** 평면 뷰의 확대율(px/m). 벽과 치수선이 들어갈 여백을 뺀 영역에 방이 들어가는 값이다. */
export function orthoZoomToFit(viewportW: number, viewportH: number, extent: RoomExtent): number {
  const w = Math.max(mmToWorld(extent.width), 0.5) + WALL_EXTRA_M;
  const d = Math.max(mmToWorld(extent.depth), 0.5) + WALL_EXTRA_M;
  const availW = viewportW - PLAN_MARGIN_PX.left - PLAN_MARGIN_PX.right;
  const availH = viewportH - PLAN_MARGIN_PX.top - PLAN_MARGIN_PX.bottom;
  return Math.max(1, Math.min(availW / w, availH / d));
}

/**
 * 방을 여백 영역의 가운데에 놓기 위한 카메라 목표의 이동량(m). 위·왼쪽 여백이 더 커서 방이 오른쪽 아래로 밀려 보이도록
 * 카메라 목표를 반대로 옮긴다(화면 오른쪽 = +x, 아래 = +z).
 */
export function orthoFitShift(zoom: number): { x: number; z: number } {
  return {
    x: -(PLAN_MARGIN_PX.left - PLAN_MARGIN_PX.right) / 2 / zoom,
    z: -(PLAN_MARGIN_PX.top - PLAN_MARGIN_PX.bottom) / 2 / zoom,
  };
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
    if ((data.kind !== 'wall' && data.kind !== 'opening') || !data.edgeMid || !data.outward) return;
    const beyond =
      (cx - data.edgeMid.x) * data.outward.x + (cz - data.edgeMid.z) * data.outward.z > 0;
    obj.visible = !(viewMode === '3d' && beyond);
  });
}
