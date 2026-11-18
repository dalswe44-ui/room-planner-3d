// 평면 뷰와 3D 뷰를 한 캔버스에 그린다. 포인터는 방 좌표로 바꿔 PlacementHandlers로 넘기기만 한다.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, createRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { Canvas, useFrame, useThree, type RootState } from '@react-three/fiber';
import { Object3D, type DirectionalLight } from 'three';
import { roomBounds } from '../contracts/room';
import { openingSpan } from '../contracts/structure';
import { mmToWorld } from '../contracts/coords';
import type { DragPreview, FurnitureItem, ItemStatus, Mm, PlacementHandlers, StructureHandlers, ViewMode } from '../contracts/types';
import { useProjectStore } from '../store/projectStore';
import { usePhotoStore } from '../photo/photoStore';
import { CameraRig } from './CameraRig';
import { PhotoUnderlay } from './PhotoUnderlay';
import { setSceneCapture } from './capture';
import { FOV_DEG } from './camera';
import { FurnitureBox } from './Furniture';
import { Room } from './Room';
import { SceneOverlays } from './SceneOverlays';
import { SCENE_BACKGROUND, WALL_THICKNESS_MM, isWarningStatus } from './geometry';
import { Openings } from './Openings';
import { WallPreviewOutline } from './Outlines';
import { straightenPreview } from './structureGeometry';
import { footprintCorners } from './overlayMath';
import { PlacementRouter, StructureRouter } from './gestures';
import { pickStructure, pickFurniture, clientToFloor, mmPerPxAt, screenRectOf } from './pointer';
import { createSceneProbe, type ControlsHandle, type SceneRuntime } from './sceneProbe';
import { formatLengthWithUnit } from '../contracts/units';
import { IconFit, IconMinus, IconPlus } from '../ui/icons';
import './scene.css';

export interface SceneViewProps {
  handlers: PlacementHandlers;
  statuses: Record<string, ItemStatus>;
  /** 선택한 가구의 화면 위치 바로 위(자리가 없으면 아래)에 띄우는 DOM(가구 도구 막대). 끄는 중에는 숨긴다. */
  selectionOverlay?: ReactNode;
  /** 선택한 가구에서 벽 0 ~ 3까지의 거리(mm). 평면 뷰에서 치수선과 글자로 그린다. 음수는 방 밖. */
  wallDistances?: readonly [Mm, Mm, Mm, Mm] | null;
  /** 구조 편집 모드(store.editMode === 'structure')의 포인터 처리. 없으면 구조 모드에서 장면은 카메라만 움직인다. */
  structureHandlers?: StructureHandlers;
}

/** 가구 발자국을 감싸는 사각형(mm) */
function footprintBox(item: FurnitureItem) {
  const cs = footprintCorners(item);
  return {
    minX: Math.min(...cs.map((c) => c.x)),
    maxX: Math.max(...cs.map((c) => c.x)),
    minZ: Math.min(...cs.map((c) => c.z)),
    maxZ: Math.max(...cs.map((c) => c.z)),
  };
}

