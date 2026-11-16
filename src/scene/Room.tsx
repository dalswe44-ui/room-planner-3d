// 바닥과 벽. corners(다각형)를 그대로 따르고, 벽 높이는 천장 높이다.
import { useMemo } from 'react';
import { mmToWorld } from '../contracts/coords';
import type { Mm, PointMm } from '../contracts/types';
import { FLOOR_COLOR, WALL_COLOR, WALL_THICKNESS_MM, floorShape, wallSegments, type SceneUserData } from './geometry';

interface RoomProps {
  corners: PointMm[];
  ceilingHeight: Mm;
}

export function Room({ corners, ceilingHeight }: RoomProps) {
  const shape = useMemo(() => floorShape(corners), [corners]);
  const walls = useMemo(() => wallSegments(corners), [corners]);
  const wallHeight = mmToWorld(ceilingHeight);
  const wallThickness = mmToWorld(WALL_THICKNESS_MM);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} userData={{ kind: 'floor' } satisfies SceneUserData}>
        <shapeGeometry args={[shape]} />
        {/* 바닥과 가구 밑면이 같은 평면에 놓이므로 바닥을 조금 뒤로 민다 */}
        <meshStandardMaterial color={FLOOR_COLOR} polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
      </mesh>
      {walls.map((wall, i) => (
        <mesh
          key={i}
          position={[mmToWorld(wall.center.x), wallHeight / 2, mmToWorld(wall.center.z)]}
          rotation={[0, wall.rotationY, 0]}
          userData={
            {
              kind: 'wall',
              edgeMid: { x: mmToWorld(wall.mid.x), z: mmToWorld(wall.mid.z) },
              outward: wall.outward,
            } satisfies SceneUserData
          }
        >
          <boxGeometry args={[mmToWorld(wall.length), wallHeight, wallThickness]} />
          <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}
