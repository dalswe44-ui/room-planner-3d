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

describe('미리보기(draft) 가구', () => {
  it('draft 표식이 있는 가구는 snapshot.draft에 들어가고 items에는 없다', () => {
    const scene = buildScene(3600, 3000, 2400);
    addFurniture(scene, 'A', { x: 1000, z: 1000, w: 1000, d: 600, h: 500, rotationDeg: 0 });
    addFurniture(scene, 'D', { x: 2000, z: 1200, w: 1800, d: 900, h: 800, rotationDeg: 90 });
    (scene.children[scene.children.length - 1] as Mesh).userData.draft = true;
    const snap = readSnapshot(scene, new OrthographicCamera());
    expect(snap.items.map((i) => i.id)).toEqual(['A']);
    expect(snap.draft?.id).toBe('D');
    expect(snap.draft?.center).toEqual({ x: 2000, y: 400, z: 1200 });
    expect(snap.draft?.size).toEqual({ w: 1800, h: 800, d: 900 });
    expect(snap.draft?.rotationDeg).toBe(90);
  });

  it('미리보기가 없으면 draft는 null이다', () => {
    expect(readSnapshot(buildScene(3600, 3000, 2400), new OrthographicCamera()).draft).toBeNull();
  });
});

describe('readSnapshot: 칸막이 벽, 개구부, 이름표, 편집 모드', () => {
  it('벽 자리 메시와 개구부 상자의 위치·회전·크기에서 mm 값을 읽는다(바깥 벽 문은 몸통 쪽 이동을 되돌린다)', () => {
    const scene = buildScene(5000, 4000, 2400);
    // 칸막이 벽 a (3000, 2500) → b (5000, 2500): 방향 +x, rotationY 0
    const foot = new Mesh(new BoxGeometry(mmToWorld(2000), mmToWorld(1), mmToWorld(100)), new MeshStandardMaterial());
    foot.position.set(mmToWorld(4000), 0, mmToWorld(2500));
    foot.userData = { kind: 'partitionFootprint', wallId: 'w2', selected: true };
    scene.add(foot);
    // 세로 벽 a (3000, 0) → b (3000, 2500): 방향 +z, rotationY = -90도
    const foot2 = new Mesh(new BoxGeometry(mmToWorld(2500), mmToWorld(1), mmToWorld(100)), new MeshStandardMaterial());
    foot2.position.set(mmToWorld(3000), 0, mmToWorld(1250));
    foot2.rotation.y = -Math.PI / 2;
    foot2.userData = { kind: 'partitionFootprint', wallId: 'w1' };
    scene.add(foot2);
    // 바깥 벽 2(아래쪽, 방향 -x)의 문: 구간 x 4400 → 3500, 몸통 쪽(+z)으로 50 이동
    const door = new Mesh(new BoxGeometry(mmToWorld(900), mmToWorld(2100), mmToWorld(240)), new MeshStandardMaterial());
    door.position.set(mmToWorld(3950), mmToWorld(1050), mmToWorld(4050));
    door.rotation.y = Math.PI;
    door.userData = { kind: 'opening', role: 'span', structure: { kind: 'opening', id: 'd1' }, openingType: 'door', shiftMm: { x: 0, z: 50 }, selected: true };
    scene.add(door);
    // 문짝(role leaf)은 개구부 목록에 들어가지 않는다
    const leaf = new Mesh(new BoxGeometry(0.9, 2.1, 0.04), new MeshStandardMaterial());
    leaf.userData = { kind: 'opening', role: 'leaf', structure: { kind: 'opening', id: 'd1' } };
    scene.add(leaf);

    const snap = readSnapshot(scene, new OrthographicCamera(), { editMode: 'structure' });
    expect(snap.walls).toEqual([
      { id: 'w2', a: { x: 3000, z: 2500 }, b: { x: 5000, z: 2500 }, thickness: 100, selected: true },
      { id: 'w1', a: { x: 3000, z: 0 }, b: { x: 3000, z: 2500 }, thickness: 100, selected: false },
    ]);
    expect(snap.openings).toEqual([{ id: 'd1', type: 'door', from: { x: 4400, z: 4000 }, to: { x: 3500, z: 4000 }, selected: true }]);
    expect(snap.editMode).toBe('structure');
    expect(snap.labels).toEqual([]);
    expect(readSnapshot(scene, new OrthographicCamera()).editMode).toBe('furniture');
  });

  it('이름표는 그려진 DOM 요소에서 읽는다', () => {
    const root = document.createElement('div');
    root.innerHTML = '<span data-label-id="a" data-at-x="1500" data-at-z="1500">거실</span>';
    const snap = readSnapshot(buildScene(3600, 3000, 2400), new OrthographicCamera(), { labelRoot: root });
    expect(snap.labels).toEqual([{ id: 'a', name: '거실', at: { x: 1500, z: 1500 } }]);
  });
});

describe('readSnapshot: 사람 뷰의 eye는 실제 카메라에서 읽는다', () => {
  function walkCamera(): PerspectiveCamera {
    const cam = new PerspectiveCamera(70, 1.5, 0.05, 200);
    cam.userData = { walk: true };
    cam.rotation.order = 'YXZ';
    return cam;
  }
  it('평면 뷰·3D 뷰에서는 eye가 null이고 view는 각각 2d, 3d다', () => {
    const scene = buildScene(5000, 4000, 2400);
    expect(readSnapshot(scene, new OrthographicCamera()).eye).toBeNull();
    const s3 = readSnapshot(scene, new PerspectiveCamera());
    expect(s3.view).toBe('3d');
    expect(s3.eye).toBeNull();
  });
  it('사람 뷰: 위치(mm)·눈높이·방향(도)을 카메라에서 읽는다', () => {
    const cam = walkCamera();
    cam.position.set(2.5, 1.5, 2);
    cam.rotation.set(0, (270 * Math.PI) / 180, 0);
    const snap = readSnapshot(buildScene(5000, 4000, 2400), cam);
    expect(snap.view).toBe('walk');
    expect(snap.eye).toEqual({ x: 2500, z: 2000, height: 1500, headingDeg: 270 });
  });
  it('카메라를 돌리거나 옮기면 값이 따라 바뀐다(위아래만 보면 방향은 그대로)', () => {
    const cam = walkCamera();
    cam.position.set(1, 1.5, 1);
    const scene = buildScene(5000, 4000, 2400);
    cam.rotation.set(0.5, 0, 0);
    expect(readSnapshot(scene, cam).eye).toEqual({ x: 1000, z: 1000, height: 1500, headingDeg: 0 });
    cam.rotation.y = Math.PI / 2;
    cam.position.x = 3;
    expect(readSnapshot(scene, cam).eye).toEqual({ x: 3000, z: 1000, height: 1500, headingDeg: 90 });
  });
});
