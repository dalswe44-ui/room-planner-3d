// 바닥과 벽. corners(다각형)를 그대로 따르고, 벽 높이는 천장 높이다. 칸막이 벽과 문·창문이 있으면 벽을 그 구간에서 자른다.
// 평면 뷰에서는 보이기 전용 벽(wallVisual.ts: 밝은 윗면 + 안쪽 옆면, 개구부 구간은 비워 둔다)을 그리고, 눌림·검증용 벽 상자는 보이지 않게 둔다.
// 3D 뷰에서는 안쪽 면이 밝고 윗면이 먹색인 잘린 모형처럼 보인다.
import { useEffect, useMemo } from "react";
import {
  DoubleSide,
  MeshStandardMaterial,
  MeshBasicMaterial,
  LineBasicMaterial,
} from "three";
import { mmToWorld, roomToWorld } from "../contracts/coords";
import type {
  PointMm,
  Room as RoomData,
  StructureTarget,
} from "../contracts/types";
import { createPlankTexture } from "./floorTexture";
import {
  WALL_INNER_COLOR,
  WALL_OUTER_COLOR,
  WALL_TOP_COLOR,
  floorShape,
  wallSegments,
  type SceneUserData,
} from "./geometry";
import { RectOutline } from "./Outlines";
import {
  cutWallPieces,
  drawnWall,
  openingsOnWall,
  wallRectCorners,
  type DrawnWall,
} from "./structureGeometry";
import {
  PLAN_TILT_OUTER,
  PLAN_TILT_PARTITION,
  PLAN_WALL_EDGE_COLOR,
  buildPlanWallGeometries,
  planWallVisual,
  roomCenter,
  silhouetteBox,
  type PlanWallVisual,
} from "./wallVisual";

interface RoomProps {
  room: Pick<RoomData, "corners" | "walls" | "openings" | "ceilingHeight">;
  plan: boolean;
  selected: StructureTarget | null;
}

export function Room({ room, plan, selected }: RoomProps) {
  const { corners, ceilingHeight } = room;
  const shape = useMemo(() => floorShape(corners), [corners]);
  const walls = useMemo(() => wallSegments(corners), [corners]);
  const center = useMemo(() => roomCenter(corners), [corners]);

  const floorMap = useMemo(() => createPlankTexture(), []);
  // BoxGeometry의 면 순서: +x, -x, +y, -y, +z, -z. 안쪽 면이 +z인지 -z인지는 벽마다 다르다.
  const mats = useMemo(() => {
    const outer = new MeshStandardMaterial({
      color: WALL_OUTER_COLOR,
      roughness: 0.95,
    });
    const inner = new MeshStandardMaterial({
      color: WALL_INNER_COLOR,
      roughness: 0.95,
    });
    const top = new MeshStandardMaterial({
      color: WALL_TOP_COLOR,
      roughness: 0.9,
    });
    const hidden = new MeshBasicMaterial({ visible: false });
    // 평면 뷰 보이기 전용 벽. 빛에 의존하지 않고 정점 색을 그대로 낸다.
    const planFill = new MeshBasicMaterial({
      vertexColors: true,
      side: DoubleSide,
    });
    const planEdge = new LineBasicMaterial({ color: PLAN_WALL_EDGE_COLOR });
    return {
      all: [outer, inner, top, hidden, planFill, planEdge],
      planFill,
      planEdge,
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
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        userData={{ kind: "floor" } satisfies SceneUserData}
      >
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
        const innerIsPlusZ =
          wall.outward.x * Math.sin(wall.rotationY) +
            wall.outward.z * Math.cos(wall.rotationY) <
          0;
        const base: SceneUserData = {
          kind: "wall",
          structure: { kind: "outerWall", index: i },
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
              center={center}
              tilt={PLAN_TILT_OUTER}
              planMats={mats}
            />
            {selected?.kind === "outerWall" && selected.index === i && (
              <WallOutline
                wall={d}
                yMm={plan ? 0 : ceilingHeight}
                planTilt={
                  plan
                    ? { center, ratio: PLAN_TILT_OUTER, ext: d.thickness / 2 }
                    : undefined
                }
              />
            )}
          </group>
        );
      })}
      {room.walls.map((w) => {
        const d = drawnWall(room, w.id);
        if (!d) return null;
        const isSel = selected?.kind === "wall" && selected.id === w.id;
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
              userData={{
                kind: "partition",
                structure: { kind: "wall", id: w.id },
              }}
              center={center}
              tilt={PLAN_TILT_PARTITION}
              planMats={mats}
            />
            {/* 칸막이 벽 전체 자리. 개구부가 끝에 있어도 벽의 양 끝을 검증 조회가 읽을 수 있다. 보이지 않는다. */}
            <mesh
              position={roomToWorld({ x: cx, z: cz }, 0)}
              rotation={[0, d.rotationY, 0]}
              material={mats.hidden}
              userData={
                {
                  kind: "partitionFootprint",
                  selected: isSel,
                  wallId: w.id,
                } satisfies SceneUserData
              }
            >
              <boxGeometry
                args={[
                  mmToWorld(d.length),
                  mmToWorld(1),
                  mmToWorld(d.thickness),
                ]}
              />
            </mesh>
            {isSel && (
              <WallOutline
                wall={d}
                yMm={plan ? 0 : ceilingHeight}
                planTilt={
                  plan
                    ? { center, ratio: PLAN_TILT_PARTITION, ext: 0 }
                    : undefined
                }
              />
            )}
          </group>
        );
      })}
    </group>
  );
}

