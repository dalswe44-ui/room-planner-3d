# pstack 점검 1: 테스트·검증 (2026-11-17, 읽기 전용)

검토자: poteto-agent 역할. 플레이북 Investigation. 원칙: Test Behavior Not Implementation, Prove It Works, Fix Root Causes, Attack the Premise.
실행: npm run test 275개 통과. e2e 다섯 번(1회차 비정상 종료 "28 passed", 2회차 요약 미확인, 3~5회차 80/80). 점검 중 다른 에이전트 커밋·작업 트리 변경이 있었음.

결론: 배치 규칙과 1차 체크리스트 테스트는 대체로 SPEC 수치로 동작을 확인한다. 약점 넷: e2e가 커밋에 묶이지 않음, 원인 모를 실패를 재실행으로 넘김, probe가 그린 화면을 일부만 반영, 1차 이후 기능과 터치는 e2e 없음.

| 심각도 | 위치 | 문제 | 원칙 | 권장 |
|---|---|---|---|---|
| 높음 | playwright.config.ts:20-25 | webServer가 공유 dist/에 빌드, 고정 포트 4173, reuseExistingServer true → 다른 에이전트의 미커밋 변경이 섞인 상태로 시험, 동시 실행 충돌 후보(추정). T-009 W-4 goto 실패를 재실행 한 번으로 닫음 | Fix Root Causes, Attack the Premise, Prove It Works | 커밋 고정 worktree, 별도 포트, 재사용 끔, trace retain-on-failure로 재현 |
| 중간 | sceneProbe.ts:25-41, Furniture.tsx:26-46 | warning·color·kind를 userData 표식에서 읽고, 모양 가구는 보이지 않는 히트 박스 값을 돌려줌 → 경고 색 줄이 깨져도 W-, F-5 e2e 통과. "probe = 그려진 것" 전제가 일부만 맞음 | Test Behavior, Attack the Premise | 평면 뷰 픽셀 색으로 경고 색 확인 e2e 1개 |
| 중간 | helpers.ts:104-107 | e2e "mobile"은 마우스 이벤트. 터치는 단위 테스트만 | Prove It Works | hasTouch 터치 끌기 e2e 1개, 실기기는 사용자 작업 |
| 중간 | T-007 | 클립보드·createObjectURL 모킹, .json 파일 테스트 없음, 브라우저 확인은 임시 복사본 | Prove It Works | 클립보드 권한 + setInputFiles e2e |
| 중간 | T-008/T-012 | 20 mm로 바꾼 뒤 가구끼리 붙기(M-2)·안 붙기(M-3)는 브라우저 미확인, e2e 영향은 손 계산 | Prove It Works | M-1~M-3 e2e |
| 낮음 | parseLayoutImport.test.ts:82-109 | 거부 테스트가 오류 개수만 봄, 10000 경계 없음 | Test Behavior | 문구에 가구 번호·칸 이름 단언 |
| 낮음 | FurniturePanel.test.tsx, parseLayoutImport.test.ts:117 | `'kind' in item` 저장 모양을 고정 | Test Behavior | (kind ?? 'box') 단언 |
| 낮음 | furnitureParts.test.ts:49-61 | 죽은 분기, 네 변 중 두 변만 확인 | Test Behavior | 정리 |
| 낮음 | evidence.spec.ts:13-16 | e2e 실행마다 T-005 스크린샷을 덮어씀 | Prove It Works | 날짜·커밋 폴더 |
| 낮음 | 주석 | usePlacement.ts:11 등 "100 mm", W-2 옛 좌표 | | 고치기 |

e2e가 확인하지 않는 것: M-1~M-3, K-1, 붙은 축 격자 미적용, 끄는 중 경고 변화, 기본 가구·item-kind·probe.kind(SPEC 항목 없음), 사진·배치도 탭(SPEC 항목 없음), 3D 끌기, F-5 색·V-4 경고 색 단언, X-1 공개 URL, S-1~S-5, 모든 터치.

검토자의 우선 3가지: (1) 격리된 e2e로 W-4 계열 실패 재현·원인 기록, (2) 새 기능 e2e와 터치 끌기, SPEC 4절 항목 추가, (3) 경고 색 픽셀 확인 또는 probe가 실제 재질을 읽게.
