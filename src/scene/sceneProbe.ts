// window.__sceneProbe 구현. store 값이 아니라 장면에 실제로 그려진 three.js 객체에서 읽는다.
import { Box3, BoxGeometry, Camera, MathUtils, Mesh, Object3D, OrthographicCamera } from 'three';
import type { OrbitControls } from '@react-three/drei';
import type { RootState } from '@react-three/fiber';
import type { ComponentRef, RefObject } from 'react';
import { mmToWorld, worldToMm } from '../contracts/coords';
import type { SceneProbe, SceneProbeItem, SceneProbeSnapshot } from '../contracts/probe';
import type { Mm } from '../contracts/types';
import { useProjectStore } from '../store/projectStore';
import { sceneDataOf } from './geometry';
import { floorToClient, screenRectOf } from './pointer';

export type ControlsHandle = ComponentRef<typeof OrbitControls>;

/** 장면 바깥(뷰 모듈)에서 Canvas 안의 상태와 카메라 조작 객체를 찾기 위한 연결점 */
export interface SceneRuntime {
  /** Canvas 안의 SceneBridge가 채운다. 아직 준비되지 않았으면 null. */
  get: (() => RootState) | null;
  controlsRef: RefObject<ControlsHandle | null>;
  /** 장면을 그릴 때마다 DOM 겹침(도구 막대, 치수선)의 위치를 다시 잡는 함수. SceneOverlays가 채운다. */
  syncOverlays?: (() => void) | null;
}

function normalizeDeg(value: number): number {
  return ((Math.round(value) % 360) + 360) % 360;
}

function readItem(mesh: Mesh, geometry: BoxGeometry): SceneProbeItem {
  const data = sceneDataOf(mesh);
  const center = {
    x: worldToMm(mesh.position.x),
    y: worldToMm(mesh.position.y),
    z: worldToMm(mesh.position.z),
  };
  const { width, height, depth } = geometry.parameters;
  return {
    id: data.furnitureId ?? '',
    center,
    size: { w: worldToMm(width), h: worldToMm(height), d: worldToMm(depth) },
    rotationDeg: normalizeDeg(MathUtils.radToDeg(mesh.rotation.y)),
    color: data.baseColor ?? '',
    warning: data.warning === true,
    selected: data.selected === true,
    kind: data.shape ?? 'box',
  };
}

const dirOf = (rotationY: number) => ({ x: Math.cos(rotationY), z: -Math.sin(rotationY) });
const mmPt = (x: number, z: number) => ({ x: worldToMm(x), z: worldToMm(z) });

export interface SnapshotExtras {
  editMode?: 'furniture' | 'structure';
  /** 구역 이름표(DOM)를 찾을 범위. 없으면 문서 전체 */
  labelRoot?: ParentNode | null;
}

/** 장면을 읽어 검증용 스냅샷을 만든다. 방의 크기는 바닥 메시의 실제 범위, 천장은 벽 상자의 높이다. */
export function readSnapshot(scene: Object3D, camera: Camera, extras: SnapshotExtras = {}): SceneProbeSnapshot {
  const floors: Mesh[] = [];
  const walls: BoxGeometry[] = [];
  const items: SceneProbeItem[] = [];
  let draft: SceneProbeItem | null = null;
  const wallOut: SceneProbeSnapshot['walls'] = [];
  const openingOut: SceneProbeSnapshot['openings'] = [];
  scene.traverse((obj) => {
    if (!(obj instanceof Mesh)) return;
    const data = sceneDataOf(obj);
    if (data.kind === 'floor') floors.push(obj);
    else if (data.kind === 'wall' && obj.geometry instanceof BoxGeometry) walls.push(obj.geometry);
    else if (data.kind === 'partitionFootprint' && obj.geometry instanceof BoxGeometry) {
      // 상자의 로컬 x축이 벽 방향(시작 → 끝), 로컬 z 크기가 두께다.
      const { width, depth } = obj.geometry.parameters;
      const dir = dirOf(obj.rotation.y);
      const half = width / 2;
      wallOut.push({
        id: data.wallId ?? '',
        a: mmPt(obj.position.x - dir.x * half, obj.position.z - dir.z * half),
        b: mmPt(obj.position.x + dir.x * half, obj.position.z + dir.z * half),
        thickness: worldToMm(depth),
        selected: data.selected === true,
      });
    } else if (data.kind === 'opening' && data.role === 'span' && obj.geometry instanceof BoxGeometry && data.structure?.kind === 'opening') {
      const half = obj.geometry.parameters.width / 2;
      const dir = dirOf(obj.rotation.y);
      const shift = data.shiftMm ?? { x: 0, z: 0 };
      const cx = obj.position.x - mmToWorld(shift.x);
      const cz = obj.position.z - mmToWorld(shift.z);
      openingOut.push({
        id: data.structure.id,
        type: data.openingType ?? 'door',
        from: mmPt(cx - dir.x * half, cz - dir.z * half),
        to: mmPt(cx + dir.x * half, cz + dir.z * half),
        selected: data.selected === true,
      });
    }
    else if (data.kind === 'furniture' && obj.geometry instanceof BoxGeometry) {
      if (data.draft === true) draft = readItem(obj, obj.geometry);
      else items.push(readItem(obj, obj.geometry));
    }
  });

  let width: Mm = 0;
  let depth: Mm = 0;
  if (floors[0]) {
    const box = new Box3().setFromObject(floors[0]);
    width = worldToMm(box.max.x - box.min.x);
    depth = worldToMm(box.max.z - box.min.z);
  }
  const ceilingHeight: Mm = walls.length > 0 ? Math.max(...walls.map((g) => worldToMm(g.parameters.height))) : 0;

  return {
    view: camera instanceof OrthographicCamera ? '2d' : '3d',
    room: { width, depth, ceilingHeight },
    items,
    draft,
    walls: wallOut,
    openings: openingOut,
    labels: readLabels(extras.labelRoot ?? (typeof document === 'undefined' ? null : document)),
    editMode: extras.editMode ?? 'furniture',
  };
}

/** 평면 뷰에 그려진 구역 이름표(DOM). 3D 뷰에서는 그리지 않으므로 빈 목록이다. */
function readLabels(root: ParentNode | null): SceneProbeSnapshot['labels'] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>('[data-label-id]')).map((el) => ({
    id: el.dataset.labelId ?? '',
    name: el.textContent ?? '',
    at: { x: Number(el.dataset.atX), z: Number(el.dataset.atZ) },
  }));
}

export function createSceneProbe(runtime: SceneRuntime): SceneProbe {
  const state = (): RootState => {
    if (!runtime.get) throw new Error('장면이 아직 준비되지 않았다');
    return runtime.get();
  };
  return {
    snapshot() {
      const s = state();
      return readSnapshot(s.scene, s.camera, {
        editMode: useProjectStore.getState().editMode,
        labelRoot: s.gl.domElement.closest('[data-testid="scene-canvas"]'),
      });
    },
    floorToClient(x, z) {
      const s = state();
      return floorToClient(s.camera, screenRectOf(s.gl.domElement), { x, z });
    },
  };
}