/** 선택 테두리. 평면 뷰에서는 눈에 보이는 윗면(밀어 올린 꼭짓점)을 두른다. */
function WallOutline({
  wall,
  yMm,
  planTilt,
}: {
  wall: DrawnWall;
  yMm: number;
  planTilt?: { center: PointMm; ratio: number; ext: number };
}) {
  const a = {
    x: wall.start.x - wall.dir.x * (planTilt?.ext ?? 0),
    z: wall.start.z - wall.dir.z * (planTilt?.ext ?? 0),
  };
  const b = {
    x: wall.start.x + wall.dir.x * (wall.length + (planTilt?.ext ?? 0)),
    z: wall.start.z + wall.dir.z * (wall.length + (planTilt?.ext ?? 0)),
  };
  const corners = planTilt
    ? planWallVisual(a, b, wall.thickness, planTilt.center, planTilt.ratio).top
    : wallRectCorners(a, b, wall.thickness);
  return <RectOutline corners={corners} yMm={yMm} lift={3} />;
}

interface WallBodyProps {
  wall: DrawnWall;
  ceiling: number;
  ext: number;
  cuts: ReturnType<typeof openingsOnWall>;
  plan: boolean;
  materials: MeshStandardMaterial[] | MeshBasicMaterial[];
  userData: SceneUserData;
  center: PointMm;
  tilt: number;
  planMats: {
    hidden: MeshBasicMaterial;
    planFill: MeshBasicMaterial;
    planEdge: LineBasicMaterial;
  };
}

/**
 * 벽 하나를 개구부로 자른 상자 조각들로 그린다.
 * 평면 뷰에서는 이 상자들(눌림·검증용)을 보이지 않게 두고(obj.visible은 그대로라 pickFurniture의 가림막 판정이 3D와 같다),
 * 같은 조각 단위로 보이기 전용 입체 벽을 따로 그린다.
 */
function WallBody({
  wall,
  ceiling,
  ext,
  cuts,
  plan,
  materials,
  userData,
  center,
  tilt,
  planMats,
}: WallBodyProps) {
  const pieces = useMemo(
    () => cutWallPieces(wall.length, ceiling, cuts, { ext, plan }),
    [wall.length, ceiling, cuts, ext, plan],
  );
  return (
    <>
      {pieces.map((p, i) => {
        const c = (p.t0 + p.t1) / 2;
        const pos = roomToWorld(
          {
            x: wall.start.x + wall.dir.x * c,
            z: wall.start.z + wall.dir.z * c,
          },
          (p.y0 + p.y1) / 2,
        );
        return (
          <group key={i}>
            <mesh
              position={pos}
              rotation={[0, wall.rotationY, 0]}
              material={plan ? planMats.hidden : materials}
              userData={userData}
            >
              <boxGeometry
                args={[
                  mmToWorld(p.t1 - p.t0),
                  mmToWorld(p.y1 - p.y0),
                  mmToWorld(wall.thickness),
                ]}
              />
            </mesh>
            {plan && (
              <PlanWallPiece
                wall={wall}
                // 바깥 벽의 양 끝 조각은 모서리의 빈 사각형(두께/2 x 두께/2)까지 채워 윗면이 모서리에서 이어지게 한다. 눌림·검증용 상자는 그대로다.
                t0={ext > 0 && p.t0 <= -ext ? p.t0 - wall.thickness / 2 : p.t0}
                t1={
                  ext > 0 && p.t1 >= wall.length + ext
                    ? p.t1 + wall.thickness / 2
                    : p.t1
                }
                height={ceiling}
                center={center}
                ratio={tilt}
                planMats={planMats}
                structure={userData.structure}
              />
            )}
          </group>
        );
      })}
    </>
  );
}

interface PlanWallPieceProps {
  wall: DrawnWall;
  t0: number;
  t1: number;
  height: number;
  center: PointMm;
  ratio: number;
  planMats: WallBodyProps["planMats"];
  structure: SceneUserData["structure"];
}

/** 평면 뷰의 보이기 전용 벽 조각. raycast를 끄고 kind를 붙이지 않는다(probe·가림막 판정에 잡히지 않는다). */
function PlanWallPiece({
  wall,
  t0,
  t1,
  height,
  center,
  ratio,
  planMats,
  structure,
}: PlanWallPieceProps) {
  const visual = useMemo<PlanWallVisual>(() => {
    const at = (t: number): PointMm => ({
      x: wall.start.x + wall.dir.x * t,
      z: wall.start.z + wall.dir.z * t,
    });
    return planWallVisual(at(t0), at(t1), wall.thickness, center, ratio);
  }, [wall, t0, t1, center, ratio]);
  const geos = useMemo(
    () => buildPlanWallGeometries(visual, height),
    [visual, height],
  );
  useEffect(
    () => () => {
      geos.fill.dispose();
      geos.edges.dispose();
    },
    [geos],
  );
  // 눈에 보이는 윗면·옆면을 눌러도 그 벽이 골라지도록, 그 모양을 감싸는 얇은 눌림 상자를 구조 편집 모드의 눌림 대상으로 둔다(kind 없음).
  const pick = useMemo(
    () => silhouetteBox(visual, wall.dir),
    [visual, wall.dir],
  );
  const noRaycast = () => null;
  return (
    <>
      <mesh
        geometry={geos.fill}
        material={planMats.planFill}
        raycast={noRaycast}
        renderOrder={1}
      />
      <lineSegments
        geometry={geos.edges}
        material={planMats.planEdge}
        raycast={noRaycast}
        renderOrder={2}
      />
      {structure && (
        <mesh
          position={roomToWorld(pick.center, 0.5)}
          rotation={[0, wall.rotationY, 0]}
          material={planMats.hidden}
          userData={{ structure } satisfies SceneUserData}
        >
          <boxGeometry
            args={[mmToWorld(pick.length), mmToWorld(1), mmToWorld(pick.depth)]}
          />
        </mesh>
      )}
    </>
  );
}
