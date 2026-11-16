// 데이터 모델 계약. 모든 길이는 정수 mm다. (규약: CLAUDE.md, 설명: docs/CONTRACT.md)

export type Mm = number;
export type DisplayUnit = 'mm' | 'cm' | 'm';

/** 방 좌표계의 바닥 위 한 점. 원점은 방 바닥의 한 모서리, +x는 폭, +z는 깊이. */
export interface PointMm {
  x: Mm;
  z: Mm;
}

export interface Opening {
  id: string;
  type: 'door' | 'window' | 'opening';
  /** corners[wall] → corners[wall + 1] 변 */
  wall: number;
  /** 그 벽의 시작 꼭짓점에서 개구부 시작까지 */
  offset: Mm;
  width: Mm;
  height: Mm;
  /** 바닥에서 개구부 하단까지. 문은 0 */
  sill: Mm;
}

export interface PhotoRef {
  id: string;
  blobKey: string;
}

export interface Room {
  ceilingHeight: Mm;
  /** 안목치수 기준 바닥 다각형. 이번 버전의 UI는 4개(직사각형)만 만든다. */
  corners: PointMm[];
  openings: Opening[];
  photos: PhotoRef[];
}

export interface FurnitureItem {
  id: string;
  name: string;
  /** 회전 0일 때 x방향 폭 */
  w: Mm;
  /** 회전 0일 때 z방향 깊이 */
  d: Mm;
  /** 높이 */
  h: Mm;
  /** 바닥면 중심의 방 좌표 */
  x: Mm;
  z: Mm;
  /** 정수 도. 위에서 볼 때 반시계가 양수. 이번 버전은 0, 90, 180, 270 */
  rotationDeg: number;
  /** 바닥에서 띄운 높이. 기본 0 */
  elevation: Mm;
  color: string;
}

export interface Project {
  version: 1;
  displayUnit: DisplayUnit;
  room: Room;
  items: FurnitureItem[];
}

/** 화면 모드. 평면 뷰(위에서 본 화면)와 3D 뷰. */
export type ViewMode = '2d' | '3d';

/** 가구 하나의 배치 상태. 겹침과 방 이탈은 막지 않고 경고로만 표시한다. */
export interface ItemStatus {
  /** 다른 가구와 겹침 */
  overlap: boolean;
  /** 방 경계 밖으로 나감 */
  outside: boolean;
}

/** 끄는 동안의 임시 위치. 손을 떼면 정수 mm로 확정해 items에 반영하고 null로 되돌린다. */
export interface DragPreview {
  itemId: string;
  x: number;
  z: number;
}

/** scene-engine → furniture-placement 로 넘기는 포인터 이벤트. 좌표는 모두 방 좌표 mm. */
export interface PlacementHandlers {
  /** 가구 위에서 포인터를 누름. floor는 그 순간 포인터가 가리키는 바닥 위의 점. */
  onItemPointerDown(itemId: string, floor: PointMm): void;
  /** 가구가 없는 곳을 짧게 누름(끌지 않고 뗌). 선택 해제에 쓴다. */
  onBackgroundTap(): void;
  onFloorPointerMove(floor: PointMm): void;
  onPointerUp(): void;
}
