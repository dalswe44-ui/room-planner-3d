import { describe, expect, it } from 'vitest';
import { MathUtils, OrthographicCamera, Vector3 } from 'three';
import { mmToWorld } from '../contracts/coords';
import { WALL_THICKNESS_MM, wallSegments } from './geometry';
import { orthoFitShift, orthoView, orthoZoomToFit, PLAN_MARGIN_PX } from './camera';
import { rectCorners } from '../contracts/room';
import { footprintCorners, itemScreenRect, placeOverlay, projectToPx, roomDimLines, wallDistanceLines } from './overlayMath';

const room = { width: 3600, depth: 3000, ceilingHeight: 2400 };

/** 평면 뷰 카메라(CameraRig와 같은 방법으로 맞춘다) */
function planCamera(w: number, h: number): OrthographicCamera {
  const zoom = orthoZoomToFit(w, h, room);
  const view = orthoView(room, orthoFitShift(zoom));
  const cam = new OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0.1, 200);
  cam.up.copy(view.up);
  cam.zoom = zoom;
  cam.position.copy(view.position);
  cam.lookAt(view.target);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
  return cam;
}

describe('방 좌표 → 화면 좌표', () => {
  it('평면 뷰: 원점은 왼쪽 위, +x는 오른쪽, +z는 아래쪽, 1 m는 확대율 px', () => {
    const cam = planCamera(1280, 800);
    const size = { width: 1280, height: 800 };
    const o = projectToPx(cam, size, { x: 0, z: 0 });
    const x1 = projectToPx(cam, size, { x: 1000, z: 0 });
    const z1 = projectToPx(cam, size, { x: 0, z: 1000 });
    expect(x1.x - o.x).toBeCloseTo(cam.zoom, 3);
    expect(x1.y).toBeCloseTo(o.y, 3);
    expect(z1.y - o.y).toBeCloseTo(cam.zoom, 3);
    expect(z1.x).toBeCloseTo(o.x, 3);
  });

  it('가구 발자국 모서리는 three.js의 rotation.y와 같은 방향으로 돈다', () => {
    const item = { x: 2000, z: 1500, w: 1200, d: 600, rotationDeg: 90 };
    const expected = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([sx, sz]) => {
      const v = new Vector3(sx! * mmToWorld(item.w) / 2, 0, sz! * mmToWorld(item.d) / 2).applyAxisAngle(new Vector3(0, 1, 0), MathUtils.degToRad(item.rotationDeg));
      return { x: item.x + v.x * 1000, z: item.z + v.z * 1000 };
    });
    footprintCorners(item).forEach((c, i) => {
      expect(c.x).toBeCloseTo(expected[i]!.x, 6);
      expect(c.z).toBeCloseTo(expected[i]!.z, 6);
    });
  });

  it('가구 경계 사각형이 평면 뷰에서 폭 x 깊이 x 확대율이다', () => {
    const cam = planCamera(1280, 800);
    const r = itemScreenRect(cam, { width: 1280, height: 800 }, { x: 1800, z: 1500, w: 1000, d: 500, h: 700, elevation: 0, rotationDeg: 0 });
    expect(r.right - r.left).toBeCloseTo(cam.zoom, 3);
    expect(r.bottom - r.top).toBeCloseTo(cam.zoom / 2, 3);
  });
});

describe('도구 막대 자리', () => {
  const view = { width: 400, height: 600 };
  const box = { width: 100, height: 40 };
  it('경계 위 가운데에서 8px 띄운다', () => {
    const p = placeOverlay({ left: 150, top: 300, right: 250, bottom: 360 }, box, view);
    expect(p).toEqual({ x: 150, y: 252, below: false });
  });
  it('위에 자리가 없으면 아래에 놓는다', () => {
    const p = placeOverlay({ left: 150, top: 30, right: 250, bottom: 90 }, box, view);
    expect(p.below).toBe(true);
    expect(p.y).toBe(98);
  });
  it('장면 영역 안으로 가둔다', () => {
    const left = placeOverlay({ left: -50, top: 300, right: 10, bottom: 360 }, box, view);
    expect(left.x).toBe(4);
    const right = placeOverlay({ left: 380, top: 300, right: 460, bottom: 360 }, box, view);
    expect(right.x).toBe(view.width - box.width - 4);
    const bottom = placeOverlay({ left: 150, top: 10, right: 250, bottom: 640 }, box, view);
    expect(bottom.y).toBe(view.height - box.height - 4);
  });
});

