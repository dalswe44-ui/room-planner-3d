import { describe, expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, OrthographicCamera } from 'three';
import { mmToWorld } from '../contracts/coords';
import { orthoView, orthoZoomToFit } from './camera';
import { furnitureTransform } from './geometry';
import { floorToClient, pickFurniture } from './pointer';

describe('미리보기 가구 선택', () => {
  it('draft 표식이 있는 가구도 레이캐스트에 맞아 id와 중심을 돌려준다', () => {
    const room = { width: 3600, depth: 3000, ceilingHeight: 2400 };
    const W = 1000;
    const H = 800;
    const view = orthoView(room);
    const cam = new OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, 0.1, 200);
    cam.up.copy(view.up);
    cam.zoom = orthoZoomToFit(W, H, room);
    cam.position.copy(view.position);
    cam.lookAt(view.target);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    const t = furnitureTransform({ x: 1200, z: 900, w: 1800, d: 900, h: 800, elevation: 0, rotationDeg: 0 });
    const mesh = new Mesh(new BoxGeometry(...t.size), new MeshBasicMaterial());
    mesh.position.set(...t.position);
    mesh.userData = { kind: 'furniture', furnitureId: 'draft-1', draft: true };
    const scene = new Group();
    scene.add(mesh);
    const rect = { left: 0, top: 0, width: W, height: H };
    const p = floorToClient(cam, rect, { x: 1200, z: 900 });
    expect(pickFurniture(scene, cam, rect, p.x, p.y, 'draft-1')).toEqual({ itemId: 'draft-1', center: { x: 1200, z: 900 } });
    const far = floorToClient(cam, rect, { x: 3400, z: 2800 });
    expect(pickFurniture(scene, cam, rect, far.x, far.y, 'draft-1')).toBeNull();
    expect(mmToWorld(1800)).toBeCloseTo(1.8);
  });
});
