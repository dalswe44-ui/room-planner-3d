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
| `src/ui/LengthInput.tsx` | `LengthInput(props: { label: string; valueMm: Mm; unit: DisplayUnit; onCommit(mm: Mm): void; min?: Mm; max?: Mm; testId?: string; onValidityChange?(valid: boolean): void })`. `onValidityChange`는 칸이 거부 상태(오류 문구가 보이는 상태)가 되면 `false`, 거기서 벗어나면 `true`로 부른다(T-002b에서 추가). 값이 그대로이면 `onCommit`을 부르지 않는다. 처음 그릴 때는 `onValidityChange`를 부르지 않으므로 부모는 처음 상태를 올바름으로 둔다. 확정(Enter, 포커스 이탈)으로 바뀐 상태는 그 이벤트 안에서 바로 알리고, 올바른 값일 때는 `onValidityChange(true)`가 `onCommit`보다 먼저다. 거부 상태인 칸이 화면에서 사라져도 `true`를 부르지 않으므로, 나타났다 사라지는 칸에는 이 prop을 쓰지 않는다. Enter나 포커스 이탈 때 확정한다. 읽을 수 없거나 범위를 벗어난 값은 `onCommit`을 부르지 않고 오류를 보여 준다. 오류 문구에는 허용 범위가 현재 표시 단위로 들어간다. `min`의 기본값은 1이다. `valueMm`이나 `unit`이 바뀌면 칸의 글자도 새 값으로 바뀐다 |
| `src/ui/UnitToggle.tsx` | `UnitToggle()`. store의 `displayUnit`을 읽고 바꾼다 |
| `src/room/RoomPanel.tsx` | `RoomPanel()`. 방의 폭·깊이·천장 높이 입력. store를 직접 읽고 쓴다. `UnitToggle`은 포함하지 않는다(App이 따로 놓는다) |

### scene-engine

| 파일 | 내보내는 것 |
|---|---|
| `src/scene/SceneView.tsx` | `SceneView(props: { handlers: PlacementHandlers; statuses: Record<string, ItemStatus>; selectionOverlay?: ReactNode; wallDistances?: readonly [Mm, Mm, Mm, Mm] \| null })`. `selectionOverlay`는 선택한 가구의 화면 위치 바로 위(자리가 없으면 아래)에 띄우는 DOM(가구 도구 막대). 끄는 중에는 숨긴다. `wallDistances`는 선택한 가구에서 벽 0 ~ 3까지의 거리로, 평면 뷰에서 치수선과 글자로 그린다(2026-11-17 추가). `project`, `viewMode`, `selectedItemId`, `dragPreview`는 store에서 읽는다. 부모 요소를 가득 채운다. `window.__sceneProbe`를 제공한다 |
| `src/scene/ViewToggle.tsx` | `ViewToggle()`. store의 `viewMode`를 읽고 바꾼다 |

끄는 중인 가구는 `dragPreview`의 위치에 그린다(`dragPreview.itemId`가 그 가구일 때).

### furniture-placement

| 파일 | 내보내는 것 |
|---|---|
| `src/furniture/FurniturePanel.tsx` | `FurniturePanel()`. 가구 추가 폼, 목록, 선택한 가구의 수정·회전·삭제 |
| `src/furniture/usePlacement.ts` | `usePlacement(): PlacementHandlers`. 포인터 이벤트를 받아 선택, 끌기, 확정을 처리한다 |
| `src/furniture/useItemStatuses.ts` | `useItemStatuses(): Record<string, ItemStatus>`. `dragPreview`를 반영한 현재 배치의 상태 |
| `src/furniture/ItemToolbar.tsx` | `ItemToolbar()`. 선택한 가구의 도구 막대(복제, 왼쪽·오른쪽 90도 돌리기, 삭제). 선택이 없으면 아무것도 그리지 않는다 (2026-11-17 추가) |
| `src/furniture/useSelectedWallDistances.ts` | `useSelectedWallDistances(): readonly [Mm, Mm, Mm, Mm] \| null`. 선택한 가구(끄는 중이면 임시 위치)에서 벽 0 ~ 3까지의 거리 (2026-11-17 추가) |

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
| `item-name`, `item-w`, `item-d`, `item-h`, `item-color` | 선택한 가구의 수정 칸. 선택이 없으면 요소가 없다 | furniture-placement |
| `item-dist-0` ~ `item-dist-3` | 선택한 가구에서 벽 0 ~ 3까지의 거리(숫자만, 현재 표시 단위). 선택이 없으면 요소가 없다 | furniture-placement |
| `item-rotate`, `item-delete` | 선택한 가구의 회전·삭제 버튼 | furniture-placement |
| `item-status` | 선택한 가구의 경고 문구(겹침, 방 이탈). 경고가 없으면 요소가 없다 | furniture-placement |


