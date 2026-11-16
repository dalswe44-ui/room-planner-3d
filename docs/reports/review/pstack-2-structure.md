# pstack 점검 2: 구조·타입·경계 (2026-11-17, 읽기 전용)

검토자: poteto-agent 역할(general-purpose + poteto-agent.md, poteto-mode SKILL.md 선독). 플레이북 Investigation.
적용 원칙: Model the Domain, Boundary Discipline, Type System Discipline, Minimize Reader Load, Laziness Protocol, Subtract Before You Add.
검토 시점: typecheck·lint 통과, test 275개 통과. build·e2e는 돌리지 않음.

총평: 단위·좌표 변환이 contracts 한 곳, 배치 규칙은 순수 함수, 배치도 JSON은 경계에서 파싱 뒤 Project로. 고칠 곳은 주로 같은 결정의 복사본.

## 발견 (요약)
| 가치 | 위치 | 문제 | 원칙 | 조치 |
|---|---|---|---|---|
| 높음 | RoomPanel.tsx:9-12, placement.ts:9-16, parseLayoutImport.ts:9-16 | 범위 상수(500/20000/1800/5000/10/10000)와 기본 이름이 세 곳에 따로. 사용자 확인 전 임시값이라 바뀌면 어긋날 위험 | Laziness, Model the Domain | contracts/limits.ts 하나로 |
| 중간 | parseLayoutImport.ts:137-158 | left만 있고 top이 null이면 있는 값도 버리고 "위치가 없어 가운데" 경고 | Boundary Discipline | 축별 처리 + 테스트 |
| 중간 | usePlacement.ts:11 | 주석 "100 mm", 실제 SNAP_MM 20 | Minimize Reader Load | 주석 수정 |
| 중간 | FurniturePanel.tsx:35-38, PhotoPanel.tsx:13-15 | 종류 이름표 두 곳, `as Record` 캐스트로 빠진 키를 숨김 | Type System | furniturePresets에 KIND_LABEL(box 포함) |
| 중간 | PhotoPanel.tsx:23-26 | boolean 4개가 사실은 상태 2개('idle'/'copied'/'fallback', 'idle'/'confirming'/'applied') | Model the Domain | union 두 개 |
| 중간 | types.ts:45 등 | kind 'box'와 undefined 두 표현 | Type System | 저장 기능 때 kind 필수화 |
| 중간 | types.ts:25-35 | Room.photos/PhotoRef는 아무도 안 읽음(사진은 메모리 store) | Subtract | 삭제 권장 |
| 낮음 | pointer.ts:49,87 | `|| 0`이 coords의 -0 정리를 반복하고 DECISIONS가 금지한 형태(NaN 숨김) | Boundary, Subtract | 삭제 |
| 낮음 | PhotoPanel.tsx:55-58 | file.text() 실패 미처리 | Boundary(경계라 맞는 자리) | try/catch + 문구 |
| 낮음 | layoutImport.ts:6 | LayoutUnit이 DisplayUnit 복사 | Type System | 별칭으로 |
| 낮음 | 기타 | FurnitureHit 이중 정의, COLORS 별칭, store 방 가운데 재계산, presetKind null/'box' | Reader Load | 작게 정리 |

## 고치지 말 것 (검토자 판단)
Mm 브랜드 타입(범위 큼, 실제 혼용 없음), kind 필수화·rotationDeg union(저장 기능 때), elevation 삭제, AddForm의 latest ref(iOS blur 대응, 테스트 있음), sceneProbe의 normalizeDeg 중복(독립 판독이 목적), useItemStatuses 이중 호출.

## 헤드 확인
- usePlacement.ts:11 "100 mm" 주석, parseLayoutImport의 hasPos(둘 다 있어야 위치 사용), pointer.ts의 `|| 0` 두 곳을 코드에서 직접 확인: 모두 사실.
- src/furniture/node_modules(vitest 캐시)는 헤드가 지움.