export function SceneView({ handlers, statuses, selectionOverlay, wallDistances, structureHandlers }: SceneViewProps) {
  const project = useProjectStore((s) => s.project);
  const viewMode = useProjectStore((s) => s.viewMode);
  const selectedItemId = useProjectStore((s) => s.selectedItemId);
  const extraSelectedIds = useProjectStore((s) => s.extraSelectedIds);
  const dragPreview = useProjectStore((s) => s.dragPreview);
  const draft = useProjectStore((s) => s.draft);
  const editMode = useProjectStore((s) => s.editMode);
  const selectedStructure = useProjectStore((s) => s.selectedStructure);
  const wallPreview = useProjectStore((s) => s.wallPreview);
  const photoUrl = usePhotoStore((s) => s.url);
  const underlay = usePhotoStore((s) => s.underlay);

  const [hintDismissed, setHintDismissed] = useState(false);
  const [walkHintDismissed, setWalkHintDismissed] = useState(false);
  const walk = viewMode === 'walk';
  const [runtime] = useState<SceneRuntime>(() => ({ get: null, controlsRef: createRef<ControlsHandle>() }));

  // 핸들러는 렌더마다 새 객체일 수 있으므로 최신 것을 ref로 읽는다.
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);
  const structureRef = useRef(structureHandlers);
  useEffect(() => {
    structureRef.current = structureHandlers;
  }, [structureHandlers]);

  const [router] = useState(
    () =>
      new PlacementRouter({
        handlers: {
          onItemPointerDown: (itemId, floor, additive) => handlersRef.current.onItemPointerDown(itemId, floor, additive),
          onBackgroundTap: () => handlersRef.current.onBackgroundTap(),
          onFloorPointerMove: (floor, mmPerPx) => handlersRef.current.onFloorPointerMove(floor, mmPerPx),
          onPointerUp: () => handlersRef.current.onPointerUp(),
        },
        toFloor: (clientX, clientY) => {
          const s = runtime.get?.();
          return s ? clientToFloor(s.camera, screenRectOf(s.gl.domElement), clientX, clientY) : null;
        },
        mmPerPxAt: (clientX, clientY) => {
          const s = runtime.get?.();
          return s ? mmPerPxAt(s.camera, screenRectOf(s.gl.domElement), clientX, clientY) : undefined;
        },
        setCameraEnabled: (enabled) => {
          const controls = runtime.controlsRef.current;
          if (controls) controls.enabled = enabled;
        },
      }),
  );

  const [structureRouter] = useState(
    () =>
      new StructureRouter({
        handlers: {
          onTargetPointerDown: (t, floor) => structureRef.current?.onTargetPointerDown(t, floor),
          onBackgroundPointerDown: (floor) => structureRef.current?.onBackgroundPointerDown(floor),
          onPointerMove: (floor, mmPerPx) => structureRef.current?.onPointerMove(floor, mmPerPx),
          onPointerUp: () => structureRef.current?.onPointerUp(),
          onBackgroundTap: () => structureRef.current?.onBackgroundTap(),
        },
        toFloor: (clientX, clientY) => {
          const s = runtime.get?.();
          return s ? clientToFloor(s.camera, screenRectOf(s.gl.domElement), clientX, clientY) : null;
        },
        mmPerPxAt: (clientX, clientY) => {
          const s = runtime.get?.();
          return s ? mmPerPxAt(s.camera, screenRectOf(s.gl.domElement), clientX, clientY) : undefined;
        },
        setCameraEnabled: (enabled) => {
          const controls = runtime.controlsRef.current;
          if (controls) controls.enabled = enabled;
        },
      }),
  );

  // 캡처 단계에서 먼저 받아야 카메라 조작(OrbitControls)이 같은 누름을 가져가기 전에 끌 수 있다.
  const onPointerDownCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
    // 도구 막대 같은 겹침 DOM 위에서 누른 것은 장면 조작(끌기, 빈 곳 탭)이 아니다.
    if (event.target instanceof Element && event.target.closest('[data-scene-overlay]')) return;
    // 사람 뷰는 편집하지 않는다. 가구 끌기·선택·벽 그리기 핸들러를 부르지 않고 WalkControls가 카메라를 움직인다.
    if (useProjectStore.getState().viewMode === 'walk') {
      setWalkHintDismissed(true);
      return;
    }
    const s = runtime.get?.();
    if (!s) return;
    const primary = event.pointerType !== 'mouse' || event.button === 0;
    if (useProjectStore.getState().editMode === 'structure') {
      const state = useProjectStore.getState();
      const rect = screenRectOf(s.gl.domElement);
      const target = primary ? pickStructure(s.scene, s.camera, rect, event.clientX, event.clientY) : null;
      if (state.viewMode === '3d') setHintDismissed(true);
      structureRouter.pointerDown(event.pointerId, event.clientX, event.clientY, primary, target, state.viewMode === '2d');
      return;
    }
    const hit = primary
      ? pickFurniture(s.scene, s.camera, screenRectOf(s.gl.domElement), event.clientX, event.clientY, useProjectStore.getState().draft?.id ?? useProjectStore.getState().selectedItemId)
      : null;
    setHintDismissed(true);
    router.pointerDown(event.pointerId, event.clientX, event.clientY, primary, hit, event.shiftKey || event.ctrlKey || event.metaKey);
  };

  // 포인터가 캔버스 밖으로 나가도 끝을 받도록 창에 건다.
  useEffect(() => {
    const move = (e: PointerEvent) => {
      router.pointerMove(e.pointerId, e.clientX, e.clientY);
      structureRouter.pointerMove(e.pointerId, e.clientX, e.clientY);
    };
    const up = (e: PointerEvent) => {
      router.pointerUp(e.pointerId);
      structureRouter.pointerUp(e.pointerId);
    };
    const cancel = (e: PointerEvent) => {
      router.pointerCancel(e.pointerId);
      structureRouter.pointerCancel(e.pointerId);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
  }, [router, structureRouter]);

  const bounds = useMemo(() => roomBounds(project.room), [project.room]);
  // 사람 뷰의 처음 자리: 바깥 벽의 문 안쪽, 가구 위는 피한다(QA 4-3).
  const walkDoors = useMemo(
    () =>
      project.room.openings.flatMap((o) => {
        if (o.type !== 'door' || typeof o.wall !== 'number') return [];
        const span = openingSpan(project.room, o);
        return span ? [{ at: { x: (span.from.x + span.to.x) / 2, z: (span.from.z + span.to.z) / 2 }, inward: span.segment.normal }] : [];
      }),
    [project.room],
  );
  const walkBlocked = useMemo(() => project.items.map((it) => footprintBox(it)), [project.items]);

  const isWarning = (id: string): boolean => isWarningStatus(statuses[id]);
  // 낭독기가 읽을 장면 설명(QA 4-10): 어느 뷰인지, 방 크기, 가구 수와 경고 수
  const warnCount = project.items.filter((it) => isWarning(it.id)).length;
  const sceneLabel = `${viewMode === '2d' ? '평면 뷰' : viewMode === '3d' ? '3D 뷰' : '사람 뷰'}: 방 ${formatLengthWithUnit(bounds.width, project.displayUnit)} × ${formatLengthWithUnit(bounds.depth, project.displayUnit)}, 가구 ${project.items.length}개${warnCount > 0 ? `, 경고 ${warnCount}개` : ''}. 가구 목록과 치수는 패널에서 고칠 수 있어요.`;
  // 함께 고른 가구 중 하나를 끄는 동안에는 나머지도 같은 거리만큼 옮겨 그린다(QA 5-6).
  const group = selectedItemId === null ? [] : [selectedItemId, ...extraSelectedIds];
  const anchor = dragPreview && group.length > 1 && group.includes(dragPreview.itemId) ? project.items.find((it) => it.id === dragPreview.itemId) : undefined;
  const previewOf = (id: string): DragPreview | null => {
    if (dragPreview?.itemId === id) return dragPreview;
    if (!anchor || !dragPreview || !group.includes(id)) return null;
    const it = project.items.find((x) => x.id === id);
    return it ? { itemId: id, x: it.x + dragPreview.x - anchor.x, z: it.z + dragPreview.z - anchor.z } : null;
  };
  const structureMode = editMode === 'structure';
  const preview = wallPreview ? straightenPreview(wallPreview.a, wallPreview.b) : null;
  const onLabelPointerDown = (id: string, event: ReactPointerEvent<HTMLElement>) => {
    const s = runtime.get?.();
    if (!s) return;
    const primary = event.pointerType !== 'mouse' || event.button === 0;
    structureRouter.pointerDown(event.pointerId, event.clientX, event.clientY, primary, { kind: 'label', id }, viewMode === '2d');
  };

  return (
    <div
      className="scene-root"
      data-testid="scene-canvas"
      onPointerDownCapture={onPointerDownCapture}
      onWheel={() => (walk ? setWalkHintDismissed(true) : setHintDismissed(true))}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="scene-canvas-layer" role="img" aria-label={sceneLabel} data-testid="scene-label">
      {/* flat: 톤 매핑 없이 정해 둔 색 그대로 그린다(도면의 종이색·먹색·참나무색이 화면에서 달라지지 않게). */}
      <Canvas
        flat
        shadows="percentage"
        frameloop="demand"
        dpr={[1, 2]}
        gl={{ antialias: true }}
        camera={{ fov: FOV_DEG, near: 0.05, far: 200, position: [3, 3, 4] }}
      >
        <SceneBridge runtime={runtime} />
        <OverlaySync runtime={runtime} />
        <color attach="background" args={[SCENE_BACKGROUND]} />
        <Lights viewMode={viewMode} width={bounds.width} depth={bounds.depth} />
        <Room room={project.room} plan={viewMode === '2d'} selected={walk ? null : selectedStructure} />
        <Openings room={project.room} plan={viewMode === '2d'} selected={walk ? null : selectedStructure} />
        {viewMode === '2d' && photoUrl && underlay.visible && (
          <PhotoUnderlay url={photoUrl} opacity={underlay.opacity} width={bounds.width} depth={bounds.depth} />
        )}
        {structureMode && !walk && preview && <WallPreviewOutline a={preview.a} b={preview.b} thickness={WALL_THICKNESS_MM} />}
        {project.items.map((item) => (
          <FurnitureBox
            key={item.id}
            item={item}
            preview={previewOf(item.id)}
            warning={isWarning(item.id)}
            selected={selectedItemId === item.id || extraSelectedIds.includes(item.id)}
            plan={viewMode === '2d'}
          />
        ))}
        {draft && (
          <FurnitureBox
            key={draft.id}
            item={draft}
            preview={dragPreview?.itemId === draft.id ? dragPreview : null}
            warning={isWarning(draft.id)}
            selected={false}
            draft
            plan={viewMode === '2d'}
          />
        )}
        <CameraRig
          viewMode={viewMode}
          width={bounds.width}
          depth={bounds.depth}
          ceilingHeight={project.room.ceilingHeight}
          corners={project.room.corners}
          walkDoors={walkDoors}
          walkBlocked={walkBlocked}
          runtime={runtime}
        />
      </Canvas>
      </div>
      <SceneOverlays runtime={runtime} selectionOverlay={selectionOverlay} wallDistances={wallDistances} onLabelPointerDown={onLabelPointerDown} />
      {structureMode && !walk && (
        <p className="scene-mode-badge" data-testid="structure-mode-badge">
          벽·문 편집 중
        </p>
      )}
      {viewMode === '3d' && !hintDismissed && (
        <p className="scene-hint" data-testid="scene-hint">
          빈 곳을 끌면 화면이 돌아가요. 휠이나 두 손가락, + − 단추로 확대해요.
        </p>
      )}
      {viewMode === '2d' && !hintDismissed && (
        <p className="scene-hint" data-testid="scene-hint">
          가구를 끌어 옮겨요. 빈 곳을 끌면 화면이 움직이고, 휠이나 두 손가락, + − 단추로 확대해요.
        </p>
      )}
      {!walk && (
        <div className="scene-zoom" role="group" aria-label="화면 확대" data-scene-overlay="">
          <button type="button" className="icon-btn scene-zoom__btn" data-testid="zoom-in" aria-label="확대" title="확대" onClick={() => runtime.zoomBy?.(1.25)}>
            <IconPlus size={20} />
          </button>
          <button type="button" className="icon-btn scene-zoom__btn" data-testid="zoom-out" aria-label="축소" title="축소" onClick={() => runtime.zoomBy?.(0.8)}>
            <IconMinus size={20} />
          </button>
          <button type="button" className="icon-btn scene-zoom__btn" data-testid="view-fit" aria-label="방 전체 보기" title="방 전체 보기" onClick={() => runtime.fitView?.()}>
            <IconFit size={20} />
          </button>
        </div>
      )}
      {walk && !walkHintDismissed && (
        <p className="scene-hint" data-testid="scene-hint">
          끌면 둘러봐요. 바닥을 누르면 그 자리로 가요.
        </p>
      )}
    </div>
  );
}