### 2026-11-17 추가 data-testid (가구 도구 막대, 도면 치수)
| data-testid | 어디 | 뜻 |
|---|---|---|
| `item-toolbar` | 장면 위 | 선택한 가구의 도구 막대. 선택이 없거나 끄는 중이면 없다 |
| `tool-duplicate`, `tool-rotate-left`, `tool-rotate-right`, `tool-delete` | 도구 막대 | 복제(복제본이 선택됨), 반시계 90도, 시계 90도, 삭제 |
| `item-duplicate`, `item-rotate-right` | 패널의 선택한 가구 칸 | 복제, 시계 90도(−90). 기존 `item-rotate`는 반시계 90도(+90, SPEC P-4와 같음)로 그대로, `item-delete`도 그대로. (처음에 헤드가 `item-rotate`를 시계 방향이라고 잘못 적었고 T-024 에이전트가 SPEC·테스트와 어긋남을 찾아 바로잡음) |
| `room-dim-width`, `room-dim-depth` | 평면 뷰 | 방 폭·깊이 치수 글자(현재 단위의 숫자와 단위) |
| `scene-dist-0` ~ `scene-dist-3` | 평면 뷰 | 선택한 가구에서 벽 0 ~ 3까지 거리 글자. 선택이 없으면 없다 |


### 2026-11-17 미리보기 가구 (draft) — 사용자 요청 13:21
기본 가구 버튼을 누르면 바로 추가하지 않고 미리보기를 만든다. ✓로 확정, ✗로 취소, 다른 기본 가구 버튼은 미리보기를 바꾼다.
- store: `draft: FurnitureItem | null`, `startDraft(input)`, `updateDraft(patch)`, `commitDraft()`, `cancelDraft()`. 미리보기는 project에 없다(저장·되돌리기·겹침 대상 목록 밖). 미리보기가 있는 동안 `selectedItemId`는 null. 다른 가구를 고르면(`selectItem(id)`) 미리보기는 버려진다. 빈 곳 탭은 미리보기를 버리지 않는다.
- 장면: draft를 반투명으로 그리고, 누르고 끌 수 있다(`onItemPointerDown(draft.id, …)`, 끄는 중 위치는 `dragPreview.itemId === draft.id`). 도구 막대 자리(`selectionOverlay`)는 draft가 있으면 draft 위에 띄운다. probe: `snapshot().draft`(items와 같은 모양, 없으면 null).
- 가구 쪽: `usePlacement`가 draft 끌기를 처리(놓으면 `updateDraft({x, z})`, 자석·격자 규칙은 가구와 같다), `useItemStatuses`는 draft의 겹침·방 밖도 계산(키 draft.id), `useKeyboardNudge`는 draft도 움직인다. `DraftToolbar()`: ✓ 추가(`draft-confirm`), 왼쪽·오른쪽 90도(`draft-rotate-left`, `draft-rotate-right`), ✗ 취소(`draft-cancel`). 패널에는 미리보기 카드(`draft-card`, 이름과 치수 편집 가능, 같은 ✓ ✗ 버튼).
- App: `selectionOverlay={draft ? <DraftToolbar /> : <ItemToolbar />}`.
- 추가 data-testid (T-030): `draft-toolbar`, `draft-confirm`, `draft-cancel`, `draft-rotate-left`, `draft-rotate-right`, `draft-card`, `draft-card-confirm`, `draft-card-cancel`, `draft-name`, `draft-w`, `draft-d`, `draft-h`, `draft-status`. 내보내기: `src/furniture/DraftToolbar.tsx`의 `DraftToolbar()`.


