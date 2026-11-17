// 검증용 조회 계약. 화면 대신 숫자로 확인할 수 있게, 지금 실제로 그려진 방과 가구를 mm로 돌려준다.
// scene-engine이 window.__sceneProbe 로 제공하고 qa-verifier가 e2e 테스트에서 읽는다.
import type { FurnitureKind, Mm, ViewMode } from './types';

export interface SceneProbeItem {
  id: string;
  /** 그려진 상자의 중심을 방 좌표(mm)로 바꾼 값. y는 바닥에서 상자 중심까지의 높이. */
  center: { x: Mm; y: Mm; z: Mm };
  /** 그려진 상자의 크기(mm). 회전 전 기준 w(x), h(y), d(z). */
  size: { w: Mm; h: Mm; d: Mm };
  /** 그려진 상자의 y축 회전(정수 도, 0 이상 360 미만) */
  rotationDeg: number;
  /** 가구에 지정된 색(경고 색으로 덮이기 전의 원래 색, "#rrggbb") */
  color: string;
  /** 경고 색으로 표시되고 있는지 */
  warning: boolean;
  selected: boolean;
  /** 그려진 모양의 종류(가구에 kind가 없으면 'box') */
  kind: FurnitureKind;
}

export interface SceneProbeSnapshot {
  view: ViewMode;
  /** 그려진 방 바닥의 크기(mm)와 천장 높이 */
  room: { width: Mm; depth: Mm; ceilingHeight: Mm };
  items: SceneProbeItem[];
  /** 확정하지 않은 미리보기 가구(store.draft). 없으면 null. items에는 들어 있지 않다. */
  draft: SceneProbeItem | null;
  /** 그려진 칸막이 벽(장면 객체에서 읽은 중심선 양 끝과 두께, mm). selected는 구조 선택 여부 */
  walls: { id: string; a: { x: Mm; z: Mm }; b: { x: Mm; z: Mm }; thickness: Mm; selected: boolean }[];
  /** 그려진 문·창문. from/to는 벽 위 구간의 두 끝(mm) */
  openings: { id: string; type: 'door' | 'window' | 'opening'; from: { x: Mm; z: Mm }; to: { x: Mm; z: Mm }; selected: boolean }[];
  /** 그려진 구역 이름표 */
  labels: { id: string; name: string; at: { x: Mm; z: Mm } }[];
  /** 장면이 지금 받는 편집 모드 */
  editMode: 'furniture' | 'structure';
  /**
   * 사람 뷰에서 눈의 자리(방 좌표 mm)와 바라보는 방향. 다른 뷰에서는 null.
   * headingDeg는 정수 도(0 이상 360 미만): 0이면 위쪽 벽(-z)을 보고, 위에서 볼 때 반시계가 양수(90이면 왼쪽 벽 -x).
   */
  eye: { x: Mm; z: Mm; height: Mm; headingDeg: number } | null;
}

export interface SceneProbe {
  snapshot(): SceneProbeSnapshot;
  /** 방 좌표(mm)의 바닥 위 한 점이 캔버스의 어느 화면 좌표(CSS px, 뷰포트 기준)에 그려지는지 */
  floorToClient(x: Mm, z: Mm): { x: number; y: number };
}

declare global {
  interface Window {
    __sceneProbe?: SceneProbe;
  }
}
