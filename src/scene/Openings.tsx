// 문·창문·문틈. 평면 뷰는 벽을 비운 자리에 문짝 선·열림 호·창문 이중선을 선으로 그리고, 3D 뷰는 문짝(90도 열림)과 유리 판을 그린다.
// 구간 전체를 덮는 보이지 않는 상자는 구조 편집 모드의 눌림 대상이고 검증 조회가 from/to를 읽는 곳이다.
import { useEffect, useMemo } from 'react';
import { MeshBasicMaterial, MeshStandardMaterial } from 'three';
import { Line } from '@react-three/drei';
import { mmToWorld, roomToWorld } from '../contracts/coords';
import type { Opening, PointMm, Room, StructureTarget } from '../contracts/types';
import { DOOR_COLOR, GLASS_COLOR, INK_COLOR, wallSegments, type SceneUserData } from './geometry';
import { PLAN_WINDOW_LINE_COLOR } from './wallVisual';
import { RectOutline } from './Outlines';
import { doorPlan, openingBox, windowPlanLines, wallRectCorners } from './structureGeometry';

type V3 = [number, number, number];
const DOOR_LEAF_MM = 40;
const GLASS_MM = 20;
/** 평면 뷰에서 눌림 상자를 벽 두께보다 넓게 잡는 최소 깊이(mm). 얇은 벽의 문도 손가락으로 누를 수 있게 한다. */
const PLAN_PICK_DEPTH_MM = 240;
/** 평면 뷰 선의 높이(mm). 바닥 바로 위. 가구가 위에 있으면 가구가 가린다. */
const PLAN_LINE_Y_MM = 5;

interface OpeningsProps {
  room: Pick<Room, 'corners' | 'walls' | 'openings' | 'ceilingHeight'>;
  plan: boolean;
  selected: StructureTarget | null;
}

export function Openings({ room, plan, selected }: OpeningsProps) {
  const mats = useMemo(
    () => ({
      pick: new MeshBasicMaterial({ visible: false }),
      door: new MeshStandardMaterial({ color: DOOR_COLOR, roughness: 0.7 }),
      glass: new MeshStandardMaterial({ color: GLASS_COLOR, roughness: 0.1, transparent: true, opacity: 0.3, depthWrite: false }),
    }),
    [],
  );
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
  const outer = useMemo(() => wallSegments(room.corners), [room.corners]);

  return (
    <>
      {room.openings.map((o) => (
        <OpeningShape
          key={o.id}
          room={room}
          o={o}
          plan={plan}
          selected={selected?.kind === 'opening' && selected.id === o.id}
          outer={outer}
          mats={mats}
        />
      ))}
    </>
  );
}

interface ShapeProps {
  room: OpeningsProps['room'];
  o: Opening;
  plan: boolean;
  selected: boolean;
  outer: ReturnType<typeof wallSegments>;
  mats: { pick: MeshBasicMaterial; door: MeshStandardMaterial; glass: MeshStandardMaterial };
}

function OpeningShape({ room, o, plan, selected, outer, mats }: ShapeProps) {
  const box = openingBox(room, o);
  const door = useMemo(() => doorPlan(room, o), [room, o]);
  const winLines = useMemo(() => (o.type === 'window' ? windowPlanLines(room, o) : null), [room, o]);
  if (!box) return null;

  const height = Math.max(1, Math.min(o.height, room.ceilingHeight - o.sill));
  const midY = o.sill + height / 2;
  // 바깥 벽의 문·창문은 그 벽이 카메라 쪽이라 숨겨질 때 함께 숨긴다.
  const seg = typeof o.wall === 'number' ? outer[o.wall] : undefined;
  const hide: SceneUserData = seg
    ? { edgeMid: { x: mmToWorld(seg.mid.x), z: mmToWorld(seg.mid.z) }, outward: seg.outward }
    : {};
  const structure: StructureTarget = { kind: 'opening', id: o.id };
  const depth = plan ? Math.max(box.thickness, PLAN_PICK_DEPTH_MM) : box.thickness;

  const toPts = (pts: PointMm[]): V3[] => pts.map((p) => roomToWorld(p, PLAN_LINE_Y_MM) as V3);

  const corners = wallRectCorners(
    {
      x: box.center.x - box.wall.dir.x * (box.length / 2),
      z: box.center.z - box.wall.dir.z * (box.length / 2),
    },
    {
      x: box.center.x + box.wall.dir.x * (box.length / 2),
      z: box.center.z + box.wall.dir.z * (box.length / 2),
    },
    box.thickness + 20,
  );

  return (
    <group>
      <mesh
        position={roomToWorld(box.center, midY)}
        rotation={[0, box.rotationY, 0]}
        material={mats.pick}
        userData={{ kind: 'opening', role: 'span', structure, selected, openingType: o.type, shiftMm: { x: box.wall.outward.x * (box.wall.thickness / 2), z: box.wall.outward.z * (box.wall.thickness / 2) }, ...hide } satisfies SceneUserData}
      >
        <boxGeometry args={[mmToWorld(box.length), mmToWorld(height), mmToWorld(depth)]} />
      </mesh>

      {plan && door && (
        <>
          <Line points={toPts(door.leaf)} color={INK_COLOR} lineWidth={2} renderOrder={5} />
          <Line points={toPts(door.arc)} color={INK_COLOR} lineWidth={1} dashed dashSize={0.05} gapSize={0.04} renderOrder={5} />
        </>
      )}
      {plan && winLines && winLines.map((l, i) => <Line key={i} points={toPts(l)} color={PLAN_WINDOW_LINE_COLOR} lineWidth={2} renderOrder={5} />)}

      {!plan && door && (
        <mesh
          position={roomToWorld(
            {
              x: door.leaf[0].x + door.openDir.x * (door.width / 2) + (door.arc[0].x - door.leaf[0].x) / door.width * (DOOR_LEAF_MM / 2),
              z: door.leaf[0].z + door.openDir.z * (door.width / 2) + (door.arc[0].z - door.leaf[0].z) / door.width * (DOOR_LEAF_MM / 2),
            },
            midY,
          )}
          rotation={[0, Math.atan2(-door.openDir.z, door.openDir.x) + 0, 0]}
          material={mats.door}
          userData={{ kind: 'opening', role: 'leaf', structure, openingType: o.type, ...hide } satisfies SceneUserData}
        >
          <boxGeometry args={[mmToWorld(door.width), mmToWorld(height), mmToWorld(DOOR_LEAF_MM)]} />
        </mesh>
      )}
      {!plan && o.type === 'window' && (
        <mesh
          position={roomToWorld(box.center, midY)}
          rotation={[0, box.rotationY, 0]}
          material={mats.glass}
          renderOrder={2}
          userData={{ kind: 'opening', role: 'glass', openingType: o.type, ...hide } satisfies SceneUserData}
        >
          <boxGeometry args={[mmToWorld(box.length), mmToWorld(height), mmToWorld(GLASS_MM)]} />
        </mesh>
      )}

      {selected && <RectOutline corners={corners} yMm={plan ? 0 : o.sill} lift={plan ? 4 : 0} />}
      {selected && !plan && <RectOutline corners={corners} yMm={o.sill + height} />}
    </group>
  );
}
