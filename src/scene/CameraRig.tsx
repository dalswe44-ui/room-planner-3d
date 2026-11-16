// 두 카메라(평면 = 직교, 3D = 원근)와 카메라 조작. 화면 모드에 따라 활성 카메라를 바꾼다.
import { useCallback, useEffect, useState } from 'react';
import { OrbitControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { MOUSE, OrthographicCamera, PerspectiveCamera, TOUCH } from 'three';
import type { ViewMode } from '../contracts/types';
import { FOV_DEG, applyWallVisibility, orthoView, orthoZoomToFit, perspectiveView } from './camera';
import type { SceneRuntime } from './sceneProbe';

// 평면 뷰: 회전 없이 이동과 확대만. 한 손가락 끌기도 이동이다.
const ORTHO_MOUSE = { LEFT: MOUSE.PAN, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN };
const ORTHO_TOUCH = { ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_PAN };
// 3D 뷰: 회전, 확대, 이동
const PERSP_MOUSE = { LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN };
const PERSP_TOUCH = { ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN };

interface CameraRigProps {
  viewMode: ViewMode;
  width: number;
  depth: number;
  ceilingHeight: number;
  runtime: SceneRuntime;
}

export function CameraRig({ viewMode, width, depth, ceilingHeight, runtime }: CameraRigProps) {
  const [ortho] = useState(() => new OrthographicCamera(-1, 1, 1, -1, 0.1, 200));
  const [persp] = useState(() => new PerspectiveCamera(FOV_DEG, 1, 0.05, 200));
  const active = viewMode === '2d' ? ortho : persp;

  const get = useThree((s) => s.get);
  const set = useThree((s) => s.set);
  const invalidate = useThree((s) => s.invalidate);
  const size = useThree((s) => s.size);
  const controlsRef = runtime.controlsRef;

  useEffect(() => {
    set({ camera: active });
    invalidate();
  }, [active, set, invalidate]);

  // 캔버스 크기가 바뀌면 투영만 맞춘다. 확대율과 자세는 그대로 둔다.
  useEffect(() => {
    const { width: w, height: h } = get().size;
    ortho.left = -w / 2;
    ortho.right = w / 2;
    ortho.top = h / 2;
    ortho.bottom = -h / 2;
    ortho.updateProjectionMatrix();
    persp.aspect = w / h;
    persp.updateProjectionMatrix();
    invalidate();
  }, [size, get, ortho, persp, invalidate]);

  // 방이 바뀌거나 화면을 바꾸면 방 전체가 보이도록 맞춘다.
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const extent = { width, depth, ceilingHeight };
    const { width: w, height: h } = get().size;
    if (viewMode === '2d') {
      const view = orthoView(extent);
      ortho.up.copy(view.up);
      ortho.zoom = orthoZoomToFit(w, h, extent);
      ortho.position.copy(view.position);
      ortho.lookAt(view.target);
      ortho.updateProjectionMatrix();
      controls.target.copy(view.target);
      controls.minZoom = ortho.zoom * 0.25;
      controls.maxZoom = ortho.zoom * 20;
    } else {
      const view = perspectiveView(extent, w / h);
      persp.position.copy(view.position);
      persp.lookAt(view.target);
      persp.updateProjectionMatrix();
      controls.target.copy(view.target);
      controls.minDistance = view.distance * 0.3;
      controls.maxDistance = view.distance * 3;
    }
    controls.update();
    invalidate();
  }, [viewMode, width, depth, ceilingHeight, ortho, persp, get, invalidate, controlsRef]);

  // 벽 가림은 카메라가 움직일 때마다 다시 정한다. 장면의 벽 메시는 방이 바뀌면 새로 만들어지므로 그때도 맞춘다.
  const onCameraChange = useCallback(() => {
    const s = get();
    applyWallVisibility(s.scene, s.camera, viewMode);
  }, [get, viewMode]);

  useEffect(() => {
    const s = get();
    applyWallVisibility(s.scene, s.camera, viewMode);
    invalidate();
  }, [viewMode, width, depth, ceilingHeight, active, get, invalidate]);

  // 평면 뷰는 카메라 기준 up이 -z라서 수직 위 시점이 phi = 90도에 해당한다. 각도를 90도로 고정해 기울지 않게 한다.
  return (
    <>
      <primitive object={ortho} />
      <primitive object={persp} />
      <OrbitControls
        ref={controlsRef}
        camera={active}
        enableDamping={false}
        enableRotate={viewMode === '3d'}
        mouseButtons={viewMode === '2d' ? ORTHO_MOUSE : PERSP_MOUSE}
        touches={viewMode === '2d' ? ORTHO_TOUCH : PERSP_TOUCH}
        minPolarAngle={viewMode === '2d' ? Math.PI / 2 : 0}
        maxPolarAngle={viewMode === '2d' ? Math.PI / 2 : Math.PI / 2 - 0.05}
        onChange={onCameraChange}
      />
    </>
  );
}
