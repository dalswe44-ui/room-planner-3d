# 프롬프트·위임 기록

헤드가 위임을 보내기 전에 메시지 전문을 먼저 적고, 결과를 받으면 나머지를 채운다. 사용자의 지시는 원문 그대로 남긴다. 지나간 항목은 고쳐 쓰지 않는다. 개인정보는 적지 않는다.

## 이 기록이 시작되기 전의 과정 (2026-11-16)

- 사용자가 Claude(클라우드 세션)에게 프로젝트 목표를 주고, 헤드 에이전트 1개와 하위 에이전트 5개의 구성과 프롬프트를 먼저 짜 달라고 요청했다.
- Claude가 네 갈래(웹 3D 기술 스택, 사진에서 방 구조 얻기, 기존 룸 플래너, 멀티 에이전트 설계)로 조사하고 설계서를 썼다. 조사 도중 사용자가 공모전 공지 전문을 제공했고 설계서에 반영됐다. 설계서 원문은 docs/DESIGN.md다.
- 프롬프트 6개와 CLAUDE.md는 Claude가 쓴 초안이며, 첫 커밋에 수정 없이 그대로 들어 있다. **이 시점까지 사용자가 프롬프트를 직접 고친 이력은 없다.**

## 사용자 지시 (원문)

### 2026-11-16 20:19
> 이제부터 우리는 3D 가구 배치를 만들거야 내가 원하는 목표는 프로젝트에 써 놨고 너가 필요한 에이전트를 늘려서 너가 헤드 에이전트로 하고 하위 5개의 에이전트들을 만들어서 이 프로젝트를 구성할수있게 해줘 제일 먼저 프롬프트를 짜고 몇개의 에이전트 각 에이전트는 무엇을 할것인지 만들어줘

### 2026-11-16 20:30
> (공모전 공지 전문을 첨부하며) 이거야

### 2026-11-16 22:37
> 저장소를 정하는거 너가해줄수있어?

- 헤드의 처리: 이 세션에 GitHub 계정이 연결돼 있지 않아 원격 저장소는 만들지 못했다. 작업 공간 안에 로컬 git 저장소를 만들고 프롬프트 초안을 첫 커밋으로 넣었다.

### 2026-11-16 22:38
> 나 일하고올테니까 너가 혼자 할수있는거 다 해줘

- 헤드의 해석: 사용자가 자리를 비운 동안, 사용자만 할 수 있는 일(프롬프트 직접 수정, 전후 비교 측정, 호스팅 계정 연결과 공개, 서명, 주최 측 문의)을 뺀 나머지를 설계서의 일정 순서대로 진행한다. 범위는 뼈대와 계약, SPEC, 그리고 "방 치수 입력 → 2D·3D 표시 → 가구 추가·끌기·회전·겹침 경고 → 독립 검증"까지다.
- 사용자가 프롬프트를 검토·수정하기 전에 초안 그대로 실행했다. 이 사실은 사례 보고서에 그대로 적어야 한다.
- 사용자가 정해야 하는 값(치수 허용 범위, 스냅 간격 등)은 헤드가 임시로 정해 docs/DECISIONS.md에 "사용자 확인 필요"로 남긴다.

### 2026-11-16 23:04
> 내가 즇은 아이디어가 하나 생각났어 처음에 사진이나 배치도를 넣을때 굿노트에 배치도 예시를 그리고 사진을 넣으면 가구치수나 방치수 이런거 다 반영될수있게 만들고싶어

- 사용자가 낸 기능 아이디어다. 손으로 그린 배치도(치수를 숫자로 적은 그림)를 넣으면 방과 가구가 한 번에 반영되게 하자는 것.
- 헤드의 답: 방 사진에서 치수를 추정하는 것과 달리, 적힌 숫자를 읽는 일이라 가능하다고 답했다. 방법 두 가지(① AI가 배치도를 읽어 만든 데이터를 앱에 붙여 넣는 가져오기 방식, ② 앱 안에서 자동 인식. 서버와 API 키 필요)를 제시하고 ①을 추천했다. 답이 없으면 ①로 진행하고, 기본 흐름을 먼저 끝낸 뒤 붙이기로 했다. 읽은 값은 사용자가 확인한 뒤 반영한다.

### 2026-11-16 23:20
> 1.번이고 사진을 찍더라도 그 사진안에서 가구 치수 이런것들은 직접입력하는 형식으로 만들어야할거같아

- 사용자의 결정 두 가지. (1) 배치도 읽기는 ① 가져오기 방식으로 한다. (2) 방 사진을 찍어 넣는 경우에도 가구와 방의 치수는 사진에서 자동으로 뽑지 않고 사용자가 직접 입력한다.
- 헤드의 해석: (2)는 사진을 화면에 띄워 놓고 보면서 치수를 직접 입력하는 형식으로 읽었다. 지금 설계(사진은 참고 이미지, 치수는 입력값만 근거)와 같다. 사진 위에 직접 표시를 찍어 치수를 적는 방식을 뜻한 것일 수도 있어 사용자에게 되물었다.

## 헤드가 직접 한 일 (위임 아님)

### 2026-11-16 22:40 ~ 22:50 뼈대와 계약
- package.json과 설정 파일, src/contracts/(types, units, coords, room, probe)와 계약 테스트, src/store/projectStore.ts와 테스트, src/app/ 빈 화면, docs/CONTRACT.md.
- 실행한 명령과 결과: `npm run typecheck` 통과, `npm run lint` 통과, `npm run test` 2개 파일 23개 테스트 통과, `npm run build` 통과.
- 설계서의 미검증 항목 확인: three 0.187.0 + @react-three/fiber 9.8.2 + @react-three/drei 10.7.9 조합은 임시 컴포넌트로 typecheck와 build가 통과했다. TypeScript 7.0.2는 typescript-eslint와 peer 범위가 맞지 않아 6.0.3으로 바꿨다(docs/DECISIONS.md).
- 하지 못한 것: 공개 URL 첫 배포(호스팅 계정 연결은 사용자 승인이 필요하다).

## 위임 기록

모든 위임 메시지 앞에는 아래 머리말이 붙는다(`<name>`만 바뀐다). 하위 에이전트가 자기 프롬프트 파일을 직접 읽게 하기 위해서다.

    당신은 이 저장소의 하위 에이전트 `<name>`다. 작업 디렉터리는 /home/claude/room-planner-3d 다.
    가장 먼저 .claude/agents/<name>.md 를 읽고 그 파일의 역할, 소유 경로, 규칙을 그대로 따른다. 그다음 CLAUDE.md를 읽는다.
    다른 에이전트를 띄우지 않는다. git commit과 push는 하지 않는다(헤드가 한다).
    아래가 이번 작업의 위임 메시지다.

