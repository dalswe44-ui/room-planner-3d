# 계약 설명

원본은 `src/contracts/`의 타입과 함수, `src/store/projectStore.ts`다. 이 문서는 그 설명이고, 둘이 다르면 코드가 맞다. 바꿔야 하면 헤드에게 요청한다.

## 1. 데이터 (`src/contracts/types.ts`)

- 모든 길이는 정수 mm. `Project` 하나가 저장 단위다: `{ version: 1, displayUnit, room, items }`.
- `Room`: `ceilingHeight`, `corners`(안목치수 바닥 다각형), `openings`, `photos`. 이번 버전의 UI는 직사각형만 만들고, `openings`는 형식만 있다.
- `FurnitureItem`: `w`(x방향 폭), `d`(z방향 깊이), `h`(높이), `x`·`z`(바닥면 중심), `rotationDeg`(정수 도, 위에서 볼 때 반시계가 양수, 이번 버전은 0·90·180·270), `elevation`, `color`.
- `ItemStatus`: `{ overlap, outside }`. 겹침과 방 이탈은 막지 않고 경고로만 쓴다.
- `DragPreview`: 끄는 동안의 임시 위치 `{ itemId, x, z }`. 손을 떼면 정수 mm로 확정한다.

## 2. 단위 (`src/contracts/units.ts`)

- `parseLength(input, fallback)`: 글자 → 정수 mm 또는 `null`. `"1200"`, `"120cm"`, `"1.2m"` 을 읽는다. 0은 0으로 돌려주므로 양수여야 하는 칸은 호출하는 쪽에서 `> 0`을 확인한다.
- `formatLength(mm, unit)`: mm는 정수, cm는 소수 1자리, m는 소수 3자리. 단위 글자는 붙이지 않는다.
- `formatLengthWithUnit(mm, unit)`: `"1.200 m"`.
- `DISPLAY_UNITS`, `UNIT_LABEL`.

## 3. 좌표 (`src/contracts/coords.ts`, `src/contracts/room.ts`)

- 장면은 1 unit = 1 m. `mmToWorld`, `worldToMm`, `roomToWorld(point, yMm)`, `worldToRoom(x, z)`.
- 방 좌표와 장면 좌표는 축이 같다: +x 폭, +y 위, +z 깊이. 원점은 방 바닥의 한 모서리.
- `rectCorners(width, depth)`: 원점 → +x → +x+z → +z 순서. 벽 0은 z=0 변, 벽 1은 x=width 변, 벽 2는 z=depth 변, 벽 3은 x=0 변.
- `roomBounds(room)`: `{ minX, maxX, minZ, maxZ, width, depth }`.

## 4. 상태 저장소 (`src/store/projectStore.ts`)

`useProjectStore`의 값: `project`, `selectedItemId`, `viewMode`(`'2d' | '3d'`), `dragPreview`.

액션:

| 액션 | 하는 일 |
|---|---|
| `setDisplayUnit(unit)` | 표시 단위만 바꾼다. 저장된 mm는 그대로다 |
| `setRoomSize({ width, depth, ceilingHeight })` | 직사각형 방의 크기를 정하고 `corners`를 다시 만든다 |
| `addItem({ name, w, d, h, ... })` | 가구를 추가하고 id를 돌려준다. 위치가 없으면 방 가운데. 추가한 가구를 선택한다 |
| `updateItem(id, patch)` | 길이는 정수 mm로, 회전은 0 이상 360 미만 정수로 맞춰 저장한다 |
| `removeItem(id)` | 선택과 끌기 상태도 함께 지운다 |
| `selectItem(id \| null)` | |
| `setViewMode(mode)` | |
| `setDragPreview(preview \| null)` | 끄는 동안의 임시 위치 |
| `replaceProject(project)` | 불러오기용 |

`createDefaultProject()`는 3600 × 3000 × 2400 mm 방과 빈 가구 목록을 돌려준다.

## 5. 모듈이 내보내는 것

`src/app/App.tsx`(헤드 소유)가 아래 컴포넌트를 한 화면으로 묶는다. 이름과 props를 바꾸려면 변경 요청으로 올린다.

### room-input

