# 결정 기록

날짜, 결정, 이유, 영향 범위를 한 항목씩 쌓는다. 버린 대안도 적는다. 지나간 항목은 고쳐 쓰지 않는다.

| 날짜 | 결정 | 이유 | 영향 | 버린 대안 |
|---|---|---|---|---|
| 2026-11-16 | 헤드 1 + 하위 에이전트 5(spec-report, room-input, scene-engine, furniture-placement, qa-verifier)로 구성하고 폴더 소유권으로 나눈다 | 사용자가 헤드 1 + 하위 5 구조를 요청했다. 조사에서 단계별 분할보다 소유 폴더별 분할이 인계 손실이 적다는 근거를 얻었다(docs/DESIGN.md) | 전체 | 기획·구현·테스트의 단계별 분할, 실험 기능인 agent teams |
| 2026-11-16 | 사진은 참고 이미지로만 쓰고 치수는 입력값만 근거로 삼는다 | 사진 한 장에서 방 구조를 자동으로 뽑는 검증된 방법을 조사에서 찾지 못했다 | room-input, 보고서 서술 | 사진에서 구조 자동 추정, LiDAR 스캔 |
| 2026-11-16 | 저장과 계산은 정수 mm, 장면은 1 unit = 1 m. 변환은 src/contracts/units.ts와 coords.ts에만 둔다 | 단위와 좌표 가정이 모듈마다 갈라지는 것을 막기 위해 | 전체 | 장면 좌표를 mm로 두기 |
| 2026-11-16 | TypeScript는 7.0.2가 아니라 6.0.3을 쓴다 | 설계서는 7.0.2를 적었으나 typescript-eslint 8.72.2의 peer 범위가 `>=4.8.4 <6.1.0`이라 맞지 않았다. npm registry에서 직접 확인했다 | 빌드 설정 | TypeScript 7.0.2 + lint에서 타입 규칙 제외 |
| 2026-11-16 | 버전 고정: react 19.3.1, three 0.187.0, @react-three/fiber 9.8.2, @react-three/drei 10.7.9, zustand 5.1.0, vite 8.3.8, vitest 5.1.0 | 설계서에서 미검증으로 남긴 조합을 실제로 설치해, Canvas·OrbitControls·OrthographicCamera·Grid를 쓰는 임시 컴포넌트로 typecheck와 build가 통과함을 확인했다 | 빌드 설정 | R3F v10·drei v11(alpha) |
| 2026-11-16 | e2e 테스트는 Playwright가 시스템의 Chrome을 쓰게 한다(`channel: 'chrome'`) | 이 작업 환경은 Playwright 브라우저 내려받기 주소에 접근할 수 없고 Chrome은 이미 설치돼 있다 | tests/e2e | Playwright 번들 Chromium |
| 2026-11-16 | 런타임 의존성 라이선스는 MIT, Apache-2.0, ISC, BSD-3-Clause뿐이다. webgl-constants는 package.json에 license 필드가 없지만 LICENSE 파일이 MIT다 | 소스코드를 공모전 실증자료로 낼 수 있어야 한다. node_modules의 package.json과 LICENSE 파일에서 직접 확인했다 | 제출물 | |
| 2026-11-16 | 이 클라우드 세션에서는 GitHub 계정이 연결돼 있지 않아 저장소를 작업 공간 안의 로컬 git 저장소로 시작한다 | 사용자가 저장소 준비를 요청했으나 원격 저장소 생성과 push는 계정 연결 없이는 할 수 없다 | 저장소, 배포 | 사용자가 연결할 때까지 대기 |
| 2026-11-16 | PlacementHandlers에 `onBackgroundTap()`을 추가한다 | 빈 곳을 눌러 선택을 해제하는 흐름에 필요하다. 설계서 초안에는 없었다 | scene-engine, furniture-placement | 선택 해제 버튼만 두기 |
