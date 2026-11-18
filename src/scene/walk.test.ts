import { describe, expect, it } from 'vitest';
import { Mesh, MeshBasicMaterial, PerspectiveCamera, PlaneGeometry, Group, BoxGeometry } from 'three';
import { rectCorners } from '../contracts/room';
import { mmToWorld } from '../contracts/coords';
import { pickWalkFloor } from './pointer';
import { headingDegOf, pointInPolygon, pullInside, stepFrom, walkFovDeg, walkKeyAction, walkStart, WALK_WALL_MARGIN_MM } from './walk';

describe('headingDegOf: 0은 -z(위쪽 벽), 반시계가 양수', () => {
  it('네 방향', () => {
    expect(headingDegOf(0, -1)).toBe(0);
    expect(headingDegOf(-1, 0)).toBe(90);
    expect(headingDegOf(0, 1)).toBe(180);
    expect(headingDegOf(1, 0)).toBe(270);
  });
  it('카메라 rotation.y(YXZ)와 같은 값이다', () => {
    const cam = new PerspectiveCamera();
    cam.rotation.order = 'YXZ';
    for (const deg of [0, 30, 90, 200, 359]) {
      cam.rotation.set(0.4, (deg * Math.PI) / 180, 0); // 위아래를 봐도 같다
      cam.updateMatrixWorld();
      const f = cam.getWorldDirection(cam.position.clone());
      expect(headingDegOf(f.x, f.z)).toBe(deg);
    }
  });
});

describe('pullInside', () => {
  const room = rectCorners(5000, 4000);
  it('안쪽 점은 그대로', () => {
    expect(pullInside({ x: 2500, z: 2000 }, room)).toEqual({ x: 2500, z: 2000 });
  });
  it('벽에 붙은 점은 margin만큼 띄운다', () => {
    expect(pullInside({ x: 50, z: 2000 }, room)).toEqual({ x: WALK_WALL_MARGIN_MM, z: 2000 });
    expect(pullInside({ x: 4990, z: 3990 }, room)).toEqual({ x: 4600, z: 3600 });
  });
  it('방 밖은 null', () => {
    expect(pullInside({ x: -10, z: 100 }, room)).toBeNull();
    expect(pullInside({ x: 5001, z: 100 }, room)).toBeNull();
  });
  it('ㄱ자 방에서도 방 안에 남는다', () => {
    const L = [
      { x: 0, z: 0 }, { x: 4000, z: 0 }, { x: 4000, z: 2000 }, { x: 2000, z: 2000 }, { x: 2000, z: 4000 }, { x: 0, z: 4000 },
    ];
    const out = pullInside({ x: 1900, z: 1900 }, L);
    expect(out).not.toBeNull();
    expect(pointInPolygon(out!, L)).toBe(true);
  });
});

describe('walkStart (2026-11-19 QA 4-3)', () => {
  it('문이 없으면 왼쪽 아래 모서리에서 벽 600 mm 안쪽에 서서 방 가운데를 보고 12도 내려다본다', () => {
    expect(walkStart(rectCorners(5000, 4000))).toEqual({ x: 600, z: 3400, headingDeg: 306, pitchDeg: -12 });
  });
  it('바깥 벽에 문이 있으면 문 안쪽 600 mm에 선다', () => {
    const s = walkStart(rectCorners(5000, 4000), [{ at: { x: 2500, z: 4000 }, inward: { x: 0, z: -1 } }]);
    expect(s).toEqual({ x: 2500, z: 3400, headingDeg: 0, pitchDeg: -12 });
  });
  it('가구 위 자리는 건너뛰고 다음 모서리에 선다', () => {
    const s = walkStart(rectCorners(5000, 4000), [], [{ minX: 0, maxX: 1200, minZ: 3000, maxZ: 4000 }]);
    expect({ x: s.x, z: s.z }).toEqual({ x: 600, z: 600 });
  });
  it('ㄱ자 방은 넓은 쪽 안의 무게중심을 본다(빠진 모서리 꼭짓점이 아니라)', () => {
    const L = [
      { x: 0, z: 0 },
      { x: 3600, z: 0 },
      { x: 3600, z: 1500 },
      { x: 1800, z: 1500 },
      { x: 1800, z: 3000 },
      { x: 0, z: 3000 },
    ];
    const s = walkStart(L);
    expect({ x: s.x, z: s.z }).toEqual({ x: 600, z: 2400 });
    // (600, 2400)에서 (1500, 1250)을 보는 방향
    expect(s.headingDeg).toBe(headingDegOf(900, -1150));
  });
  it('설 곳이 없으면 방 가운데에서 긴 쪽을 본다', () => {
    const all = [{ minX: 0, maxX: 5000, minZ: 0, maxZ: 4000 }];
    expect(walkStart(rectCorners(5000, 4000), [], all)).toEqual({ x: 2500, z: 2000, headingDeg: 270, pitchDeg: -12 });
  });
});