### 2026-11-17 벽·문·이름표 (사용자 요청 13:34, 방식: 바깥 벽 + 칸막이 + 문 + 구역 이름표)
- 데이터(types.ts): `Room.walls: InteriorWall[]`(가로·세로만, a/b 중심선, 두께), `Room.labels: AreaLabel[]`, `Opening.wall: WallRef`(숫자 = 바깥 벽 번호, 문자열 = 칸막이 벽 id), 문은 `hinge`('start'|'end'), `swing`('normal'|'opposite', normal = 방향 (dx,dz)의 (−dz, dx) 쪽 = 바깥 벽에서는 방 안쪽). `ItemStatus`에 `wall`(칸막이 벽과 겹침), `door`(문이 열리는 자리와 겹침).
- 기하(contracts/structure.ts, 모두 이것만 쓴다): `wallSegment`, `allWallSegments`, `interiorWallRect`, `openingSpan`, `openingFits`, `doorSwingRect`, `doorHinge`, `offsetAlongWall`, `rectsOverlap`.
- store: `editMode`('furniture' | 'structure', `setEditMode`), `selectedStructure`(`StructureTarget | null`, 가구 선택·미리보기와 배타), `addWall`(곧게 펴기 `straightenWall`) / `updateWall` / `removeWall`(붙은 문도 삭제), `addOpening`(문 기본 900×2100, 창문 1200×1200 문턱 900) / `updateOpening` / `removeOpening`, `addLabel` / `updateLabel` / `removeLabel`, `wallPreview` / `setWallPreview`(그리는 중, 기록 안 함). 끄는 중 연속 이동(벽 a·b, 문 offset, 이름표 at)은 되돌리기 한 단계로 묶인다.
- 포인터: `StructureHandlers`(types.ts). 구조 모드에서 장면은 벽·문·이름표·바깥 벽을 눌린 대상으로 보내고, 평면 뷰의 빈 바닥 누름은 `onBackgroundPointerDown`(벽 그리기), 짧은 탭은 `onBackgroundTap`. 가구는 보이기만 하고 눌리지 않는다. 3D 뷰에서는 구조물 누르기(선택·문 끌기)만, 벽 그리기는 평면 뷰에서만.
- SceneView props 추가: `structureHandlers?: StructureHandlers`.
- probe: `snapshot().walls`, `.openings`, `.labels`, `.editMode`.
- 모듈: src/structure/ (room-input 소유) — `StructurePanel()`, `useStructureHandlers(): StructureHandlers`. App 왼쪽 탭 "벽·문"을 고르면 `editMode = 'structure'`.

#### T-035 이후 확정된 동작 (장면)
- `probe.snapshot().labels`는 평면 뷰에서만 채워진다. 3D 뷰는 이름표를 그리지 않으므로 빈 배열이다.
- 고른 칸막이 벽의 길이 치수 `wall-dim`은 평면과 3D 모두에 나온다. 그리는 중인 벽 길이는 `wall-preview-dim`.
- 이름표 DOM은 `data-testid="area-label"`, `data-label-id`, `data-at-x`, `data-at-z`. 구조 모드 표시는 `structure-mode-badge`.
- 경고 규칙: `overlap || outside || wall || door` (scene/geometry.ts `isWarningStatus`). 확정 가구와 draft가 같은 규칙.
- 탭: `tab-main`, `tab-structure`("벽·문"), `tab-photo`. 벽·문 탭에 있을 때만 editMode가 'structure'.

### 2026-11-17 AI 추천 배치 (사용자 요청 16:32)
- 계약: `src/contracts/layoutSuggest.ts`. `buildSuggestPrompt(goal, room, items)`가 지시문을 만든다(가구 번호는 project.items 순서, 1부터). 답은 `LayoutSuggestion`: 가구마다 `back`(뒤가 향하는 벽), `left`, `top`.
- `BACK_TO_ROTATION`: top 0, left 90, bottom 180, right 270. 차지하는 사각형은 `footprintOfBack`. 중심 x = left + fw / 2, z = top + fd / 2.
- store: `applyArrangement(moves)` — 한 번의 기록으로 여러 가구의 x, z, rotationDeg를 바꾼다.
- 서버: `api/suggest-layout.ts`. GET → {available}. POST JSON {goal, room:{corners,walls,openings}, items:[{name,kind,w,d,h,x,z,rotationDeg}], repair?:{previous, problems}} → {text}. 서버가 같은 지시문을 만든다(앱이 보낸 글을 그대로 AI에 넘기지 않는다). 오류 코드는 read-layout과 같다(503 no_key, 429 rate_limited, 413 too_large, 400 bad_request, 403 bad_origin, 502 upstream).
- 탭: `tab-suggest`("AI 추천"). 패널 testid: `suggest-panel`, `suggest-goal`, `suggest-example`(여러 개), `suggest-run`, `suggest-stop`, `suggest-retry`, `suggest-status`, `suggest-reasons`, `suggest-tips`, `suggest-warnings`, `suggest-revert`, `suggest-keep`, `suggest-manual`, `suggest-copy`, `suggest-paste`, `suggest-paste-apply`.

### 2026-11-17 사람 뷰 (사용자 요청 16:35)
- `ViewMode`에 'walk' 추가, `WALK_EYE_HEIGHT` 1500 mm. store `setViewMode('walk')`는 선택·미리보기를 푼다.
- probe `eye`: 사람 뷰에서만 {x, z, height, headingDeg}, 다른 뷰는 null. headingDeg 0은 위쪽 벽(-z)을 봄, 반시계 양수.
- 사람 뷰에서 장면은 PlacementHandlers와 StructureHandlers를 부르지 않는다. 뷰 전환 버튼 testid는 `view-walk`.
