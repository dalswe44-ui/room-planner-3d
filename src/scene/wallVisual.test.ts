import { describe, expect, it } from "vitest";
import {
  PLAN_TILT_OUTER,
  buildPlanWallGeometries,
  planWallVisual,
  roomCenter,
  silhouetteBox,
  tiltPoint,
  visibleSides,
} from "./wallVisual";

const center = { x: 2500, z: 2000 };

describe("roomCenter", () => {
  it("꼭짓점 경계 상자의 중심", () => {
    expect(
      roomCenter([
        { x: 0, z: 0 },
        { x: 5000, z: 0 },
        { x: 5000, z: 4000 },
        { x: 0, z: 4000 },
      ]),
    ).toEqual(center);
  });
});

describe("tiltPoint", () => {
  it("중심에서 비율만큼 바깥으로 민다", () => {
    expect(tiltPoint({ x: 0, z: 0 }, center, 1.04)).toEqual({
      x: 2500 - 2500 * 1.04,
      z: 2000 - 2000 * 1.04,
    });
    expect(tiltPoint(center, center, 1.04)).toEqual(center);
  });
});

describe("planWallVisual: 위쪽 바깥 벽 조각", () => {
  // 중심선 z=-50, 두께 100 → 바닥 꼭짓점은 z=-100 ~ 0
  const v = planWallVisual(
    { x: 0, z: -50 },
    { x: 5000, z: -50 },
    100,
    center,
    1.04,
  );

  it("바닥 꼭짓점은 실제 자리 그대로다(안쪽 면 바닥선 z=0)", () => {
    expect(v.bottom.map((p) => p.x)).toEqual([0, 5000, 5000, 0]);
    expect(v.bottom.map((p) => p.z + 0)).toEqual([0, 0, -100, -100]);
  });

  it("윗면은 각 꼭짓점이 중심에서 비율만큼 이동한다", () => {
    v.bottom.forEach((b, i) => {
      expect(v.top[i]!.x).toBeCloseTo(center.x + (b.x - center.x) * 1.04, 9);
      expect(v.top[i]!.z).toBeCloseTo(center.z + (b.z - center.z) * 1.04, 9);
    });
  });

  it("안쪽 옆면만 위에서 보이고 바깥 옆면은 가려진다", () => {
    // 변 0 = 안쪽 면(z=0), 변 2 = 바깥 면(z=-100). 변 1, 3은 조각의 양 끝 면
    const vis = visibleSides(v);
    expect(vis[0]).toBe(true);
    expect(vis[2]).toBe(false);
  });

  it("비율 1이면 옆면이 보이지 않는다", () => {
    const flat = planWallVisual(
      { x: 0, z: -50 },
      { x: 5000, z: -50 },
      100,
      center,
      1,
    );
    expect(visibleSides(flat)).toEqual([false, false, false, false]);
  });

  it("눌림 상자는 바닥과 윗면을 모두 감싼다", () => {
    const box = silhouetteBox(v, { x: 1, z: 0 });
    const zs = [...v.bottom, ...v.top].map((p) => p.z);
    expect(box.depth).toBeCloseTo(Math.max(...zs) - Math.min(...zs), 9);
    expect(box.center.z).toBeCloseTo(
      (Math.max(...zs) + Math.min(...zs)) / 2,
      9,
    );
  });
});

describe("planWallVisual: 칸막이 벽(중심 가까이)", () => {
  it("중심을 지나는 칸막이는 기울지 않는다", () => {
    const v = planWallVisual(
      { x: 2500, z: 0 },
      { x: 2500, z: 1000 },
      100,
      center,
      PLAN_TILT_OUTER,
    );
    const mid = (q: { x: number }[]) => (q[0]!.x + q[2]!.x) / 2;
    expect(mid(v.top) - mid(v.bottom)).toBeCloseTo(0, 9);
    expect(v.top[0]!.x - v.bottom[0]!.x).toBeCloseTo(
      -v.top[2]!.x + v.bottom[2]!.x,
      9,
    );
  });
});

describe("buildPlanWallGeometries", () => {
  it("윗면 + 보이는 옆면의 정점과 색을 만들고 해제할 수 있다", () => {
    const v = planWallVisual(
      { x: 0, z: -50 },
      { x: 5000, z: -50 },
      100,
      center,
      1.04,
    );
    const g = buildPlanWallGeometries(v, 2400);
    // 윗면 6 + 옆면 하나당 6
    const sides = visibleSides(v).filter(Boolean).length;
    expect(g.fill.getAttribute("position").count).toBe(6 + 6 * sides);
    expect(g.fill.getAttribute("color").count).toBe(6 + 6 * sides);
    expect(g.edges.getAttribute("position").count % 2).toBe(0);
    g.fill.dispose();
    g.edges.dispose();
  });
});
