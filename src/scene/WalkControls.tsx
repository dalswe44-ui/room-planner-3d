// 사람 뷰의 카메라 조작. 끌면 제자리에서 둘러보고, 바닥을 짧게 누르면 그 자리로 부드럽게 옮겨 간다.
// 눌린 곳을 mm로 바꿔 벽에서 띄울 뿐, 가구에는 아무것도 하지 않는다(편집 핸들러를 부르지 않는다).
import { useEffect, useLayoutEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { MathUtils, Vector3, type PerspectiveCamera } from 'three';
import { mmToWorld, roomToWorld } from '../contracts/coords';
import type { PointMm } from '../contracts/types';
import { WALK_EYE_HEIGHT } from '../contracts/types';
import { pickWalkFloor, screenRectOf } from './pointer';
import { WALK_MOVE_SECONDS, clampPitchRad, pullInside, walkStart } from './walk';

/** 짧은 누름으로 볼 최대 이동 거리(px). 가구 조작의 탭과 같은 값이다. */
const TAP_SLOP_PX = 6;

interface Move {
  from: Vector3;
  to: Vector3;
  t: number;
}

export function WalkControls({ camera, corners }: { camera: PerspectiveCamera; corners: readonly PointMm[] }) {
  const get = useThree((s) => s.get);
  const invalidate = useThree((s) => s.invalidate);
  const dom = useThree((s) => s.gl.domElement);
  const move = useRef<Move | null>(null);
  const cornersRef = useRef(corners);
  cornersRef.current = corners;

  // 들어갈 때(또는 방이 바뀔 때) 방 가운데에 선다.
  useLayoutEffect(() => {
    const start = walkStart(corners);
    camera.rotation.order = 'YXZ';
    const [x, y, z] = roomToWorld({ x: start.x, z: start.z }, WALK_EYE_HEIGHT);
    camera.position.set(x, y, z);
    camera.rotation.set(0, MathUtils.degToRad(start.headingDeg), 0);
    move.current = null;
    camera.updateMatrixWorld();
    invalidate();
  }, [camera, corners, invalidate]);

  useEffect(() => {
    let active: { id: number; x: number; y: number; dragging: boolean; tap: boolean } | null = null;
    dom.style.touchAction = 'none';

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (active) {
        // 두 번째 손가락: 확대는 없다. 진행 중인 누름은 탭이 아니다.
        active.tap = false;
        return;
      }
      active = { id: e.pointerId, x: e.clientX, y: e.clientY, dragging: false, tap: true };
    };
    const onMove = (e: PointerEvent) => {
      if (!active || e.pointerId !== active.id) return;
      if (!active.dragging && Math.hypot(e.clientX - active.x, e.clientY - active.y) <= TAP_SLOP_PX) return;
      const height = Math.max(dom.clientHeight, 1);
      const radPerPx = MathUtils.degToRad(camera.fov) / height;
      // 화면의 그림이 손가락을 따라오게: 오른쪽으로 끌면 왼쪽을 보고(heading 증가), 아래로 끌면 위를 본다.
      camera.rotation.y += (e.clientX - active.x) * radPerPx;
      camera.rotation.x = clampPitchRad(camera.rotation.x + (e.clientY - active.y) * radPerPx);
      active.dragging = true;
      active.tap = false;
      active.x = e.clientX;
      active.y = e.clientY;
      invalidate();
    };
    const onUp = (e: PointerEvent) => {
      if (!active || e.pointerId !== active.id) return;
      const wasTap = active.tap && !active.dragging;
      active = null;
      if (!wasTap) return;
      const s = get();
      const floor = pickWalkFloor(s.scene, s.camera, screenRectOf(dom), e.clientX, e.clientY);
      const target = floor ? pullInside(floor, cornersRef.current) : null;
      if (!target) return;
      move.current = {
        from: camera.position.clone(),
        to: new Vector3(mmToWorld(target.x), camera.position.y, mmToWorld(target.z)),
        t: 0,
      };
      invalidate();
    };
    const onCancel = (e: PointerEvent) => {
      if (active && e.pointerId === active.id) active = null;
    };

    dom.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    return () => {
      dom.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    };
  }, [camera, dom, get, invalidate]);

  // 이동 애니메이션. 움직이는 동안에만 다시 그리게 한다(frameloop="demand").
  useFrame((state, delta) => {
    const m = move.current;
    if (!m) return;
    m.t = Math.min(1, m.t + Math.min(delta, 1 / 30) / WALK_MOVE_SECONDS);
    const k = m.t * m.t * (3 - 2 * m.t);
    camera.position.lerpVectors(m.from, m.to, k);
    if (m.t >= 1) move.current = null;
    else state.invalidate();
  });

  return null;
}
