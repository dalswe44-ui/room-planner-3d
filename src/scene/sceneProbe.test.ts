import { describe, expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, OrthographicCamera, PerspectiveCamera, ShapeGeometry } from 'three';
import type { RootState } from '@react-three/fiber';
import { rectCorners } from '../contracts/room';
import { mmToWorld } from '../contracts/coords';
import { orthoView, orthoZoomToFit } from './camera';
import { floorShape, furnitureTransform, wallSegments } from './geometry';
import { createSceneProbe, readSnapshot, type SceneRuntime } from './sceneProbe';

/** Room.tsx와 같은 방식으로 바닥과 벽을 만든 장면. WebGL 없이 객체 구조만 맞춘다. */
function buildScene(width: number, depth: number, ceiling: number): Group {
  const scene = new Group();
  const floor = new Mesh(new ShapeGeometry(floorShape(rectCorners(width, depth))), new MeshStandardMaterial());
  floor.rotation.x = -Math.PI / 2;
  floor.userData = { kind: 'floor' };
  scene.add(floor);
  for (const seg of wallSegments(rectCorners(width, depth))) {
    const wall = new Mesh(
      new BoxGeometry(mmToWorld(seg.length), mmToWorld(ceiling), mmToWorld(100)),
      new MeshStandardMaterial(),
    );
    wall.position.set(mmToWorld(seg.center.x), mmToWorld(ceiling) / 2, mmToWorld(seg.center.z));
    wall.rotation.y = seg.rotationY;
    wall.userData = { kind: 'wall' };
    scene.add(wall);
  }
  return scene;
}

function addFurniture(
  scene: Group,
  id: string,
  item: { x: number; z: number; w: number; d: number; h: number; rotationDeg: number },
  extra: { warning?: boolean; selected?: boolean } = {},
): void {
  const t = furnitureTransform({ ...item, elevation: 0 });
  const mesh = new Mesh(new BoxGeometry(...t.size), new MeshStandardMaterial({ color: '#7aa2d6' }));
  mesh.position.set(...t.position);
  mesh.rotation.y = t.rotationY;
  mesh.userData = { kind: 'furniture', furnitureId: id, baseColor: '#7aa2d6', warning: extra.warning ?? false, selected: extra.selected ?? false };
  scene.add(mesh);
}

describe('readSnapshot: 실제 장면 객체에서 읽는다', () => {
  it('방 크기는 바닥 메시의 범위, 천장은 벽 상자의 높이에서 온다', () => {
    const scene = buildScene(3600, 3000, 2400);
    const cam = new OrthographicCamera();
    const snap = readSnapshot(scene, cam);
    expect(snap.room).toEqual({ width: 3600, depth: 3000, ceilingHeight: 2400 });
    expect(snap.view).toBe('2d');
  });

  it('가구의 중심·크기·회전은 메시의 위치, 지오메트리, 회전에서 읽는다(F-1 값)', () => {
    const scene = buildScene(3600, 3000, 2400);
    addFurniture(scene, 'desk', { x: 1800, z: 1500, w: 1200, d: 600, h: 720, rotationDeg: 0 }, { selected: true });
    const snap = readSnapshot(scene, new PerspectiveCamera());
    expect(snap.view).toBe('3d');
    expect(snap.items).toHaveLength(1);
    const [item] = snap.items;
    expect(item.id).toBe('desk');
    expect(item.center).toEqual({ x: 1800, y: 360, z: 1500 });
    expect(item.size).toEqual({ w: 1200, h: 720, d: 600 });
    expect(item.rotationDeg).toBe(0);
    expect(item.selected).toBe(true);
    expect(item.warning).toBe(false);
    expect(item.color).toBe('#7aa2d6');
  });

  it('모양 종류는 표식(shape)에서 읽고 없으면 box다', () => {
    const scene = buildScene(3600, 3000, 2400);
    addFurniture(scene, 'A', { x: 1000, z: 1000, w: 1000, d: 600, h: 500, rotationDeg: 0 });
    addFurniture(scene, 'B', { x: 2000, z: 1000, w: 1000, d: 600, h: 500, rotationDeg: 0 });
    (scene.children.filter((o) => o.userData.kind === 'furniture')[1] as Mesh).userData.shape = 'bed';
    expect(readSnapshot(scene, new PerspectiveCamera()).items.map((i) => i.kind)).toEqual(['box', 'bed']);
  });

  it('회전 270도와 경고 상태를 읽는다', () => {
    const scene = buildScene(3600, 3000, 2400);
    addFurniture(scene, 'B', { x: 1000, z: 1000, w: 1000, d: 1000, h: 500, rotationDeg: 270 }, { warning: true });
    const [item] = readSnapshot(scene, new OrthographicCamera()).items;
    expect(item.rotationDeg).toBe(270);
    expect(item.warning).toBe(true);
    expect(item.center).toEqual({ x: 1000, y: 250, z: 1000 });
  });

  it('장면 객체를 바꾸면 스냅샷도 바뀐다(값을 저장해 두지 않는다)', () => {
    const scene = buildScene(3600, 3000, 2400);
    addFurniture(scene, 'A', { x: 1800, z: 1500, w: 1200, d: 600, h: 720, rotationDeg: 0 });
    const furniture = scene.children.find((o) => o.userData.kind === 'furniture') as Mesh;
    furniture.position.x = mmToWorld(2300);
    expect(readSnapshot(scene, new OrthographicCamera()).items[0].center.x).toBe(2300);
  });
});

