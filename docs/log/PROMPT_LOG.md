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

- T-002c 결과 (2026-11-16 23:40, 헤드 검증): 방법 A로 오류 줄 자리를 고정 2줄(36px)로 예약. 중간에 에이전트 세션이 중단되어 같은 지시로 재위임했다. 헤드가 직접 확인: typecheck·lint·build 통과, 테스트 94개 통과. 실제 Chrome 측정에서 320px 폭 오류 전후 버튼 위치 차이 0, 버튼 가장자리 클릭 성공. 보고서는 docs/reports/T-002c.md. 발견한 결함(요청하지 않은 발견): 1줄 예약은 320px 폭에서 오류 문구가 두 줄이 되면 막지 못했다. 같은 에이전트가 이를 찾아 2줄로 바꿨다.