### T-001 · spec-report · 2026-11-16 22:52 발송

    [task-id] T-001
    [목표] 구현 에이전트 3개와 qa-verifier가 그대로 따를 수 있는 요구사항과 완료 기준을 글로 고정한다. 공모전 사례 보고서의 뼈대와 전후 비교 측정 양식도 함께 만든다.
    [범위] docs/SPEC.md, docs/submission/report.md, docs/submission/before-after.md (세 파일만)
    [읽을 것] CLAUDE.md, docs/CONTRACT.md, src/contracts/ 전체, src/store/projectStore.ts, docs/DESIGN.md의 "7일판 MVP와 이후로 미루는 것" 절과 "심사 배점 네 항목에 대한 대응" 절, docs/DECISIONS.md, docs/log/PROMPT_LOG.md
    [쓸 수 있는 인터페이스] 문서 작업이라 해당 없음. 단, SPEC의 완료 기준은 docs/CONTRACT.md 8절의 data-testid 이름과 7절의 검증용 조회(window.__sceneProbe)로 확인할 수 있는 문장으로 쓴다.
    [이번 버전의 기능] 설계서 표의 "줄이지 않는 최소선" 전부와 "이번 주 목표" 중 벽까지 거리 표시, 격자 스냅까지. 자동 저장, 예시 방, 사진 첨부, JSON 내보내기는 SPEC에 "다음 작업(T-006 이후)" 절로 따로 적고 완료 기준 체크리스트도 따로 둔다.
    [헤드가 임시로 정한 값] 사용자가 자리를 비워 헤드가 정했다. SPEC에 그대로 쓰고 각 값 옆에 "(사용자 확인 필요)"를 붙인다.
      - 방 폭·깊이 허용 범위 500 ~ 20000 mm, 천장 높이 1800 ~ 5000 mm. 범위를 벗어나면 저장하지 않고 오류 문구를 보여 준다.
      - 단위 확인 경고: 방의 폭이나 깊이가 1000 mm 미만이거나 15000 mm 초과이면 저장은 하되 "단위를 확인하세요" 경고를 띄운다.
      - 가구 폭·깊이·높이 허용 범위 10 ~ 10000 mm.
      - 끌기 격자 스냅 10 mm. 손을 뗄 때 확정되는 x, z는 10 mm의 배수.
      - 회전은 버튼 한 번에 반시계 90도.
      - 겹침: 두 가구의 바닥 사각형이 1 mm 이상 겹치면 겹침. 변이 정확히 맞닿은 것은 겹침이 아니다. 이번 버전은 모든 가구가 바닥에 놓이므로 높이는 따지지 않는다.
      - 방 이탈: 가구 바닥 사각형의 일부가 방 경계 밖으로 1 mm 이상 나가면 이탈. 벽에 정확히 붙은 것은 이탈이 아니다.
      - 겹침과 이탈은 막지 않고 경고 색과 문구로만 알린다.
      - 방 치수를 줄여 가구가 방 밖에 놓이게 되면 가구 위치는 그대로 두고 이탈 경고로 표시한다.
      - 벽까지 거리: 선택한 가구의 바닥 사각형(회전 반영)에서 방의 네 벽까지의 거리 4개를 현재 표시 단위로 보여 준다.
      - 새 가구는 방 가운데에 놓인다. 기본 방은 3600 × 3000 × 2400 mm.
    [완료 기준]
      1. docs/SPEC.md가 두 쪽 이내이고 사용자 흐름, 기능과 동작 규칙(위 숫자 포함), 범위 밖, 완료 기준 체크리스트를 갖췄다.
      2. 체크리스트의 모든 항목이 "무엇을 입력하면(또는 조작하면) 무엇이 보인다(또는 어떤 값이 된다)" 형태이고 예/아니오로 답할 수 있다. 항목마다 번호(예: R-1, U-1, F-1, P-1, V-1)가 있다.
      3. 체크리스트에 거부되거나 경고되어야 하는 입력이 들어 있다: 빈 값, 0, 음수, 글자, 범위 밖 치수, m로 생각한 값을 mm 칸에 넣은 경우(예: mm 단위에서 3.5 입력), 방보다 큰 가구.
      4. 체크리스트에 단위 왕복 항목이 있다: 표시 단위를 mm → cm → m → mm로 바꿔도 저장된 값이 변하지 않는다.
      5. docs/submission/report.md에 공모전 필수 다섯 항목이 제목으로 있고, 항목마다 어떤 기록 파일에서 내용을 가져올지와 사용자가 직접 써야 할 곳("[사용자 작성 필요]", "[사용자 측정 필요: …]")이 표시돼 있다. 지금 기록 파일에 있는 사실(예: 프롬프트 초안을 Claude가 썼고 사용자 수정 이력이 아직 없다는 것, TypeScript 버전을 바꾼 결정)은 사실대로 반영한다.
      6. docs/submission/before-after.md에 측정 절차와 빈 표가 있다. 문제 층(종이와 줄자 대 앱)과 개발 층(위임 횟수 등) 두 층. 값은 비워 둔다.
    [실행할 검증] 문서 작업이라 npm 명령은 없다. 끝나면 git status로 변경이 세 파일과 보고서에만 있는지 확인한다.
    [하지 않을 것] 코드 작성, README.md, video-script.md, checklist.md(다음 작업), 구현 방법 지정, 수치 지어내기.
    [보고] docs/reports/T-001.md, CLAUDE.md의 보고 양식

- 결과 (2026-11-16 23:04 무렵 수신): 일부만 완료. docs/SPEC.md(체크리스트 34개 + 다음 작업 5개)와 docs/submission/before-after.md는 썼다. docs/submission/report.md와 docs/reports/T-001.md는 이 작업 환경의 쓰기 도구가 하위 에이전트의 보고서 파일 쓰기를 거부해 쓰지 못했고, 내용을 최종 응답으로 돌려줬다. 변경 요청 5건, 미해결 질문 9건.
- 보고서 경로: docs/reports/T-001.md (헤드가 응답 내용을 옮겨 저장)
- 통과 여부: 통과. 쓰지 못한 두 파일은 환경 제약이고 내용은 완료 기준을 충족했다.
- 헤드의 처리:
  - report.md와 T-001.md를 응답 내용 그대로 저장했다.
  - 변경 요청 1 ~ 5를 모두 받아들였다(CONTRACT 8절 식별자 추가, SceneProbeItem에 color 추가, DECISIONS에 임시 값 기록, TASKS에 사용자 확인 항목 추가, LengthInput 오류 문구에 허용 범위).
  - 미해결 질문 1(격자 스냅과 벽 붙이기의 충돌): 중심이 아니라 바닥 사각형의 왼쪽·위쪽 변을 격자에 맞추는 것으로 정하고 SPEC 2절의 끌기 규칙과 P-2를 직접 고쳤다(두 줄). 질문 2 ~ 6은 제안대로 두고 한계로 적었다. 질문 7은 다음 작업에서 정한다. 질문 8(모델)은 아래에 적는다.
  - 이후 위임의 머리말에 "보고서는 파일로 쓰지 말고 최종 응답으로 돌려주면 헤드가 저장한다"를 넣는다.
- 실행 모델: 하위 에이전트가 환경에서 확인한 모델 ID는 `claude-fable-5-2`다. 헤드도 같은 모델이다. 프롬프트 파일 머리의 `model: sonnet`은 이 실행 방식에서는 적용되지 않는다.
- 사용자가 개입해 고친 내용: 없음(사용자 부재).

