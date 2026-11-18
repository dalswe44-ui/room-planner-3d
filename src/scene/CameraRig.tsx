// 두 카메라(평면 = 직교, 3D = 원근)와 카메라 조작. 화면 모드에 따라 활성 카메라를 바꾼다.
import { useCallback, useEffect, useRef, useState } from 'react';
import { OrbitControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { MOUSE, OrthographicCamera, PerspectiveCamera, TOUCH, Vector3 } from 'three';
import type { PointMm, ViewMode } from '../contracts/types';
import { FOV_DEG, applyWallVisibility, orthoFitShift, orthoView, orthoZoomToFit, perspectiveView } from './camera';
import type { SceneRuntime } from './sceneProbe';
import { WalkControls } from './WalkControls';
import { WALK_FOV_DEG, walkFovDeg, type Blocked } from './walk';

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
  /** 사람 뷰가 이동할 자리를 방 안쪽으로 당길 때 쓴다 */
  corners: readonly PointMm[];
  /** 사람 뷰가 들어갈 때 설 자리를 고르는 데 쓴다(문 안쪽, 가구 피하기) */
  walkDoors?: readonly { at: PointMm; inward: PointMm }[];
  walkBlocked?: readonly Blocked[];
  runtime: SceneRuntime;
}

export function CameraRig({ viewMode, width, depth, ceilingHeight, corners, walkDoors, walkBlocked, runtime }: CameraRigProps) {
  const [ortho] = useState(() => new OrthographicCamera(-1, 1, 1, -1, 0.1, 200));
  const [persp] = useState(() => new PerspectiveCamera(FOV_DEG, 1, 0.05, 200));
  // 사람 뷰는 3D 뷰와 따로 둔 원근 카메라를 쓴다(3D 뷰의 시점을 건드리지 않고, probe가 둘을 구별한다).
  const [walk] = useState(() => {
    const cam = new PerspectiveCamera(WALK_FOV_DEG, 1, 0.05, 200);
    cam.userData = { walk: true };
    return cam;
  });
  const active = viewMode === '2d' ? ortho : viewMode === 'walk' ? walk : persp;

  const get = useThree((s) => s.get);
  const set = useThree((s) => s.set);
  const invalidate = useThree((s) => s.invalidate);
  const size = useThree((s) => s.size);
  const controlsRef = runtime.controlsRef;
  // 3D 시점 기억: 카메라 위치는 persp 객체가 그대로 갖고 있으므로 회전 중심만 따로 둔다. 방 크기가 바뀌면 버린다.
  const saved3d = useRef<{ key: string; target: Vector3 } | null>(null);
  const extentKey = `${width}x${depth}x${ceilingHeight}`;

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
    walk.aspect = w / h;
    walk.fov = walkFovDeg(w / h);
    walk.updateProjectionMatrix();
    invalidate();
  }, [size, get, ortho, persp, walk, invalidate]);

  // 방이 바뀌거나 화면을 바꾸면 방 전체가 보이도록 맞춘다. "방 전체 보기" 버튼(QA 4-7)은 forceFit으로 3D 시점 기억도 버린다.
  const fit = useCallback((forceFit: boolean) => {
    const controls = controlsRef.current;
    if (!controls) return;
    const extent = { width, depth, ceilingHeight };
    const { width: w, height: h } = get().size;
    if (viewMode === '2d') {
      const zoom = orthoZoomToFit(w, h, extent);
      const view = orthoView(extent, orthoFitShift(zoom));
      ortho.up.copy(view.up);
      ortho.zoom = zoom;
      ortho.position.copy(view.position);
      ortho.lookAt(view.target);
      ortho.updateProjectionMatrix();
      controls.target.copy(view.target);
      controls.minZoom = ortho.zoom * 0.25;
      controls.maxZoom = ortho.zoom * 20;
    } else if (viewMode === '3d') {
      const view = perspectiveView(extent, w / h);
      const keep = !forceFit && saved3d.current?.key === extentKey ? saved3d.current.target : null;
      if (keep) {
        controls.target.copy(keep);
      } else {
        persp.position.copy(view.position);
        persp.lookAt(view.target);
        persp.updateProjectionMatrix();
        controls.target.copy(view.target);
      }
      controls.minDistance = view.distance * 0.3;
      controls.maxDistance = view.distance * 3;
    }
    // 사람 뷰는 OrbitControls를 쓰지 않는다(WalkControls가 카메라를 직접 움직인다).
    if (viewMode !== 'walk') controls.update();
    invalidate();
  }, [viewMode, width, depth, ceilingHeight, extentKey, ortho, persp, get, invalidate, controlsRef]);

  useEffect(() => fit(false), [fit]);

  // 화면 위 버튼(방 전체 보기, 확대·축소, QA 4-7)이 부르는 함수. 확대는 평면 뷰는 배율, 3D 뷰는 거리로 한다.
  useEffect(() => {
    runtime.fitView = () => fit(true);
    runtime.zoomBy = (factor: number) => {
      const controls = controlsRef.current;
      if (!controls) return;
      if (viewMode === '2d') {
        ortho.zoom = Math.min(controls.maxZoom, Math.max(controls.minZoom, ortho.zoom * factor));
        ortho.updateProjectionMatrix();
      } else if (viewMode === '3d') {
        const offset = persp.position.clone().sub(controls.target);
        const dist = Math.min(controls.maxDistance, Math.max(controls.minDistance, offset.length() / factor));
        persp.position.copy(controls.target).add(offset.setLength(dist));
      } else return;
      controls.update();
      invalidate();
    };
    return () => {
      runtime.fitView = null;
      runtime.zoomBy = null;
    };
  }, [runtime, fit, viewMode, ortho, persp, controlsRef, invalidate]);

  // 벽 가림은 카메라가 움직일 때마다 다시 정한다. 장면의 벽 메시는 방이 바뀌면 새로 만들어지므로 그때도 맞춘다.
  const onCameraChange = useCallback(() => {
    const s = get();
    applyWallVisibility(s.scene, s.camera, viewMode);
    const controls = controlsRef.current;
    if (controls && controls.object === persp) {
      saved3d.current = { key: extentKey, target: controls.target.clone() };
    }
  }, [get, viewMode, controlsRef, persp, extentKey]);

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
      <primitive object={walk} />
      {viewMode === 'walk' && <WalkControls camera={walk} corners={corners} doors={walkDoors} blocked={walkBlocked} />}
      <OrbitControls
        ref={controlsRef}
        camera={viewMode === '2d' ? ortho : persp}
        enabled={viewMode !== 'walk'}
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
