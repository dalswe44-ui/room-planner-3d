import { describe, expect, it } from 'vitest';
import { Group, Mesh, OrthographicCamera, PerspectiveCamera, Vector3 } from 'three';
import { mmToWorld } from '../contracts/coords';
import { applyWallVisibility, orthoView, orthoZoomToFit, perspectiveView, type RoomExtent } from './camera';
import { wallSegments } from './geometry';
import { rectCorners } from '../contracts/room';

const room: RoomExtent = { width: 3600, depth: 3000, ceilingHeight: 2400 };

/** 방의 네 바닥 모서리가 카메라의 화면 안(NDC -1 ~ 1)에 들어오는지 */
function cornersInside(camera: OrthographicCamera | PerspectiveCamera): boolean {
  camera.updateMatrixWorld();
  return rectCorners(room.width, room.depth).every((c) => {
    const p = new Vector3(mmToWorld(c.x), 0, mmToWorld(c.z)).project(camera);
    return Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1;
  });
}

describe('평면 뷰 맞춤', () => {
  it('확대율로 잡은 프러스텀에서 방의 네 모서리가 화면 안에 든다(가로·세로 화면 모두)', () => {
    for (const [w, h] of [
      [1280, 800],
      [390, 800],
    ]) {
      const view = orthoView(room);
      const cam = new OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0.1, 200);
      cam.up.copy(view.up);
      cam.zoom = orthoZoomToFit(w, h, room);
      cam.position.copy(view.position);
      cam.lookAt(view.target);
      cam.updateProjectionMatrix();
      expect(cornersInside(cam), `${w}x${h}`).toBe(true);
    }
  });

  it('위에서 본 평면 뷰: 원점은 화면 왼쪽 위, +x는 오른쪽, +z는 아래쪽', () => {
    const view = orthoView(room);
    const cam = new OrthographicCamera(-640, 640, 400, -400, 0.1, 200);
    cam.up.copy(view.up);
    cam.zoom = orthoZoomToFit(1280, 800, room);
    cam.position.copy(view.position);
    cam.lookAt(view.target);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    const origin = new Vector3(0, 0, 0).project(cam);
    const px = new Vector3(mmToWorld(3600), 0, 0).project(cam);
    const pz = new Vector3(0, 0, mmToWorld(3000)).project(cam);
    expect(px.x).toBeGreaterThan(origin.x);
    expect(pz.y).toBeLessThan(origin.y);
  });
});

describe('3D 뷰 맞춤', () => {
  it('원근 카메라에서도 방의 네 모서리가 화면 안에 든다(가로·세로 화면 모두)', () => {
    for (const aspect of [1280 / 800, 390 / 800]) {
      const view = perspectiveView(room, aspect);
      const cam = new PerspectiveCamera(45, aspect, 0.05, 200);
      cam.position.copy(view.position);
      cam.lookAt(view.target);
      cam.updateProjectionMatrix();
      expect(cornersInside(cam), `aspect ${aspect}`).toBe(true);
    }
  });
});

describe('벽 가림', () => {
  function buildWalls(): { scene: Group; walls: Mesh[] } {
    const scene = new Group();
    const walls = wallSegments(rectCorners(room.width, room.depth)).map((seg) => {
      const mesh = new Mesh();
      mesh.userData = {
        kind: 'wall',
        edgeMid: { x: mmToWorld(seg.mid.x), z: mmToWorld(seg.mid.z) },
        outward: seg.outward,
      };
      scene.add(mesh);
      return mesh;
    });
    return { scene, walls };
  }

  it('3D 뷰: 카메라 쪽(+x, +z) 벽은 숨기고 방 안쪽 시선의 벽은 보인다', () => {
    const { scene, walls } = buildWalls();
    const cam = new PerspectiveCamera();
    cam.position.set(1.8 + 6, 5, 1.5 + 6); // 방의 +x, +z 바깥(방 폭 3.6 m, 깊이 3.0 m)
    applyWallVisibility(scene, cam, '3d');
    // 벽 1(x=W)과 벽 2(z=D)는 카메라 쪽이라 가려지고, 벽 0(z=0)과 벽 3(x=0)은 보인다.
    expect(walls.map((w) => w.visible)).toEqual([true, false, false, true]);
  });

  it('카메라가 다른 쪽 바깥이면 가리는 벽도 바뀐다', () => {
    const { scene, walls } = buildWalls();
    const cam = new PerspectiveCamera();
    cam.position.set(-6, 5, -6);
    applyWallVisibility(scene, cam, '3d');
    expect(walls.map((w) => w.visible)).toEqual([false, true, true, false]);
  });

  it('평면 뷰에서는 모든 벽을 보인다', () => {
    const { scene, walls } = buildWalls();
    const cam = new OrthographicCamera();
    cam.position.set(-6, 20, -6);
    applyWallVisibility(scene, cam, '2d');
    expect(walls.every((w) => w.visible)).toBe(true);
  });
});
