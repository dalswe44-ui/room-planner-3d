// 바닥과 벽. corners(다각형)를 그대로 따르고, 벽 높이는 천장 높이다.
// 평면 뷰에서는 위에서 내려다보므로 벽의 윗면(먹색)만 보이고, 3D 뷰에서는 안쪽 면이 밝고 윗면이 먹색인 잘린 모형처럼 보인다.
import { useEffect, useMemo } from 'react';
import { MeshStandardMaterial } from 'three';
import { mmToWorld } from '../contracts/coords';
import type { Mm, PointMm } from '../contracts/types';
import { createPlankTexture } from './floorTexture';
import {
  WALL_INNER_COLOR,
  WALL_OUTER_COLOR,
  WALL_THICKNESS_MM,
  WALL_TOP_COLOR,
  floorShape,
  wallSegments,
  type SceneUserData,
} from './geometry';

interface RoomProps {
  corners: PointMm[];
  ceilingHeight: Mm;
}

export function Room({ corners, ceilingHeight }: RoomProps) {
  const shape = useMemo(() => floorShape(corners), [corners]);
  const walls = useMemo(() => wallSegments(corners), [corners]);
  const wallHeight = mmToWorld(ceilingHeight);
  const wallThickness = mmToWorld(WALL_THICKNESS_MM);

  const floorMap = useMemo(() => createPlankTexture(), []);
  // BoxGeometry의 면 순서: +x, -x, +y, -y, +z, -z. 안쪽 면이 +z인지 -z인지는 벽마다 다르다.
  const wallMaterials = useMemo(() => {
    const outer = new MeshStandardMaterial({ color: WALL_OUTER_COLOR, roughness: 0.95 });
    const inner = new MeshStandardMaterial({ color: WALL_INNER_COLOR, roughness: 0.95 });
    const top = new MeshStandardMaterial({ color: WALL_TOP_COLOR, roughness: 0.9 });
    return {
      all: [outer, inner, top],
      innerPlusZ: [outer, outer, top, outer, inner, outer],
      innerMinusZ: [outer, outer, top, outer, outer, inner],
    };
  }, []);
  useEffect(
    () => () => {
      floorMap.dispose();
      wallMaterials.all.forEach((m) => m.dispose());
    },
    [floorMap, wallMaterials],
  );

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow userData={{ kind: 'floor' } satisfies SceneUserData}>
        <shapeGeometry args={[shape]} />
        {/* 바닥과 가구 밑면이 같은 평면에 놓이므로 바닥을 조금 뒤로 민다 */}
        <meshStandardMaterial
          color="#ffffff"
          map={floorMap}
          roughness={1}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </mesh>
      {walls.map((wall, i) => {
        // 벽 상자의 로컬 +z는 장면 (sinθ, cosθ) 방향이다. 바깥이 -z쪽이면 안쪽 면은 +z다.
        const innerIsPlusZ = wall.outward.x * Math.sin(wall.rotationY) + wall.outward.z * Math.cos(wall.rotationY) < 0;
        return (
          <mesh
            key={i}
            position={[mmToWorld(wall.center.x), wallHeight / 2, mmToWorld(wall.center.z)]}
            rotation={[0, wall.rotationY, 0]}
            material={innerIsPlusZ ? wallMaterials.innerPlusZ : wallMaterials.innerMinusZ}
            userData={
              {
                kind: 'wall',
                edgeMid: { x: mmToWorld(wall.mid.x), z: mmToWorld(wall.mid.z) },
                outward: wall.outward,
              } satisfies SceneUserData
            }
          >
            <boxGeometry args={[mmToWorld(wall.length), wallHeight, wallThickness]} />
          </mesh>
        );
      })}
    </group>
  );
}

