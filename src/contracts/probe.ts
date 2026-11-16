// 검증용 조회 계약. 화면 대신 숫자로 확인할 수 있게, 지금 실제로 그려진 방과 가구를 mm로 돌려준다.
// scene-engine이 window.__sceneProbe 로 제공하고 qa-verifier가 e2e 테스트에서 읽는다.
import type { Mm, ViewMode } from './types';

export interface SceneProbeItem {
  id: string;
  /** 그려진 상자의 중심을 방 좌표(mm)로 바꾼 값. y는 바닥에서 상자 중심까지의 높이. */
  center: { x: Mm; y: Mm; z: Mm };
  /** 그려진 상자의 크기(mm). 회전 전 기준 w(x), h(y), d(z). */
  size: { w: Mm; h: Mm; d: Mm };
  /** 그려진 상자의 y축 회전(정수 도, 0 이상 360 미만) */
  rotationDeg: number;
  /** 경고 색으로 표시되고 있는지 */
  warning: boolean;
  selected: boolean;
}

export interface SceneProbeSnapshot {
  view: ViewMode;
  /** 그려진 방 바닥의 크기(mm)와 천장 높이 */
  room: { width: Mm; depth: Mm; ceilingHeight: Mm };
  items: SceneProbeItem[];
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
