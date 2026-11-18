# fix-qa-1118 — 2026-11-18 QA 결함 수정

대상: docs/reports/qa/2026-11-18-qa-report.md, docs/reports/qa/defects.md의 D-1118-01 ~ D-1118-05, T-1118-01.
X-1(공개 URL)은 배포가 필요해 이번 작업에서 다루지 않았다.

## 1. 한 일 (변경 파일)

| 결함 | 변경 | 파일 |
|---|---|---|
| D-1118-01 깨진 사진 첨부 | 미리보기 img가 그리지 못한 파일(onError)은 읽기를 멈추고 보관을 지운 뒤 오류 문구(`photo-file-error`)를 보인다. 브라우저가 그릴 수 있는 형식(HEIC 등)은 그대로 받는다. | src/photo/PhotoPanel.tsx, src/photo/PhotoPanel.test.tsx |
| D-1118-02 방을 줄일 때 칸막이·문 | setRoomSize가 칸막이 벽을 새 방 안으로 자르고, 완전히 밖으로 나가거나 100 mm보다 짧아진 벽과 그 벽의 개구부를 지운다. 바깥 벽·칸막이의 개구부는 벽 안으로 옮기고 벽보다 넓으면 벽 길이로 좁힌다. 한 단계로 기록되어 되돌리기로 되살린다. 방 패널이 바뀐 내용을 `room-fit-note`로 알린다. | src/store/projectStore.ts, src/room/RoomPanel.tsx, src/store/projectStore.test.ts |
| D-1118-03 문 겹침 | 문·창문 추가가 같은 벽의 기존 개구부와 겹치지 않는 빈 구간 중 벽 가운데에 가장 가까운 곳에 놓는다. 빈 구간이 폭보다 좁으면 넣지 않고 `wall-opening-full`을 보인다. | src/structure/StructurePanel.tsx, src/structure/StructurePanel.test.tsx |
| D-1118-04 사람 뷰 편집 | 사람 뷰에서는 왼쪽 패널 내용을 `fieldset disabled`로 막고 `walk-edit-locked` 안내를 보인다. 방향키 이동(handleNudgeKey)도 사람 뷰에서는 무시한다. | src/app/App.tsx, src/app/app.css, src/furniture/keyboardNudge.ts |
| D-1118-05 되돌리기 묶음 | updateItem에 `opts.merge`를 더했다(기본 true). 끌기 확정(usePlacement)은 merge: false라 끌기 한 번이 한 단계다. 방향키 연속 이동은 그대로 1초 안이면 묶는다. | src/store/projectStore.ts, src/furniture/usePlacement.ts, src/store/projectStore.test.ts |
| T-1118-01 WK-3 | 이동 애니메이션이 끝난 자리(5600 − 150 이상)가 될 때까지 poll한 뒤 위 한계를 확인한다. | tests/e2e/walk.spec.ts |

그 밖에: defects.md의 위 6건 상태를 "고침"으로 바꿨다. docs/evidence/qa-2026-11-18/의 명령 출력 3개에서 사용자 이름이 든 경로를 `~/`로 가렸다(내용은 그대로).

## 2. 실행한 명령과 결과

- `npm run typecheck` — 오류 0
- `npm run lint` — 오류 0
- `npm run test` — 45 파일, 653 통과, 0 실패 (수정 전 649 + 새 테스트 4)
- `npm run build` — 성공 (청크 크기 경고만, 기존과 같음)
- `E2E_PORT=4612 npx playwright test --trace off --reporter=line` — 189 통과, 0 실패, 12 건너뜀 (5.8분). 수정 전 2026-11-18 실행은 188 통과, 1 실패(WK-3), 12 건너뜀. 출력: docs/evidence/fix-qa-1118/npm-run-e2e.txt

## 3. 완료 기준 대조

| 결함 | 기대 | 결과 |
|---|---|---|
| D-1118-01 | 이미지가 아닌 파일은 오류 문구, 보관하지 않음 | 충족(단위 테스트). e2e로 실제 깨진 파일을 넣는 테스트는 추가하지 않음 |
| D-1118-02 | 방 밖 칸막이를 경고하거나 정리 | 충족(정리 + 알림, 단위 테스트). SPEC에 동작이 적혀 있지 않아 "정리 + 알림 + 되돌리기"로 정함 |
| D-1118-03 | 둘째 문은 빈 구간에 놓이거나 겹침 경고 | 충족(빈 구간 배치, 자리가 없으면 알림. 단위 테스트) |
| D-1118-04 | 사람 뷰에서 추가·이동 안 됨 | 충족(패널 비활성, 방향키 무시). 전용 테스트는 아직 없음, 기존 e2e 회귀 없음 |
| D-1118-05 | 직전 끌기만 취소 | 충족(단위 테스트) |
| T-1118-01 | WK-3 통과 | 충족(e2e 데스크톱·모바일 통과) |

## 4. 계약·공유 파일 변경 요청

- store의 `updateItem` 시그니처에 선택 인자 `opts?: { merge?: boolean }`를 더했다(기존 호출은 그대로 동작). docs/CONTRACT.md에 반영 필요.
- SPEC 2절·4-4절에 "방 크기를 줄이면 칸막이·개구부를 방 안으로 맞추고 알린다"를 적어야 한다(spec-report 몫).

## 5. 미해결 질문

- D-1118-02에서 방 밖으로 나간 칸막이를 지우는 대신 남겨 두고 경고만 하는 쪽을 원하면 바꿔야 한다. 지금은 지우고, 되돌리기로 되살릴 수 있다.
- X-1(공개 URL)은 Vercel 배포가 필요해 사용자 결정을 기다린다.