### 머리말 변경 (T-002부터)

T-001에서 하위 에이전트의 보고서 파일 쓰기가 막혔으므로 머리말의 마지막 줄 앞에 아래 한 줄을 넣는다.

    작업 보고서는 파일로 쓰지 않는다. CLAUDE.md의 보고 양식 5개 항목을 최종 응답에 그대로 적어 돌려주면 헤드가 docs/reports/에 저장한다.

### T-002 · room-input · 2026-11-16 23:08 발송

    [task-id] T-002
    [목표] 사용자가 방의 폭·깊이·천장 높이를 mm·cm·m 어느 단위로든 입력하고 언제든 고칠 수 있다. 표시 단위를 바꿔도 값은 변하지 않는다. 가구 입력에서도 쓸 공용 길이 입력 부품을 만든다.
    [범위] src/ui/LengthInput.tsx, src/ui/UnitToggle.tsx, src/room/RoomPanel.tsx, 각 파일의 단위 테스트, 이 부품들의 CSS(src/ui/, src/room/ 안에 두고 컴포넌트에서 import)
    [읽을 것] docs/SPEC.md 2절의 "방", "단위 확인 경고", "단위"와 4절의 R-1 ~ R-5, U-1 ~ U-4. docs/CONTRACT.md 2절, 4절, 5절(room-input), 8절. src/contracts/units.ts, src/contracts/types.ts, src/contracts/room.ts, src/store/projectStore.ts, src/app/app.css(색 변수)
    [쓸 수 있는 인터페이스] parseLength, formatLength, UNIT_LABEL, DISPLAY_UNITS (src/contracts/units.ts). roomBounds (src/contracts/room.ts). useProjectStore의 project.displayUnit, project.room, setDisplayUnit, setRoomSize. CSS 변수 --ink, --ink-soft, --line, --accent, --warn, --panel.
    [완료 기준]
      1. LengthInput의 props가 CONTRACT 5절과 정확히 같다. testId는 input 요소의 data-testid가 되고, 오류 문구 요소는 "<testId>-error"다.
      2. Enter와 포커스 이탈 때 확정한다. 읽을 수 없는 값(빈 값, 글자, 음수, 단위 혼용)과 min ~ max 밖의 값은 onCommit을 부르지 않고 오류 문구를 보여 주며, 문구에 허용 범위가 현재 표시 단위의 숫자로 들어간다(예: mm에서 500과 20000, m에서 0.500과 20.000). 올바른 값을 확정하면 오류가 사라진다.
      3. 입력 도중의 글자("1." 등)를 덮어쓰지 않는다. valueMm이나 unit이 밖에서 바뀌면 칸의 글자가 formatLength(valueMm, unit)으로 바뀐다. 값을 고치지 않고 Enter를 눌러도 오류가 나지 않고 값이 그대로다.
      4. UnitToggle은 unit-mm, unit-cm, unit-m 버튼 3개이고 선택된 것만 aria-pressed="true"다. 누르면 store의 displayUnit만 바뀐다.
      5. RoomPanel은 room-width(500 ~ 20000), room-depth(500 ~ 20000), room-height(1800 ~ 5000) 칸을 가진다. 확정하면 setRoomSize로 반영한다. 반영된 폭이나 깊이가 1000 미만이거나 15000 초과이면 "단위를 확인하세요"가 들어간 room-unit-warning을 보여 주고, 아니면 그 요소가 없다. 천장 높이는 경고 대상이 아니다.
      6. SPEC의 R-2, R-3, R-4, R-5, U-1, U-2(방 부분), U-3, U-4가 컴포넌트 단위 테스트로 들어 있다(probe 대신 store의 값을 확인한다).
      7. 숫자 칸은 inputMode="decimal"이고, 누르는 요소의 높이는 44px 이상이다. 각 칸에 label이 연결돼 있다.
    [실행할 검증] npm run typecheck, npm run lint, npm run test
    [하지 않을 것] 사진 첨부, 저장·불러오기, 예시 방(다음 작업). src/app/ 수정(화면 조립은 헤드가 한다). three.js. 의존성 추가. src/contracts/와 src/store/ 수정.
    [보고] 최종 응답에 CLAUDE.md의 보고 양식 5개 항목

- 결과 (2026-11-16 23:15 무렵 수신): 완료 기준 7개 충족. 새 파일 8개(src/ui/, src/room/), 테스트 49개 추가. 변형 확인(구현을 일부러 망가뜨려 테스트가 잡는지)과 실제 Chrome 크기 측정까지 스스로 했다. 변경 요청 3건, 미해결 질문 6건.
- 보고서 경로: docs/reports/T-002.md (헤드가 응답 내용을 옮겨 저장)
- 통과 여부: 통과. 헤드가 git status로 변경이 src/ui/와 src/room/에만 있음을 확인했고 typecheck, lint, test(5개 파일 72개)를 직접 돌려 통과를 확인했다.
- 헤드의 처리:
  - src/app/App.tsx에 UnitToggle(머리글)과 RoomPanel(패널)을 조립했다.
  - 변경 요청 1: `onValidityChange?(valid: boolean)` 선택 prop을 추가하기로 하고 CONTRACT 5절을 먼저 고친 뒤 T-002b로 room-input에게 다시 맡긴다. 요청 2는 CONTRACT에 반영했다.
  - 미해결 질문 1, 2(휴대폰 키패드)는 사용자의 실기기 확인 항목으로 넘긴다. 3 ~ 5는 지금 동작대로 둔다.
- 사용자가 개입해 고친 내용: 없음(사용자 부재).

### T-002b · room-input · 2026-11-16 23:18 발송 (T-003과 동시에 실행)

    [task-id] T-002b
    [목표] 가구 추가 폼이 "칸에 잘못된 값이 들어 있는 동안에는 추가하지 않는다"를 구현할 수 있도록, LengthInput이 자기 칸의 거부 상태를 부모에게 알린다.
    [범위] src/ui/LengthInput.tsx, src/ui/LengthInput.test.tsx
    [읽을 것] docs/CONTRACT.md 5절의 LengthInput 줄(onValidityChange 설명이 추가됐다), docs/reports/T-002.md 4절 1번, docs/SPEC.md 4절 F-2·F-3
    [쓸 수 있는 인터페이스] 기존과 같다.
    [완료 기준]
      1. 선택 prop onValidityChange?(valid: boolean): void 가 추가됐다. 주지 않으면 기존 동작과 완전히 같다.
      2. 확정 시도가 거부되어 오류 문구가 보이게 되면 onValidityChange(false)를 부른다. 그 뒤 올바른 값이 확정되거나 valueMm·unit이 밖에서 바뀌어 오류가 사라지면 onValidityChange(true)를 부른다. 상태가 바뀔 때만 부르고 렌더마다 부르지 않는다.
      3. 테스트: 빈 값·글자·범위 밖 값을 넣고 포커스를 옮기면 false가 한 번 불린다. 올바른 값을 확정하면 true가 불린다. 포커스 이탈 뒤 곧바로 다른 버튼을 누르는 순서(가구 추가 버튼을 누르는 상황)에서 버튼의 click 핸들러가 실행되는 시점에 이미 false가 전달돼 있다.
      4. 기존 테스트가 모두 그대로 통과한다.
    [실행할 검증] npm run typecheck, npm run lint, npm run test (다른 에이전트가 src/scene/에서 동시에 작업 중이다. src/scene/ 때문에 생기는 typecheck·lint 오류는 당신의 것이 아니니 고치지 말고 보고서에 적는다)
    [하지 않을 것] 다른 파일 수정, 기존 props와 문구 변경.
    [보고] 최종 응답에 CLAUDE.md의 보고 양식 5개 항목