| 파일 | 내보내는 것 |
|---|---|
| `src/ui/LengthInput.tsx` | `LengthInput(props: { label: string; valueMm: Mm; unit: DisplayUnit; onCommit(mm: Mm): void; min?: Mm; max?: Mm; testId?: string })`. Enter나 포커스 이탈 때 확정한다. 읽을 수 없거나 범위를 벗어난 값은 `onCommit`을 부르지 않고 오류를 보여 준다. `min`의 기본값은 1이다 |
| `src/ui/UnitToggle.tsx` | `UnitToggle()`. store의 `displayUnit`을 읽고 바꾼다 |
| `src/room/RoomPanel.tsx` | `RoomPanel()`. 방의 폭·깊이·천장 높이 입력. store를 직접 읽고 쓴다 |

### scene-engine

| 파일 | 내보내는 것 |
|---|---|
| `src/scene/SceneView.tsx` | `SceneView(props: { handlers: PlacementHandlers; statuses: Record<string, ItemStatus> })`. `project`, `viewMode`, `selectedItemId`, `dragPreview`는 store에서 읽는다. 부모 요소를 가득 채운다. `window.__sceneProbe`를 제공한다 |
| `src/scene/ViewToggle.tsx` | `ViewToggle()`. store의 `viewMode`를 읽고 바꾼다 |

끄는 중인 가구는 `dragPreview`의 위치에 그린다(`dragPreview.itemId`가 그 가구일 때).

### furniture-placement

| 파일 | 내보내는 것 |
|---|---|
| `src/furniture/FurniturePanel.tsx` | `FurniturePanel()`. 가구 추가 폼, 목록, 선택한 가구의 수정·회전·삭제 |
| `src/furniture/usePlacement.ts` | `usePlacement(): PlacementHandlers`. 포인터 이벤트를 받아 선택, 끌기, 확정을 처리한다 |
| `src/furniture/useItemStatuses.ts` | `useItemStatuses(): Record<string, ItemStatus>`. `dragPreview`를 반영한 현재 배치의 상태 |

## 6. 포인터 이벤트 (`PlacementHandlers`)

scene-engine이 부르고 furniture-placement가 구현한다. 좌표는 모두 방 좌표 mm.

- `onItemPointerDown(itemId, floor)`: 가구 위에서 누름.
- `onBackgroundTap()`: 가구가 없는 곳을 끌지 않고 짧게 누름.
- `onFloorPointerMove(floor)`: 가구를 누른 뒤 포인터가 움직임. 가구를 끄는 동안에만 부른다.
- `onPointerUp()`: 가구를 누른 포인터를 뗌.

## 7. 검증용 조회 (`src/contracts/probe.ts`)

`window.__sceneProbe.snapshot()`은 **실제로 그려진 three.js 객체에서 읽은** 방과 가구의 값을 mm로 돌려준다(store 값을 그대로 돌려주면 검증이 되지 않는다). `floorToClient(x, z)`는 방 좌표의 한 점이 화면의 어느 위치에 그려지는지 돌려주며, e2e 테스트가 가구를 끌 때 쓴다.

## 8. 테스트용 식별자 (`data-testid`)

e2e 테스트가 화면 요소를 찾을 때 쓴다. 모듈은 아래 이름을 그대로 붙인다.

| 식별자 | 요소 | 소유 |
|---|---|---|
| `unit-mm`, `unit-cm`, `unit-m` | 단위 전환 버튼. 선택된 것은 `aria-pressed="true"` | room-input |
| `room-width`, `room-depth`, `room-height` | 방 치수 입력 칸(`input`) | room-input |
| `<testId>-error` | `LengthInput`의 오류 문구 | room-input |
| `room-unit-warning` | 단위 확인 경고 | room-input |
| `view-2d`, `view-3d` | 뷰 전환 버튼. 선택된 것은 `aria-pressed="true"` | scene-engine |
| `scene-canvas` | 캔버스를 감싼 요소 | scene-engine |
| `furniture-name`, `furniture-w`, `furniture-d`, `furniture-h`, `furniture-add` | 가구 추가 폼 | furniture-placement |
| `item-row` | 가구 목록의 한 줄. `data-item-id`에 id | furniture-placement |
| `item-rotate`, `item-delete` | 선택한 가구의 회전·삭제 버튼 | furniture-placement |
| `item-status` | 선택한 가구의 경고 문구(겹침, 방 이탈). 경고가 없으면 요소가 없다 | furniture-placement |
