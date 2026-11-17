import { describe, expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, OrthographicCamera, PerspectiveCamera } from 'three';
import type { PointMm } from '../contracts/types';
import { mmToWorld } from '../contracts/coords';
import { orthoView, orthoZoomToFit, perspectiveView, type RoomExtent } from './camera';
import { furnitureTransform } from './geometry';
import { mmPerPxAt, clientToFloor, floorToClient, pickFurniture, type ScreenRect } from './pointer';

const room: RoomExtent = { width: 3600, depth: 3000, ceilingHeight: 2400 };
const rect: ScreenRect = { left: 40, top: 60, width: 1280, height: 800 };

function orthoFor(r: ScreenRect): OrthographicCamera {
  const view = orthoView(room);
  const cam = new OrthographicCamera(-r.width / 2, r.width / 2, r.height / 2, -r.height / 2, 0.1, 200);
  cam.up.copy(view.up);
  cam.zoom = orthoZoomToFit(r.width, r.height, room);
  cam.position.copy(view.position);
  cam.lookAt(view.target);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
  return cam;
}

function perspFor(r: ScreenRect): PerspectiveCamera {
  const view = perspectiveView(room, r.width / r.height);
  const cam = new PerspectiveCamera(45, r.width / r.height, 0.05, 200);
  cam.position.copy(view.position);
  cam.lookAt(view.target);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
  return cam;
}

const points: PointMm[] = [
  { x: 0, z: 0 },
  { x: 1000, z: 800 },
  { x: 2456, z: 1994 },
  { x: 3600, z: 3000 },
];

describe('화면 좌표 ↔ 방 바닥 좌표', () => {
  it('평면 뷰: 방 바닥의 점을 화면에 그렸다가 다시 읽으면 같은 mm 좌표가 나온다', () => {
    const cam = orthoFor(rect);
    for (const p of points) {
      const c = floorToClient(cam, rect, p);
      expect(clientToFloor(cam, rect, c.x, c.y), JSON.stringify(p)).toEqual(p);
    }
  });

  it('3D 뷰: 같은 왕복이 원근 카메라에서도 성립한다', () => {
    const cam = perspFor(rect);
    for (const p of points) {
      const c = floorToClient(cam, rect, p);
      expect(clientToFloor(cam, rect, c.x, c.y), JSON.stringify(p)).toEqual(p);
    }
  });

  it('평면 뷰에서 방 원점은 화면 왼쪽 위 쪽에, (3600, 0)은 같은 높이의 오른쪽에 그려진다', () => {
    const cam = orthoFor(rect);
    const origin = floorToClient(cam, rect, { x: 0, z: 0 });
    const right = floorToClient(cam, rect, { x: 3600, z: 0 });
    const below = floorToClient(cam, rect, { x: 0, z: 3000 });
    expect(right.x).toBeGreaterThan(origin.x);
    expect(right.y).toBeCloseTo(origin.y, 6);
    expect(below.y).toBeGreaterThan(origin.y);
    expect(below.x).toBeCloseTo(origin.x, 6);
  });

  it('임의의 화면 점도 정수 mm로 돌아온다', () => {
    const cam = orthoFor(rect);
    const p = clientToFloor(cam, rect, rect.left + 333.3, rect.top + 200.7);
    expect(p).not.toBeNull();
    expect(Number.isInteger(p!.x)).toBe(true);
    expect(Number.isInteger(p!.z)).toBe(true);
  });
});