- 결과 (2026-11-16 23:21 무렵 수신): 완료 기준 4개 충족, 테스트 19개 추가(전체 91개 통과). 실제 Chrome 확인 중에 **요청하지 않은 결함을 스스로 찾았다**: 오류 문구가 나타나거나 사라질 때 그 아래 버튼이 밀려 클릭이 사라진다. 오류를 고친 직후 누른 "추가"가 먹지 않는다.
- 보고서 경로: docs/reports/T-002b.md
- 통과 여부: 통과.
- 헤드의 처리: 방법 A(오류 문구 자리를 항상 비워 둠)로 정하고 같은 에이전트에게 T-002c로 이어서 맡긴다. CONTRACT 5절에 설명 3줄을 보탰다. unmount 때 true를 부르는 것은 넣지 않고, 선택한 가구의 수정 칸에는 이 prop을 쓰지 말라고 T-004 위임에 적는다. iOS에서 버튼을 눌러도 칸이 포커스를 잃지 않을 가능성은 T-004에서 "추가 처리 시작 때 포커스를 직접 뗀다"로 막고 실기기 확인 항목에 넣는다.
- 사용자가 개입해 고친 내용: 없음.

### T-002c · room-input · 2026-11-16 23:22 발송 (T-002b를 한 에이전트에게 이어서 보냄, T-003은 계속 진행 중)

    [task-id] T-002c
    [목표] 오류 문구가 나타나거나 사라져도 그 아래 요소가 움직이지 않아, 오류를 고친 직후 누른 버튼의 클릭이 사라지지 않는다.
    [범위] src/ui/LengthInput.tsx, src/ui/ui.css, src/ui/LengthInput.test.tsx (필요하면 src/room/room.css의 간격)
    [읽을 것] 당신이 쓴 T-002b 보고의 4절 1번(방법 A)
    [완료 기준]
      1. 오류 문구가 없을 때에도 그 자리(한 줄 높이)가 비워져 있어, 오류가 나타나거나 사라져도 LengthInput의 높이가 변하지 않는다(문구가 한 줄인 경우).
      2. "<testId>-error" 요소는 지금처럼 오류가 있을 때만 존재한다(e2e가 요소의 유무로 거부를 판정한다).
      3. 실제 Chrome에서 확인: 버튼이 칸 바로 아래에 있을 때, 오류가 떠 있는 칸을 올바른 값으로 고치고 곧바로 버튼을 한 번 누르면 click 핸들러가 실행된다. 잘못된 값을 넣고 곧바로 누를 때도 click 핸들러가 실행되고 그 시점에 false가 전달돼 있다. 360px 폭에서 문구가 두 줄이 되는지와 그때 얼마나 밀리는지 재서 보고한다.
      4. 기존 테스트가 모두 통과한다.
    [실행할 검증] npm run typecheck, npm run lint, npm run test
    [하지 않을 것] 문구 내용과 props 변경, 다른 파일 수정.
    [보고] 최종 응답에 보고 양식 5개 항목

- 결과: (T-002c 결과를 받으면 채운다)