describe('createSceneProbe', () => {
  function runtimeFor(scene: Group, camera: OrthographicCamera | PerspectiveCamera, rectWidth: number, rectHeight: number): SceneRuntime {
    const fake = {
      scene,
      camera,
      gl: {
        domElement: {
          getBoundingClientRect: () => ({ left: 0, top: 0, width: rectWidth, height: rectHeight, right: rectWidth, bottom: rectHeight, x: 0, y: 0, toJSON: () => ({}) }),
        },
      },
    } as unknown as RootState;
    return { get: () => fake, controlsRef: { current: null } };
  }

  it('준비되기 전에는 조회하면 오류를 낸다', () => {
    const probe = createSceneProbe({ get: null, controlsRef: { current: null } });
    expect(() => probe.snapshot()).toThrow();
  });

  it('floorToClient는 평면 뷰에서 방 원점을 왼쪽 위 쪽에 그린다', () => {
    const scene = buildScene(3600, 3000, 2400);
    const W = 1280;
    const H = 800;
    const view = orthoView({ width: 3600, depth: 3000, ceilingHeight: 2400 });
    const cam = new OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, 0.1, 200);
    cam.up.copy(view.up);
    cam.zoom = orthoZoomToFit(W, H, { width: 3600, depth: 3000, ceilingHeight: 2400 });
    cam.position.copy(view.position);
    cam.lookAt(view.target);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    const probe = createSceneProbe(runtimeFor(scene, cam, W, H));
    const origin = probe.floorToClient(0, 0);
    const right = probe.floorToClient(3600, 0);
    expect(right.x).toBeGreaterThan(origin.x);
    expect(right.y).toBeCloseTo(origin.y, 6);
    // 네 모서리가 scene-canvas 안에 있다
    for (const [x, z] of [[0, 0], [3600, 0], [3600, 3000], [0, 3000]] as const) {
      const p = probe.floorToClient(x, z);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(W);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(H);
    }
  });
});

// 가구 목록의 순서는 장면에 추가한 순서를 따른다
describe('스냅샷의 가구 순서', () => {
  it('장면에 추가한 순서대로 나온다', () => {
    const scene = buildScene(3600, 3000, 2400);
    addFurniture(scene, 'first', { x: 500, z: 500, w: 100, d: 100, h: 100, rotationDeg: 0 });
    addFurniture(scene, 'second', { x: 900, z: 900, w: 100, d: 100, h: 100, rotationDeg: 0 });
    expect(readSnapshot(scene, new OrthographicCamera()).items.map((i) => i.id)).toEqual(['first', 'second']);
  });
});
