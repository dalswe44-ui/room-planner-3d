// 평면 뷰와 3D 뷰를 한 캔버스에 그린다. 포인터는 방 좌표로 바꿔 PlacementHandlers로 넘기기만 한다.
import { useEffect, useMemo, useRef, useState, createRef, type PointerEvent as ReactPointerEvent } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { roomBounds } from '../contracts/room';
import type { ItemStatus, PlacementHandlers } from '../contracts/types';
import { useProjectStore } from '../store/projectStore';
import { CameraRig } from './CameraRig';
import { FOV_DEG } from './camera';
import { FurnitureBox } from './Furniture';
import { Room } from './Room';
import { SCENE_BACKGROUND } from './geometry';
import { PlacementRouter } from './gestures';
import { pickFurniture, clientToFloor, screenRectOf } from './pointer';
import { createSceneProbe, type ControlsHandle, type SceneRuntime } from './sceneProbe';
import './scene.css';

export interface SceneViewProps {
  handlers: PlacementHandlers;
  statuses: Record<string, ItemStatus>;
}

export function SceneView({ handlers, statuses }: SceneViewProps) {
  const project = useProjectStore((s) => s.project);
  const viewMode = useProjectStore((s) => s.viewMode);
  const selectedItemId = useProjectStore((s) => s.selectedItemId);
  const dragPreview = useProjectStore((s) => s.dragPreview);

  const [runtime] = useState<SceneRuntime>(() => ({ get: null, controlsRef: createRef<ControlsHandle>() }));

  // 핸들러는 렌더마다 새 객체일 수 있으므로 최신 것을 ref로 읽는다.
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  const [router] = useState(
    () =>
      new PlacementRouter({
        handlers: {
          onItemPointerDown: (itemId, floor) => handlersRef.current.onItemPointerDown(itemId, floor),
          onBackgroundTap: () => handlersRef.current.onBackgroundTap(),
          onFloorPointerMove: (floor) => handlersRef.current.onFloorPointerMove(floor),
          onPointerUp: () => handlersRef.current.onPointerUp(),
        },
        toFloor: (clientX, clientY) => {
          const s = runtime.get?.();
          return s ? clientToFloor(s.camera, screenRectOf(s.gl.domElement), clientX, clientY) : null;
        },
        setCameraEnabled: (enabled) => {
          const controls = runtime.controlsRef.current;
          if (controls) controls.enabled = enabled;
        },
      }),
  );

  // 캡처 단계에서 먼저 받아야 카메라 조작(OrbitControls)이 같은 누름을 가져가기 전에 끌 수 있다.
  const onPointerDownCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
    const s = runtime.get?.();
    if (!s) return;
    const primary = event.pointerType !== 'mouse' || event.button === 0;
    const hit = primary
      ? pickFurniture(s.scene, s.camera, screenRectOf(s.gl.domElement), event.clientX, event.clientY)
      : null;
    router.pointerDown(event.pointerId, event.clientX, event.clientY, primary, hit);
  };

  // 포인터가 캔버스 밖으로 나가도 끝을 받도록 창에 건다.
  useEffect(() => {
    const move = (e: PointerEvent) => router.pointerMove(e.pointerId, e.clientX, e.clientY);
    const up = (e: PointerEvent) => router.pointerUp(e.pointerId);
    const cancel = (e: PointerEvent) => router.pointerCancel(e.pointerId);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
  }, [router]);

  const bounds = useMemo(() => roomBounds(project.room), [project.room]);

  const isWarning = (id: string): boolean => {
    const status = statuses[id];
    return status !== undefined && (status.overlap || status.outside);
  };

  return (
    <div
      className="scene-root"
      data-testid="scene-canvas"
      role="img"
      aria-label="방과 가구의 3D 또는 평면 장면"
      onPointerDownCapture={onPointerDownCapture}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Canvas
        frameloop="demand"
        dpr={[1, 2]}
        gl={{ antialias: true }}
        camera={{ fov: FOV_DEG, near: 0.05, far: 200, position: [3, 3, 4] }}
      >
        <SceneBridge runtime={runtime} />
        <color attach="background" args={[SCENE_BACKGROUND]} />
        <ambientLight intensity={0.8} />
        <directionalLight position={[3, 6, 4]} intensity={1.2} />
        <Room corners={project.room.corners} ceilingHeight={project.room.ceilingHeight} />
        {project.items.map((item) => (
          <FurnitureBox
            key={item.id}
            item={item}
            preview={dragPreview?.itemId === item.id ? dragPreview : null}
            warning={isWarning(item.id)}
            selected={selectedItemId === item.id}
            showLabel={viewMode === '2d'}
          />
        ))}
        <CameraRig
          viewMode={viewMode}
          width={bounds.width}
          depth={bounds.depth}
          ceilingHeight={project.room.ceilingHeight}
          runtime={runtime}
        />
      </Canvas>
    </div>
  );
}

/** Canvas 안의 상태를 바깥(런타임, 검증 조회)에 연결하고, 컨텍스트 복구 뒤에 다시 그리게 한다. */
function SceneBridge({ runtime }: { runtime: SceneRuntime }) {
  const get = useThree((s) => s.get);
  const invalidate = useThree((s) => s.invalidate);
  const canvas = useThree((s) => s.gl.domElement);

  useEffect(() => {
    runtime.get = get;
    window.__sceneProbe = createSceneProbe(runtime);
    const onRestored = () => invalidate();
    canvas.addEventListener('webglcontextrestored', onRestored);
    return () => {
      canvas.removeEventListener('webglcontextrestored', onRestored);
      delete window.__sceneProbe;
      runtime.get = null;
    };
  }, [runtime, get, invalidate, canvas]);

  return null;
}