/**
 * 조명. 평면 뷰는 바닥·가구 색이 그대로 보이도록 고르게 비추고(그림자 없음), 3D 뷰는 반구광과 주광으로 입체감을 주며
 * 가구 그림자만 만든다(그림자 지도 1024, 장면은 demand로 그려 움직일 때만 다시 그린다).
 * 광원 개수는 뷰와 상관없이 같게 두어 뷰를 바꿀 때 셰이더를 다시 만들지 않는다. 세기 1 = 반사율 1인 면이 1/π 밝기이므로 π를 쓴다.
 */
function Lights({ viewMode, width, depth }: { viewMode: ViewMode; width: number; depth: number }) {
  const plan = viewMode === '2d';
  const target = useMemo(() => new Object3D(), []);
  const lightRef = useRef<DirectionalLight>(null);
  const invalidate = useThree((s) => s.invalidate);
  const cx = mmToWorld(width) / 2;
  const cz = mmToWorld(depth) / 2;
  const reach = Math.hypot(cx, cz) * 1.15 + 0.5;

  // 그림자 카메라가 방 전체를 덮도록 맞춘다.
  useLayoutEffect(() => {
    target.position.set(cx, 0, cz);
    const light = lightRef.current;
    if (!light) return;
    const cam = light.shadow.camera;
    cam.left = -reach;
    cam.right = reach;
    cam.top = reach;
    cam.bottom = -reach;
    cam.near = 0.5;
    cam.far = reach * 2 + 12;
    cam.updateProjectionMatrix();
    invalidate();
  }, [target, cx, cz, reach, invalidate]);

  return (
    <>
      <hemisphereLight args={['#ffffff', plan ? '#ffffff' : '#f3eee4']} intensity={plan ? Math.PI : 2.5} />
      <directionalLight
        ref={lightRef}
        position={[cx - 2.5, 6, cz + 3]}
        target={target}
        intensity={plan ? 0 : 1.2}
        castShadow={!plan}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-radius={4}
      />
      <primitive object={target} />
    </>
  );
}

