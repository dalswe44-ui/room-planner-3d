import { describe, expect, it, vi } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, OrthographicCamera, PerspectiveCamera } from 'three';
import type { StructureHandlers, PointMm, StructureTarget } from '../contracts/types';
import { mmToWorld } from '../contracts/coords';
import { orthoView, orthoZoomToFit, perspectiveView, type RoomExtent } from './camera';
import { StructureRouter } from './gestures';
import { isWarningStatus, type SceneUserData } from './geometry';
import { chooseStructureHit, floorToClient, pickStructure, type ScreenRect } from './pointer';

const wall: StructureTarget = { kind: 'wall', id: 'w1' };
const door: StructureTarget = { kind: 'opening', id: 'd1' };
const outer: StructureTarget = { kind: 'outerWall', index: 0 };

describe('chooseStructureHit: 레이캐스트 우선순위', () => {
  it('아무것도 안 맞으면 null, 가장 가까운 것이 가구면 null(가구는 눌리지 않고 뒤를 가린다)', () => {
    expect(chooseStructureHit([])).toBeNull();
    expect(chooseStructureHit([{ distance: 1 }, { distance: 2, target: wall }])).toBeNull();
  });

  it('벽만 맞으면 가장 가까운 벽, 칸막이와 바깥 벽은 거리 순', () => {
    expect(chooseStructureHit([{ distance: 5, target: outer }, { distance: 3, target: wall }])).toEqual(wall);
  });

  it('문·창문은 같은 자리의 벽보다 우선한다(벽이 조금 더 가까워도)', () => {
    expect(chooseStructureHit([{ distance: 3.0, target: wall }, { distance: 3.1, target: door }])).toEqual(door);
  });

  it('문이 벽보다 훨씬 뒤에 있으면(벽에 가려짐) 벽이 눌린다', () => {
    expect(chooseStructureHit([{ distance: 3, target: wall }, { distance: 6, target: door }])).toEqual(wall);
  });
});

const room: RoomExtent = { width: 5000, depth: 4000, ceilingHeight: 2400 };
const rect: ScreenRect = { left: 0, top: 0, width: 1000, height: 700 };

function planCamera(): OrthographicCamera {
  const view = orthoView(room);
  const cam = new OrthographicCamera(-500, 500, 350, -350, 0.1, 200);
  cam.up.copy(view.up);
  cam.zoom = orthoZoomToFit(1000, 700, room);
  cam.position.copy(view.position);
  cam.lookAt(view.target);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
  return cam;
}

function box(x: number, z: number, w: number, h: number, d: number, data: SceneUserData, visible = true): Mesh {
  const m = new Mesh(new BoxGeometry(mmToWorld(w), mmToWorld(h), mmToWorld(d)), new MeshBasicMaterial());
  m.position.set(mmToWorld(x), mmToWorld(h) / 2, mmToWorld(z));
  m.userData = data;
  m.visible = visible;
  return m;
}

describe('pickStructure: 장면에서 눌린 구조물', () => {
  const scene = new Group();
  // 칸막이 벽 (x=3000, z 0~2500), 같은 선 위 z 1400~2300에 문 상자, 바깥 벽 0, 가구
  scene.add(box(3000, 700, 100, 2400, 1400, { kind: 'partition', structure: wall }));
  scene.add(box(3000, 1850, 100, 2100, 900, { kind: 'opening', role: 'span', structure: door }));
  scene.add(box(2500, -50, 5000, 2400, 100, { kind: 'wall', structure: outer }));
  scene.add(box(1000, 2500, 1000, 700, 800, { kind: 'furniture', furnitureId: 'sofa' }));
  scene.add(box(4000, 3000, 100, 2400, 100, { kind: 'wall', structure: { kind: 'outerWall', index: 2 } }, false));
  const cam = planCamera();
  const at = (p: PointMm) => floorToClient(cam, rect, p);
  const pick = (p: PointMm) => pickStructure(scene, cam, rect, at(p).x, at(p).y);

  it('평면 뷰: 벽 단면, 문 구간, 바깥 벽을 각각 맞힌다', () => {
    expect(pick({ x: 3000, z: 500 })).toEqual(wall);
    expect(pick({ x: 3000, z: 1850 })).toEqual(door);
    expect(pick({ x: 2000, z: -50 })).toEqual(outer);
  });

  it('빈 바닥과 가구 위는 null, 숨긴 벽은 맞지 않는다', () => {
    expect(pick({ x: 1500, z: 1500 })).toBeNull();
    expect(pick({ x: 1000, z: 2500 })).toBeNull();
    expect(pick({ x: 4000, z: 3000 })).toBeNull();
  });

  it('3D 뷰에서도 벽 몸통을 맞힌다', () => {
    const view = perspectiveView(room, 1000 / 700);
    const p = new PerspectiveCamera(45, 1000 / 700, 0.05, 200);
    p.position.copy(view.position);
    p.lookAt(view.target);
    p.updateProjectionMatrix();
    p.updateMatrixWorld();
    const c = floorToClient(p, rect, { x: 3000, z: 500 });
    // 바닥 점 바로 위 벽 중간 높이를 누른다
    const hits = pickStructure(scene, p, rect, c.x, c.y - 30);
    expect(hits?.kind === 'wall' || hits?.kind === 'outerWall' || hits?.kind === 'opening').toBe(true);
  });
});

