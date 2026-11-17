// 데이터 모델 계약. 모든 길이는 정수 mm다. (규약: CLAUDE.md, 설명: docs/CONTRACT.md)

export type Mm = number;
export type DisplayUnit = 'mm' | 'cm' | 'm';

/** 방 좌표계의 바닥 위 한 점. 원점은 방 바닥의 한 모서리, +x는 폭, +z는 깊이. */
export interface PointMm {
  x: Mm;
  z: Mm;
}

/**
 * 벽을 가리키는 값. 숫자는 바깥 벽 번호(corners[i] → corners[i + 1]), 문자열은 칸막이 벽 id.
 * 벽의 "시작"은 바깥 벽이면 corners[i], 칸막이 벽이면 a. "방향"은 시작에서 끝으로.
 */
export type WallRef = number | string;

export interface Opening {
  id: string;
  type: 'door' | 'window' | 'opening';
  wall: WallRef;
  /** 그 벽의 시작에서 개구부 시작까지 */
  offset: Mm;
  width: Mm;
  height: Mm;
  /** 바닥에서 개구부 하단까지. 문은 0 */
  sill: Mm;
  /** 문만: 경첩이 개구부의 어느 끝에 있는지. 'start'는 벽 시작에 가까운 끝. 기본 'start' */
  hinge?: 'start' | 'end';
  /**
   * 문만: 문짝이 벽의 어느 쪽으로 열리는지. 'normal'은 벽 방향 (dx, dz)를 +90도 돌린 (−dz, dx) 쪽.
   * 직사각형 방의 바깥 벽에서는 'normal'이 방 안쪽이다. 기본 'normal'
   */
  swing?: 'normal' | 'opposite';
}

/**
 * 방 안의 칸막이 벽(2026-11-17 사용자 요청). 가로나 세로로만 놓인다: a.x === b.x 또는 a.z === b.z.
 * a, b는 벽 중심선의 양 끝(mm). 두께는 중심선 양쪽으로 반씩. 높이는 천장 높이와 같다.
 */
export interface InteriorWall {
  id: string;
  a: PointMm;
  b: PointMm;
  thickness: Mm;
}

export interface PhotoRef {
  id: string;
  blobKey: string;
}

/** 바닥 위 구역 이름표(거실, 침실 등). 평면 뷰에 글자로 그린다. */
export interface AreaLabel {
  id: string;
  name: string;
  at: PointMm;
}

export interface Room {
  ceilingHeight: Mm;
  /** 안목치수 기준 바닥 다각형. 이번 버전의 UI는 4개(직사각형)만 만든다. */
  corners: PointMm[];
  openings: Opening[];
  /** 칸막이 벽. 바깥 테두리(corners) 안에 그린다 */
  walls: InteriorWall[];
  /** 구역 이름표 */
  labels: AreaLabel[];
  photos: PhotoRef[];
}

/** 기본 가구 종류. 장면은 종류마다 단순 도형으로 모양을 그린다. 없거나 'box'면 상자. */
export type FurnitureKind = 'box' | 'desk' | 'chair' | 'bed' | 'sofa' | 'wardrobe' | 'table' | 'shelf';

export interface FurnitureItem {
  id: string;
  name: string;
  /** 기본 가구 종류. 겹침·스냅·거리 계산은 종류와 상관없이 w×d 발자국으로 한다. */
  kind?: FurnitureKind;
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
  /** 칸막이 벽과 겹침(1 mm 이상) */
  wall: boolean;
  /** 문이 열리는 자리(문짝이 그리는 사분원의 바운딩 사각형)와 겹침 */
  door: boolean;
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
  /**
   * 끄는 중 포인터가 가리키는 바닥 위치.
   * mmPerPx: 그 위치에서 화면 1 px이 바닥에서 몇 mm인지(자석 맞춤 거리를 화면 기준으로 정하는 데 쓴다).
   * 장면이 계산하지 못하면 생략한다.
   */
  onFloorPointerMove(floor: PointMm, mmPerPx?: number): void;
  onPointerUp(): void;
}

/** 구조 편집 모드에서 누를 수 있는 것. 바깥 벽은 번호, 나머지는 id. */
export type StructureTarget =
  | { kind: 'outerWall'; index: number }
  | { kind: 'wall' | 'opening' | 'label'; id: string };

/**
 * 구조 편집 모드(store.editMode === 'structure')의 포인터 처리. 장면이 부르고 구조 편집 모듈이 구현한다.
 * 이 모드에서는 가구를 누를 수 없고(보이기만 한다), 빈 곳을 끌면 카메라 대신 벽을 그린다(평면 뷰).
 */
export interface StructureHandlers {
  /** 벽·문·창문·이름표를 누름. floor는 누른 바닥 위치 */
  onTargetPointerDown(target: StructureTarget, floor: PointMm): void;
  /** 평면 뷰에서 빈 바닥을 누름(벽 그리기 시작) */
  onBackgroundPointerDown(floor: PointMm): void;
  /** 누른 채 움직임. mmPerPx는 onFloorPointerMove와 같다 */
  onPointerMove(floor: PointMm, mmPerPx?: number): void;
  onPointerUp(): void;
  /** 빈 곳을 짧게 누름(움직임 6 px 이내) */
  onBackgroundTap(): void;
}
