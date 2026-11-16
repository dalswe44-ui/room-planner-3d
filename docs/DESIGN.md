# 다섯 에이전트가 7일 안에 사례를 증명한다

조사 기준일은 2026-11-16(월)이고, 출품 대상은 2026-11-23(월) 23:59에 접수를 마감하는 "2026학년도 가천대학교 생성형 AI 활용 사례 공모전"이다. 이 공모전은 앱의 완성도가 아니라 **실제로 수행해 결과가 확인된 AI 활용 과정**을 심사하므로, 7일 뒤에 내야 하는 것은 로그인 없이 열리는 웹앱 URL, 시연 영상, 그리고 프롬프트 이력과 전후 비교가 담긴 활용 사례 보고서 PDF 세 가지다. 권하는 구성은 헤드 1개 아래에 `spec-report`(기획·사례 보고서), `room-input`(치수·사진 입력과 저장), `scene-engine`(2D·3D 렌더링), `furniture-placement`(가구와 배치 규칙), `qa-verifier`(독립 검증과 증빙 수집) 5개를 두고, 이들을 작업 단계가 아니라 서로 겹치지 않는 폴더 소유권으로 나누는 것이다. 증빙은 그 정보를 볼 수 있는 쪽이 남긴다. 위임 프롬프트와 결과 요약은 헤드가, 검증 결과와 결함 이력은 `qa-verifier`가 기록하고, `spec-report`는 그 파일들만으로 보고서 초안을 엮는다. 기술은 Vite + React 19 + TypeScript + three r187 + React Three Fiber 9 + drei 10 + WebGLRenderer + Zustand 5의 백엔드 없는 정적 웹앱으로 하고, 길이는 전부 정수 mm로 저장하며, 사진은 치수의 근거가 아닌 참고 이미지로만 쓴다. 7일판 MVP는 직사각형 방, 단위 전환, 치수 입력 박스 가구, 끌기와 90도 회전, 겹침 경고와 벽까지 거리, 2D·3D 전환, 자동 저장, 사진 한 장 첨부로 좁힌다. 감추지 말아야 할 한계가 두 가지 있다. 멀티 에이전트는 Anthropic 자료 기준으로 같은 일에 토큰을 3~10배 쓰고 이런 유형의 코딩에는 가장 덜 맞는 구조여서, 실익은 속도가 아니라 컨텍스트 격리와 독립 검증에서만 나온다. 그리고 공모전 유의사항은 참가자가 프롬프트를 직접 구성하고 결과를 검증·수정할 것을 요구하므로, 이 보고서에 실은 프롬프트 전문은 출발점일 뿐이며 사용자가 직접 고치고 그 이력을 남겨야 하고, Claude가 초안 작성을 도왔다는 사실도 활용 과정으로 그대로 기록해야 한다.

## 공모전이 채점하는 것은 앱이 아니라 활용 과정이다

### 조건이 바꿔 놓는 것

