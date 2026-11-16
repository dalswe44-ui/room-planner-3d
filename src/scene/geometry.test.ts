import { describe, expect, it } from 'vitest';
import { MathUtils } from 'three';
import { rectCorners } from '../contracts/room';
import { furnitureTransform, wallSegments } from './geometry';

const base = { x: 1800, z: 1500, w: 1200, d: 600, h: 720, elevation: 0, rotationDeg: 0 };

describe('furnitureTransform', () => {
  it('F-1 가구(중심 1800, 1500 / 1200×720×600)는 장면 (1.8, 0.36, 1.5)에 그려진다', () => {
    const t = furnitureTransform(base);
    expect(t.position[0]).toBeCloseTo(1.8);
    expect(t.position[1]).toBeCloseTo(0.36);
    expect(t.position[2]).toBeCloseTo(1.5);
    expect(t.size).toEqual([1.2, 0.72, 0.6]);
    expect(t.rotationY).toBe(0);
  });

  it('높이의 절반만큼 올리고, 바닥에서 띄운 높이(elevation)를 더한다', () => {
    const t = furnitureTransform({ ...base, elevation: 100 });
    expect(t.position[1]).toBeCloseTo(0.1 + 0.36);
  });

  it('회전 90도는 y축 회전 π/2이고 중심과 크기는 그대로다', () => {
    const t = furnitureTransform({ ...base, rotationDeg: 90 });
    expect(t.rotationY).toBeCloseTo(MathUtils.degToRad(90));
    expect(t.position[0]).toBeCloseTo(1.8);
    expect(t.size).toEqual([1.2, 0.72, 0.6]);
  });

  it('끄는 중의 임시 위치를 주면 그 위치에 그린다', () => {
    const t = furnitureTransform(base, { x: 1000, z: 800 });
    expect(t.position[0]).toBeCloseTo(1.0);
    expect(t.position[2]).toBeCloseTo(0.8);
  });
});

describe('wallSegments', () => {
  it('직사각형 방(3600×3000): 벽 0은 아래쪽 변이고 바깥은 -z 쪽이다', () => {
    const walls = wallSegments(rectCorners(3600, 3000), 100);
    expect(walls).toHaveLength(4);
    expect(walls[0].mid).toEqual({ x: 1800, z: 0 });
    expect(walls[0].outward.x).toBeCloseTo(0);
    expect(walls[0].outward.z).toBeCloseTo(-1);
    expect(walls[0].center.z).toBeCloseTo(-50);
    expect(walls[0].length).toBe(3700);
    expect(walls[0].rotationY).toBeCloseTo(0);
  });

  it('벽 1은 x=3600 변이고 바깥은 +x 쪽이며, 상자 방향은 +z다', () => {
    const walls = wallSegments(rectCorners(3600, 3000), 100);
    expect(walls[1].mid).toEqual({ x: 3600, z: 1500 });
    expect(walls[1].outward.x).toBeCloseTo(1);
    expect(walls[1].outward.z).toBeCloseTo(0);
    expect(walls[1].center.x).toBeCloseTo(3650);
    // 로컬 x축이 (cosθ, -sinθ) = (0, 1)이 되도록 θ = -π/2
    expect(walls[1].rotationY).toBeCloseTo(-Math.PI / 2);
  });

  it('꼭짓점 순서가 반대(음의 면적)여도 바깥은 방 밖이다', () => {
    const reversed = [...rectCorners(3600, 3000)].reverse();
    const walls = wallSegments(reversed, 100);
    for (const wall of walls) {
      // 방의 중심(1800, 1500)에서 변 가운데로 가는 방향과 바깥 방향이 같은 쪽이어야 한다
      const toMidX = wall.mid.x - 1800;
      const toMidZ = wall.mid.z - 1500;
      expect(toMidX * wall.outward.x + toMidZ * wall.outward.z).toBeGreaterThan(0);
    }
  });
});