describe('벽까지 치수선과 방 치수선', () => {
  const corners = rectCorners(room.width, room.depth);
  const outward = wallSegments(corners).map((w) => w.outward);

  it('직사각형 방의 벽 0 ~ 3은 위, 오른쪽, 아래, 왼쪽이다', () => {
    expect(outward.map((o) => [Math.round(o.x) + 0, Math.round(o.z) + 0])).toEqual([
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ]);
  });

  it('선은 가구 경계에서 벽까지 거리만큼 화면에서 뻗는다', () => {
    const cam = planCamera(1280, 800);
    const size = { width: 1280, height: 800 };
    const item = { x: 1000, z: 800, w: 600, d: 400, rotationDeg: 0 };
    const dist = [600, 2300, 2000, 700] as const;
    const lines = wallDistanceLines(cam, size, item, outward, dist);
    lines.forEach((l, i) => expect(l.length).toBeCloseTo((dist[i]! / 1000) * cam.zoom, 2));
    // 위쪽 선은 가구 윗변 가운데에서 위로 올라간다
    const top = projectToPx(cam, size, { x: 1000, z: 600 });
    expect(lines[0]!.from.x).toBeCloseTo(top.x, 3);
    expect(lines[0]!.from.y).toBeCloseTo(top.y, 3);
    expect(lines[0]!.dir.y).toBeCloseTo(-1, 6);
    expect(lines[1]!.dir.x).toBeCloseTo(1, 6);
  });

  it('음수 거리는 가구 안쪽으로 그어지고 거리 0은 길이 0이다', () => {
    const cam = planCamera(1280, 800);
    const size = { width: 1280, height: 800 };
    const item = { x: 100, z: 1500, w: 600, d: 400, rotationDeg: 0 };
    const lines = wallDistanceLines(cam, size, item, outward, [1300, 3200, 1300, -200]);
    expect(lines[3]!.to.x).toBeGreaterThan(lines[3]!.from.x);
    const zero = wallDistanceLines(cam, size, item, outward, [0, 0, 0, 0]);
    expect(zero[0]!.length).toBe(0);
    expect(zero[0]!.dir.y).toBeCloseTo(-1, 6);
  });

  it('방 치수선: 폭은 방 위쪽 바깥, 깊이는 왼쪽 바깥에 있고 360px 폭 화면에서도 화면 안에 들어온다', () => {
    for (const [w, h] of [
      [1280, 800],
      [360, 700],
    ] as const) {
      const cam = planCamera(w, h);
      const size = { width: w, height: h };
      const bounds = { minX: 0, maxX: room.width, minZ: 0, maxZ: room.depth };
      const d = roomDimLines(cam, size, bounds, WALL_THICKNESS_MM, 20);
      expect(d.width.mid.y).toBeLessThan(d.wallOuterTop);
      expect(d.depth.mid.x).toBeLessThan(d.wallOuterLeft);
      expect(d.width.length).toBeCloseTo((room.width / 1000) * cam.zoom, 2);
      expect(d.depth.length).toBeCloseTo((room.depth / 1000) * cam.zoom, 2);
      // 선과 글자(위 18px, 왼쪽 가로 글자 폭 정도)가 화면 밖으로 나가지 않는다
      expect(d.width.mid.y).toBeGreaterThan(PLAN_MARGIN_PX.top - 40);
      expect(d.width.mid.y - 24).toBeGreaterThanOrEqual(0);
      expect(d.depth.mid.x - 12).toBeGreaterThanOrEqual(0);
      // 방 오른쪽 아래 바깥 면도 화면 안
      const br = projectToPx(cam, size, { x: room.width + WALL_THICKNESS_MM, z: room.depth + WALL_THICKNESS_MM });
      expect(br.x).toBeLessThanOrEqual(w);
      expect(br.y).toBeLessThanOrEqual(h);
    }
  });
});