function routerSetup(plan: boolean) {
  const handlers: StructureHandlers = {
    onTargetPointerDown: vi.fn(),
    onBackgroundPointerDown: vi.fn(),
    onPointerMove: vi.fn(),
    onPointerUp: vi.fn(),
    onBackgroundTap: vi.fn(),
  };
  const setCameraEnabled = vi.fn();
  const floor: PointMm = { x: 1000, z: 800 };
  const router = new StructureRouter({ handlers, toFloor: () => floor, setCameraEnabled });
  return { router, handlers, setCameraEnabled, floor, plan };
}

describe('StructureRouter: 구조 모드 라우팅', () => {
  it('구조물을 누르면 카메라를 끄고 onTargetPointerDown, 끌면 onPointerMove, 떼면 onPointerUp과 카메라 켜기', () => {
    const { router, handlers, setCameraEnabled, floor } = routerSetup(true);
    router.pointerDown(1, 10, 10, true, door, true);
    expect(setCameraEnabled).toHaveBeenNthCalledWith(1, false);
    expect(handlers.onTargetPointerDown).toHaveBeenCalledWith(door, floor);
    router.pointerMove(1, 50, 50);
    expect(handlers.onPointerMove).toHaveBeenCalledTimes(1);
    router.pointerUp(1);
    expect(handlers.onPointerUp).toHaveBeenCalledTimes(1);
    expect(setCameraEnabled).toHaveBeenLastCalledWith(true);
    expect(handlers.onBackgroundTap).not.toHaveBeenCalled();
  });

  it('평면 뷰의 빈 바닥 끌기는 벽 그리기: onBackgroundPointerDown → move → up, 카메라는 멈춘다(이동 없음)', () => {
    const { router, handlers, setCameraEnabled, floor } = routerSetup(true);
    router.pointerDown(1, 10, 10, true, null, true);
    expect(handlers.onBackgroundPointerDown).toHaveBeenCalledWith(floor);
    expect(setCameraEnabled).toHaveBeenCalledWith(false);
    router.pointerMove(1, 80, 10);
    router.pointerUp(1);
    expect(handlers.onPointerMove).toHaveBeenCalledTimes(1);
    expect(handlers.onPointerUp).toHaveBeenCalledTimes(1);
    expect(handlers.onBackgroundTap).not.toHaveBeenCalled();
  });

  it('평면 뷰의 빈 바닥 6 px 이내 탭: onPointerUp 뒤에 onBackgroundTap', () => {
    const { router, handlers } = routerSetup(true);
    router.pointerDown(1, 10, 10, true, null, true);
    router.pointerMove(1, 13, 12);
    router.pointerUp(1);
    expect(handlers.onPointerUp).toHaveBeenCalledTimes(1);
    expect(handlers.onBackgroundTap).toHaveBeenCalledTimes(1);
  });

  it('3D 뷰의 빈 곳은 카메라 조작: 벽 그리기 없음, 끌면 아무것도 안 부르고 짧은 탭만 onBackgroundTap', () => {
    const { router, handlers, setCameraEnabled } = routerSetup(false);
    router.pointerDown(1, 10, 10, true, null, false);
    router.pointerMove(1, 90, 90);
    router.pointerUp(1);
    expect(handlers.onBackgroundPointerDown).not.toHaveBeenCalled();
    expect(handlers.onPointerMove).not.toHaveBeenCalled();
    expect(handlers.onBackgroundTap).not.toHaveBeenCalled();
    expect(setCameraEnabled).not.toHaveBeenCalled();
    router.pointerDown(2, 10, 10, true, null, false);
    router.pointerUp(2);
    expect(handlers.onBackgroundTap).toHaveBeenCalledTimes(1);
  });

  it('두 번째 손가락이나 보조 버튼은 카메라 조작이다', () => {
    const { router, handlers } = routerSetup(true);
    router.pointerDown(1, 10, 10, true, null, true);
    router.pointerDown(2, 50, 50, true, door, true);
    expect(handlers.onTargetPointerDown).not.toHaveBeenCalled();
    router.pointerUp(2);
    router.pointerUp(1);
    router.pointerDown(3, 10, 10, false, null, true);
    expect(handlers.onBackgroundPointerDown).toHaveBeenCalledTimes(1);
  });
});

describe('isWarningStatus: 경고색 규칙', () => {
  const none = { overlap: false, outside: false, wall: false, door: false };
  it('겹침, 방 이탈, 칸막이 벽 겹침, 문 열림 자리 겹침 중 하나라도 있으면 경고', () => {
    expect(isWarningStatus(undefined)).toBe(false);
    expect(isWarningStatus(none)).toBe(false);
    expect(isWarningStatus({ ...none, overlap: true })).toBe(true);
    expect(isWarningStatus({ ...none, outside: true })).toBe(true);
    expect(isWarningStatus({ ...none, wall: true })).toBe(true);
    expect(isWarningStatus({ ...none, door: true })).toBe(true);
  });
});