describe('사람 뷰 키 조작', () => {
  it('↑·W는 앞으로, A·D는 옆으로, ←·→는 돌기', () => {
    expect(walkKeyAction('ArrowUp')).toEqual({ forward: 300, side: 0, turnDeg: 0 });
    expect(walkKeyAction('W')).toEqual({ forward: 300, side: 0, turnDeg: 0 });
    expect(walkKeyAction('s')).toEqual({ forward: -300, side: 0, turnDeg: 0 });
    expect(walkKeyAction('a')).toEqual({ forward: 0, side: -300, turnDeg: 0 });
    expect(walkKeyAction('ArrowLeft')).toEqual({ forward: 0, side: 0, turnDeg: 15 });
    expect(walkKeyAction('x')).toBeNull();
  });
  it('stepFrom: heading 0은 -z로, 오른쪽은 +x', () => {
    expect(stepFrom({ x: 1000, z: 1000 }, 0, 300, 0)).toEqual({ x: 1000, z: 700 });
    expect(stepFrom({ x: 1000, z: 1000 }, 0, 0, 300)).toEqual({ x: 1300, z: 1000 });
    expect(stepFrom({ x: 1000, z: 1000 }, 90, 300, 0)).toEqual({ x: 700, z: 1000 });
  });
});

describe('walkFovDeg', () => {
  it('가로 화면은 70도, 세로 화면은 가로가 70도가 되게 키우되 100도까지', () => {
    expect(walkFovDeg(1.6)).toBe(70);
    expect(walkFovDeg(0.8)).toBeCloseTo(2 * Math.atan(Math.tan((35 * Math.PI) / 180) / 0.8) * (180 / Math.PI), 5);
    expect(walkFovDeg(0.1)).toBe(100);
  });
});

describe('pickWalkFloor', () => {
  const rect = { left: 0, top: 0, width: 800, height: 600 };
  function setup(withFurniture: boolean) {
    const scene = new Group();
    const floor = new Mesh(new PlaneGeometry(10, 10), new MeshBasicMaterial());
    floor.rotation.x = -Math.PI / 2;
    floor.userData = { kind: 'floor' };
    scene.add(floor);
    if (withFurniture) {
      const box = new Mesh(new BoxGeometry(2, 1, 2), new MeshBasicMaterial());
      box.position.set(0, 0.5, -3);
      box.userData = { kind: 'furniture', furnitureId: 'a' };
      scene.add(box);
    }
    const cam = new PerspectiveCamera(70, 800 / 600, 0.05, 200);
    cam.position.set(0, 1.5, 0);
    cam.rotation.order = 'YXZ';
    cam.updateMatrixWorld();
    return { scene, cam };
  }
  it('바닥을 누르면 그 자리의 mm 좌표', () => {
    const { scene, cam } = setup(false);
    // 화면 아래쪽 가운데 = 카메라 앞(-z)의 바닥
    const p = pickWalkFloor(scene, cam, rect, 400, 500);
    expect(p).not.toBeNull();
    expect(p!.x).toBe(0);
    expect(p!.z).toBeLessThan(0);
  });
  it('가구가 먼저 맞으면 null', () => {
    const { scene, cam } = setup(true);
    // 가구(z=-3, 높이 1)를 향한 시선: 카메라 높이 1.5에서 윗면(1.0)이 보이는 방향
    const ray = pickWalkFloor(scene, cam, rect, 400, 330);
    expect(ray).toBeNull();
  });
  it('하늘(바닥과 만나지 않음)은 null', () => {
    const { scene, cam } = setup(false);
    expect(pickWalkFloor(scene, cam, rect, 400, 100)).toBeNull();
  });
  it('화면 맨 아래 가운데는 카메라 앞 -z 쪽 바닥(눈높이 1.5 m, 아래 시야 반각 35도)', () => {
    const { scene, cam } = setup(false);
    const p = pickWalkFloor(scene, cam, rect, 400, 599.9)!;
    expect(p.x).toBe(0);
    expect(mmToWorld(-p.z)).toBeCloseTo(1.5 / Math.tan((35 * Math.PI) / 180), 1);
  });
});