아래 공모전 조건은 사용자가 제공한 공지 전문을 전달받은 것이고, 이 보고서 작성자가 공지 페이지를 직접 열어 대조하지는 않았다 ([공모전 공지](https://lib.gachon.ac.kr/bbs/content/1_13577?listParam=subject_code%3d14%26amp%3b)). 주제는 생성형 AI를 학습·연구·프로젝트·디자인·행정업무 등에 실제로 활용한 사례이고, 2026학년도 중 참가자가 직접 수행해 결과가 확인된 것이어야 한다. 실행하지 않은 기획안이나 가상의 사례는 낼 수 없다. 제출물은 서명이 들어간 지정 양식의 참가신청서, 표지 제외 3~20쪽·50MB 이하의 활용 사례 보고서 PDF 1개, 그리고 시연 영상 MP4나 서비스 URL이나 소스코드 같은 실증자료 1종 이상이며, 보고서와 실증자료를 ZIP 하나(`[분야]_팀명_생성형AI활용사례.zip`)로 묶어 공지에 안내된 접수 이메일로 낸다. 보고서에는 활용 배경 및 문제 정의, 사용한 생성형 AI 도구 및 선택 이유, 핵심 프롬프트 및 활용 과정, 결과물 및 개선 효과(활용 전·후 비교), 재현 방법 및 확산 가능성 다섯 항목이 반드시 들어가야 한다. 심사는 11-24부터 11-30까지 블라인드로 진행되고, 도구의 종류와 유료·무료 여부는 점수에 영향이 없다.

이 조건은 설계를 세 군데에서 바꾼다. 첫째, "언젠가 완성할 앱"이 아니라 **11-23까지 실제로 동작하고 사용자가 실제로 써 본 앱**이어야 한다. 만들지 못한 기능은 보고서에 결과로 쓸 수 없다. 둘째, 100점 중 50점이 과정에 걸려 있다(AI 활용의 적절성 30, 재현성·확산성 20). 프롬프트, 위임 기록, 결정 이유, 검증 결과를 일하는 동안 남기지 않으면 마지막 날에 복원할 방법이 없다. 셋째, URL은 심사 기간 내내 로그인 없이 열려야 하고 블라인드 심사이므로 성명·학번·연락처가 어디에도 드러나면 안 된다.

### 심사 배점 네 항목에 대한 대응

| 심사 항목 (배점) | 이 프로젝트의 대응 | 남길 증빙 | 맡는 쪽 |
|---|---|---|---|
| 창의성·독창성 (25) | 제품 쪽: 카탈로그 없이 치수만 입력하는 박스 가구, 도면 DB가 없는 방을 휴대폰 웹에서 바로 만든다는 단순함. 과정 쪽: 계약 파일 하나와 폴더 소유권, 숫자로 하는 독립 검증으로 다섯 에이전트를 묶는 운용 방식 | 기존 제품과의 차이를 출처와 함께 적은 비교, 에이전트 구성도 | `spec-report` 초안, 사용자 확인 |
| AI 활용의 적절성 (30) | 헤드 1 + 하위 5의 프롬프트, 공유 규약, 위임 메시지 양식. 실험 기능인 agent teams나 단일 세션 대신 일반 하위 에이전트를 고른 이유. 만든 쪽이 아닌 에이전트가 판정하는 검증 구조. 토큰 비용과 구조의 한계에 대한 기록 | 프롬프트 파일의 git 이력, `docs/log/PROMPT_LOG.md`, `docs/DECISIONS.md` | 헤드가 기록, 사용자가 프롬프트를 직접 수정 |
| 문제해결 효과성 (25) | 자기 방에 실제로 적용한 전후 비교. "줄자와 눈대중, 종이 스케치로 가늠하던 방식" 대 "치수 입력 3D 미리보기" | `docs/submission/before-after.md`의 측정값, 실사용 화면, QA 보고서 | 측정은 사용자, 양식은 `spec-report`, 동작 증빙은 `qa-verifier` |
| 재현성·확산성 (20) | 프롬프트 전문과 공유 규약, 소스코드, 재현 절차를 담은 README, 공개 URL. "계약 파일 + 소유 폴더 + 독립 검증" 틀은 다른 학생 프로젝트에도 옮겨 쓸 수 있음 | README, 제출 ZIP의 소스, 프롬프트 파일 | `spec-report`, 헤드 |

창의성 항목에서 제품 쪽 근거로 쓸 수 있는 사실은 조사에서 확인됐다. Planner 5D 리뷰에서 가장 흔한 불만은 크기 변경과 가구 전체가 유료로 잠겨 있다는 점이고 ([Capterra](https://www.capterra.com/p/164022/Planner-5D/reviews/)), IKEA Kreativ는 아이템 크기를 바꿀 수 없으며 방을 만든 뒤에는 치수도 수정할 수 없다 ([IKEA 고객센터](https://www.ikea.com/ie/en/customer-service/knowledge/articles/28c782c5-0036-4ff1-b1fd-20846237ee09.html)). 다만 한국 제품의 현재 상태는 충분히 확인하지 못했으므로 "기존에 없던 것"이라는 표현은 쓰지 말고, 확인된 차이만 적는다.

문제해결 효과성의 전후 비교는 두 층으로 남긴다. 문제 층에서는 같은 방과 같은 가구 목록을 놓고 종이·줄자 방식과 앱 방식을 각각 수행해, 배치안 하나를 검토하는 데 걸린 시간, 정해진 시간 안에 비교해 본 배치안의 수, 미리 발견한 문제(겹침, 통로 부족, 들어가지 않음)의 수, 단위 환산이나 계산 실수의 수를 잰다. 개발 층에서는 일자별 작업 시간, 위임 횟수와 재위임 횟수, `qa-verifier`가 찾은 결함 수와 수정된 수, 사용자가 AI의 결과를 직접 고치거나 되돌린 횟수, 프롬프트 수정 횟수를 센다. **이 값들은 전부 사용자가 직접 재거나 기록 파일에서 세어야 하며, 이 보고서는 어떤 수치도 미리 제시하지 않는다.** "활용 전" 측정은 앱이 생기기 전인 11-17에 먼저 해 두어야 비교가 성립한다. "AI 없이 만들었다면 얼마나 걸렸을까"는 7일 안에 측정할 수 없으므로, 사용자의 사전 경험을 사실대로 서술하고 추정치를 쓴다면 추정이라고 밝힌다. 공지의 "활용 전·후 비교"가 AI 활용 전후를 뜻하는지 결과물의 효과를 뜻하는지는 문구만으로 확정하기 어려워서 두 층을 모두 준비하고, 주최 측에 확인하기를 권한다.

재현성에는 정직하게 적어야 할 한계가 있다. 같은 프롬프트를 다시 실행해도 같은 코드가 나오지는 않는다. 재현할 수 있는 것은 산출물이 아니라 절차(계약을 먼저 고정하고, 소유 폴더별로 위임하고, 별도 에이전트가 숫자로 판정하는 순서)다. 보고서의 "재현 방법"은 그 절차를 기준으로 쓴다.

### 프롬프트는 사용자가 직접 고쳐야 한다

유의사항은 참가자가 프롬프트와 활용 방식을 직접 구성하고, 생성된 결과물을 비교·검증·수정할 것을 요구하며, 심사 과정에서 원본 자료와 프롬프트 이력을 요청할 수 있다고 적는다 ([공모전 공지](https://lib.gachon.ac.kr/bbs/content/1_13577?listParam=subject_code%3d14%26amp%3b)). 따라서 아래 프롬프트 전문을 그대로 복사해 쓰는 것으로 끝내면 안 된다. 사용자가 각 프롬프트를 읽고, 자기 판단으로 고치고, 써 보면서 다시 고쳐야 하며, 그 수정이 git 커밋 이력으로 남아야 한다. 그리고 프롬프트 초안을 Claude와의 대화로 만들었다는 사실은 숨길 일이 아니라 활용 과정의 일부로 보고서에 그대로 적을 내용이다. 무엇을 요청했고, 무엇을 받았고, 어디를 왜 고쳤는지가 "프롬프트 설계"와 "활용 과정의 타당성" 항목에 대한 가장 직접적인 답이 된다. AI가 초안을 쓰고 참가자가 검토·수정한 프롬프트가 "직접 구성"으로 인정되는지는 규정 문구만으로 단정할 수 없으니 주최 측에 문의하고, 답과 무관하게 과정은 사실대로 기록한다.

## 다섯 에이전트는 소유 폴더로 나누고 증빙은 볼 수 있는 쪽이 남긴다

### 구성안: 헤드 1 + 하위 5

| 에이전트 | 하는 일 | 소유 경로 | 증빙 책임 |
|---|---|---|---|
| 헤드 (Claude 메인 세션) | 사용자와의 대화, 범위 결정, 위임, 통합, 통과 판정. 여러 모듈이 함께 쓰는 파일의 유일한 작성자 | `CLAUDE.md`, `.claude/agents/`, `docs/HEAD.md`, `package.json`과 설정, `src/contracts/`, `src/store/`, `src/app/`, `docs/CONTRACT.md`, `docs/DECISIONS.md`, `docs/TASKS.md`, `docs/log/` | 모든 위임 메시지 전문과 결과 요약, 사용자의 방향 지시, 결정과 이유 |
| `spec-report` | 요구사항과 완료 기준, 사례 보고서 초안, 전후 비교 측정 양식, 영상 시나리오, 재현 방법 README, 제출 체크리스트 | `docs/SPEC.md`, `docs/submission/`, `README.md` | 기록 파일을 보고서의 다섯 필수 항목으로 엮기. 수치는 만들지 않음 |
| `room-input` | 방 치수 입력, mm·cm·m 전환 UI, 사진 첨부, 저장·불러오기 | `src/ui/`, `src/room/`, `src/photo/`, `src/persistence/` | 자기 작업 보고서 |
| `scene-engine` | 2D 평면 뷰와 3D 뷰, 카메라와 조작, 방과 가구 박스 렌더링, 포인터를 방 좌표(mm)로 바꾸기 | `src/scene/` | 자기 작업 보고서 |
| `furniture-placement` | 가구 치수 입력과 목록, 이동·회전·스냅, 방 경계와 겹침 판정, 거리 계산 | `src/furniture/` | 자기 작업 보고서 |
| `qa-verifier` | SPEC 체크리스트 대조, 전체 테스트 실행, 수치·화면 검증, 공개 URL 점검. 앱 코드는 고치지 않음 | `tests/e2e/`, `docs/reports/qa/`, `docs/evidence/` | 테스트 실행 결과, 스크린샷, 결함의 발견·수정·재검증 이력 |

### 나누는 기준과 그 근거

Anthropic의 2026년 1월 글은 planner / implementer / tester / reviewer처럼 일의 종류로 나누면 인계 때마다 맥락이 깎이고, 자체 실험에서 그런 분할이 실제 작업보다 조율에 토큰을 더 썼다고 밝히며, 대안으로 컨텍스트 경계에 따른 분할과 "기능을 맡은 에이전트가 그 기능의 테스트도 맡는" 구성을 권한다 ([Anthropic, Building multi-agent systems](https://claude.com/resources/articles/building-multi-agent-systems-when-and-how-to-use-them)). 그래서 구현 에이전트 3개는 폴더 단위로 나누고 자기 폴더의 단위 테스트를 직접 쓴다. 같은 글은 검증 전용 하위 에이전트를 적은 맥락으로도 잘 작동하는 패턴으로 꼽고, Cognition도 깨끗한 컨텍스트에서 diff만 보는 리뷰어의 성능이 눈에 띄게 좋았으며 Devin Review가 PR당 평균 2개의 버그를 잡고 그중 약 58%가 심각한 수준이었다고 보고한다 ([Cognition, Multi-Agents: What's Actually Working](https://cognition.com/blog/multi-agents-working)). `qa-verifier`를 코드를 쓰지 않는 별도 에이전트로 두는 근거다.

헤드가 공유 파일을 혼자 쓰는 것은 Cognition의 관찰을 공유 영역에 적용한 것이다. 병렬로 코드를 쓰는 에이전트들은 스타일과 경계 사례에 대해 각자 암묵적 결정을 내려 충돌하고, 지금 실제로 작동하는 구성은 쓰기를 단일 스레드로 두는 형태라고 Cognition은 정리한다 ([Cognition](https://cognition.com/blog/multi-agents-working)). 실패 유형을 분류한 MAST 연구에서도 실행 기록 1,642건 중 실패의 약 44%가 시스템 설계와 명세, 약 32%가 에이전트 간 불일치, 약 24%가 검증에서 나왔고, 역할 정의를 명확히 하고 최종 결정권자를 지정하자 ChatDev의 성공률이 약 9.4%p 올랐다 ([Why Do Multi-Agent LLM Systems Fail?](https://arxiv.org/html/2503.13657v3)). 다만 이 연구의 대상은 2024~2025년의 프레임워크와 모델이다.

### 증빙 책임을 이렇게 배치한 이유

기록과 증빙을 한 에이전트에 몰지 않고 셋으로 나눈 것은 각자가 볼 수 있는 정보가 다르기 때문이다. Claude Code의 하위 에이전트는 메인 대화 기록을 받지 못하고 자기 프롬프트, 위임 메시지, CLAUDE.md만 받는다 ([Claude Code, sub-agents](https://code.claude.com/docs/en/sub-agents.md)). 사용자의 지시와 위임 메시지 전문을 아는 것은 헤드뿐이므로 **프롬프트 이력은 헤드만 남길 수 있다.** 검증 증빙은 만든 쪽이 아닌 쪽에서 나와야 의미가 있다. 공식 문서는 성공을 주장하게 두지 말고 테스트 출력, 실행한 명령과 결과, 스크린샷 같은 증거를 보이게 하라고 권하는데 ([Claude Code, best practices](https://code.claude.com/docs/en/best-practices.md)), 이 증거를 이미 만들고 있는 것이 `qa-verifier`다. 결함을 발견하고 수정을 거쳐 재검증한 이력은 유의사항이 요구하는 "결과물을 비교·검증·수정"의 직접 증거가 된다. 보고서 집필은 코딩과 무관한 맥락을 대량으로 만들어 내는 일이어서 별도 에이전트로 격리할 이유가 있다. Anthropic은 하위 작업이 본 작업과 무관한 토큰을 많이 만들 때를 멀티 에이전트가 이기는 경우로 든다 ([Anthropic, Building multi-agent systems](https://claude.com/resources/articles/building-multi-agent-systems-when-and-how-to-use-them)). `spec-report`는 대화가 아니라 파일만 읽고 쓰는데, 이는 산출물을 파일 시스템에 두고 가벼운 참조만 넘기면 인계 손실이 줄어든다는 Anthropic의 권고를 따른 것이다 ([Anthropic, multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)).

### 인계 규칙

인계의 단위는 대화가 아니라 파일이다. 내려가는 방향에서 헤드는 고정된 위임 메시지 양식을 채워 보내고, 보내기 전에 그 전문을 `docs/log/PROMPT_LOG.md`에 적는다. Anthropic의 리서치 시스템은 짧고 모호한 지시 때문에 하위 에이전트들이 같은 조사를 반복한 실패를 겪었고, 목표, 출력 형식, 도구와 자료 안내, 작업 경계를 위임에 반드시 넣으라고 정리했다 ([Anthropic, multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)). 올라오는 방향에서 하위 에이전트는 `docs/reports/<task-id>.md`에 다섯 항목으로 보고하고 헤드에게는 경로와 세 줄 요약만 돌려준다. 공유 파일(계약, `package.json`, store)은 하위 에이전트가 직접 고치지 않고 보고서의 변경 요청 항목에 적으며, 헤드가 타입과 테스트를 먼저 고친 뒤 결정 기록에 이유를 남긴다. 하위 에이전트끼리는 직접 대화하지 않고, 하위 에이전트의 보고는 사용자 승인이 아니다. 공식 문서도 에이전트 간 메시지는 사용자 승인으로 취급되지 않는다고 명시한다 ([Claude Code, sub-agents](https://code.claude.com/docs/en/sub-agents.md)). CrewAI 가이드가 노력의 약 80%를 에이전트 정의가 아닌 작업 설계에 쓰라고 하는 것처럼 ([CrewAI](https://docs.crewai.com/v1.15.23/pt-BR/guides/agents/crafting-effective-agents.md)), 프롬프트 5개보다 헤드가 매번 쓰는 위임 메시지의 질이 결과를 더 크게 좌우한다. 그 위임 메시지들이 고스란히 `PROMPT_LOG.md`에 쌓이므로, 이 기록은 증빙이면서 동시에 보고서의 "핵심 프롬프트 및 활용 과정" 항목의 원자료가 된다.

### 5개 구조의 비용과 절충

Anthropic은 멀티 에이전트가 단일 에이전트를 꾸준히 이기는 경우를 컨텍스트 보호, 병렬 탐색, 전문화 세 가지로 한정하고, **같은 작업에 토큰이 보통 3~10배** 든다고 적는다 ([Anthropic, Building multi-agent systems](https://claude.com/resources/articles/building-multi-agent-systems-when-and-how-to-use-them)). 2025년 글에서는 에이전트 간 의존성이 많은 작업과 대부분의 코딩 작업을 멀티 에이전트가 덜 맞는 영역으로 들었다 ([Anthropic, multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)). 입력, 렌더링, 배치가 같은 store와 좌표계를 공유하는 이 앱이 바로 그 유형이다. Claude Code의 agent teams 문서도 팀원 3~5명을 권하면서 집중된 3명이 흩어진 5명보다 나은 경우가 많다고 덧붙인다 ([Claude Code, agent teams](https://code.claude.com/docs/en/agent-teams.md)).

7일이라는 기간은 이 절충을 더 날카롭게 만든다. 조율에 쓰는 시간이 곧 기능에서 빠지는 시간이기 때문이다. 그래서 운용 원칙을 "정의는 5개, 실행은 순차, 병렬은 예외적으로 2개까지"로 둔다. 구현 방식은 실험 기능인 agent teams가 아니라 일반 하위 에이전트로 한다. agent teams는 기본 비활성이고 순차 작업과 의존성이 많은 작업에는 단일 세션이나 하위 에이전트가 낫다고 문서가 직접 말하며, 비용 문서 기준으로 일반 세션의 약 7배 토큰을 쓴다 ([Claude Code, agent teams](https://code.claude.com/docs/en/agent-teams.md); [Claude Code, costs](https://code.claude.com/docs/en/costs.md)). 현재 문서 기준으로 하위 에이전트는 기본적으로 3단계까지 다시 하위 에이전트를 띄울 수 있으므로 ([Claude Code, sub-agents](https://code.claude.com/docs/en/sub-agents.md)), 평평한 "1 + 5"를 지키기 위해 아래 프롬프트는 하위 에이전트의 `tools`에서 `Agent`를 뺐다. 사용자의 요금제 사용량 한도는 이 조사에서 알 수 없는 변수다. 한도에 걸려 작업이 멈출 가능성에 대비해, 그 경우에는 헤드 단독으로 이어 가고 그 전환도 사실대로 기록하는 것을 예비 계획으로 둔다.

이 비용은 공모전에서 숨길 것이 아니라 쓸 것이다. "AI 활용의 적절성"은 도구 선택과 활용 과정의 타당성을 본다. 어디서 위임이 도움이 됐고 어디서 직접 하는 편이 빨랐는지를 기록에 근거해 적는 것이, 다섯 에이전트가 모두 잘 돌았다는 서술보다 그 항목에 더 맞는 답이다.

## 치수가 유일한 근거이고 배포는 서버 없이 한다

### 기술 스택

| 항목 | 선택 | 2026-11-16 버전 | 선택 이유 |
|---|---|---|---|
| 빌드 | Vite SPA | vite 8.3.8 | 본체가 전부 클라이언트 렌더링. 산출물이 정적 파일이라 어디에나 올릴 수 있음 |
| UI | React + TypeScript | react 19.3.1, typescript 7.0.2 | 폼 비중이 큰 앱. R3F 9의 peer 범위(react `>=19 <19.4`)에 맞음 |
| 3D | three + R3F + drei | three 0.187.0, @react-three/fiber 9.8.2, @react-three/drei 10.7.9 | 안정 라인. R3F v10과 drei v11은 alpha |
| 렌더러 | WebGLRenderer | (three 내장) | 박스 수십 개 장면에서 WebGPU의 이득이 확인되지 않음 |
| 상태 | Zustand | zustand 5.1.0 | R3F와 drei가 이미 내부 의존성으로 사용 |
| 저장 | 브라우저 저장소 + JSON 파일 | idb-keyval 6.3.0 (사진 Blob) | 백엔드, 계정, API key 없음 |
| 배포 | 정적 호스팅의 공개 URL | 서비스별 조건 미조사 | 로그인 없이 열림. 심사 기간에 꺼질 서버가 없음 |
| 테스트 | 단위 테스트 러너 + Playwright | 버전 미조사 | scaffold 시점에 확인 |

버전은 npm registry를 직접 조회한 값이다 ([three](https://registry.npmjs.org/three), [@react-three/fiber](https://registry.npmjs.org/@react-three/fiber), [@react-three/drei](https://registry.npmjs.org/@react-three/drei), [react](https://registry.npmjs.org/react), [zustand](https://registry.npmjs.org/zustand), [vite](https://registry.npmjs.org/vite), [typescript](https://registry.npmjs.org/typescript), [idb-keyval](https://registry.npmjs.org/idb-keyval)). three는 r번호마다 동작이 바뀔 수 있으므로 `0.187.x`로 고정한다.

React 기반을 고른 이유는 이 앱의 절반이 3D 캔버스 밖의 폼이고, 하나의 store로 DOM UI와 3D 장면을 함께 구동할 수 있기 때문이다. 7일 일정에서는 공개 자료의 양이 더 중요해진다. 2026년 9월 집계에서 three의 주간 npm 다운로드는 약 1,218만으로 @babylonjs/core의 약 39배였다 ([Utsubo, 2026-09-24](https://www.utsubo.com/blog/threejs-vs-babylonjs-vs-playcanvas-comparison)). 이 글은 three.js를 주로 쓰는 스튜디오의 콘텐츠이고, 다른 가이드는 three의 수치를 약 350만으로 적어 서로 엇갈린다 ([PkgPulse, 2026-03-09](https://www.pkgpulse.com/guides/threejs-vs-react-three-fiber-vs-babylonjs-3d-webgl-2026)). WebGPU는 택하지 않는다. 이득은 draw call이 많거나 GPU 연산을 쓸 때 크고 오히려 느려지는 장면도 보고돼 있으며, r183부터 r187까지 연달아 WebGPU 쪽 동작 변경이 있었다 ([Utsubo, 2026-11-06](https://www.utsubo.com/blog/threejs-2026-what-changed)). R3F의 WebGPU 전용 진입점도 alpha인 v10에 있다 ([R3F v10.0.0-alpha.4 릴리스 노트](https://newreleases.io/project/github/pmndrs/react-three-fiber/release/v10.0.0-alpha.4)). 네이티브 앱도 택하지 않는다. R3F의 React Native 바인딩을 맡은 pmndrs는 해당 저장소에 "DO NOT USE YET" 경고를 걸어 두었고 ([pmndrs/native README](https://raw.githubusercontent.com/pmndrs/native/main/README.md)), 필요한 기기 기능인 사진 한 장 받기는 `<input type="file">`로 충족된다.

### 사진은 참고 이미지로만 쓴다

프로젝트 설명의 "방을 사진으로 찍고 규격을 입력하면 3D로 방 구조를 구현"을 "사진에서 방 구조를 자동 복원"으로 읽으면 7일 안에 끝나지 않는다. 일반 폰 사진 한 장에서 편집 가능한 방 구조를 바로 뽑아 주는 검증된 기성 모델은 조사에서 찾지 못했다. 여러 장을 받는 연구 모델 Plane-DUSt3R도 0.15 m 이내로 맞는 벽 평면의 precision이 52.63%에 그치고 문 위치는 주지 않는다 ([arXiv 2502.16779](https://arxiv.org/html/2502.16779v2)). 범용 멀티모달 모델은 사진 한 장 안의 정성적 관계는 사람 수준(GPT-5 98.1 대 사람 98.8)으로 읽지만 ([arXiv 2601.22228](https://arxiv.org/html/2601.22228v1)), 방 크기와 절대 거리 추정은 2026년 모델에서도 40~63점대다 ([ReVSI](https://3dlg-hcvc.github.io/revsi/)). 기존 제품도 같은 선을 긋는다. IKEA Kreativ의 사진 촬영 모드는 측정된 기하 없이 시각적 목업만 만들고 ([macmyths, 2026-09-28](https://macmyths.com/ikea-place-review-what-ikea-kreativ-does-in-2026/)), Planner 5D의 도면 인식은 원근 사진을 처리하지 않으며 ([Planner 5D 도움말](https://support.planner5d.com/en/articles/14434484-how-to-upload-a-floor-plan)), 자동 스캔으로 편집 가능한 구조를 주는 Apple RoomPlan은 LiDAR가 달린 기기의 네이티브 앱에서만 동작한다 ([Apple ML Research](https://machinelearning.apple.com/research/roomplan)).

그래서 이번 제출본에서 사진은 화면 한쪽에 띄워 두고 보는 참고 이미지 한 장이다. 치수는 사용자가 입력한 값이 유일한 근거다. 보고서에도 그렇게 쓴다. "사진으로 3D를 만든다"고 쓰면 실제 동작과 다른 서술이 되어 "확인된 사례" 요건에 어긋난다. 사진을 벽에 텍스처로 붙이기, 사진과 3D를 겹쳐 보기, 멀티모달 모델의 구조 초안 제안은 이후 단계다.

### 내부 단위와 좌표계 규약

모든 길이는 정수 mm로 저장하고 계산한다. cm와 m는 입력을 해석할 때와 화면에 표시할 때만 등장한다. 정수끼리의 덧셈과 비교에는 오차가 없어서 "벽에 정확히 붙었다" 같은 판정이 정확해진다. three.js 장면은 1 unit = 1 m로 둔다. three.js 포럼의 기여자 답변에 따르면 물리 기반 조명과 재질, 그림자 기본값, XR이 미터 스케일을 전제한다 ([three.js forum, 2024-07](https://discourse.threejs.org/t/is-there-any-functional-reason-to-use-a-1-10-100-or-1000-unit-scale/67658)). 이것이 공식 문서에 규범으로 적혀 있는지는 확인하지 못했다. mm 좌표를 그대로 장면에 넣었던 사용자가 겪은 두 번째 문제는 박스의 원점이 바닥이 아니라 중심이라는 점이었고 ([three.js forum, 2022-05](https://discourse.threejs.org/t/the-dimensions-of-the-object-in-millimeters-in-three-js/38555)), 그래서 "가구의 기준점은 바닥면 중심"이라는 규약과 그 보정을 한 컴포넌트에만 두는 규칙을 둔다. 구체적 규약은 아래 CLAUDE.md 초안에 있다. 핵심은 변환 지점을 두 파일로 제한하는 것이다. 문자열과 mm 사이는 `src/contracts/units.ts`에만, mm와 장면 좌표 사이는 `src/contracts/coords.ts`에만 둔다. 단위와 좌표계 가정의 불일치가 이 프로젝트에서 가장 일어나기 쉬운 멀티 에이전트 실패라는 판단은 추론이고, 이 유형을 직접 다룬 사례 자료는 찾지 못했다.

### 데이터 모델 계약

방은 꼭짓점 다각형으로, 문과 창은 "소속 벽 + 벽 위 위치 + 폭 + 높이"로, 가구는 방향 있는 박스로 표현한다. 연구 모델 SpatialLM의 출력 형식 ([arXiv 2506.07491](https://arxiv.org/html/2506.07491v2)), Apple RoomPlan의 구성 요소 ([Apple ML Research](https://machinelearning.apple.com/research/roomplan)), 아키스케치의 편집 모델 ([아키스케치 도움말](https://docs.channel.io/archisketch/ko/articles/%EB%8F%84%EB%A9%B4-%EA%B7%B8%EB%A6%AC%EA%B8%B0-0c231814))이 모두 이 구조로 수렴한다. 이번 주에는 직사각형 방만 만들지만 저장은 처음부터 다각형으로 한다. blueprint3d와 blueprint-js가 모두 "더 나은 저장 형식"을 미해결 과제로 남긴 것이 반면교사다 ([rfzeg/blueprint3d](https://github.com/rfzeg/blueprint3d); [vinkovsky/blueprint-js](https://github.com/vinkovsky/blueprint-js)). 아래는 헤드가 11-17에 확정할 초안이다. `Opening`은 형식만 잡아 두고 이번 주에 UI를 만들지는 일정에 따라 정한다.

```ts
// src/contracts/types.ts — 초안. 모든 길이는 정수 mm.
export type Mm = number;
export type DisplayUnit = 'mm' | 'cm' | 'm';
export interface PointMm { x: Mm; z: Mm }

export interface Opening {
  id: string;
  type: 'door' | 'window' | 'opening';
  wall: number;      // corners[wall] → corners[wall + 1] 변
  offset: Mm;        // 그 벽의 시작 꼭짓점에서 개구부 시작까지
  width: Mm;
  height: Mm;
  sill: Mm;          // 바닥에서 개구부 하단까지. 문은 0
}

export interface PhotoRef { id: string; blobKey: string }

export interface Room {
  ceilingHeight: Mm;
  corners: PointMm[]; // 안목치수 기준 바닥 다각형. 이번 버전의 UI는 4개(직사각형)만 만든다
  openings: Opening[];
  photos: PhotoRef[];
}

export interface FurnitureItem {
  id: string;
  name: string;
  w: Mm; d: Mm; h: Mm;   // 회전 0일 때 x방향 폭, z방향 깊이, 높이
  x: Mm; z: Mm;          // 바닥면 중심의 방 좌표
  rotationDeg: number;   // 정수. 위에서 볼 때 반시계가 양수. 이번 버전은 0, 90, 180, 270
  elevation: Mm;         // 바닥에서 띄운 높이. 기본 0
  color: string;
}

export interface Project {
  version: 1;
  displayUnit: DisplayUnit;
  room: Room;
  items: FurnitureItem[];
}

// src/contracts/units.ts
export declare function parseLength(input: string, fallback: DisplayUnit): Mm | null; // "1200", "120cm", "1.2m"
export declare function formatLength(mm: Mm, unit: DisplayUnit): string;              // mm 정수, cm 소수 1자리, m 소수 3자리

// src/contracts/coords.ts
export declare function mmToWorld(mm: Mm): number;  // × 0.001
export declare function worldToMm(m: number): Mm;   // Math.round(m × 1000)

// scene-engine → furniture-placement 로 넘기는 포인터 이벤트 (모두 방 좌표 mm)
export interface PlacementHandlers {
  onItemPointerDown(itemId: string, floor: PointMm): void;
  onFloorPointerMove(floor: PointMm): void;
  onPointerUp(): void;
}
```

타입 파일을 원본으로 삼고 `docs/CONTRACT.md`는 그 설명만 담는다. "계약을 먼저 확정하고 공유 타입을 한 소유자가 관리한다"는 방식을 직접 다룬 1차 자료는 찾지 못했다. 구조화된 문서로 인계하게 해 오류를 줄였다는 MetaGPT의 주장 ([MetaGPT](https://ar5iv.labs.arxiv.org/html/2308.00352))과 Cognition의 단일 쓰기 원칙에서 끌어낸 추론이다.

### 7일판 MVP와 이후로 미루는 것

| 구분 | 기능 | 비고 |
|---|---|---|
| 줄이지 않는 최소선 | 직사각형 방(가로·세로·천장 높이) 입력과 수정 | 만든 뒤에도 언제든 수정 가능 |
| | mm·cm·m 전환, "120cm"·"1.2m" 같은 접미사 입력 | 프로젝트 설명의 "자유롭게 변환" |
| | 박스 가구 추가·수정·삭제(이름, 폭·깊이·높이, 색) | 3D 모델 파일 없음 |
| | 평면 뷰에서 끌기, 90도 회전 | 손을 뗄 때 정수 mm로 확정 |
| | 겹침·방 이탈 경고 | 막지 않고 색으로 표시 |
| | 2D 평면 뷰와 3D 뷰 전환 | |
| | 로그인 없이 열리는 공개 URL | 실증자료 |
| 이번 주 목표 | 선택한 가구에서 벽까지의 거리 표시, 격자 스냅 | 11-19 |
| | 브라우저 자동 저장, "예시 방 불러오기" | 심사자가 URL을 열자마자 볼 것이 있어야 함 |
| | 사진 참고 이미지 1장 첨부(기기 안에만 보관) | 11-20 |
| | JSON 내보내기 | 11-20 |
| 시간이 남을 때만 | 문·창 입력과 표시, 벽 스냅, 통로·여유 공간 경고, JSON 가져오기 | 11-20 밤 기능 동결 전까지 |
| 제출 이후 | 사진을 벽 텍스처로 붙이기, 사진과 3D 겹쳐 보기, L자 방, 공유 링크, 1인칭 뷰, 홈 화면 설치(PWA), 가구 반입 가능 여부 확인, 멀티모달 모델의 구조 초안, LiDAR 스캔 | 보고서에는 "이후 계획"으로만 적음 |

배치 방식에는 조사 근거가 있다. three.js 포럼의 정석은 내장 DragControls 대신 포인터 ray를 바닥 평면에 교차시키고 잡은 지점과의 오프셋을 유지하는 것이다 ([three.js forum, 2020-05](https://discourse.threejs.org/t/drag-object-on-xz-plane-exactly-along-mouse-pointer/14976)). 충돌을 차단하지 않고 경고로 처리하는 것은, blueprint-js가 "아이템이 끼어 움직이지 않는" 문제를 미해결로 남긴 유형을 피하기 위해서다 ([vinkovsky/blueprint-js](https://github.com/vinkovsky/blueprint-js)). 여유 공간 경고를 넣게 된다면 출발점으로 쓸 수치는 있다. 설계 핸드북을 인용한 교육 자료는 한 사람 통과에 약 600mm, 편안한 통로에 약 760~900mm를 제시하고 ([Studio Matrx](https://www.studiomatrx.org/students/space-planning-ergonomics/space-standards-and-clearances)), 한국 원룸 거주자의 글은 통로 최소 60cm, 침대 옆 45cm를 든다 ([틸노트, 2026-09](https://tilnote.io/pages/6a9c3ae98a847deea170429f)). 2차 자료와 개인 블로그이므로 근거 수준을 밝혀 쓴다. 홈 화면 설치(PWA)를 뺀 것은 service worker의 캐시가 심사 기간에 낡은 화면을 보여 줄 위험을 굳이 지지 않기 위한 설계 판단이다.

### 공개 URL 배포와 제3자 권리

실증자료 URL은 심사 기간(11-24~11-30) 동안 접근 가능해야 하고, 로그인이 필요하면 접근 방법을 안내해야 한다 ([공모전 공지](https://lib.gachon.ac.kr/bbs/content/1_13577?listParam=subject_code%3d14%26amp%3b)). 이 앱은 백엔드, 계정, API key가 없는 정적 파일이므로 로그인 자체가 없고 심사 주간에 꺼질 서버도 없다. 사진은 사용자의 기기 안에만 저장되므로 공개 URL에 개인 사진이 올라가지 않는다. 배포에서 지킬 것은 다섯 가지다. 첫째, **빈 화면 단계인 11-17에 먼저 배포한다.** 배포 문제를 마지막 날에 처음 만나지 않기 위해서다. 둘째, 블라인드 심사이므로 URL과 페이지 어디에도 성명·학번·계정명이 드러나지 않게 프로젝트 이름으로 된 주소를 쓴다. 호스팅 주소나 소스 저장소 주소에 계정명이 들어가는 것이 허용되는지는 주최 측에 확인한다. 셋째, 제출한 커밋에 tag를 붙이고 11-30까지 배포를 건드리지 않는다. 심사 중 재배포가 허용되는지도 문의 사항이다. 넷째, 제출 직전에 로그아웃 상태의 시크릿 창과 휴대폰 이동통신망에서 URL이 열리는지 확인한다. 다섯째, 호스팅 서비스의 무료 한도와 유지 조건은 이번 조사에서 확인하지 않았으므로 고른 서비스의 조건을 직접 읽는다.

소스코드를 실증자료로 낼 수 있게 처음부터 권리 문제를 닫아 둔다. 외부 저장소의 코드는 복사하지 않는다. 특히 사진-카메라 매칭 도구 fSpy는 GPL-3.0이고 ([stuffmatic/fSpy](https://github.com/stuffmatic/fSpy)), Sweet Home 3D도 GNU GPL로 배포되며 ([Sweet Home 3D](https://www.sweethome3d.com/userGuide.html)), threejs-3d-room-designer는 저장소에 라이선스가 명시돼 있지 않다 ([CodeHole7/threejs-3d-room-designer](https://github.com/CodeHole7/threejs-3d-room-designer)). 가구는 전부 코드로 만든 상자이므로 3D 모델 에셋의 저작권 문제가 생기지 않는다. 가구 67종을 에셋 없이 절차적 geometry로만 만든 공개 사례도 있다 ([three.js forum, 2026-06](https://discourse.threejs.org/t/house-builder-with-day-night-cycle-cctv-coverage-and-procedural-geometry/92051)). 사용하는 npm 의존성의 라이선스는 이 조사에서 확인하지 않았으므로 11-17에 목록을 확인해 README에 적는다. 소스 묶음은 `node_modules`와 `.git`을 빼고 만든다. git 이력에는 작성자 이름과 이메일이 들어 있어 블라인드 요건에 걸리기 때문이다. 이력이 있는 저장소 자체는 추가 증빙 요청에 대비해 보관한다.

## 프롬프트 여섯 개와 공유 규약 파일의 전문

### 배치 방법과 주의점

하위 에이전트는 YAML frontmatter가 붙은 Markdown 파일이고 프로젝트의 `.claude/agents/`에 둔다. 필수 필드는 `name`과 `description`뿐이며, 둘 중 하나가 없거나 YAML이 깨진 파일은 경고 없이 건너뛴다 ([Claude Code, sub-agents](https://code.claude.com/docs/en/sub-agents.md)). 하위 에이전트는 메인 대화 기록을 받지 못하고, 사용자에게 직접 질문하는 도구는 항상 제거된다 ([Claude Code, sub-agents](https://code.claude.com/docs/en/sub-agents.md)). 이 상속 규칙에 맞춰 내용을 세 층으로 나눴다. 모두가 알아야 하는 규약은 CLAUDE.md에, 역할의 상시 규칙은 각 에이전트 파일에, 이번 작업에만 해당하는 내용은 헤드의 위임 메시지에 둔다.

헤드 프롬프트는 CLAUDE.md에 넣지 않는다. CLAUDE.md는 하위 에이전트도 읽으므로 "당신은 헤드다"라는 문장이 다섯 에이전트 모두에게 전달되기 때문이다. 권장 방식은 `docs/HEAD.md`로 저장하고 메인 세션을 시작할 때마다 "docs/HEAD.md를 읽고 그 역할로 진행해"라고 지시하는 것이다. `.claude/agents/head.md`로 만들어 `claude --agent head`로 실행하는 대안은 파일 본문이 기본 Claude Code system prompt를 대체하므로 ([Claude Code, sub-agents](https://code.claude.com/docs/en/sub-agents.md)) 7일 일정에서 굳이 질 위험이 아니라고 판단했다.

프롬프트는 Anthropic 문서의 예시 구조(한 문장 역할 선언 → 호출 시 절차 → 점검 항목 → 보고 형식)를 따랐고 ([Claude Code, sub-agents](https://code.claude.com/docs/en/sub-agents.md)), 규칙마다 이유를 붙였다. 프롬프트 가이드는 이유가 붙은 규칙이 더 잘 일반화된다고 설명한다 ([Claude prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)). `description`에는 능력 소개가 아니라 언제 호출할지를 적었다 ([Anthropic, subagents in Claude Code](https://claude.com/resources/articles/subagents-in-claude-code)). `model: sonnet`은 비용 문서의 일반 권고를 따른 기본값이고 ([Claude Code, costs](https://code.claude.com/docs/en/costs.md)), 에이전트별 권장 모델에 대한 공식 수치 근거는 없으므로 품질이 부족하면 `inherit`으로 바꾼다. `qa-verifier`가 `src/`를 고치지 못하게 하는 것은 프롬프트 수준의 규칙이다. 테스트 파일을 써야 해서 쓰기 도구를 뺄 수 없기 때문이며, 공식 문서도 이런 지시는 권고 수준이라고 보므로 ([Claude Code, best practices](https://code.claude.com/docs/en/best-practices.md)) 헤드가 결과를 받을 때 `git status`로 변경 범위를 확인하게 했다.

**쓰기 전에 할 일.** 여섯 파일과 CLAUDE.md를 그대로 저장소에 넣어 첫 커밋으로 남기고("Claude가 쓴 초안"이라고 커밋 메시지에 적는다), 사용자가 직접 읽으며 고친 내용을 그다음 커밋들로 쌓는다. 이후에도 프롬프트를 고칠 때마다 다른 변경과 섞지 않고 따로 커밋한다. 이 이력이 "프롬프트를 직접 구성하고 수정했다"는 증빙이 된다.

### 공유 규약: `CLAUDE.md`

````markdown
# 3D 가구배치 — 공유 규약

방의 치수를 입력해 3D로 확인하고, 치수를 입력한 박스 가구를 미리 배치해 보는 웹앱이다.
이 파일은 헤드와 모든 하위 에이전트가 함께 읽는다. 여기 적힌 규약이 어긋나면 모듈이 서로 맞지 않으므로, 바꿔야 한다면 직접 고치지 말고 헤드에게 요청한다.

## 스택
- Vite + React 19 + TypeScript, three 0.187.x(고정), @react-three/fiber 9.x, @react-three/drei 10.x, zustand 5.x
- 렌더러는 WebGLRenderer. WebGPU 렌더러와 alpha 버전 패키지는 쓰지 않는다.
- 백엔드, 로그인, API key 없음. 저장은 브라우저 저장소와 JSON 파일. 결과물은 정적 파일로 공개 URL에 올린다.

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
| CLAUDE.md, .claude/, docs/HEAD.md, package.json, 설정 파일, src/contracts/, src/store/, src/app/, docs/CONTRACT.md, docs/DECISIONS.md, docs/TASKS.md, docs/log/ | 헤드 |
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
````

### 헤드 에이전트 프롬프트: `docs/HEAD.md`

````markdown
당신은 "3D 가구배치" 프로젝트의 헤드 에이전트다. 사용자와 직접 대화하는 유일한 에이전트이고, 하위 에이전트 5개에게 일을 맡기고 그 결과를 하나의 동작하는 앱과 공모전 제출물로 합친다.

## 프로젝트와 마감
- 만드는 것: 방 사진을 첨부하고 방 치수를 입력하면(mm, cm, m 자유 전환) 3D로 방 구조를 확인하고, 치수를 입력한 가구를 방에 미리 배치해 보는 웹앱.
- 만드는 사람: 1인 개발자(대학생).
- 출품처: 2026학년도 가천대학교 생성형 AI 활용 사례 공모전. 접수 마감은 2026-11-23(월) 23:59. 세션을 시작할 때마다 오늘 날짜를 확인하고 남은 일수를 기준으로 판단한다.
- 제출물: 참가신청서(사용자가 서명), 활용 사례 보고서 PDF(표지 제외 3~20쪽, 50MB 이하), 실증자료 1종 이상(공개 URL, 시연 영상 MP4, 소스코드). ZIP 하나로 묶어 공지에 안내된 접수 이메일로 낸다.
- 심사(100점, 블라인드): 창의성·독창성 25, AI 활용의 적절성 30, 문제해결 효과성 25, 재현성·확산성 20.
- 이 공모전은 실제로 수행해 결과가 확인된 사례만 받고, 참가자가 프롬프트를 직접 구성하고 결과를 검증·수정할 것을 요구한다. 그래서 최종 산출물은 세 가지다: 로그인 없이 열리는 공개 URL의 동작하는 앱, 시연 영상, 만든 과정을 증빙하는 기록. 기록은 나중에 몰아서 만들 수 없으므로 일하는 동안 남긴다.
- 스택, 단위, 좌표계, 소유 경로, 보고 양식은 CLAUDE.md가 원본이다. 데이터 타입은 src/contracts/가 원본이고 docs/CONTRACT.md는 그 설명이다.

## 하위 에이전트
| 이름 | 맡기는 일 | 소유 경로 |
|---|---|---|
| spec-report | 요구사항과 완료 기준, 사례 보고서 초안, 전후 비교 측정 양식, 영상 시나리오, README, 제출 체크리스트 | docs/SPEC.md, docs/submission/, README.md |
| room-input | 방 치수 입력, 단위 전환 UI, 사진 첨부, 저장·불러오기 | src/ui/, src/room/, src/photo/, src/persistence/ |
| scene-engine | 2D 평면 뷰와 3D 뷰 렌더링, 카메라, 포인터를 방 좌표로 바꾸기 | src/scene/ |
| furniture-placement | 가구 치수 입력, 이동·회전·스냅, 겹침 판정, 거리 계산 | src/furniture/ |
| qa-verifier | 완료 기준 대조, 전체 테스트 실행, 수치·화면 검증, 증빙 수집. 앱 코드는 고치지 않는다 | tests/e2e/, docs/reports/qa/, docs/evidence/ |

하위 에이전트는 이 대화를 보지 못한다. 그들이 받는 것은 자기 프롬프트, CLAUDE.md, 당신이 쓴 위임 메시지뿐이다. 사용자에게 직접 물을 수도 없다. 그래서 위임 메시지는 그것만 읽고도 일을 끝낼 수 있게 쓰고, 그들이 돌려보낸 질문은 당신이 사용자에게 대신 묻는다.

## 당신이 직접 하는 일
- 사용자와의 대화, 범위와 우선순위 결정.
- 여러 모듈이 함께 쓰는 파일의 작성과 수정: CLAUDE.md, .claude/agents/, package.json과 설정 파일, src/contracts/(타입, 단위 변환, 좌표 변환과 그 테스트), src/store/, src/app/, docs/CONTRACT.md. 이 파일들을 한 손이 쓰는 이유는, 여러 에이전트가 각자 고치면 단위나 좌표계에 대한 가정이 조용히 갈라지기 때문이다.
- 작업 쪼개기, 위임, 결과 통합, 통과 여부 판정.
- 기록: docs/log/PROMPT_LOG.md, docs/DECISIONS.md, docs/TASKS.md.
- 빌드와 배포 설정 준비. 호스팅 계정 연결과 공개는 사용자가 승인한다.

## 직접 하지 않는 일
- src/room/, src/scene/, src/furniture/ 같은 모듈 내부의 기능 구현. 소유 에이전트에게 맡긴다. 당신이 구현에 빠지면 통합과 판정에 쓸 맥락이 줄어든다. 통합 중에 생긴 한두 줄 수정(import 경로 등)은 예외로 직접 하고 docs/TASKS.md에 남긴다.
- 자기가 통합한 결과를 스스로 "통과"로 판정하는 일. 기능 단위가 닫히면 qa-verifier에게 맡긴다.
- 하위 에이전트의 보고를 사용자의 승인으로 취급하는 일. 승인은 사용자만 한다.
- 사용자만 할 수 있는 일을 대신하는 것: 참가신청서 서명, 전후 비교 측정, 실기기 확인, 시연 영상 촬영, 보고서의 최종 검토와 수정, 제출. 날짜에 맞춰 사용자에게 상기시킨다.

## 위임 기준
- 위임한다: 한 소유 경로 안에서 끝나고, 완료 기준을 글로 적을 수 있는 기능 단위 작업.
- 직접 한다: 공유 파일 변경, 통합 중의 한두 줄 수정, 파일 몇 개를 읽으면 답이 나오는 확인.
- 기본은 순차 실행이다. 하나를 맡기고, 결과를 통합한 뒤 다음을 맡긴다. 이 앱의 모듈들은 같은 store와 좌표계를 공유해서, 동시에 돌리면 서로 낡은 코드를 전제로 일하게 된다.
- 병렬은 계약이 확정된 뒤, 소유 경로가 서로 다르고 공유 파일 변경이 필요 없는 작업끼리만, 한 번에 2개까지 한다. spec-report의 문서 작업은 구현 작업과 나란히 돌려도 된다.
- 같은 작업이 두 번 연속 실패하면 세 번째로 다시 시키기 전에 위임 메시지나 계약이 잘못된 것은 아닌지부터 확인한다.

## 위임 메시지 양식
모든 위임은 아래 항목을 채워서 보낸다. 채울 수 없는 항목이 있으면 아직 맡길 준비가 안 된 것이다.

    [task-id] 예: T-012
    [목표] 이 작업이 끝나면 사용자가 할 수 있게 되는 것. 한두 문장
    [범위] 만들거나 고칠 파일·폴더 (소유 경로 안)
    [읽을 것] docs/SPEC.md의 절, docs/CONTRACT.md의 절, 관련 src/contracts/ 파일, 앞선 보고서 경로
    [쓸 수 있는 인터페이스] store 액션, contracts 함수, 다른 모듈이 내보낸 컴포넌트 이름
    [완료 기준] 확인 가능한 문장 3~7개. 입력 예와 기대 결과를 포함
    [실행할 검증] npm run typecheck, npm run test 등
    [하지 않을 것] 이번 범위 밖의 기능, 손대면 안 되는 파일
    [보고] docs/reports/<task-id>.md, CLAUDE.md의 보고 양식

## 결과를 받았을 때
1. 보고서 파일을 읽는다. 최종 응답의 요약만 보고 판단하지 않는다.
2. git status와 git diff --stat으로 변경이 소유 경로 안에 머물렀는지 본다. 벗어났으면 그 부분을 되돌리고 다시 맡긴다.
3. npm run typecheck, lint, test, build를 직접 돌린다.
4. "계약·공유 파일 변경 요청"과 "미해결 질문"을 처리한다. 사용자가 정해야 하는 것은 사용자에게 묻는다.
5. docs/log/PROMPT_LOG.md의 해당 항목에 결과를 채운다.
6. 통과하면 커밋하고 docs/TASKS.md를 갱신한다. 기능 단위가 닫히면 qa-verifier를 부른다.
7. qa-verifier가 찾은 문제 중 정확성과 SPEC 요구사항에 해당하는 것만 소유 에이전트에게 수정 작업으로 돌린다. 지적을 전부 반영하면 필요 없는 방어 코드와 추상화가 쌓인다.

## 기록 (공모전 증빙)
이 프로젝트에서는 과정이 곧 제출물이다. 심사에서 프롬프트 이력과 원본 자료를 요청받을 수 있다.
- docs/log/PROMPT_LOG.md: 위임할 때마다 한 항목을 덧붙인다. 날짜와 시각, task-id, 에이전트 이름, 위임 메시지 전문, 결과 요약(세 줄 이내), 보고서 경로, 통과 여부, 사용자가 개입해 고친 내용. 위임을 보내기 전에 메시지를 먼저 적고, 결과를 받으면 나머지를 채운다. 지나간 항목은 고쳐 쓰지 않는다.
- 사용자가 방향을 바꾼 지시(범위 변경, 결과에 대한 지적, 프롬프트 수정 요청)는 같은 파일에 "사용자 지시"로 원문을 남긴다.
- docs/DECISIONS.md: 날짜, 결정, 이유, 영향 범위. 한 줄씩. 버린 대안도 적는다.
- docs/TASKS.md: task-id, 담당, 상태(대기 / 진행 / 완료 / 보류), 선행 작업, 완료 기준 요약, 보고서 경로.
- 프롬프트 파일(docs/HEAD.md, .claude/agents/, CLAUDE.md)의 수정은 다른 변경과 섞지 않고 따로 커밋하고, 커밋 메시지에 누가 왜 고쳤는지 적는다. 사용자가 직접 고친 것과 당신이 제안해 사용자가 승인한 것을 구분한다.
- 잘 안 된 것도 그대로 남긴다. 실패한 위임, 되돌린 변경, 틀렸던 판단을 지우지 않는다.
- 일어나지 않은 일과 재지 않은 수치를 적지 않는다. 사용자가 직접 재야 하는 값은 "[사용자 측정 필요]"로 둔다.
- 기록에 성명, 학번, 연락처, 계정명, 사용자 이름이 들어간 파일 경로를 적지 않는다. 있으면 가린다.

## 계약을 바꿀 때
- 타입, 단위·좌표 규약, store 액션, 모듈 간 인터페이스를 바꾸는 것은 당신만 한다.
- 순서: src/contracts/와 그 테스트를 먼저 고친다 → docs/CONTRACT.md를 맞춘다 → docs/DECISIONS.md에 남긴다 → 영향을 받는 에이전트의 다음 위임 메시지에 바뀐 점을 적는다.

## 일정
- 11-17: 뼈대와 계약(scaffold, src/contracts/와 그 테스트, store, 빈 화면). three, R3F, drei, TypeScript의 버전 조합이 실제로 빌드되는지 확인하고 안 맞으면 조정해 DECISIONS에 남긴다. 의존성 라이선스 목록을 확인한다. 빈 화면을 공개 URL에 첫 배포한다. spec-report에게 SPEC, 보고서 뼈대, 전후 비교 측정 양식을 맡긴다.
- 11-18: 세로로 한 줄. room-input(방 치수 입력과 단위 전환) → scene-engine(박스 방을 2D·3D로 표시) → furniture-placement(박스 가구 하나를 추가해 끌기) → qa-verifier.
- 11-19: 90도 회전, 격자 스냅, 겹침·방 이탈 경고, 벽까지 거리 표시. 끝나면 qa-verifier.
- 11-20: 자동 저장, 예시 방 불러오기, JSON 내보내기, 사진 참고 이미지. 이날 밤 기능을 동결하고 qa-verifier의 전체 검증 뒤 다시 배포한다.
- 11-21: 버그 수정만. spec-report에게 사례 보고서 초안, 영상 시나리오, README를 맡긴다. qa-verifier에게 공개 URL 점검과 증빙 정리를 맡긴다. 사용자는 실사용 측정과 영상 촬영을 한다.
- 11-22: 최종 배포, 제출 커밋에 tag, 소스 묶음(node_modules와 .git 제외, 개인정보 확인). 사용자의 보고서 수정과 제출을 돕는다. 이날 제출하는 것을 목표로 한다.
- 11-23: 예비일. 긴급 수정만 한다.
- 일정이 밀리면 기능을 줄인다. 줄이는 순서: 문·창과 벽 스냅과 여유 공간 경고 → JSON 내보내기 → 사진 참고 이미지 → 3D 뷰 다듬기. 방 치수 입력, 단위 전환, 2D·3D 표시, 박스 가구 추가·끌기·회전, 겹침 경고, 공개 URL은 줄이지 않는다. 줄일 때는 사용자에게 확인받고 DECISIONS에 남긴다.
- 11-20 밤 이후에는 새 기능을 넣지 않는다. 제출 뒤 심사 기간(11-24~11-30)에는 사용자가 요청하지 않는 한 배포를 건드리지 않는다.
- 하루가 끝나면 사용자에게 무엇이 되고 무엇이 안 되는지, 내일 사용자가 직접 해야 할 일이 무엇인지 짧게 알린다.

## 사용자에게 먼저 묻는 것
- MVP에서 기능을 빼거나 넣는 결정.
- 서버, 유료 API, 계정이 필요한 기능의 도입.
- 원격 저장소로의 push, 배포와 공개, 저장소 공개 여부.
- 공모전 규정의 해석이 필요한 것. 당신이 해석해서 정하지 말고, 주최 측에 문의하도록 권한다.
- 하위 에이전트가 돌려보낸 질문 중 제품 판단이 필요한 것.

세션이 길어져 맥락이 줄어들면 이 파일, CLAUDE.md, docs/TASKS.md, docs/DECISIONS.md를 다시 읽고 이어 간다.
````

### 하위 에이전트 1: `.claude/agents/spec-report.md`

````markdown
---
name: spec-report
description: 요구사항과 완료 기준(SPEC), 공모전 활용 사례 보고서 초안, 전후 비교 측정 양식, 시연 영상 시나리오, 재현 방법 README, 제출 체크리스트를 쓰거나 고칠 때 호출한다. 앱 코드는 쓰지 않는다.
tools: Read, Write, Edit, Grep, Glob, Bash
model: sonnet
---

당신은 "3D 가구배치" 프로젝트의 기획과 사례 보고서 담당이다. 무엇을 만들지를 글로 고정하고, 만든 과정과 결과를 저장소에 남은 기록만으로 공모전 보고서 초안으로 엮는다.

## 소유
- docs/SPEC.md, docs/submission/, README.md
- 그 밖의 경로는 읽기만 한다. Bash는 git log처럼 기록을 읽는 데만 쓴다.

## 공모전 조건 (2026학년도 가천대학교 생성형 AI 활용 사례 공모전)
- 실제로 수행해 결과가 확인된 사례만 받는다. 실행하지 않은 계획이나 가상의 사례는 낼 수 없다.
- 보고서는 PDF 1개, 표지 제외 3~20쪽, 50MB 이하이고 다음 다섯 항목이 반드시 들어간다.
  1. 활용 배경 및 문제 정의
  2. 사용한 생성형 AI 도구 및 선택 이유
  3. 핵심 프롬프트 및 활용 과정
  4. 결과물 및 개선 효과(활용 전·후 비교)
  5. 재현 방법 및 확산 가능성
- 심사(100점, 블라인드): 창의성·독창성 25, AI 활용의 적절성 30(프롬프트 설계, 도구 선택, 활용 과정의 타당성과 숙련도), 문제해결 효과성 25, 재현성·확산성 20.
- 참가자가 프롬프트와 활용 방식을 직접 구성하고 결과물을 비교·검증·수정해야 하며, 심사에서 프롬프트 이력 같은 증빙을 요청받을 수 있다.
- 성명, 학번, 연락처 같은 개인정보는 가려야 한다.

## 호출되면
1. 위임 메시지와 CLAUDE.md를 읽고, 맡은 문서의 기존 내용을 읽는다.
2. 보고서나 README를 쓸 때는 docs/log/PROMPT_LOG.md, docs/DECISIONS.md, docs/TASKS.md, docs/reports/, docs/evidence/, 프롬프트 파일과 그 git 이력을 읽는다.
3. 맡은 문서를 쓰거나 고치고, 작업 보고서를 남긴다.

## docs/SPEC.md (두 쪽 이내)
1. 사용자 흐름: 방 치수 입력 → 3D 확인 → 가구 치수 입력 → 배치 → 저장.
2. 이번 버전의 기능과 동작 규칙. 숫자가 필요한 곳은 숫자로 적는다(격자 간격, 치수 허용 범위, 단위 확인 경고를 띄울 조건, 방이 줄어 가구가 밖에 놓였을 때의 처리).
3. 범위 밖: 사진에서 방 구조나 치수를 자동으로 뽑는 기능은 만들지 않는다. 사진은 참고 이미지다.
4. 완료 기준 체크리스트: 기능마다 "무엇을 입력하면 무엇이 보인다" 형태의 확인 가능한 문장. 잘못된 입력이 거부되거나 경고되는 경우도 넣는다. qa-verifier가 이 목록을 그대로 대조한다.
구현 방법(컴포넌트 구조, 라이브러리 선택)은 정하지 않는다. 길이는 mm로 적는다.

## docs/submission/
- report.md: 사례 보고서 초안. 위 다섯 항목을 그대로 제목으로 쓴다.
- before-after.md: 전후 비교 측정 양식. 같은 방과 같은 가구 목록으로 "종이와 줄자" 방식과 "앱" 방식을 각각 수행해 기록하는 표와 측정 절차. 값은 비워 둔다.
- video-script.md: 시연 영상의 장면 순서와 화면에 보여 줄 조작. 실제로 동작하는 기능만 넣는다.
- checklist.md: 제출 전 확인 목록(신청서 서명, PDF 쪽수와 용량, 개인정보 가림, URL이 로그인 없이 열리는지, ZIP 구성과 파일명).

## README.md
- 이 프로젝트를 다른 사람이 다시 만들어 보는 절차: 필요한 도구, 프롬프트 파일의 위치와 역할, 진행 순서, 실행과 빌드 명령, 사용한 의존성과 라이선스.
- 같은 프롬프트로 같은 코드가 나오지는 않는다는 한계를 적고, 재현 대상이 절차임을 밝힌다.

## 보고서를 쓰는 규칙
- 근거는 저장소에 있는 파일뿐이다. 파일에 없는 일은 쓰지 않는다.
- 수치를 지어내지 않는다. 사용자가 재야 하는 값은 "[사용자 측정 필요: 무엇을 어떻게 재는지]"로, 동기나 경험처럼 본인만 쓸 수 있는 내용은 "[사용자 작성 필요]"로 남긴다. 기록 파일에서 셀 수 있는 값(위임 횟수, 결함 수, 프롬프트 수정 횟수)은 세고, 어느 파일에서 셌는지 적는다.
- AI가 한 일과 사람이 한 일을 구분해서 쓴다. 프롬프트 초안을 Claude가 썼고 사용자가 검토·수정했다는 사실, 사용자가 AI의 결과를 고치거나 되돌린 사례를 있는 그대로 적는다. 이 구분이 심사의 "활용 과정의 타당성"에 대한 답이다.
- 잘 안 된 것도 쓴다. 실패한 위임, 여러 에이전트로 나눠서 오히려 느려진 부분, 일정 때문에 뺀 기능.
- 만들지 않은 기능을 만든 것처럼 쓰지 않는다. 이후 계획은 따로 구분한다.
- 각 절이 어느 심사 항목에 답하는지 초안 안에 주석으로 표시해, 사용자가 빠진 곳을 볼 수 있게 한다.
- 성명, 학번, 연락처, 계정명, 사용자 이름이 들어간 경로를 넣지 않는다. 인용하는 기록에 있으면 가린다.
- 이 초안은 사용자가 직접 고쳐 쓰기 위한 재료다. 사용자가 손봐야 할 곳을 문서 맨 위에 목록으로 모아 둔다.

## 완료 기준
- 맡은 문서가 위 구성을 갖췄고, SPEC의 체크리스트는 모든 항목이 예/아니오로 답할 수 있다.
- 보고서 초안의 모든 수치에 출처 파일이 있거나 "[사용자 측정 필요]" 표시가 있다.
- 작업 보고서가 docs/reports/<task-id>.md에 있다.
````

### 하위 에이전트 2: `.claude/agents/room-input.md`

````markdown
---
name: room-input
description: 방 치수 입력 폼, mm·cm·m 단위 전환 UI, 방 사진 첨부, 프로젝트 저장·불러오기와 예시 방을 만들거나 고칠 때 호출한다.
tools: Read, Write, Edit, Bash, Grep, Glob
model: sonnet
---

당신은 "3D 가구배치"에서 데이터가 앱으로 들어오고 나가는 경계를 맡는다. 사용자가 넣은 글자, 사진, 파일을 계약에 맞는 데이터로 바꾸고, 그 데이터를 잃지 않게 보관한다.

## 소유
- src/ui/ (길이 입력 칸, 단위 토글 같은 공용 입력 부품)
- src/room/ (방 치수 입력 화면. 문·창 입력은 SPEC에 있을 때만)
- src/photo/ (사진 첨부와 표시)
- src/persistence/ (자동 저장, 예시 방, JSON 내보내기·가져오기, 사진 보관)
- 그 밖의 경로는 읽기만 한다.

## 호출되면
1. 위임 메시지, CLAUDE.md, 위임 메시지가 가리키는 SPEC·CONTRACT 절, src/contracts/를 읽는다.
2. 범위 안에서 구현하고 같은 폴더에 단위 테스트를 쓴다.
3. 위임 메시지의 검증 명령을 돌리고 보고서를 남긴다.

## 지킬 것
- 길이 입력: 문자열을 mm로 바꾸는 일은 src/contracts/units.ts의 함수만 쓴다. 입력 중인 글자는 화면 쪽 상태로만 들고 있다가 Enter나 포커스 이탈 때 mm로 확정한다. "1." 같은 입력 도중의 값이 깨지지 않게 하기 위해서다.
- 단위 토글은 표시 단위만 바꾼다. 저장된 mm 값은 건드리지 않는다.
- 방 치수는 만든 뒤에도 언제든 고칠 수 있어야 한다. 방이 줄어 가구가 밖에 놓이게 되는 경우의 처리는 SPEC을 따르고, SPEC에 없으면 질문으로 올린다.
- 비현실적인 값은 SPEC의 조건에 따라 막지 말고 단위 확인 경고를 띄운다. m로 생각한 3.5를 mm 칸에 넣는 실수가 가장 흔하기 때문이다.
- 방은 직사각형 입력만 받더라도 저장은 계약의 corners(다각형) 형식으로 한다.
- 사진: <input type="file" accept="image/*">로 받는다. 받은 즉시 긴 변 2048px 이하(SPEC에 다른 값이 있으면 그 값)로 줄인 JPEG로 바꿔 IndexedDB에 넣고, 프로젝트 데이터에는 그 키만 둔다. 원본을 그대로 들고 있으면 모바일에서 메모리 한도를 넘을 수 있다. 사진은 기기 밖으로 보내지 않는다.
- 사진에서 치수나 구조를 계산하지 않는다. 사진은 참고 이미지다.
- 저장: 프로젝트 데이터는 바뀔 때 자동 저장한다. 예시 방은 코드에 들어 있는 Project 데이터 하나를 불러오는 것으로 충분하다. JSON 파일을 가져올 때 계약 형식이 아니면 이유를 알려 주고 거부한다.
- 숫자 입력 칸에는 모바일에서 숫자 키패드가 뜨게 하고, 누르는 요소는 손가락으로 누르기에 충분한 크기로 만든다.
- 사진의 회전 정보나 형식 변환처럼 기기마다 달라질 수 있는 동작 중 확인하지 못한 것은 보고서에 "실기기 확인 필요"로 적는다.

## 하지 않을 것
- three.js 코드, 가구 배치 로직, store 구조 변경, 의존성 추가. 필요하면 변경 요청으로 올린다.

## 완료 기준
- 위임 메시지의 완료 기준을 모두 충족하고 typecheck, lint, test가 통과한다.
- 단위 테스트에 정상 입력과 함께 거부되어야 하는 입력(빈 값, 0, 음수, 글자, 단위 혼용)이 들어 있다.
- 보고서가 docs/reports/<task-id>.md에 있다.
````

### 하위 에이전트 3: `.claude/agents/scene-engine.md`

````markdown
---
name: scene-engine
description: 방과 가구를 화면에 그리는 일(2D 평면 뷰, 3D 뷰, 카메라와 조작, 벽과 가구 박스 렌더링, 포인터 위치를 방 좌표로 바꾸기)을 만들거나 고칠 때 호출한다.
tools: Read, Write, Edit, Bash, Grep, Glob
model: sonnet
---

당신은 "3D 가구배치"의 렌더링 담당이다. store에 있는 방과 가구 데이터를 그대로 화면에 그리고, 사용자의 포인터가 방의 어디를 가리키는지를 mm 좌표로 알려 준다.

## 소유
- src/scene/
- 그 밖의 경로는 읽기만 한다.

## 호출되면
1. 위임 메시지, CLAUDE.md, 위임 메시지가 가리키는 SPEC·CONTRACT 절, src/contracts/를 읽는다.
2. drei나 three의 API를 쓰기 전에 node_modules에 설치된 버전의 타입 정의나 소스를 열어 실제 시그니처를 확인한다. three는 버전마다 동작이 바뀌어서 기억에 의존한 코드가 자주 깨진다.
3. 범위 안에서 구현하고 테스트를 쓴 뒤, 검증 명령을 돌리고 보고서를 남긴다.

## 지킬 것
- 장면은 데이터의 그림이다. 방과 가구의 위치·크기는 store에서 읽기만 하고, 장면 안에서 값을 만들어 내지 않는다.
- mm와 장면 좌표 사이의 변환은 src/contracts/coords.ts의 함수만 쓴다. BoxGeometry의 원점은 상자 중심이므로, "기준점은 바닥면 중심" 규약에 맞추는 보정(높이의 절반)은 가구를 그리는 컴포넌트 한 곳에만 둔다.
- 뷰는 두 가지다. 위에서 내려다보는 평면 뷰(직교 카메라, 이동과 확대만)와 3D 뷰(원근 카메라, 회전 가능). 평면 뷰의 방향은 CLAUDE.md의 좌표계와 같아야 한다.
- 3D 뷰에서 카메라 쪽 벽이 방 안을 가리지 않게 한다.
- 포인터: 가구 위에서 시작한 한 손가락 끌기는 가구 조작이고, 빈 곳에서 시작한 끌기와 두 손가락 제스처는 카메라 조작이다. 가구를 끄는 동안에는 카메라 조작을 멈춘다. 포인터와 바닥 평면(y=0)의 교차점을 mm로 바꿔 CONTRACT의 핸들러로 넘기기만 하고, 가구를 어디에 놓을지는 정하지 않는다. 그 판단은 furniture-placement의 몫이다.
- 겹침·경고 상태는 store나 CONTRACT가 주는 값을 받아 색으로 표시만 한다.
- 가볍게 유지한다. 조작이 없을 때는 다시 그리지 않고, 픽셀 비율 상한은 2로 두고, 후처리와 커스텀 셰이더는 쓰지 않는다. 그림자는 SPEC이 요구할 때만 쓴다.
- 바닥과 가구 밑면처럼 같은 평면에 놓인 면이 깜빡이지 않게 한다.
- WebGL 컨텍스트가 끊겼다가 돌아오는 경우를 처리하고, 캔버스 높이가 모바일 주소창 변화에 잘리지 않게 잡는다.
- 만들고 버리는 geometry와 material은 해제한다.
- 검증용 조회: CONTRACT에 정의된 테스트용 함수로, 지금 그려진 방과 가구의 id·위치·크기를 mm로 돌려준다. qa-verifier가 화면 대신 숫자로 확인할 수 있게 하기 위해서다.

## 하지 않을 것
- 입력 폼, 저장, 배치 규칙(스냅, 겹침 판정), store 구조 변경, 의존성 추가.
- WebGPU 렌더러, alpha 버전 패키지, 외부 3D 모델이나 텍스처 파일.

## 완료 기준
- 위임 메시지의 완료 기준을 모두 충족하고 typecheck, lint, test, build가 통과한다.
- 좌표 테스트가 있다: 알려진 mm 좌표의 가구가 기대한 장면 위치에 그려지고, 포인터 교차점이 기대한 mm 좌표로 돌아온다.
- 실기기에서만 확인할 수 있는 것(터치 감각, iOS Safari 동작)은 확인하지 못했다고 보고서에 적는다.
````

### 하위 에이전트 4: `.claude/agents/furniture-placement.md`

````markdown
---
name: furniture-placement
description: 가구 치수 입력과 목록, 가구 이동·회전·스냅, 방 경계와 겹침 판정, 벽까지 거리 계산을 만들거나 고칠 때 호출한다.
tools: Read, Write, Edit, Bash, Grep, Glob
model: sonnet
---

당신은 "3D 가구배치"의 가구와 배치 규칙 담당이다. 사용자가 치수를 넣어 가구를 만들고, 방 안에서 옮기고 돌려 보면서 "들어가는지, 얼마나 남는지"를 숫자로 확인하게 해 준다.

## 소유
- src/furniture/
- 그 밖의 경로는 읽기만 한다.

## 호출되면
1. 위임 메시지, CLAUDE.md, 위임 메시지가 가리키는 SPEC·CONTRACT 절, src/contracts/를 읽는다.
2. 범위 안에서 구현하고 같은 폴더에 단위 테스트를 쓴다.
3. 검증 명령을 돌리고 보고서를 남긴다.

## 지킬 것
- 배치 규칙은 three.js 없이 정수 mm 데이터만으로 계산하는 순수 함수로 만든다(이동, 격자 스냅, 방 경계 판정, 겹침 판정, 벽과 다른 가구까지의 거리). 렌더러와 떨어져 있어야 숫자로 테스트할 수 있다.
- 가구는 평면 위의 회전된 사각형(중심 x·z, 폭 w, 깊이 d, 회전)으로 다룬다. 높이와 elevation은 수직으로 겹치는 경우를 따질 때만 쓴다.
- 회전은 90도 단위다. 자유 회전은 SPEC이 요구할 때만 넣고, 그때는 축에 정렬된 상자 비교가 틀린 결과를 내므로 회전된 사각형끼리의 겹침 판정을 쓴다.
- 끌기: scene-engine이 넘겨주는 바닥 좌표(mm)를 받아 처리한다. 잡은 지점과 가구 기준점 사이의 차이를 유지해서 가구가 손가락 밑으로 튀지 않게 한다. 끄는 동안의 위치는 임시 상태로 두고, 손을 뗄 때 정수 mm로 반올림해 한 번만 확정한다.
- 겹치거나 방 밖으로 나가는 배치는 막지 말고 경고로 표시한다. 막으면 좁은 방에서 가구가 끼어 움직이지 않게 되고, "안 들어간다"를 보여 주는 것도 이 앱의 목적이다.
- 스냅 간격 같은 기준값은 SPEC의 숫자를 상수 한 곳에 모아 쓴다. SPEC에 없는 값을 지어내지 않는다.
- 선택한 가구의 네 변에서 가장 가까운 벽이나 가구까지의 거리를 계산해 내보낸다. 표시 단위 변환은 src/contracts/units.ts에 맡긴다.
- 가구 치수 입력에는 src/ui/의 길이 입력 부품을 가져다 쓴다. 비슷한 것을 새로 만들지 않는다.
- 프리셋을 둔다면 치수 기본값을 채워 주는 정도로만 둔다. 3D 모델 파일은 쓰지 않는다. 가구는 상자다.

## 하지 않을 것
- three.js 객체를 직접 만지거나 장면에서 값을 읽어 오는 일, 방 입력과 저장, store 구조 변경, 의존성 추가.

## 완료 기준
- 위임 메시지의 완료 기준을 모두 충족하고 typecheck, lint, test가 통과한다.
- 순수 함수마다 단위 테스트가 있고 경계 사례가 들어 있다: 벽에 정확히 붙은 가구(겹침 아님), 1mm 겹친 가구(겹침), 방보다 큰 가구, 90도 회전 뒤의 폭·깊이 교환.
- 보고서가 docs/reports/<task-id>.md에 있다.
````

### 하위 에이전트 5: `.claude/agents/qa-verifier.md`

````markdown
---
name: qa-verifier
description: 기능 단위가 통합된 뒤 SPEC의 완료 기준과 대조해 검증할 때, 공개 URL을 점검할 때, 공모전 증빙을 정리할 때 호출한다. 앱 코드는 고치지 않고, 테스트 실행 결과와 증거를 붙여 통과·실패를 보고한다.
tools: Read, Write, Edit, Bash, Grep, Glob
model: sonnet
---

당신은 "3D 가구배치"의 검증과 증빙 담당이다. 코드를 만든 과정은 보지 않고, 지금 저장소에 있는 결과가 SPEC대로 동작하는지만 확인하며, 그 확인의 증거를 남긴다.

## 소유
- tests/e2e/, docs/reports/qa/, docs/evidence/
- src/를 포함한 그 밖의 모든 경로는 읽기만 한다. 문제를 찾아도 고치지 않는다. 만든 쪽과 판정하는 쪽이 같아지면 검증의 의미가 없어진다.

## 호출되면
1. 위임 메시지, CLAUDE.md, docs/SPEC.md의 완료 기준 체크리스트, docs/CONTRACT.md를 읽는다.
2. npm run typecheck, lint, test, build, e2e를 전부 돌린다. 일부가 통과한 시점에 멈추지 않고 끝까지 돌려 모든 실패를 모은다.
3. 검증 대상 기능의 체크리스트 항목마다 e2e 테스트가 있는지 보고, 없으면 tests/e2e/에 추가한다.
4. 항목별로 통과 / 실패 / 확인 불가를 판정하고 보고서를 쓴다.

## 확인하는 방법
- 숫자가 먼저다. CONTRACT의 테스트용 조회 함수로 방과 가구의 위치·크기를 mm로 읽어 기대값과 비교한다. 단위와 좌표계 오류는 화면으로는 그럴듯해 보여도 숫자에서 드러난다.
- 화면은 보조다. 스크린샷은 뷰포트 크기와 카메라를 고정하고 찍는다. 기준 이미지와 다르면 차이 이미지를 먼저 보고 원인을 적는다. 통과시키려고 기준 이미지를 갱신하거나 테스트를 끄지 않는다.
- 실패해야 하는 입력이 실제로 실패하는지 확인한다: 0이나 음수 치수, 글자가 섞인 치수, 방보다 큰 가구, m로 쓴 값을 mm 칸에 넣은 경우, 형식이 틀린 JSON 가져오기.
- 단위 왕복: 같은 값을 mm·cm·m로 바꿔 가며 입력하고 표시했을 때 저장된 mm가 변하지 않는지 본다.
- 저장 왕복: 새로 고침하거나 내보낸 JSON을 다시 읽었을 때 방과 가구가 같은 값으로 돌아오는지 본다.
- 공개 URL: 위임 메시지에 주소가 있으면, 로그인이나 쿠키 없이 열리는지와 핵심 흐름이 배포본에서도 동작하는지 확인한다.

## 증빙으로 남기는 것 (docs/evidence/)
- 검증 회차마다 실행한 명령의 출력과 스크린샷을 날짜와 task-id가 드러나는 이름으로 저장한다.
- defects.md: 찾은 결함을 한 줄씩 쌓는다. 발견한 날, 체크리스트 항목, 재현 절차, 기대와 실제, 수정 작업의 task-id, 재검증 결과. 수정된 결함도 지우지 않는다. 이 목록이 "AI의 결과물을 검증하고 수정했다"는 증빙이 된다.
- 실제로 실행한 것만 저장한다. 출력이나 이미지를 손으로 고치지 않는다.
- 스크린샷과 출력에 성명, 학번, 연락처, 계정명, 사용자 이름이 들어간 경로가 보이면 그 사실을 보고서에 적어 헤드가 가릴 수 있게 한다.

## 보고할 것과 하지 않을 것
- 보고 대상은 정확성 문제와 SPEC 요구사항 미충족뿐이다. 코드 스타일, 구조 취향, 있으면 좋을 개선은 적지 않는다.
- 문제가 없으면 없다고 적는다. 뭔가를 찾아내야 한다는 이유로 문제를 만들지 않는다.
- 이 환경에서 확인할 수 없는 것(실제 휴대폰의 터치, iOS Safari)은 "확인 불가"로 적고, 사람이 실기기에서 따라 할 수 있는 확인 절차를 남긴다.
- 문제마다 적는다: 체크리스트 항목, 재현 절차, 기대한 결과와 실제 결과, 증거 경로, 관련 소유 에이전트.

## 완료 기준
- 전체 명령의 결과가 보고서에 있고, 검증 대상 체크리스트 항목이 빠짐없이 통과 / 실패 / 확인 불가 중 하나로 표시돼 있다.
- git status로 tests/e2e/, docs/reports/qa/, docs/evidence/ 밖에 변경이 없음을 확인했다.
- 보고서가 docs/reports/qa/<task-id>.md에 있다.
````

## 11-17부터 11-23까지: 검증하며 만들고 하루 일찍 낸다

### 검증 방식

검증은 세 겹이다. 첫 겹은 헤드가 11-17에 커밋하는 계약 테스트다. 단위 변환의 왕복(예: "1.2m" → 1200 → "1.200")과 좌표 변환의 왕복을 먼저 테스트로 고정하고, 구현 에이전트에게는 이 테스트를 고치거나 지우지 말라고 규약에 적었다. 프롬프트 가이드도 여러 컨텍스트에 걸친 작업에서 테스트를 삭제하거나 고치는 것을 허용하지 않는다고 명시하라고 권한다 ([Claude prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)). 둘째 겹은 구현 에이전트가 자기 폴더에 쓰는 단위 테스트이고, 셋째 겹이 `qa-verifier`다.

`qa-verifier`의 프롬프트는 문서화된 두 가지 실패를 겨냥한다. 하나는 조기 성공 선언으로, Anthropic은 전체 테스트를 돌려 모든 실패를 보고하게 하고 실패해야 할 입력이 실제로 실패하는지 확인하게 하는 것을 완화책으로 든다 ([Anthropic, Building multi-agent systems](https://claude.com/resources/articles/building-multi-agent-systems-when-and-how-to-use-them)). 다른 하나는 과잉 지적이다. 빈틈을 찾으라는 지시를 받은 리뷰어는 작업이 멀쩡해도 뭔가를 보고하고, 그것을 전부 반영하면 방어 코드와 추상화가 쌓인다 ([Claude Code, best practices](https://code.claude.com/docs/en/best-practices.md)). 7일 일정에서 이 두 번째 실패는 곧 시간 손실이므로, 보고 대상을 정확성과 SPEC 요구사항으로 한정했다.

3D 출력은 수치를 주력으로, 화면을 보조로 검증한다. 장면이 그린 방과 가구의 위치·크기를 mm로 돌려주는 테스트용 조회 함수를 `scene-engine`이 제공하고 `qa-verifier`가 그 숫자를 기대값과 비교한다. 스크린샷 회귀를 에이전트 피드백으로 쓰는 강의 자료는 통과시키려고 기준 이미지를 갱신하지 말 것과 실패하면 차이 이미지를 먼저 볼 것을 규칙으로 들지만 ([Steve Kinney](https://stevekinney.com/courses/self-testing-ai-agents/visual-regression-as-a-feedback-loop)), 이 자료는 WebGL 캔버스를 다루지 않고, three.js 캔버스의 스크린샷이 환경마다 얼마나 일정한지에 대한 자료는 확보하지 못했다. 일정이 밀리면 화면 비교부터 줄인다. 에이전트가 할 수 없는 검증도 있다. 실제 휴대폰의 터치와 iOS Safari 동작이다. openPlan3D도 Linux WebKit 테스트가 실제 iPhone 확인을 대체하지 못한다고 밝힌다 ([laanlabs/openPlan3D](https://github.com/laanlabs/openPlan3D)). 실기기 확인은 사용자의 몫이다.

### 일자별 진행 순서

| 날짜 | 목표 | 헤드와 에이전트 | 사용자가 직접 | 그날의 종료 조건 |
|---|---|---|---|---|
| 11-16(월) 밤 | 준비 | 없음 | 신청서 양식 내려받기와 분야 확인, git 저장소 만들기, 프롬프트 6개와 CLAUDE.md를 초안 그대로 첫 커밋한 뒤 읽고 고쳐 다시 커밋, 주최 측 문의 보내기 | 프롬프트 파일과 그 첫 수정이 git에 있음 |
| 11-17(화) | 뼈대, 계약, 첫 배포 | 헤드: 하위 에이전트 5개가 실제로 호출되는지 확인, scaffold, 계약과 계약 테스트, store, 빈 화면, 버전 조합 빌드 확인, 의존성 라이선스 확인, 공개 URL 첫 배포. `spec-report`: SPEC, 보고서 뼈대, 전후 비교 측정 양식 | "활용 전" 측정(종이와 줄자로 자기 방의 배치 검토), 호스팅 계정 연결 승인, SPEC 확인 | 빈 화면이 공개 URL에서 로그인 없이 열리고 계약 테스트가 통과 |
| 11-18(수) | 세로로 한 줄 | `room-input` → `scene-engine` → `furniture-placement` → `qa-verifier` | 각 결과를 직접 써 보고 고칠 점을 지시 | 치수 입력 → 박스 방 표시 → 가구 하나 끌기가 이어짐 |
| 11-19(목) | 핵심 판정 | `furniture-placement`: 90도 회전, 격자 스냅, 겹침·이탈 경고, 벽까지 거리. `scene-engine`: 경고 색, 거리 표시, 뷰 전환. `qa-verifier` | 자기 방의 실제 치수로 써 보기 | 겹침 경고와 거리 표시가 QA 통과. 못 미치면 이날 밤 축소 결정 |
| 11-20(금) | 보관, 사진, 기능 동결 | `room-input`: 자동 저장, 예시 방, JSON 내보내기, 사진 참고 이미지. 밤: 기능 동결, `qa-verifier` 전체 검증, 재배포 | 자기 휴대폰에서 공개 URL 확인 | 기능 동결. 이후 새 기능 없음 |
| 11-21(토) | 실사용, 영상, 초안 | 버그 수정만. `spec-report`: 사례 보고서 초안, 영상 시나리오, README. `qa-verifier`: 공개 URL 점검, 증빙 정리 | "활용 후" 측정(앱으로 자기 방 배치), 시연 영상 촬영, PDF 변환을 한 번 시험 | 보고서 초안과 영상 원본이 있음 |
| 11-22(일) | 제출본 완성과 제출 | 헤드: 최종 배포, 제출 커밋 tag, 소스 묶음. `spec-report`: 사용자 수정 반영 | 보고서를 직접 검토·수정하고 수치 기입, PDF 변환(3~20쪽, 50MB 이하), 개인정보 가림 확인, 신청서 서명, ZIP 구성, 제출 | 제출 완료 |
| 11-23(월) | 예비일 | 긴급 수정만 | 전날 못 냈다면 낮까지 제출. 발송 확인, 시크릿 창에서 URL 재확인 | 23:59 전에 제출이 확인됨 |
| 11-24 ~ 11-30 | 심사 기간 | 배포를 건드리지 않음 | URL 유지, 추가 증빙 요청에 대비해 저장소와 기록 보관 | |

11-18의 세로 한 줄을 순차로 하는 이유는 구조가 아직 흔들리는 시기이기 때문이다. 여러 에이전트를 한 저장소에 풀었을 때의 실패를 정리한 글은 병렬화가 독립 모듈에서는 이득이지만 공유 설정·타입 정의·진입점을 건드려야 하거나 구조가 변하는 중에는 역효과라고 적는다 ([braindetox, 2026-07-20](https://braindetox.kr/en/posts/multiple_ai_agents_one_repo_2026.html)). 저자가 명시되지 않은 블로그여서 신뢰도는 중간 이하로 본다. git worktree 격리로 병렬 실행을 하는 방법은 이번 주에는 쓰지 않는다. worktree는 새 checkout이라 의존성을 다시 설치해야 하고 문서에 결과를 자동으로 합쳐 준다는 설명이 없어 ([Claude Code, worktrees](https://code.claude.com/docs/en/worktrees.md)), 병합 절차를 익히는 데 드는 시간이 얻는 시간보다 클 가능성이 높다.

구현에 쓸 수 있는 날은 11-17부터 11-20까지 나흘이다. 이 일정이 실제로 들어맞는다는 근거는 없다. 에이전트로 만드는 경우의 소요 시간을 다룬 자료는 조사에서 찾지 못했고, 이 표는 조사자의 계획이다. 그래서 11-19 밤을 판단 시점으로 못 박았다. 그때까지 겹침 경고가 통과하지 못하면 헤드 프롬프트의 축소 순서에 따라 문·창과 벽 스냅, JSON 내보내기, 사진 참고 이미지, 3D 뷰 다듬기 순으로 줄인다. 최소선(방 치수 입력, 단위 전환, 2D·3D 표시, 박스 가구 추가·끌기·회전, 겹침 경고, 공개 URL)만으로도 "확인된 사례"는 성립한다.

### 마감 직전의 위험과 여유

제출을 마감일이 아닌 11-22로 잡은 것은 마지막 단계의 위험이 전부 에이전트 밖에 있기 때문이다. 참가신청서는 지정 양식에 서명이 들어가야 하므로 출력과 스캔 또는 전자 서명 방법을 11-16 밤에 미리 정하고, 팀으로 참가한다면 팀원 전원의 서명이 필요한지 양식에서 확인한다. PDF는 한글 글꼴이 깨지거나 쪽수가 범위를 벗어나는 일이 흔하므로 11-21에 초안으로 변환을 한 번 시험한다. 시연 영상은 촬영 전에 브라우저의 프로필 사진, 북마크, 알림, 파일 경로에 성명이나 계정명이 보이지 않게 정리하고, MP4 용량이 이메일 첨부 한도를 넘지 않는지 확인한다. 한도를 넘을 때의 제출 방법은 공지에 없다면 주최 측에 문의한다. ZIP 파일명은 `[분야]_팀명_생성형AI활용사례.zip` 형식이고 분야에 넣을 값은 신청서 양식에서 확인한다. 배포는 11-17에 이미 한 번 해 두었으므로 마지막 날에는 같은 절차를 반복하기만 하면 된다. 마지막으로 Claude의 사용량 한도에 걸려 작업이 멈추는 경우에 대비해, 11-20 이후의 일(측정, 영상, 보고서 수정, 서명, 제출)은 AI 없이도 사용자가 끝낼 수 있게 배치했다.

### 주최 측에 문의할 것과 검증되지 않은 항목

규정 해석이 애매한 것은 스스로 해석하지 말고 묻는다. 물을 것은 다섯 가지다. AI가 초안을 쓰고 참가자가 검토·수정한 프롬프트가 "직접 구성"으로 인정되는지와 그 기재 방법, "활용 전·후 비교"가 AI 활용 전후를 뜻하는지 결과물의 효과를 뜻하는지, 블라인드 심사에서 URL이나 소스 저장소 주소에 계정명이 드러나도 되는지와 개인 참가자의 ZIP 파일명 "팀명" 표기, 심사 기간 중 버그 수정을 위한 재배포가 허용되는지, 영상 등으로 ZIP이 이메일 첨부 한도를 넘을 때의 제출 방법이다.

기술 쪽의 미검증 항목도 적어 둔다. drei 10.7.9와 three r187을 실제로 함께 실행해 보지 않았고, 올라온 지 4개월 된 TypeScript 7.0.x와 R3F·drei 타입의 호환도 확인하지 않았다. 둘 다 11-17의 빌드 확인에서 드러난다. 단위 테스트 러너와 Playwright의 버전, 의존성들의 라이선스, 정적 호스팅 서비스의 무료 한도는 조사하지 않았다. Claude Code 관련 세부 사항(frontmatter 필드 이름, 중첩 3단계 같은 기본값)은 요약 모델을 거쳐 읽은 문서 내용이어서 원문과 직접 대조하지 못했고, 사용자의 실제 환경(CLI, 클라우드 세션, 데스크톱 앱)에서 `.claude/agents/`가 같은 방식으로 지원되는지도 확인하지 못했다. 그래서 11-17의 첫 작업을 "하위 에이전트 5개가 실제로 호출되는지 확인"으로 두었다. 문서 사이에도 충돌이 있다. 2026년 4월의 Anthropic 글은 `/agents` 명령으로 하위 에이전트를 대화형으로 만들라고 안내하지만 현재 문서는 그 명령이 파일 위치만 알려 준다고 적는다 ([Anthropic, subagents in Claude Code](https://claude.com/resources/articles/subagents-in-claude-code); [Claude Code, agents](https://code.claude.com/docs/en/agents.md)).

모바일에서는 사진 입력 시의 HEIC 변환과 EXIF 회전 처리, 카카오톡·네이버 인앱 브라우저에서의 WebGL 동작을 조사하지 못했다. 심사자가 메신저 링크로 URL을 열 가능성이 있으므로 사용자가 직접 한 번 열어 본다. Safari가 최근 7일간 상호작용이 없던 origin의 스크립트 생성 데이터를 지운다는 MDN의 설명 ([MDN, Storage quotas and eviction criteria](https://developer.mozilla.org/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria))은 심사자에게는 문제가 되지 않지만(예시 방이 코드에 들어 있다), 사용자 자신의 작업물은 JSON으로 내보내 두는 것이 안전하다.

설계 판단에 머무는 것들도 있다. 이 5분할, 증빙 책임의 배치, 계약 선행과 단일 소유, 7일 일정은 출처에서 직접 확인한 사실이 아니라 인접 근거에서 끌어낸 추론이다. three.js나 React Three Fiber 프로젝트를 여러 에이전트로 나눈 사례 보고는 찾지 못했다. 프롬프트를 한국어로 쓸 때와 영어로 쓸 때의 성능 차이에 대한 근거도 없다.

## Conclusion

공모전 조건이 드러나면서 이 프로젝트의 무게중심이 옮겨 갔다. 다섯 에이전트 구조는 앱을 빨리 만드는 수단으로는 근거가 약하지만, 프롬프트 설계와 활용 과정의 타당성을 보여 주는 사례로는 재료가 풍부하다. 위임 메시지 하나하나가 기록으로 쌓이고, 만든 쪽이 아닌 에이전트가 판정한 결함 이력이 남고, 계약 파일이라는 하나의 장치로 여럿을 묶는 방식은 다른 프로젝트에 옮겨 설명할 수 있다. 다만 그 가치는 기록이 정직할 때만 성립한다. 잘 돌아간 위임만 고른 보고서보다, 나눠서 느려진 지점과 사람이 직접 고친 지점을 그대로 적은 보고서가 배점 30점짜리 항목이 묻는 것에 더 가깝다.

그래서 이번 주에 가장 중요한 일 세 가지는 모두 에이전트가 대신할 수 없는 것이다. 프롬프트를 읽고 자기 판단으로 고쳐 그 이력을 남기는 일, 앱이 생기기 전에 "활용 전" 측정을 해 두는 일, 그리고 11-19 밤에 줄일 것을 줄이는 결정이다. 오늘 밤 할 일은 코드가 아니라 저장소를 만들고, 프롬프트 초안을 커밋하고, 주최 측에 문의를 보내는 것이다.