### T-003 · scene-engine · 2026-11-16 23:18 발송 (T-002b와 동시에 실행)

    [task-id] T-003
    [목표] 사용자가 입력한 방과 가구 상자를 평면 뷰와 3D 뷰로 볼 수 있고, 가구를 누르고 끄는 포인터가 방 좌표(mm)로 바뀌어 배치 담당 모듈에 전달된다. 검증 담당이 화면 대신 숫자로 확인할 수 있는 조회 함수를 제공한다.
    [범위] src/scene/ 전체: SceneView.tsx, ViewToggle.tsx, 내부 컴포넌트와 순수 함수, 단위 테스트, CSS
    [읽을 것] docs/SPEC.md 2절의 "끌기", "경고 표시", "뷰와 배포"와 4절의 F-1, P-1, P-3, P-4, V-1 ~ V-4. docs/CONTRACT.md 1절, 3절, 4절, 5절(scene-engine), 6절, 7절, 8절. src/contracts/ 전체, src/store/projectStore.ts, src/app/App.tsx와 app.css(SceneView가 들어갈 .app-scene 영역)
    [쓸 수 있는 인터페이스] mmToWorld, worldToMm, roomToWorld, worldToRoom (src/contracts/coords.ts). roomBounds (src/contracts/room.ts). 타입 PlacementHandlers, ItemStatus, DragPreview, SceneProbe, SceneProbeSnapshot. useProjectStore의 project, viewMode, selectedItemId, dragPreview, setViewMode. 설치된 패키지: three 0.187.0, @react-three/fiber 9.8.2, @react-three/drei 10.7.9.
    [완료 기준]
      1. SceneView의 props가 CONTRACT 5절과 같다: { handlers: PlacementHandlers; statuses: Record<string, ItemStatus> }. 부모 요소를 가득 채우고, 캔버스를 감싼 요소에 data-testid="scene-canvas"가 있다.
      2. 평면 뷰: 위에서 내려다보는 직교 카메라. 화면 방향이 CLAUDE.md의 좌표계와 같다(원점이 왼쪽 위, +x가 오른쪽, +z가 아래). 이동과 확대만 되고 회전은 안 된다. 처음에, 그리고 방 치수가 바뀔 때 방 전체가 여백을 두고 화면 안에 들어온다.
      3. 3D 뷰: 원근 카메라, 회전·확대 가능. 처음에 방 전체가 보인다. 카메라 쪽 벽이 방 안을 가리지 않는다.
      4. 그리는 것: 바닥, 벽(두께는 그릴 때만 바깥쪽으로), 가구 상자. 가구는 store의 값 그대로 그리되 dragPreview.itemId가 그 가구이면 dragPreview의 x, z에 그린다. 선택된 가구는 테두리 등으로 구분된다. statuses에서 overlap이나 outside가 true인 가구는 경고 색(app.css의 --warn 계열)으로 그린다. 평면 뷰에서는 가구 이름을 상자 위에 글자로 보여 준다(drei의 Html처럼 DOM으로 그린다. 외부 폰트를 내려받는 drei Text는 쓰지 않는다).
      5. 포인터(두 뷰 공통, 완료 기준 검증은 평면 뷰): 가구 위에서 누르면 handlers.onItemPointerDown(id, 바닥 좌표 mm). 누른 채 움직이면 handlers.onFloorPointerMove(바닥 좌표 mm), 떼면 handlers.onPointerUp(). 그 동안 카메라 조작은 멈춘다. 포인터가 캔버스 밖으로 나가도 끌기가 끊기지 않게 포인터를 붙잡는다(pointer capture). 가구가 없는 곳을 거의 움직이지 않고(5px 이내) 눌렀다 떼면 handlers.onBackgroundTap(). 빈 곳에서 시작한 끌기와 두 손가락 제스처는 카메라 조작이다. 가구를 어디에 놓을지는 정하지 않는다(store를 쓰지 않는다. viewMode만 ViewToggle이 쓴다).
      6. window.__sceneProbe (src/contracts/probe.ts): snapshot()은 store가 아니라 실제로 그려진 three.js 객체(mesh의 위치, 크기, 회전, 재질)에서 값을 읽어 mm로 바꿔 돌려준다. center.y는 바닥에서 상자 중심까지의 높이다(높이 720 상자면 360). color는 가구의 원래 색, warning은 경고 색으로 그려지고 있는지. floorToClient(x, z)는 실제 카메라로 투영한 화면 좌표(뷰포트 기준 CSS px)다. 컴포넌트가 사라지면 window.__sceneProbe도 지운다.
      7. ViewToggle은 view-2d, view-3d 버튼 2개이고 선택된 것만 aria-pressed="true"다. 버튼 높이 44px 이상.
      8. 조작이 없을 때는 다시 그리지 않는다(frameloop="demand"). 픽셀 비율 상한 2. 바닥과 가구 밑면이 깜빡이지 않는다. WebGL 컨텍스트가 끊겼다 돌아오면 다시 그린다. 만들고 버리는 geometry와 material은 해제한다.
      9. 단위 테스트(순수 함수): 알려진 mm 값의 가구가 기대한 장면 위치·크기·회전으로 바뀐다(예: w 1200, d 600, h 720, x 1800, z 1500 → 위치 [1.8, 0.36, 1.5], 크기 [1.2, 0.72, 0.6]). 화면 좌표 → 바닥 좌표 변환이 기대한 mm로 돌아온다. 방을 화면에 맞추는 계산.
      10. 실제 Chrome에서 직접 확인한다(시스템 Chrome은 /usr/bin/google-chrome, Playwright는 channel: 'chrome'로 쓸 수 있고 WebGL은 playwright.config.ts의 launchOptions 인자로 켠다). 임시 페이지나 스크립트로 SceneView를 띄우고 store에 가구를 넣어(useProjectStore.getState().addItem) 아래를 확인하고 결과를 보고서에 적는다: probe.snapshot()의 방·가구 값이 store와 일치, 평면 뷰에서 floorToClient(3600, 0)이 (0, 0)의 오른쪽 같은 높이이고 (0, 3000)이 아래 같은 가로 위치, 두 뷰 모두 방 네 모서리가 scene-canvas 안, 가구 중심을 눌러 끌면 onItemPointerDown·onFloorPointerMove·onPointerUp이 기대한 mm 좌표로 불림, 평면 뷰와 3D 뷰의 스크린샷. 임시 파일은 끝나면 지우고 스크린샷은 저장소 밖(/tmp)에 둔다.
    [실행할 검증] npm run typecheck, npm run lint, npm run test, npm run build (다른 에이전트가 src/ui/LengthInput에서 동시에 작업 중이다. src/ui/ 때문에 생기는 오류는 당신의 것이 아니니 고치지 말고 보고서에 적는다)
    [하지 않을 것] 스냅·겹침 판정·가구 위치 확정(furniture-placement의 일). 입력 폼, 저장. src/app/, src/contracts/, src/store/ 수정(필요하면 변경 요청). 의존성 추가. WebGPU 렌더러, 외부 3D 모델·텍스처·폰트. 그림자와 후처리.
    [보고] 최종 응답에 CLAUDE.md의 보고 양식 5개 항목. 실기기에서만 확인할 수 있는 것은 확인하지 못했다고 적는다.

- 결과: (T-003 결과를 받으면 채운다)

- T-002c 결과 (헤드 검증): 방법 A로 오류 줄 자리를 고정 2줄(36px)로 예약. 중간에 에이전트 세션이 중단되어 같은 지시로 재위임했다. 헤드가 직접 확인: typecheck·lint·build 통과, 테스트 94개 통과. 실제 Chrome 측정에서 320px 폭 오류 전후 버튼 위치 차이 0, 버튼 가장자리 클릭 성공. 보고서는 docs/reports/T-002c.md. 발견한 결함(요청하지 않은 발견): 1줄 예약은 320px 폭에서 오류 문구가 두 줄이 되면 막지 못했다. 같은 에이전트가 이를 찾아 2줄로 바꿨다.

- T-003 결과 (헤드 검증): 중간에 에이전트 세션이 중단되어 같은 지시로 재위임했다. src/scene/ 새 파일 11개 + 테스트 6개. 에이전트가 확인 중 평면 뷰가 약 5도 기울어 보이는 버그를 찾아 고쳤다. 보고서는 docs/reports/T-003.md.
- 헤드 후속 작업: App.tsx에 ViewToggle과 SceneView를 조립(T-004 전까지 선택만 하는 임시 핸들러), coords.ts의 -0 정규화와 테스트 1개. 실제 앱 빌드를 Chrome으로 띄워 확인하다가 에이전트가 확인하지 못한 결함 2개를 찾았다: (1) 뷰 전환 버튼이 캔버스 아래에 깔려 보이지 않음 → app.css에서 캔버스 위로 띄움, (2) 버튼 높이 36px로 완료 기준(44px 이상) 미달 → scene.css에 min-height 44px. 수정 후 view-3d 클릭으로 3D 전환과 프로브 view=3d 확인. typecheck·lint·build 통과, 테스트 136개 통과.

- T-004 위임 (헤드 → furniture-placement, 백그라운드): 지시 원문은 이 세션의 Agent 호출 프롬프트. 요지: src/furniture/에 FurniturePanel, usePlacement(grab offset, dragPreview, 10 mm 변 스냅, 3D는 선택만), useItemStatuses(1 mm 기준 겹침·이탈, 회전, 끄는 중 반영), 벽 거리, 순수 함수 단위 테스트. App.tsx는 고치지 말고 조립 코드를 돌려줄 것.
- T-004 결과 (헤드 검증): src/furniture/ 새 파일 8개, 테스트 60개 추가(전체 196개 통과). 헤드가 App.tsx 조립 후 실제 앱에서 가구 두 개를 같은 자리에 추가 → 둘 다 경고, 하나를 오른쪽 벽으로 끌기 → 경고 해제, 벽 거리 [1200, 0, 1200, 2400] 확인. 헤드가 본 차이: 평면 뷰 가구 위에 이름 글자가 보이지 않는다(T-003 지시 4번). T-005에서 확인할 항목으로 넘긴다. 에이전트가 찾은 e2e 주의점(비활성 버튼 click 시간 초과, Enter는 제출)은 T-005 지시에 넣는다.

