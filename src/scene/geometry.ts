// 장면을 그리기 위한 순수 계산. mm → 장면 좌표(m)와 회전, 벽과 바닥의 모양만 다룬다.
// three.js 객체는 만들지 않으므로 React 없이 테스트할 수 있다.
import { MathUtils, Object3D, Shape, Vector2 } from 'three';
import { mmToWorld } from '../contracts/coords';
import type { FurnitureItem, Mm, PointMm } from '../contracts/types';

export const WALL_THICKNESS_MM = 100;
export const WARNING_COLOR = '#e5484d';
export const SELECTED_EDGE_COLOR = '#1f6feb';
export const FLOOR_COLOR = '#fbfaf6';
export const WALL_COLOR = '#d9d4c7';
export const SCENE_BACKGROUND = '#eceae4';

/** 그려진 three.js 객체에 붙여 두는 표식. 검증 조회와 카메라 처리가 이 값을 읽는다. */
export interface SceneUserData {
  kind?: 'floor' | 'wall' | 'furniture';
  furnitureId?: string;
  /** 경고 색으로 덮이기 전의 가구 색 */
  baseColor?: string;
  warning?: boolean;
  selected?: boolean;
  /** 벽: 안쪽 면 가운데(m, 장면 x·z) */
  edgeMid?: { x: number; z: number };
  /** 벽: 바깥쪽 단위 방향(장면 x·z) */
  outward?: { x: number; z: number };
}

export function sceneDataOf(obj: Object3D): SceneUserData {
  return obj.userData as SceneUserData;
}

export interface FurnitureTransform {
  /** 상자 중심의 장면 좌표(m). 기준점(바닥면 중심)에서 높이의 절반만큼 올린 곳이다. */
  position: [number, number, number];
  /** y축 회전(라디안). 위에서 볼 때 반시계가 양수다. */
  rotationY: number;
  /** 회전 전 크기(m): w(x), h(y), d(z) */
  size: [number, number, number];
}

type FurnitureGeometryInput = Pick<FurnitureItem, 'x' | 'z' | 'w' | 'h' | 'd' | 'elevation' | 'rotationDeg'>;

/**
 * 가구 하나의 상자 위치와 크기. BoxGeometry의 원점은 상자 중심이므로 높이의 절반을 올리는 보정은 여기에만 둔다.
 * at을 주면 그 방 좌표에 놓은 것으로 계산한다(끄는 동안의 임시 위치).
 */
export function furnitureTransform(
  item: FurnitureGeometryInput,
  at: PointMm = { x: item.x, z: item.z },
): FurnitureTransform {
  return {
    position: [mmToWorld(at.x), mmToWorld(item.elevation + item.h / 2), mmToWorld(at.z)],
    rotationY: MathUtils.degToRad(item.rotationDeg),
    size: [mmToWorld(item.w), mmToWorld(item.h), mmToWorld(item.d)],
  };
}

export interface WallSegment {
  /** 벽 상자의 중심(방 좌표 mm). 안쪽 면에서 두께만큼 바깥으로 나간 곳이다. */
  center: PointMm;
  /** 변의 가운데(방 좌표 mm) */
  mid: PointMm;
  /** 바깥쪽 단위 방향(방 좌표 x·z) */
  outward: { x: number; z: number };
  /** 벽 상자의 길이(mm): 변 길이에 양 끝 두께를 더한다. 바깥 모서리가 비지 않게 한다. */
  length: Mm;
  /** 벽 상자의 y축 회전(라디안) */
  rotationY: number;
}

function signedArea(corners: PointMm[]): number {
  let sum = 0;
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % corners.length];
    sum += a.x * b.z - b.x * a.z;
  }
  return sum / 2;
}

/**
 * 벽 i는 corners[i] → corners[i+1] 변이다(CLAUDE.md 좌표계).
 * 양의 면적의 다각형은 진행 방향의 왼쪽이 안쪽이므로 바깥은 오른쪽이다. 음의 면적이면 반대다.
 */
export function wallSegments(corners: PointMm[], thicknessMm: Mm = WALL_THICKNESS_MM): WallSegment[] {
  const positive = signedArea(corners) > 0;
  return corners.map((a, i) => {
    const b = corners[(i + 1) % corners.length];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    const ux = len > 0 ? dx / len : 1;
    const uz = len > 0 ? dz / len : 0;
    const outward = positive ? { x: uz, z: -ux } : { x: -uz, z: ux };
    const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
    const half = thicknessMm / 2;
    return {
      mid,
      center: { x: mid.x + outward.x * half, z: mid.z + outward.z * half },
      outward,
      length: len + thicknessMm,
      // 상자의 로컬 x축을 변 방향 (ux, uz)에 맞춘다. rotation.y = θ 이면 x축은 (cosθ, -sinθ)가 된다.
      rotationY: Math.atan2(-uz, ux),
    };
  });
}

/**
 * 바닥 모양. ShapeGeometry를 x축으로 -90도 돌려 놓으므로 Shape의 y에 -z를 넣는다(돌리면 y = -z가 z가 된다).
 */
export function floorShape(corners: PointMm[]): Shape {
  return new Shape(corners.map((c) => new Vector2(mmToWorld(c.x), -mmToWorld(c.z))));
}
