# 결함 목록

| ID | 발견일 | 항목 | 재현 절차 | 기대 | 실제 | 심각도 | 담당 | 증거 | 상태 |
|---|---|---|---|---|---|---|---|---|---|
| D-T005-01 | 2026-11-17 | T-003 위임 지시 4번 (SPEC 체크리스트에는 없음) | 이름 "책상"으로 가구 추가, 평면 뷰를 봄 | 상자 위에 이름이 DOM 글자로 보임 | `scene-canvas` 안에 이름 글자가 없음. `src/scene`에 `Html` 사용 없음 | 낮음~중간 | scene-engine | e2e `T003-4`, `T-005_F-1_plan_*.png` | 고침(T-006, scene-engine. e2e T003-4 두 뷰포트 통과) |
| D-T005-02 | 2026-11-17 | SPEC 2절 "처음에 방 전체가 보인다" (V-3 보조) | 기본 상태에서 평면 뷰. 360×740, 1280×800 | 뷰 전환 버튼이 방 바닥을 가리지 않음 | 모바일 135×17 px(약 1551×198 mm), 데스크톱 71×9 px 가림. 가려진 곳의 가구는 잡을 수 없음 | 중간(모바일), 낮음(데스크톱) | 헤드(app.css) | e2e `V-3 보조`, `T-005_R-1_default_mobile.png` | 고침(헤드, app.css: 버튼 줄을 캔버스 위로 분리. e2e V-3 보조 두 뷰포트 통과) |
| D-T032-01 | 2026-11-17 | 위임 T-032 DR-3 (칩 → Escape → 취소, 칩 → Enter → 확정) | 기본 가구 칩(예: preset-table)을 마우스로 누른 직후 Escape 또는 Enter를 누름 | Escape는 미리보기가 사라지고, Enter는 가구 1개 추가 | 둘 다 반응 없음(draft 유지, items 0개). `keyboardNudge.ts handleDraftKey`가 버튼 포커스면 무시하는데 칩 클릭 후 포커스가 칩에 남음. 포커스를 치우면 정상 | 중간 | furniture-placement | e2e `DR-3b`(데스크톱·모바일 실패), `DR-3`(포커스 해제 후 통과) | 헤드 수정: src/furniture/keyboardNudge.ts handleDraftKey — Escape는 버튼 포커스에서도 취소, Enter는 preset- 칩에서만 확정. 재실행 E2E_PORT=4391 npx playwright test -g DR-3 → 4 passed |
| D-T037-01 | 2026-11-17 | SPEC 4-4 WL-1 | 평면 뷰, 탭 벽·문, 방 3600/3000. (1800, 0)을 눌러 (1810, 2000)까지 끎(데스크톱 1280x800, 모바일 360x740 둘 다) | probe.walls에 a (1800,0), b (1800,2000) 두께 100 | walls 0개, 대신 바깥 벽 0이 선택되어 outer-wall-card가 뜸. 시작점 z를 50~100으로 하면 벽이 생김(a.z=50 또는 100) | 중간 | room-input(src/structure 시작점 판정) / scene-engine(바깥 벽 눌림 영역) | e2e `WL-1`(두 뷰포트 실패), `WL-1b` 우회 통과 | 수정(헤드, 597c652) |

관찰(결함 아님): 같은 자리에 겹친 두 상자를 누르면 선택된 가구가 아니라 먼저 추가한 가구가 잡힌다. SPEC W-2는 "하나를"이라고만 한다.
관찰(T-037, 결함 아님): 칸막이 벽 정중앙에 걸친 가구는 가구 중심을 눌러도 벽이 잡혀 가구를 끌 수 없다(벽에서 떨어진 부분을 누르면 끌림). 조치: 헤드가 597c652에서 src/scene/pointer.ts pickFurniture를 고침(평면 뷰는 칸막이가 가구를 가리지 않음, 3D는 그대로). 재검증은 T-037.md 재검증 절. 문 경첩 쪽(opening-flip-hinge)을 바꿔도 문이 쓰는 자리(사분원의 바운딩 사각형)가 같아 가구 경고는 그대로다. SPEC DR-W2의 "경첩 쪽, 안·밖"에서 경첩은 경고를 바꾸지 않는다.

## 2026-11-18 전체 검증에서 추가 (보고서: docs/reports/qa/2026-11-18-qa-report.md, 증거: docs/evidence/qa-2026-11-18/)