- T-005 위임 (헤드 → qa-verifier, 백그라운드): SPEC 체크리스트 전체를 Playwright e2e로, probe 수치 비교, 데스크톱·모바일 두 폭, 증빙 스크린샷, 결함 기록(고치지 않음). T-004의 e2e 주의점과 헤드가 본 이름 글자 누락을 지시에 넣었다.
- T-005 결과 (헤드 검증): 체크리스트 X-1(공개 URL 없음)을 빼고 모두 통과. 결함 2건: D-T005-01 평면 뷰 가구 이름 글자 없음(scene-engine), D-T005-02 뷰 전환 버튼이 모바일에서 방 바닥 왼쪽 위를 가림(헤드가 T-003 조립 때 띄운 위치가 원인). 헤드가 D-T005-02를 app.css에서 고치고 e2e 재실행: 78/80, 남은 2개는 D-T005-01.

- T-006 위임 (헤드 → scene-engine, 결함 D-T005-01): 평면 뷰 가구 이름 글자. drei Html, scene-canvas 안, pointer-events none, 말줄임, demand 렌더 유지, src/scene만.
- T-006 결과 (헤드 검증): e2e 80/80. 에이전트가 알린 문제: e2e가 docs/evidence의 T-005 스크린샷을 덮어씀 → 헤드가 T-005 시점 파일로 되돌림.
- 사용자 지시 (2026-11-17 00:17): "일단 배포해서 내가 확인할수있게 해줘"
- 사용자 피드백 (00:21): "가구 추가는 되는데 일단 가구 자체를 옮겨지지않아". 헤드가 원인 조사: 샌드박스 iframe 마우스 끌기, 모바일 에뮬레이션 터치 끌기, 실제 배포 페이지(데스크톱 앱 브라우저)의 평면 뷰 끌기 모두 동작. 사용자에게 기기와 뷰를 물음.
- 사용자 답 (00:28): "컴퓨터로 3D뷰로 하니까 안옮겨". 원인은 결함이 아니라 헤드의 결정(3D 뷰는 선택만)이었다. 사용자 기대와 어긋난 결정이므로 바꿨다.
- 헤드 직접 수정: src/furniture/usePlacement.ts에서 3D 뷰 제한 한 줄 삭제, 단위 테스트를 "3D 뷰에서도 끌 수 있다"로 바꿈. Chrome 3D 뷰에서 (1800, 1500) → (900, 700) 끌기, 끄는 동안 카메라 고정, 빈 곳 끌기는 카메라 회전 확인. test 196, e2e 80/80. 배포 페이지 갱신.

- 사용자 지시 (00:32): "그리고 사진찍으면 그 방 구조처럼 바꿀수있는 사진추가 탭을 만들어줘 굿노트로 필기도를 그려도 그대로 할수있게말야"
- 사용자 지시 (00:33): "그리고 벽에 어느정도 가까이가면 벽이랑 딱 맞출수있게 만들어주고 그건 가구나 그런것에도 동일하게 만들어줘"
- 헤드 준비: src/contracts/layoutImport.ts(배치도 JSON 계약 LayoutImport와 AI에게 줄 프롬프트 LAYOUT_READER_PROMPT), units.ts에 lengthToMm과 테스트 2개. 방식 ①(DECISIONS 2026-11-16)을 따른다: 앱은 사진에서 치수를 뽑지 않고, AI가 돌려준 JSON을 사용자가 붙여 넣어 미리보기 확인 뒤 적용.
- T-007 위임 (헤드 → room-input, 등록된 에이전트 유형으로 처음 실행): src/photo/PhotoPanel. 사진 첨부·미리보기, 프롬프트 복사, JSON 붙여넣기·검사·미리보기, 확인 뒤 적용. 지시 원문은 이 세션의 Agent 호출 프롬프트.
- T-008 위임 (헤드 → furniture-placement, 동시에 실행): 벽·가구 자석 맞춤. SNAP_MM 100, 반대쪽 변끼리, 다른 축에서 겹치거나 가까울 때만, 붙은 축은 격자 미적용, 끄는 중 미리보기에 반영.
- T-007 결과 (헤드 검증): src/photo/ 새 파일, 테스트 17개. 헤드가 반영한 변경 요청: store의 DEFAULT_COLORS export(복사본 제거), App.tsx에 탭 "방·가구" / "사진·배치도"(tab-main, tab-photo). 실제 Chrome에서 시험 손그림 사진 첨부 → 시험 1의 JSON 붙여넣기 → 확인 → 적용: 방 3400×2800×2400, 침대 (500, 1000), 책상 (2800, 500), 옷장 (1750, 2500)으로 그림과 일치, 외부 요청 0건. 남은 다듬기: 경고 문구의 "items[0]" 표기가 사용자에게 낯섦.
- 사용자 지시 (00:37): "그리고 가구를 의자나 책상 이런 기본가구들은 기본 렌더링으로 만들어줘"
- 헤드 준비 (기본 가구): types.ts에 FurnitureKind와 FurnitureItem.kind?(선택 필드, 겹침·스냅은 계속 w×d 발자국), contracts/furniturePresets.ts(기본 가구 7종과 기본 치수, 이름으로 종류 짐작), probe에 kind, store addItem이 kind를 받음. 계약 테스트 2개.
- T-009 위임 (헤드 → scene-engine): 종류별 기본 도형 모델, 모든 부품은 w×d×h 안, 레이캐스트·probe는 히트 상자 유지, 회전·경고 색·평면 뷰 반영.
- T-010 위임 (헤드 → room-input): 배치도 가져오기에서 이름으로 종류 짐작, 경고 문구의 items[0] 표기 다듬기.
- 예정 T-011 (T-008 끝난 뒤 furniture-placement): 추가 폼에 기본 가구 버튼(종류·이름·치수 채움).
- T-010 결과: src/photo만 수정, photo 테스트 19개 통과. 보고서 docs/reports/T-010.md.
- T-008 결과 (헤드 검증 중): 자석 맞춤 구현, test 232개. e2e W-2가 새 규칙 때문에 실패 → 헤드가 SPEC W-2와 e2e 좌표를 (650, 650)으로 바꿈(에이전트 제안 (1000, 1000)은 겹침이 생겨 기각). SPEC에 자석 맞춤 규칙과 M-1 ~ M-3 추가. 헤드 실수 기록: f2b4903 커밋에 동시 작업 파일이 섞임(git add -A). 이후 경로 지정 커밋.
- 사용자 결정 (00:43): 자석 맞춤 거리 "2cm로 변경하자". 헤드가 SNAP_MM을 20으로 바꿈 → furniture 테스트 14개 실패(100 mm 기준 거리 사용). T-012 위임(furniture-placement): 의도는 유지하고 거리를 SNAP_MM 기준으로 다시 씀. SPEC M-1 ~ M-3 거리 갱신.
- T-011 위임·결과 (furniture-placement): 기본 가구 버튼 줄, 종류 select, 목록에 종류 표시. test 263개 통과. 보고서 docs/reports/T-011.md.
- T-009 결과 (헤드 검증): 기본 가구 7종 모양, 히트 박스 유지, 테스트 37개 추가. 헤드가 3D 스크린샷을 직접 보고 7종 모두 알아볼 수 있음을 확인. 스크린샷을 docs/evidence/T-009/에 보관.
- T-012 결과: 테스트를 SNAP_MM 기준으로 다시 씀. 헤드 통합 검증: typecheck·lint·build 통과, test 263개, e2e 80/80. 실제 앱: 기본 가구 책상 kind desk 1200×720×600, 벽 15 mm 앞 → 붙음, 40 mm 앞 → 그대로, 의자 kind chair. 배포 페이지 갱신(사진·배치도, 자석 맞춤 2 cm, 기본 가구 7종).

