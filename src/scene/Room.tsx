// 바닥과 벽. corners(다각형)를 그대로 따르고, 벽 높이는 천장 높이다. 칸막이 벽과 문·창문이 있으면 벽을 그 구간에서 자른다.
// 평면 뷰에서는 위에서 내려다보므로 벽의 윗면(먹색)만 보이고(개구부 구간은 비워 둔다), 3D 뷰에서는 안쪽 면이 밝고 윗면이 먹색인 잘린 모형처럼 보인다.
import { useEffect, useMemo } from 'react';
import { MeshStandardMaterial, MeshBasicMaterial } from 'three';
import { mmToWorld, roomToWorld } from '../contracts/coords';
import type { Room as RoomData, StructureTarget } from '../contracts/types';
import { createPlankTexture } from './floorTexture';
import {
  WALL_INNER_COLOR,
  WALL_OUTER_COLOR,
  WALL_TOP_COLOR,
  floorShape,
  wallSegments,
  type SceneUserData,
} from './geometry';
import { RectOutline } from './Outlines';
import { cutWallPieces, drawnWall, openingsOnWall, wallRectCorners, type DrawnWall } from './structureGeometry';

interface RoomProps {
  room: Pick<RoomData, 'corners' | 'walls' | 'openings' | 'ceilingHeight'>;
  plan: boolean;
  selected: StructureTarget | null;
}

export function Room({ room, plan, selected }: RoomProps) {
  const { corners, ceilingHeight } = room;
  const shape = useMemo(() => floorShape(corners), [corners]);
  const walls = useMemo(() => wallSegments(corners), [corners]);

  const floorMap = useMemo(() => createPlankTexture(), []);
  // BoxGeometry의 면 순서: +x, -x, +y, -y, +z, -z. 안쪽 면이 +z인지 -z인지는 벽마다 다르다.
  const mats = useMemo(() => {
    const outer = new MeshStandardMaterial({ color: WALL_OUTER_COLOR, roughness: 0.95 });
    const inner = new MeshStandardMaterial({ color: WALL_INNER_COLOR, roughness: 0.95 });
    const top = new MeshStandardMaterial({ color: WALL_TOP_COLOR, roughness: 0.9 });
    const hidden = new MeshBasicMaterial({ visible: false });
    return {
      all: [outer, inner, top, hidden],
      innerPlusZ: [outer, outer, top, outer, inner, outer],
      innerMinusZ: [outer, outer, top, outer, outer, inner],
      partition: [inner, inner, top, inner, inner, inner],
      hidden,
    };
  }, []);
  useEffect(
    () => () => {
      floorMap.dispose();
      mats.all.forEach((m) => m.dispose());
    },
    [floorMap, mats],
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
        const d = drawnWall(room, i);
        if (!d) return null;
        // 벽 상자의 로컬 +z는 장면 (sinθ, cosθ) 방향이다. 바깥이 -z쪽이면 안쪽 면은 +z다.
        const innerIsPlusZ = wall.outward.x * Math.sin(wall.rotationY) + wall.outward.z * Math.cos(wall.rotationY) < 0;
        const base: SceneUserData = {
          kind: 'wall',
          structure: { kind: 'outerWall', index: i },
          edgeMid: { x: mmToWorld(wall.mid.x), z: mmToWorld(wall.mid.z) },
          outward: wall.outward,
        };
        return (
          <group key={i}>
            <WallBody
              wall={d}
              ceiling={ceilingHeight}
              ext={d.thickness / 2}
              cuts={openingsOnWall(room, room.openings, i)}
              plan={plan}
              materials={innerIsPlusZ ? mats.innerPlusZ : mats.innerMinusZ}
              userData={base}
            />
            {selected?.kind === 'outerWall' && selected.index === i && <WallOutline wall={d} yMm={plan ? 0 : ceilingHeight} />}
          </group>
        );
      })}
      {room.walls.map((w) => {
        const d = drawnWall(room, w.id);
        if (!d) return null;
        const isSel = selected?.kind === 'wall' && selected.id === w.id;
        const cx = d.start.x + (d.dir.x * d.length) / 2;
        const cz = d.start.z + (d.dir.z * d.length) / 2;
        return (
          <group key={w.id}>
            <WallBody
              wall={d}
              ceiling={ceilingHeight}
              ext={0}
              cuts={openingsOnWall(room, room.openings, w.id)}
              plan={plan}
              materials={mats.partition}
              userData={{ kind: 'partition', structure: { kind: 'wall', id: w.id } }}
            />
            {/* 칸막이 벽 전체 자리. 개구부가 끝에 있어도 벽의 양 끝을 검증 조회가 읽을 수 있다. 보이지 않는다. */}
            <mesh
              position={roomToWorld({ x: cx, z: cz }, 0)}
              rotation={[0, d.rotationY, 0]}
              material={mats.hidden}
              userData={{ kind: 'partitionFootprint', selected: isSel, wallId: w.id } satisfies SceneUserData}
            >
              <boxGeometry args={[mmToWorld(d.length), mmToWorld(1), mmToWorld(d.thickness)]} />
            </mesh>
            {isSel && <WallOutline wall={d} yMm={plan ? 0 : ceilingHeight} />}
          </group>
        );
      })}
    </group>
  );
}

function WallOutline({ wall, yMm }: { wall: DrawnWall; yMm: number }) {
  const a = wall.start;
  const b = { x: a.x + wall.dir.x * wall.length, z: a.z + wall.dir.z * wall.length };
  return <RectOutline corners={wallRectCorners(a, b, wall.thickness)} yMm={yMm} lift={3} />;
}

interface WallBodyProps {
  wall: DrawnWall;
  ceiling: number;
  ext: number;
  cuts: ReturnType<typeof openingsOnWall>;
  plan: boolean;
  materials: MeshStandardMaterial[] | MeshBasicMaterial[];
  userData: SceneUserData;
}

/** 벽 하나를 개구부로 자른 상자 조각들로 그린다. */
function WallBody({ wall, ceiling, ext, cuts, plan, materials, userData }: WallBodyProps) {
  const pieces = useMemo(() => cutWallPieces(wall.length, ceiling, cuts, { ext, plan }), [wall.length, ceiling, cuts, ext, plan]);
  return (
    <>
      {pieces.map((p, i) => {
        const c = (p.t0 + p.t1) / 2;
        const pos = roomToWorld({ x: wall.start.x + wall.dir.x * c, z: wall.start.z + wall.dir.z * c }, (p.y0 + p.y1) / 2);
        return (
          <mesh key={i} position={pos} rotation={[0, wall.rotationY, 0]} material={materials} userData={userData}>
            <boxGeometry args={[mmToWorld(p.t1 - p.t0), mmToWorld(p.y1 - p.y0), mmToWorld(wall.thickness)]} />
          </mesh>
        );
      })}
    </>
  );
}