describe('pickFurniture', () => {
  function sceneWithFurniture(): Group {
    const scene = new Group();
    const t = furnitureTransform({ x: 1800, z: 1500, w: 1200, d: 600, h: 720, elevation: 0, rotationDeg: 0 });
    const mesh = new Mesh(new BoxGeometry(...t.size), new MeshBasicMaterial());
    mesh.position.set(...t.position);
    mesh.userData = { kind: 'furniture', furnitureId: 'sofa-1' };
    scene.add(mesh);
    return scene;
  }

  it('가구 중심을 누르면 그 가구를 찾고, 중심 좌표를 mm로 돌려준다', () => {
    const scene = sceneWithFurniture();
    const cam = orthoFor(rect);
    const c = floorToClient(cam, rect, { x: 1800, z: 1500 });
    const hit = pickFurniture(scene, cam, rect, c.x, c.y);
    expect(hit?.itemId).toBe('sofa-1');
    expect(hit?.center).toEqual({ x: 1800, z: 1500 });
  });

  it('가구 밖의 빈 곳은 null이다', () => {
    const scene = sceneWithFurniture();
    const cam = orthoFor(rect);
    const c = floorToClient(cam, rect, { x: 100, z: 100 });
    expect(pickFurniture(scene, cam, rect, c.x, c.y)).toBeNull();
  });

  it('가구 앞을 가리는 보이는 벽이 있으면 벽이 먼저 맞은 것이므로 null이다', () => {
    const scene = sceneWithFurniture();
    // 평면 뷰에서 가구 중심 바로 위에 벽 상자를 세운다
    const wall = new Mesh(new BoxGeometry(mmToWorld(3600), 2.4, 0.1), new MeshBasicMaterial());
    wall.position.set(1.8, 1.2, 1.5);
    wall.userData = { kind: 'wall' };
    scene.add(wall);
    const cam = orthoFor(rect);
    const c = floorToClient(cam, rect, { x: 1800, z: 1500 });
    expect(pickFurniture(scene, cam, rect, c.x, c.y)).toBeNull();
    wall.visible = false;
    expect(pickFurniture(scene, cam, rect, c.x, c.y)?.itemId).toBe('sofa-1');
  });

  it('평면 뷰에서는 칸막이 벽이 가구를 가리지 않는다(칸막이와 겹친 가구를 끌어 뺄 수 있게)', () => {
    const scene = sceneWithFurniture();
    const partition = new Mesh(new BoxGeometry(0.1, 2.4, 2), new MeshBasicMaterial());
    partition.position.set(1.8, 1.2, 1.5);
    partition.userData = { kind: 'partition' };
    scene.add(partition);
    const cam = orthoFor(rect);
    const c = floorToClient(cam, rect, { x: 1800, z: 1500 });
    expect(pickFurniture(scene, cam, rect, c.x, c.y)?.itemId).toBe('sofa-1');
  });

  function overlapped(): Group {
    const scene = new Group();
    // 같은 자리에 겹친 두 가구. b가 더 높아 위에서 보면 b가 가까운 쪽(맨 위)이다.
    for (const [id, h] of [['a', 700], ['b', 900]] as const) {
      const tr = furnitureTransform({ x: 1800, z: 1500, w: 1200, d: 600, h, elevation: 0, rotationDeg: 0 });
      const mesh = new Mesh(new BoxGeometry(...tr.size), new MeshBasicMaterial());
      mesh.position.set(...tr.position);
      mesh.userData = { kind: 'furniture', furnitureId: id };
      scene.add(mesh);
    }
    return scene;
  }

  it('겹친 자리에서 선택된 가구가 없으면 맨 위(가장 가까운) 가구를 고른다', () => {
    const cam = orthoFor(rect);
    const c = floorToClient(cam, rect, { x: 1800, z: 1500 });
    expect(pickFurniture(overlapped(), cam, rect, c.x, c.y)?.itemId).toBe('b');
    expect(pickFurniture(overlapped(), cam, rect, c.x, c.y, null)?.itemId).toBe('b');
  });

  it('겹친 자리에 선택된 가구가 있으면 아래에 깔린 것이라도 선택된 가구를 고른다', () => {
    const cam = orthoFor(rect);
    const c = floorToClient(cam, rect, { x: 1800, z: 1500 });
    expect(pickFurniture(overlapped(), cam, rect, c.x, c.y, 'a')?.itemId).toBe('a');
  });

  it('선택된 가구가 그 자리에 없으면 맨 위 가구를 고른다', () => {
    const cam = orthoFor(rect);
    const c = floorToClient(cam, rect, { x: 1800, z: 1500 });
    expect(pickFurniture(overlapped(), cam, rect, c.x, c.y, 'zzz')?.itemId).toBe('b');
  });

  it('선택된 가구가 벽 뒤에 가려져 있으면 고르지 않는다', () => {
    const scene = overlapped();
    const wall = new Mesh(new BoxGeometry(mmToWorld(3600), 2.4, 0.1), new MeshBasicMaterial());
    wall.position.set(1.8, 1.2, 1.5);
    wall.userData = { kind: 'wall' };
    scene.add(wall);
    const cam = orthoFor(rect);
    const c = floorToClient(cam, rect, { x: 1800, z: 1500 });
    expect(pickFurniture(scene, cam, rect, c.x, c.y, 'a')).toBeNull();
  });
});

describe('mmPerPxAt', () => {
  it('평면 뷰에서는 어디서나 같고, 확대 2배면 절반이다', () => {
    const cam = orthoFor(rect);
    const a = mmPerPxAt(cam, rect, 300, 200);
    const b = mmPerPxAt(cam, rect, 1000, 700);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeCloseTo(a!, 6);
    cam.zoom *= 2;
    cam.updateProjectionMatrix();
    expect(mmPerPxAt(cam, rect, 300, 200)).toBeCloseTo(a! / 2, 6);
  });

  it('원근 뷰에서는 먼 곳(화면 위쪽)이 가까운 곳보다 크다', () => {
    const cam = perspFor(rect);
    const far = mmPerPxAt(cam, rect, 680, 330);
    const near = mmPerPxAt(cam, rect, 680, 780);
    expect(far).toBeDefined();
    expect(near).toBeDefined();
    expect(far!).toBeGreaterThan(near!);
  });

  it('바닥과 만나지 않으면 undefined다', () => {
    const cam = perspFor(rect);
    cam.position.set(1, 1, 1);
    cam.lookAt(5, 1, 1); // 수평으로 본다: 광선이 바닥과 평행
    cam.updateMatrixWorld();
    expect(mmPerPxAt(cam, rect, 680, 400)).toBeUndefined();
  });
});