- 사용자 지시 (00:50): "가구를 누른상태에서 방향기로도 세밀하게 움직일수있게 만들어줘" 그리고 다른 대화에서 받은 안내문(pstack의 poteto-mode investigation 플레이북과 원칙 스킬로 검토)을 붙여 "pstack 으로 적절한 에이전트 골라서 점검한번해줘".
- T-013 위임 (furniture-placement): 선택한 가구를 방향키 10 mm, Shift+방향키 1 mm. 자석·격자 미적용, 입력 칸 포커스 시 무시.
- pstack 점검: backnotprop/pstack(MIT, 저작권 Lauren Tan)을 프로젝트 밖(/home/claude/vendor/pstack)에 받음. 프로젝트 소스에는 넣지 않음. poteto-mode의 Investigation 플레이북(읽기 전용)으로 분류하고, poteto-agent 역할의 검토자 3명을 원칙별로 나눠 동시에 실행: ① 테스트·검증(test-behavior-not-implementation, prove-it-works, fix-root-causes, attack-the-premise) ② 구조·타입·경계(model-the-domain, boundary-discipline, type-system-discipline, minimize-reader-load, laziness-protocol, subtract-before-you-add) ③ 사용자 경험 실측(experience-first, prove-it-works, fix-root-causes). 이 환경에는 poteto-agent 유형이 없어 general-purpose에 poteto-agent.md와 poteto-mode SKILL.md를 먼저 읽게 하는 머리말로 대신함. pstack 기본값의 다른 모델(Gemini 등) 패널은 이 환경에서 쓸 수 없어 같은 모델로 실행.
- T-013 결과: 방향키 이동, test 275개. 헤드가 App.tsx에 useKeyboardNudge 조립, SPEC에 K-1 추가.
- 헤드 통합 확인: 실제 앱에서 책상을 눌러 선택 → → 3번, Shift+↓ 2번 → (1830, 1502). 배포 페이지 갱신.
- pstack 점검 2(구조)와 3(경험) 결과 저장: docs/reports/review/. 헤드가 점검 2의 지적 3건을 코드에서 직접 확인(사실).
- 사용자 지시 (00:58): "나 자고올테니까 너 스스로 할수있는것들 하고 오전 8시 30분에 보고해". 08:30 보고 예약(세션으로 돌아오는 예약 메시지).
- 헤드 직접 작업: contracts/limits.ts, KIND_LABEL·presetFor(+테스트 2), store 되돌리기(past/future, 연속 이동 묶기, +테스트 4), app/useUndoShortcuts(+테스트 3), 헤더 되돌리기·다시 실행 버튼, 패널의 중복 제목(h2) 제거, 인라인 favicon(콘솔 404 원인 추정). test 284개.
- 동시 위임(사용자 부재): T-014 furniture-placement(기본 가구 버튼 즉시 추가, 빈 자리 배치 findFreeSpot, 목록 중복 표기, limits 사용, 모바일 편집 칸 스크롤), T-015 room-input(자동 저장 S-1·사진 저장 S-4 가능하면, 배치도 축별 위치·종류별 기본 높이·JSON 단위 미리보기·확인 버튼 스크롤·파일 읽기 오류·상태 union, limits 사용), T-016 scene-engine(겹친 자리에서 선택한 가구 우선, 3D 조작 안내, 3D 시점 기억, || 0 제거). 고치지 않고 사용자에게 물을 것: 자석 거리 기준(2 cm vs 화면 기준), 끌 때 방 안으로 제한.
- pstack 점검 1(테스트·검증) 결과 저장. 헤드 판단: 가장 중요한 지적은 e2e가 공유 dist/·고정 포트·서버 재사용으로 동시 작업과 섞인다는 것. 지금 돌고 있는 T-014~016이 끝난 뒤 playwright 설정을 고치고(재사용 끔, trace, 포트 변수), 커밋 고정 worktree에서 최종 e2e를 돌린다. 새 기능 e2e는 T-017(qa-verifier)로.
- T-014·T-015·T-016 결과 저장. 헤드가 App.tsx에 usePersistence 조립(맨 앞). 합친 상태 test 332개 통과. e2e는 새 동작(빈 자리 배치) 때문에 8개 실패 예상 → T-017에서 qa가 고침.
- 헤드: playwright 설정 격리(점검 1의 높음). 실행마다 .e2e-dist-<포트> 빌드 폴더, 포트는 E2E_PORT(기본 4173), reuseExistingServer false, trace retain-on-failure. .gitignore와 eslint ignores에 .e2e-dist-*.
- 헤드: SPEC 4-2절(B-1, B-2, L-1, L-2, H-1, H-2, S-1, T-1, C-1) 추가.
- T-017 위임 (qa-verifier): 새 동작으로 깨진 e2e 8개 의도 유지해 수정, 새 기능 e2e(M, K, B, L, H, S-1, 터치 T-1, 픽셀 색 C-1), evidence 덮어쓰기 방지(EVIDENCE_DIR), 격리 포트로 두 번 연속 실행.
- T-017 결과: e2e 97 passed + 12 skipped(증빙 스크린샷, EVIDENCE_DIR 없을 때) 두 번 연속 같음. 결함 없음. 보고서 docs/reports/qa/T-017.md.
- 헤드 최종 확인: 83aec95를 깨끗한 worktree(별도 포트 4420)에서 다시 검증 — typecheck·lint 통과, test 332, e2e 97 passed + 12 skipped. 그 빌드를 배포. 배포 페이지를 데스크톱 앱 브라우저로 열어 보니 좁은 창에서 헤더 제목·되돌리기 버튼 글자가 줄바꿈되는 문제 발견 → 좁은 화면에서는 기호(↶ ↷)만, 제목 nowrap. 390/800/1280 폭 헤더 높이 67 px로 같음.
- c318c73 검증 중 e2e P-1 [mobile]이 재현 가능하게 실패: floorToClient(0,0)의 y가 145.2863451086957 → 145.28634510869608(차이 4e-13 px). 헤더 변경으로 캔버스 크기가 소수점 아래로 달라져 반올림이 바뀐 것. 카메라는 움직이지 않음. 원인은 부동소수를 toEqual로 정확히 비교한 테스트(점검 1의 '구현이 아닌 동작' 기준). 헤드가 checklist P-1과 features T-1의 카메라 비교를 0.001 px 허용(toBeCloseTo 3자리)으로 고침(qa 소유 파일, 기록).
- 1cacaf4를 깨끗한 worktree에서 e2e 두 번(97 passed, 12 skipped ×2) 확인 후 배포. 배포 페이지(데스크톱 앱 브라우저)에서 확인: 좁은 헤더 정상, 자동 저장이 claude.ai 아티팩트 안에서도 동작(가구 추가 → 새로 고침 → 남음). 그런데 새로 고침 뒤 가구 이름표가 없음 → 로컬 preview에서 재현(reload 전 1개, 후 0개). T-015(자동 저장)와 T-006(이름표)이 만나 생긴 결함. e2e에 '불러온 뒤 이름표' 시험이 없어 못 잡음.
- T-018 위임 (scene-engine, 결함 수정): pstack principle-fix-root-causes를 따라 재현·근본 원인·증거, src/scene만, 회귀 e2e 코드는 헤드가 넣음.
- T-018 결과: 근본 원인(drei Html 붙일 요소가 첫 그림 뒤 바뀌어 미뤄진 루트 해제가 새 이름표를 지움)과 계측·실험 증거. 헤드가 회귀 e2e를 추가하고 수정 전 실패·수정 후 통과를 확인.
- 8a7cab9를 깨끗한 worktree에서 두 번(98 passed, 12 skipped ×2) 확인 후 배포. 배포 페이지에서 새로 고침 뒤 이름표가 보이는 것을 확인. 헤드가 확인용으로 넣은 "가구" 상자 1개가 사용자 브라우저의 아티팩트 저장소에 남아 있음(사용자에게 알림).
- T-019 위임 (spec-report): 사례 보고서 초안에 밤사이 과정(피드백에 따른 결정 변경, 프롬프트 시험, pstack 점검, 테스트 격리, 배포 확인으로 찾은 결함, 헤드 실수) 반영. 블라인드 규칙 준수.
- T-020 위임 (room-input): 배치도 가져오기 단위 테스트 약점 보강(오류 문구 단언, 경계, kind 단언), 구현을 일부러 망가뜨려 새 테스트가 잡는지 확인.
- T-020 결과: 배치도 가져오기 테스트 보강(오류 문구 단언, 경계, kind 단언), 비교 연산자 7곳을 망가뜨려 새 테스트가 모두 잡는 것 확인 후 원복. photo 40개 통과. 헤드가 git으로 구현 파일 변경 없음 확인.
- T-019 결과: 사례 보고서 초안 2. 에이전트의 파일 쓰기가 막혀(T-001과 같은 이유) 헤드가 저장. 헤드 수정: e2e 98 passed가 [로그]에 있음을 반영, T-020 반영, 사용자가 원격 저장소를 연결한 일(23:45) 추가, 모델 변경 사실 한 줄. 블라인드 확인: 계정명·이메일·경로·저장소 주소 없음(grep).

