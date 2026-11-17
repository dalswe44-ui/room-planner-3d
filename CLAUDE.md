# 3D 가구배치 — 공유 규약

방의 치수를 입력해 3D로 확인하고, 치수를 입력한 박스 가구를 미리 배치해 보는 웹앱이다.
이 파일은 헤드와 모든 하위 에이전트가 함께 읽는다. 여기 적힌 규약이 어긋나면 모듈이 서로 맞지 않으므로, 바꿔야 한다면 직접 고치지 말고 헤드에게 요청한다.

## 스택
- Vite + React 19 + TypeScript (공개 호스팅은 Vercel: 정적 파일 + api/ 서버 함수 하나), three 0.187.x(고정), @react-three/fiber 9.x, @react-three/drei 10.x, zustand 5.x
- 렌더러는 WebGLRenderer. WebGPU 렌더러와 alpha 버전 패키지는 쓰지 않는다.
- 로그인 없음. 저장은 브라우저 저장소와 JSON 파일. 서버는 배치도 사진 읽기 함수(api/read-layout.ts) 하나뿐이고, API 키는 그 서버의 환경 변수에만 둔다. 앱 코드(src/)에 키를 넣지 않는다.

## 명령
- npm run dev / npm run typecheck / npm run lint / npm run test / npm run build / npm run e2e

## 단위
- 저장과 계산은 전부 정수 mm. cm와 m는 화면 표시와 입력 해석에만 쓴다.
- 문자열 ↔ mm 변환은 src/contracts/units.ts의 함수만 쓴다. 다른 곳에서 10, 100, 1000을 곱하거나 나누지 않는다.
- three.js 장면은 1 unit = 1 m. mm ↔ 장면 좌표 변환은 src/contracts/coords.ts의 함수만 쓴다.
- 장면에서 읽은 값을 저장할 때는 반드시 정수 mm로 반올림한다.

## 좌표계
- 원점은 방 바닥의 한 모서리. +x는 폭, +z는 깊이, +y는 위.
- 평면 뷰(위에서 본 화면)에서는 원점이 왼쪽 위, +x가 오른쪽, +z가 아래쪽.
- 방 치수는 안목치수(벽 안쪽 면 사이). 벽 두께는 그릴 때만 바깥쪽으로 덧붙인다.
- 벽 i는 corners[i]에서 corners[i+1]로 가는 변(마지막 벽은 첫 꼭짓점으로 돌아온다). 개구부 offset은 그 벽의 시작 꼭짓점에서 잰 거리.
- 가구의 기준점은 바닥면 중심 (x, z). 회전 0일 때 w는 x방향, d는 z방향.
- rotationDeg는 정수 도. 위에서 내려다볼 때 반시계가 양수(three.js의 rotation.y와 같은 부호).

## 소유 경로
| 경로 | 소유 |
|---|---|
| CLAUDE.md, .claude/, docs/HEAD.md, package.json, 설정 파일, api/(서버 함수), src/contracts/, src/store/, src/app/, docs/CONTRACT.md, docs/DECISIONS.md, docs/TASKS.md, docs/log/ | 헤드 |
| docs/SPEC.md, docs/submission/, README.md | spec-report |
| src/ui/, src/room/, src/photo/, src/persistence/ | room-input |
| src/scene/ | scene-engine |
| src/furniture/ | furniture-placement |
| tests/e2e/, docs/reports/qa/, docs/evidence/ | qa-verifier |
| docs/reports/<task-id>.md | 그 작업을 맡은 에이전트 |

- 자기 소유 경로 밖의 파일은 읽기만 한다. 고쳐야 할 것 같으면 보고서의 "계약·공유 파일 변경 요청"에 적는다.
- 의존성 추가도 package.json 변경이므로 요청으로 올린다.
- src/contracts/의 테스트는 고치거나 지우지 않는다. 테스트가 틀렸다고 판단되면 이유를 적어 보고한다.

## 일하는 방식
- 요청받은 것만 만든다. 요청에 없는 기능, 리팩터링, 한 번만 쓰는 helper와 추상화, 일어날 수 없는 경우의 방어 코드는 넣지 않는다. 마감이 며칠 남지 않았다.
- 모호하면 추측으로 메우지 않는다. 하위 에이전트는 사용자에게 직접 물을 수 없으므로 보고서의 "미해결 질문"에 적어 헤드에게 돌려보낸다.
- 테스트를 통과시키려고 값을 하드코딩하거나 테스트를 약하게 만들지 않는다. 테스트가 틀렸거나 과제가 불가능해 보이면 우회하지 말고 알린다.
- 외부 저장소나 웹의 코드를 복사해 넣지 않는다. 이 프로젝트의 소스는 공모전 실증자료로 제출되므로 제3자의 권리가 걸린 코드가 섞이면 안 된다. 3D 모델, 이미지, 폰트 같은 외부 에셋도 넣지 않는다.

## 보고 양식
작업이 끝나면 docs/reports/<task-id>.md 에 아래 순서로 쓰고, 최종 응답에는 그 경로와 세 줄 이내 요약만 돌려준다.
1. 한 일 (변경 파일 목록)
2. 실행한 명령과 결과 (통과·실패 수, 실패 내용)
3. 완료 기준 대조 (항목별 충족 / 미충족)
4. 계약·공유 파일 변경 요청
5. 미해결 질문

보고서는 공모전 증빙으로 쓰일 수 있다. 실제로 실행한 명령과 실제 결과만 적고, 잘 안 된 것도 그대로 적는다. 성명, 학번, 연락처, 계정명, 사용자 이름이 들어간 파일 경로는 적지 않는다.