| ID | 발견일 | 항목 | 재현 절차 | 기대 | 실제 | 심각도 | 담당 | 증거 | 상태 |
|---|---|---|---|---|---|---|---|---|---|
| D-1118-01 | 2026-11-18 | SPEC 5절 S-4 (사진 첨부), qa-verifier "실패해야 하는 입력" | 사진 탭 → `photo-file`에 이미지가 아닌 파일(글자만 든 fake.png, notimage.txt)을 고름 | 오류 문구가 뜨고 보관하지 않음 | 오류 없이 `photo-preview`가 생기고 깨진 그림 아이콘만 보임. "사진 지우기"도 나옴 | 중간 | room-input (src/photo) | `2026-11-18_explore-s4.txt`, `e21-photo-fake.png` | 고침(fix/qa-1118: src/photo/PhotoPanel.tsx — img가 그리지 못한 파일은 지우고 photo-file-error 표시. 단위 테스트 추가) |
| D-1118-02 | 2026-11-18 | SPEC 2절 방 이탈, 4-4절 (방 크기 변경 시 칸막이·문 동작이 적혀 있지 않음) | 칸막이 (1800,0)→(1800,2000)과 위쪽 벽의 문을 만든 뒤 방 폭을 1000으로 입력 | 방 밖에 놓인 칸막이를 경고로 표시하거나 정리 | 칸막이가 방 밖 x 1800에 그대로 그려지고 표시 없음. 문은 probe에서 (1000,0)~(1000,0) 폭 0으로 남아 보이지 않음 | 중간 | room-input (src/structure), 헤드(SPEC) | `2026-11-18_explore-s6.txt`, `2026-11-18_explore-s7.txt`, `e33-shrunk-with-structure.png`, `e34-shrunk-3d.png` | 고침(fix/qa-1118: src/store/projectStore.ts setRoomSize — 칸막이는 방 안으로 자르고 밖으로 나간 벽·그 문은 지움, 문은 벽 안으로 옮기거나 좁힘. src/room/RoomPanel.tsx room-fit-note로 알림, 되돌리기 가능. 단위 테스트 추가) |
| D-1118-03 | 2026-11-18 | SPEC 4-4 DR-W1 | 위쪽 바깥 벽 선택 → 문 추가 → 벽 다시 선택 → 문 추가 | 둘째 문은 빈 구간에 놓이거나 겹침 경고 | 두 문 모두 (1350,0)~(2250,0), 화면에는 하나로 보이고 경고 없음 | 낮음 | room-input (src/structure) | `2026-11-18_explore-s7.txt`, `e32-many-doors.png` | 고침(fix/qa-1118: src/structure/StructurePanel.tsx freeOpeningOffset — 빈 구간에 놓고, 없으면 넣지 않고 wall-opening-full 표시. 단위 테스트 추가) |
| D-1118-04 | 2026-11-18 | SPEC 4-7 "편집은 하지 않는다" | 사람 뷰 → 의자 칩 → 미리보기 카드의 추가 → 입력 칸 밖에서 → 키 | 사람 뷰에서는 추가·이동이 되지 않음 | 가구가 추가·선택되고 → 키로 10 mm 이동. 도구 막대·치수선이 없어 화면에서 알 수 없음 | 낮음 | furniture-placement, 헤드 | `2026-11-18_explore-s7.txt`, `e17-walk-preset.png`, `e38-walk-after-add.png` | 고침(fix/qa-1118: src/app/App.tsx 사람 뷰에서 패널 fieldset disabled + walk-edit-locked 안내, src/furniture/keyboardNudge.ts 사람 뷰에서 방향키 무시) |
| D-1118-05 | 2026-11-18 | SPEC 4-2 H-1, DECISIONS 2026-11-17 되돌리기 | 가구를 끌어 놓고 0.5초 뒤 다른 자리로 다시 끌어 놓음 → 되돌리기 한 번 | 직전 끌기만 취소 | 두 끌기가 한 단계로 묶여 처음 자리로 돌아감(1.6초 간격이면 정상) | 낮음 | 헤드 (src/store) | `2026-11-18_explore-s4.txt` | 고침(fix/qa-1118: updateItem에 merge 옵션, src/furniture/usePlacement.ts 끌기는 merge: false. 방향키 연속 이동만 묶음. 단위 테스트 추가) |
| T-1118-01 | 2026-11-18 | SPEC 4-7 WK-3 (테스트 결함, 앱은 정상) | `E2E_PORT=4535 npx playwright test tests/e2e/walk.spec.ts -g WK-3 --repeat-each=3` | WK-3 통과 | 6번 모두 실패(받은 값 5315~5447, 기대 5450 이상). walk.spec.ts 115~117행이 이동 애니메이션 도중 값을 한 번만 읽음. 앱은 0.45초 뒤 5600에 멈춤 | 중간(테스트) | qa-verifier (tests/e2e) | `2026-11-18_npm-run-e2e.txt`, `2026-11-18_e2e-rerun-WK-3.txt`, `2026-11-18_WK-3-direct-check.txt` | 고침(fix/qa-1118: tests/e2e/walk.spec.ts — 멈춘 자리가 될 때까지 poll) |
| X-1 | 2026-11-18 | SPEC 4절 X-1 | 공개 URL을 로그인 없는 새 창에서 엶 | 로그인 없이 `scene-canvas`와 `room-width`가 보임 | 공개 URL이 없음. 배포본은 비공개 아티팩트뿐 | 중간(배포 미완) | 사용자·헤드 (DEPLOY.md) | `x01-artifact-no-login.png` | 열림 |

관찰(2026-11-18, 결함 아님): SPEC W-1의 "B를 두 번 추가(둘 다 방 가운데) → 둘 다 warning true"는 4-2절의 빈 자리 배치와 맞지 않는다(둘째 B는 (1800, 500)에 놓이고 경고 없음). e2e는 끌어서 겹치게 만들어 확인한다. SPEC 문구 정정은 spec-report 몫.

2026-11-19 갱신(헤드, 사용자 직접 요청): D-1118-01 ~ D-1118-04는 e2e로도 확인한다(tests/e2e/fixes-1118.spec.ts의 S-4 깨진 파일, RF-1, RF-2, DR-W4, WK-5, 데스크톱·모바일 10개 통과). 위 관찰의 SPEC W-1 문구와 QA 보고서의 DOC-01 ~ DOC-04는 docs/SPEC.md·docs/CONTRACT.md에서 고쳤다.