/** 장면을 그릴 때마다 DOM 겹침(도구 막대, 치수선)의 위치를 맞춘다. 카메라 이동·확대·회전이 모두 여기를 지난다. */
function OverlaySync({ runtime }: { runtime: SceneRuntime }) {
  useFrame(() => runtime.syncOverlays?.());
  return null;
}

/**
 * 지금 화면을 PNG로(QA 5-2). 장면을 한 번 그린 바로 뒤에 캔버스를 복사하고(그리기 버퍼가 지워지기 전), 아래에 방 크기와 가구 수를 적는다.
 * 치수선·이름표 같은 글자 겹침(DOM)은 그림에 들어가지 않는다.
 */
function capturePng(s: RootState): Promise<Blob | null> {
  s.gl.render(s.scene, s.camera);
  const src = s.gl.domElement;
  const { project, viewMode } = useProjectStore.getState();
  const b = roomBounds(project.room);
  const u = project.displayUnit;
  const scale = src.width / Math.max(1, src.clientWidth || src.width);
  const footer = Math.round(36 * scale);
  const out = document.createElement('canvas');
  out.width = src.width;
  out.height = src.height + footer;
  const ctx = out.getContext('2d');
  if (!ctx) return Promise.resolve(null);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(src, 0, 0);
  ctx.fillStyle = '#1c2b39';
  ctx.font = `${Math.round(14 * scale)}px sans-serif`;
  ctx.textBaseline = 'middle';
  const view = viewMode === '2d' ? '평면 뷰' : viewMode === '3d' ? '3D 뷰' : '사람 뷰';
  ctx.fillText(
    `3D 가구배치 · ${view} · 방 ${formatLengthWithUnit(b.width, u)} × ${formatLengthWithUnit(b.depth, u)} × ${formatLengthWithUnit(project.room.ceilingHeight, u)} · 가구 ${project.items.length}개`,
    Math.round(12 * scale),
    src.height + footer / 2,
  );
  return new Promise((resolve) => out.toBlob((blob) => resolve(blob), 'image/png'));
}

/** Canvas 안의 상태를 바깥(런타임, 검증 조회)에 연결하고, 컨텍스트 복구 뒤에 다시 그리게 한다. */
function SceneBridge({ runtime }: { runtime: SceneRuntime }) {
  const get = useThree((s) => s.get);
  const invalidate = useThree((s) => s.invalidate);
  const canvas = useThree((s) => s.gl.domElement);

  useEffect(() => {
    runtime.get = get;
    window.__sceneProbe = createSceneProbe(runtime);
    setSceneCapture(() => capturePng(get()));
    const onRestored = () => invalidate();
    canvas.addEventListener('webglcontextrestored', onRestored);
    return () => {
      canvas.removeEventListener('webglcontextrestored', onRestored);
      delete window.__sceneProbe;
      setSceneCapture(null);
      runtime.get = null;
    };
  }, [runtime, get, invalidate, canvas]);

  return null;
}