- 08:30 보고(예약 메시지로 깨어나 SendUserMessage로 보냄).
- 사용자 결정 (08:32): "(나) 화면 기준으로 넓힌다(예: 화면 12 픽셀, 확대하면 좁아짐), (가) 지금처럼 허용하고 경고만 띄운다, 굿노트 배치도: 실제 손글씨 사진을 올려 주실지" — 세 번째는 사진이 첨부되지 않아 올려 달라고 다시 안내.
- 헤드: 계약 onFloorPointerMove(floor, mmPerPx?) 추가. T-021(scene-engine: mmPerPx 계산·전달)과 T-022(furniture-placement: SNAP_PX 12 × mmPerPx) 동시 위임, 이후 qa가 M-1~M-3 e2e 갱신.
- T-021·T-022 결과 저장. 헤드: SPEC 자석 맞춤 문장과 M-1 ~ M-3를 화면 기준으로, e2e M-1 ~ M-3를 화면에서 잰 자석 거리(12 px × mm/px)로 다시 씀(qa 소유 파일, 기록). 확인: 장면 쪽 변경을 빼면 M-1이 데스크톱·모바일 모두 실패.
- ed3bb5f를 깨끗한 worktree에서 두 번(test 352, e2e 98 passed + 12 skipped ×2) 확인 후 배포. 사례 보고서 사례 C에 사용자 답과 결과 반영.

- 사용자 지시 (09:24, 다른 평면도 서비스 화면 캡처 첨부): "이런식으로 가구를 누르면 이런 옵션들이 있으면 좋겟고, 디자인도 너무 픽셀이라 저런식으로 조금 디자인화 되있으면좋겟어". 캡처는 제3자 화면이라 저장소에 넣지 않음.
- 헤드: 현재 화면을 캡처해 보고(평평한 회색 바닥, 상자, 경고 시 전체 빨강) frontend-design 스킬 절차로 방향을 정함(docs/DESIGN-SYSTEM.md). app.css에 색·모양 기준값과 공용 부품(.btn, .icon-btn, .chip, .card, .num), src/ui/icons.tsx(직접 그린 선 그림 8개, room-input 소유 경로에 헤드가 추가: 세 모듈이 동시에 써야 해서), 헤더 아이콘 버튼. 계약: SceneView에 selectionOverlay·wallDistances, furniture에 ItemToolbar·useSelectedWallDistances, 새 data-testid.
- 동시 위임: T-023 scene-engine(도면 모양: 바닥 무늬, 먹색 벽, 방 치수선, 선택 가구 벽 거리선, 선택·경고 표시, 3D 조명, 도구 막대 자리), T-024 furniture-placement(ItemToolbar, 벽 거리 훅, 패널 다듬기), T-025 room-input(입력 칸·단위 전환·사진 탭 다듬기).
- T-025 결과 저장(docs/reports/T-025.md). 에이전트가 알린 헤더 넘침(390·320px에서 단위 버튼 잘림)을 헤드가 app.css·App.tsx에서 수정: grid 열 minmax(0,1fr), 420px 이하 제목 기호 숨김과 단위 버튼 44px, 372px 이하 제목 글자를 화면에서만 숨김. 320/360/390/430/800/1280 폭에서 문서 폭 = 화면 폭, 단위 m 버튼이 화면 안에 있음을 측정.
- 사용자 질문 (09:32): "우리가 지금 하는거 클로드코드에서 보려면 어떻게해?"
- T-024 결과 저장. 에이전트가 헤드의 계약 오류(item-rotate 방향)를 SPEC·테스트와 대조해 찾아 보고 → CONTRACT 수정.
- T-023 결과 저장. 헤드가 App.tsx에 selectionOverlay={<ItemToolbar />}와 wallDistances 조립. 통합 test 385개 통과. 헤드가 1280×800·390×780(터치) 화면을 직접 캡처해 확인: 방 치수선, 벽 거리선, 도구 막대(복제 → 가구 4개·복제본 선택·겹침 없음, 왼쪽 돌리기 → 90도), 3D 그림자. 헤드 평가(다듬을 것): 3D 선택 테두리가 너무 굵음, 3D 벽이 기준색보다 어둡게 보임, 뷰 전환(노랑)과 단위 전환(먹색)의 선택 표시가 서로 다름.
- 동시 위임: T-026 scene-engine(3D 선택 테두리 가늘게, 3D 벽 밝게, 뷰 전환을 단위 전환과 같은 먹색 선택 표시로), T-027 qa-verifier(W-2 조정, TB-1~4·DM-1~2 e2e, 끄는 중 막대 숨김, C-1 재검토, 새 증빙). 전후 화면을 docs/evidence/design-2026-11-17/에 보관(헤드가 찍은 것).
